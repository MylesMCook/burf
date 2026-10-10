// Package desktop keeps the trusted Wails page's native operations finite.
package desktop

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/MylesMCook/burf/app/native/nativebrowser"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/notifications"
)

// Config comes only from main. UI state writes belong to the authenticated
// agent API; the desktop can read its validated snapshot through UIState.
type Config struct {
	Version        string
	StateHome      string
	Interface      any
	UIState        func() (any, error)
	DevtoolsScript string
}

type Service struct {
	config Config
	app    *application.App
	main   *application.WebviewWindow

	browserMu  sync.Mutex
	browsers   *nativebrowser.Manager
	closed     bool
	notifier   *notifications.NotificationService
	notifyErr  error
	linksMu    sync.Mutex
	links      []string
	cliMu      sync.Mutex
	relaunchMu sync.Mutex
	relaunch   string
}

func New(config Config) *Service { return &Service{config: config} }

// Attach is a free function so configuring the trusted window is never bound
// to JavaScript. Only this window receives the command bridge.
func Attach(s *Service, app *application.App, window *application.WebviewWindow) {
	s.app, s.main = app, window
}

func (s *Service) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	s.notifier = notifications.New()
	s.notifyErr = s.notifier.ServiceStartup(ctx, options)
	// Lack of OS notification support does not prevent the app from opening.
	return nil
}

func (s *Service) ServiceShutdown() error {
	s.browserMu.Lock()
	s.closed = true
	browsers := s.browsers
	s.browserMu.Unlock()
	var result error
	if browsers != nil {
		result = browsers.Shutdown()
	}
	if s.notifier != nil && s.notifyErr == nil {
		result = errors.Join(result, s.notifier.ServiceShutdown())
	}
	return result
}

func (s *Service) caller(ctx context.Context) error {
	w, ok := ctx.Value(application.WindowKey).(application.Window)
	if !ok || w == nil || s.main == nil || w.ID() != s.main.ID() {
		return errors.New("desktop commands are only available to the main Burf window")
	}
	return nil
}

func (s *Service) browser() (*nativebrowser.Manager, error) {
	s.browserMu.Lock()
	defer s.browserMu.Unlock()
	if s.closed {
		return nil, errors.New("Burf is closing")
	}
	if s.browsers != nil {
		return s.browsers, nil
	}
	manager, err := nativebrowser.New(nativebrowser.Config{
		Parent:         s.main.NativeWindow(),
		ProfileDir:     filepath.Join(s.config.StateHome, "client", "browser"),
		Emit:           s.emit,
		DispatchSync:   application.InvokeSync,
		DevtoolsScript: s.config.DevtoolsScript,
	})
	if err != nil {
		return nil, err
	}
	s.browsers = manager
	return manager, nil
}

type endpoint struct {
	URL   string `json:"url"`
	Token string `json:"token"`
}

func (s *Service) endpoint() (endpoint, error) {
	path := filepath.Join(s.config.StateHome, "client", "ui-token")
	f, err := os.Open(path)
	if err != nil {
		return endpoint{}, fmt.Errorf("the Burf agent has not started yet (%s: %w)", path, err)
	}
	defer f.Close()
	b, err := io.ReadAll(io.LimitReader(f, 64<<10+1))
	if err != nil || len(b) > 64<<10 {
		return endpoint{}, errors.New("could not read the Burf agent's UI token")
	}
	token := strings.TrimSpace(string(b))
	if token == "" {
		return endpoint{}, errors.New("the Burf agent has not written its UI token yet")
	}
	return endpoint{URL: "http://127.0.0.1:1378", Token: token}, nil
}

// Invoke is the sole application binding. Commands retain their existing
// names and arguments; callers cannot select executables or native windows.
func (s *Service) Invoke(ctx context.Context, command string, args json.RawMessage) (any, error) {
	if err := s.caller(ctx); err != nil {
		return nil, err
	}
	if strings.HasPrefix(command, "browser_") {
		return nil, s.invokeBrowser(ctx, command, args)
	}
	switch command {
	case "start_agent":
		var p struct {
			AtLogin *bool `json:"atLogin"`
		}
		if err := decode(args, &p); err != nil {
			return nil, err
		}
		if p.AtLogin == nil {
			return nil, errors.New("start_agent requires atLogin")
		}
		if *p.AtLogin {
			out, err := runCLI(ctx, "agent", "install")
			if err != nil && runtime.GOOS == "linux" {
				started, startErr := runCLI(ctx, "agent", "start")
				if startErr != nil {
					return nil, startErr
				}
				return started + " It won't start at login: " + err.Error(), nil
			}
			return out, err
		}
		return runCLI(ctx, "agent", "start")
	case "set_window_title":
		var p struct {
			Title string `json:"title"`
		}
		if err := decode(args, &p); err != nil {
			return nil, err
		}
		if len(p.Title) > 512 {
			return nil, errors.New("window title is too long")
		}
		s.main.SetTitle(p.Title)
		return nil, nil
	case "open_url":
		var p struct {
			URL string `json:"url"`
		}
		if err := decode(args, &p); err != nil {
			return nil, err
		}
		if err := externalURL(p.URL); err != nil {
			return nil, err
		}
		return nil, s.app.Browser.OpenURL(p.URL)
	case "send_notification":
		var p struct {
			Title string `json:"title"`
			Body  string `json:"body"`
		}
		if err := decode(args, &p); err != nil {
			return nil, err
		}
		if p.Title == "" || len(p.Title) > 512 || len(p.Body) > 8192 {
			return nil, errors.New("notification title or body is invalid")
		}
		if err := s.notificationReady(); err != nil {
			return nil, err
		}
		return nil, s.notifier.SendNotification(notifications.NotificationOptions{
			ID: fmt.Sprintf("burf-%d", time.Now().UnixNano()), Title: p.Title, Body: p.Body,
		})
	}
	if err := decode(args, &struct{}{}); err != nil {
		return nil, err
	}
	switch command {
	case "ui_endpoint":
		return s.endpoint()
	case "ui_interface":
		return s.config.Interface, nil
	case "ui_state":
		if s.config.UIState == nil {
			return nil, errors.New("UI state snapshot is unavailable")
		}
		return s.config.UIState()
	case "open_devtools":
		s.main.OpenDevTools()
	case "restart_app":
		return nil, s.restart()
	case "open_terminal":
		return nil, openTerminal()
	case "cli_link_status":
		return cliLinkStatus()
	case "install_cli_link":
		s.cliMu.Lock()
		defer s.cliMu.Unlock()
		return installCLILink()
	case "remove_cli_link":
		s.cliMu.Lock()
		defer s.cliMu.Unlock()
		return removeCLILink()
	case "agent_binary":
		return findCLI(), nil
	case "restart_stale_agent":
		return runCLI(ctx, "agent", "restart", "--if-stale", "--json")
	case "prepare_app_update":
		if runtime.GOOS != "windows" {
			return false, nil
		}
		out, err := runCLI(ctx, "agent", "status", "--json")
		if err != nil {
			return nil, err
		}
		var status struct {
			Running bool `json:"running"`
		}
		if err := json.Unmarshal([]byte(out), &status); err != nil {
			return nil, err
		}
		return status.Running, nil
	case "get_version":
		return s.config.Version, nil
	case "close_window":
		s.main.Close()
	case "minimize_window":
		s.main.Minimise()
	case "toggle_maximize":
		s.main.ToggleMaximise()
	case "is_maximized":
		return s.main.IsMaximised(), nil
	case "notification_permission":
		if err := s.notificationReady(); err != nil {
			return nil, err
		}
		return s.notifier.CheckNotificationAuthorization()
	case "request_notification_permission":
		if err := s.notificationReady(); err != nil {
			return nil, err
		}
		return s.notifier.RequestNotificationAuthorization()
	case "deep_link_current":
		s.linksMu.Lock()
		defer s.linksMu.Unlock()
		return append([]string{}, s.links...), nil
	default:
		return nil, fmt.Errorf("unknown desktop command %q", command)
	}
	return nil, nil
}

func (s *Service) notificationReady() error {
	if s.notifyErr != nil {
		return s.notifyErr
	}
	if s.notifier == nil {
		return errors.New("notifications are not ready")
	}
	return nil
}

type browserOpenArgs struct {
	ID  string  `json:"id"`
	URL string  `json:"url"`
	X   float64 `json:"x"`
	Y   float64 `json:"y"`
	W   float64 `json:"w"`
	H   float64 `json:"h"`
}

func (s *Service) invokeBrowser(ctx context.Context, command string, args json.RawMessage) error {
	var id string
	var operation func(*nativebrowser.Manager) error
	switch command {
	case "browser_open":
		var p browserOpenArgs
		if err := decode(args, &p); err != nil {
			return err
		}
		operation = func(m *nativebrowser.Manager) error {
			return m.Open(p.ID, p.URL, nativebrowser.Bounds{X: p.X, Y: p.Y, Width: p.W, Height: p.H})
		}
	case "browser_set_bounds":
		var p struct {
			ID string  `json:"id"`
			X  float64 `json:"x"`
			Y  float64 `json:"y"`
			W  float64 `json:"w"`
			H  float64 `json:"h"`
		}
		if err := decode(args, &p); err != nil {
			return err
		}
		operation = func(m *nativebrowser.Manager) error {
			return m.SetBounds(p.ID, nativebrowser.Bounds{X: p.X, Y: p.Y, Width: p.W, Height: p.H})
		}
	case "browser_navigate":
		var p struct {
			ID  string `json:"id"`
			URL string `json:"url"`
		}
		if err := decode(args, &p); err != nil {
			return err
		}
		operation = func(m *nativebrowser.Manager) error { return m.Navigate(p.ID, p.URL) }
	case "browser_pick":
		var p struct {
			ID     string `json:"id"`
			Script string `json:"script"`
		}
		if err := decode(args, &p); err != nil {
			return err
		}
		operation = func(m *nativebrowser.Manager) error { return m.Pick(ctx, p.ID, p.Script) }
	case "browser_show", "browser_hide", "browser_back", "browser_forward", "browser_reload", "browser_inspect", "browser_close":
		var p struct {
			ID string `json:"id"`
		}
		if err := decode(args, &p); err != nil {
			return err
		}
		id = p.ID
		operation = func(m *nativebrowser.Manager) error {
			switch command {
			case "browser_show":
				return m.Show(id)
			case "browser_hide":
				return m.Hide(id)
			case "browser_back":
				return m.Back(id)
			case "browser_forward":
				return m.Forward(id)
			case "browser_reload":
				return m.Reload(id)
			case "browser_inspect":
				return m.Inspect(id)
			default:
				return m.Close(id)
			}
		}
	default:
		return fmt.Errorf("unknown desktop command %q", command)
	}
	m, err := s.browser()
	if err != nil {
		return err
	}
	return operation(m)
}

func (s *Service) restart() error {
	if err := ordinaryUser(); err != nil {
		return err
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	if !executable(exe) {
		return errors.New("Burf's executable is unavailable")
	}
	s.relaunchMu.Lock()
	s.relaunch = exe
	s.relaunchMu.Unlock()
	s.app.Quit()
	return nil
}

// AfterShutdown runs after Wails releases its single-instance lock. Starting
// the replacement earlier would focus the closing instance and then exit.
func AfterShutdown(s *Service) error {
	s.relaunchMu.Lock()
	exe := s.relaunch
	s.relaunch = ""
	s.relaunchMu.Unlock()
	if exe == "" {
		return nil
	}
	cmd := exec.Command(exe)
	backgroundCommand(cmd)
	if err := cmd.Start(); err != nil {
		return err
	}
	return cmd.Process.Release()
}

// ReceiveLinks is called by native lifecycle code, never by a page binding.
func ReceiveLinks(s *Service, args []string) {
	links := deepLinks(args)
	if len(links) == 0 {
		return
	}
	s.linksMu.Lock()
	s.links = links
	s.linksMu.Unlock()
	if s.main != nil {
		s.main.UnMinimise()
		s.main.Focus()
		s.emit("berth://deep-link", links)
	}
}
