// Nativecheck runs synthetic acceptance checks in the actual desktop engines.
// It never starts an agent, reads the person's state or opens a visible window.
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
	"testing/fstest"
	"time"

	"github.com/MylesMCook/burf/app/native/desktop"
	"github.com/MylesMCook/burf/app/native/nativebrowser"
	"github.com/MylesMCook/burf/internal/proxy"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

const paneID = "nativecheck"

type pageReport struct {
	Phase  string          `json:"phase"`
	Checks map[string]bool `json:"checks"`
}

type browserEvent struct {
	Name string
	Data any
}

type output struct {
	Platform string          `json:"platform"`
	Wails    string          `json:"wails"`
	Passed   bool            `json:"passed"`
	Checks   map[string]bool `json:"checks"`
	// Popup support is an observation, not a claim about signed-in login flows.
	Observed map[string]bool `json:"observed"`
	Failure  string          `json:"failure,omitempty"`
}

type smoke struct {
	reports chan pageReport
	events  chan browserEvent
	mu      sync.Mutex
	out     output
}

func main() {
	if runtime.GOOS != "darwin" && runtime.GOOS != "windows" {
		fmt.Fprintln(os.Stderr, "nativecheck requires macOS or Windows")
		os.Exit(1)
	}
	if err := run(); err != nil {
		// Error messages never include binding results or the synthetic token.
		fmt.Fprintln(os.Stderr, "nativecheck could not initialize")
		os.Exit(1)
	}
}

func randomKey() (string, error) {
	var bytes [24]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes[:]), nil
}

func run() error {
	home, err := os.MkdirTemp("", "burf-nativecheck-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(home)
	key, err := randomKey()
	if err != nil {
		return err
	}
	token, err := randomKey()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Join(home, "client"), 0700); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(home, "client", "ui-token"), []byte(token), 0600); err != nil {
		return err
	}
	s := &smoke{
		reports: make(chan pageReport, 8), events: make(chan browserEvent, 128),
		out: output{Platform: runtime.GOOS, Wails: "v3.0.0-beta.28", Checks: make(map[string]bool), Observed: make(map[string]bool)},
	}
	site := httptest.NewServer(s.handler(key)) // Always an ephemeral loopback listener.
	defer site.Close()
	assets := fstest.MapFS{"index.html": &fstest.MapFile{Data: []byte(mainHTML(site.URL+"/report/"+key, token))}}
	service := desktop.New(desktop.Config{
		Version: "nativecheck", StateHome: home, DevtoolsScript: proxy.DevtoolsScript(),
		UIState: func() (any, error) {
			return map[string]any{"version": 1, "storage": map[string]string{}, "fonts": []any{}, "images": []any{}}, nil
		},
	})
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	var app *application.App
	var manager *nativebrowser.Manager
	var managerMu sync.Mutex
	var final sync.Once
	finish := func(failure string) {
		final.Do(func() {
			cancel()
			s.mu.Lock()
			s.out.Failure = failure
			s.mu.Unlock()
			app.Quit()
		})
	}
	app = application.New(application.Options{
		Name: "Burf native smoke", LogLevel: slog.LevelInfo,
		Services:       []application.Service{application.NewService(service)},
		Assets:         application.AssetOptions{Handler: application.BundledAssetFileServer(assets), Middleware: desktop.AssetMiddleware, DisableLogging: true},
		SingleInstance: &application.SingleInstanceOptions{UniqueID: "dev.myles.burf.nativecheck." + key},
		Windows:        application.WindowsOptions{WebviewUserDataPath: filepath.Join(home, "wails")},
		OnShutdown: func() {
			cancel()
			managerMu.Lock()
			m := manager
			managerMu.Unlock()
			if m != nil {
				s.check("shutdown", m.Shutdown() == nil)
			}
		},
		PostShutdown: func() {
			site.Close()
			_ = os.RemoveAll(home)
			s.mu.Lock()
			s.out.Passed = s.out.Failure == "" && allChecks(s.out.Checks)
			_ = json.NewEncoder(os.Stdout).Encode(s.out)
			passed := s.out.Passed
			s.mu.Unlock()
			if !passed {
				os.Exit(1)
			}
		},
	})
	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name: "main", Title: "Burf native smoke", URL: "/", Width: 900, Height: 600, Hidden: true,
	})
	desktop.Attach(service, app, window)
	var started atomic.Bool
	window.OnWindowEvent(events.Common.WindowRuntimeReady, func(*application.WindowEvent) {
		if !started.CompareAndSwap(false, true) {
			return
		}
		parent := window.NativeWindow()
		go func() {
			m, err := nativebrowser.New(nativebrowser.Config{
				Parent: parent, ProfileDir: filepath.Join(home, "browser"), DevtoolsScript: proxy.DevtoolsScript(), DispatchSync: application.InvokeSync,
				Emit: func(name string, data any) {
					select {
					case s.events <- browserEvent{Name: name, Data: data}:
					case <-ctx.Done():
					}
				},
			})
			if err != nil {
				finish("native_browser_create")
				return
			}
			managerMu.Lock()
			manager = m
			managerMu.Unlock()
			finish(s.exercise(ctx, m, site.URL, key))
		}()
	})
	go func() {
		<-ctx.Done()
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			finish("deadline")
		}
	}()
	return app.Run()
}

func allChecks(checks map[string]bool) bool {
	for _, name := range []string{"bootstrap", "ui_state", "ui_endpoint", "csp", "native_navigation", "isolated", "private_rpc_denied", "evaluation", "blank_frame", "srcdoc_frame", "console_capture", "picker_capture", "native_history", "native_reload", "evaluation_cancellation", "hide_show_bounds", "owned_close", "shutdown"} {
		if !checks[name] {
			return false
		}
	}
	return true
}

func (s *smoke) check(name string, passed bool) {
	s.mu.Lock()
	s.out.Checks[name] = passed
	s.mu.Unlock()
}

func (s *smoke) handler(key string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/report/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/report/"+key || r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}
		var report pageReport
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&report) != nil || len(report.Checks) == 0 || len(report.Checks) > 16 || (report.Phase != "main" && report.Phase != "raw" && report.Phase != "popup") {
			http.Error(w, "invalid synthetic result", http.StatusBadRequest)
			return
		}
		if decoder.Decode(new(any)) != io.EOF {
			http.Error(w, "invalid synthetic result", http.StatusBadRequest)
			return
		}
		select {
		case s.reports <- report:
			w.WriteHeader(http.StatusNoContent)
		default:
			http.Error(w, "result queue is full", http.StatusServiceUnavailable)
		}
	})
	mux.HandleFunc("/a", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = io.WriteString(w, `<html><head><title>Native A</title></head><body><div id="pick">synthetic</div><iframe id="blank" src="about:blank"></iframe><iframe id="srcdoc" srcdoc="<p>synthetic frame</p>"></iframe></body></html>`)
	})
	mux.HandleFunc("/b", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = io.WriteString(w, `<html><head><title>Native B</title></head><body>second page</body></html>`)
	})
	return mux
}

func mainHTML(reportURL, token string) string {
	report, _ := json.Marshal(reportURL)
	expected, _ := json.Marshal(token)
	return fmt.Sprintf(`<html><head><meta charset="utf-8"><script type="module">
import { Call } from "/wails/runtime.js";
const checks = {bootstrap: window.top === window && window.__BURF_WAILS__ === true, ui_state: false, ui_endpoint: false, csp: false};
try {
  const invoke = (name) => Call.ByName("github.com/MylesMCook/burf/app/native/desktop.Service.Invoke", name, {});
  const state = await invoke("ui_state");
  checks.ui_state = state.version === 1 && Object.keys(state.storage).length === 0 && state.fonts.length === 0 && state.images.length === 0;
  const endpoint = await invoke("ui_endpoint");
  checks.ui_endpoint = endpoint.url === "http://127.0.0.1:1378" && endpoint.token === %s;
  const page = await fetch("/");
  const policy = page.headers.get("Content-Security-Policy") || "";
  checks.csp = policy.includes("'sha256-") && policy.includes("frame-ancestors 'none'") && page.headers.get("X-Content-Type-Options") === "nosniff";
} catch {}
await fetch(%s, {method: "POST", body: JSON.stringify({phase: "main", checks})});
</script></head><body>synthetic native check</body></html>`, expected, report)
}

func (s *smoke) report(ctx context.Context, phase string) (pageReport, error) {
	select {
	case report := <-s.reports:
		if report.Phase != phase {
			return pageReport{}, errors.New("unexpected synthetic result phase")
		}
		return report, nil
	case <-ctx.Done():
		return pageReport{}, ctx.Err()
	}
}

func (s *smoke) navigation(ctx context.Context, raw string) error {
	for {
		select {
		case event := <-s.events:
			if navigation, ok := event.Data.(nativebrowser.Event); ok && navigation.ID == paneID && navigation.URL == raw && navigation.State == "finished" {
				return nil
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (s *smoke) exercise(ctx context.Context, m *nativebrowser.Manager, site, key string) string {
	main, err := s.report(ctx, "main")
	if err != nil {
		return "main_runtime"
	}
	for name, passed := range main.Checks {
		s.check(name, passed)
	}
	a, b := site+"/a", site+"/b"
	if m.Open(paneID, a, nativebrowser.Bounds{X: 20, Y: 20, Width: 500, Height: 350}) != nil || s.navigation(ctx, a) != nil {
		return "first_navigation"
	}
	s.check("native_navigation", true)
	reportURL, _ := json.Marshal(site + "/report/" + key)
	appOrigin := "http://wails.localhost"
	if runtime.GOOS == "darwin" {
		appOrigin = "wails://localhost"
	}
	runtimeURL, _ := json.Marshal(appOrigin + "/wails/runtime")
	raw := fmt.Sprintf(`(function(){
const checks = {
  isolated: !window._wails && !window.__BURF_WAILS__ && !window.__TAURI_INTERNALS__ && !window.webkit?.messageHandlers?.external,
  private_rpc_denied: false,
  evaluation: 21 * 2 === 42,
  blank_frame: document.getElementById("blank").contentDocument.URL === "about:blank",
  srcdoc_frame: document.getElementById("srcdoc").contentDocument.body.textContent === "synthetic frame"
};
console.log("nativecheck:console");
(async function(){
  try {
    const result = await fetch(%s, {method:"POST", headers:{"Content-Type":"application/json","x-wails-window-name":"main","x-wails-client-id":"nativecheck-foreign"}, body:JSON.stringify({object:0,method:0,args:{"call-id":"nativecheck-foreign",methodName:"github.com/MylesMCook/burf/app/native/desktop.Service.Invoke",args:["ui_endpoint",{}]}})});
    checks.private_rpc_denied = !result.ok;
  } catch {checks.private_rpc_denied = true;}
  await fetch(%s, {method: "POST", body: JSON.stringify({phase: "raw", checks})});
})();
return 42;
})()`, runtimeURL, reportURL)
	if m.Pick(ctx, paneID, raw) != nil {
		return "raw_evaluation"
	}
	observed, err := s.report(ctx, "raw")
	if err != nil {
		return "raw_report"
	}
	for name, passed := range observed.Checks {
		s.check(name, passed)
	}
	console, pick := false, false
	picker := `location.href="berth-pick://pick?d="+encodeURIComponent(JSON.stringify({tag:"DIV",text:"synthetic"}))`
	if m.Pick(ctx, paneID, picker) != nil {
		return "native_picker"
	}
	for !console || !pick {
		select {
		case event := <-s.events:
			switch value := event.Data.(type) {
			case nativebrowser.ConsoleEvent:
				var data struct {
					Version int    `json:"v"`
					Doc     string `json:"doc"`
					Href    string `json:"href"`
					Entries []struct {
						Text string `json:"text"`
					} `json:"entries"`
				}
				if value.ID == paneID && json.Unmarshal([]byte(value.Data), &data) == nil && data.Version == 1 && data.Doc != "" && data.Href == a {
					for _, entry := range data.Entries {
						console = console || entry.Text == "nativecheck:console"
					}
				}
			case nativebrowser.PickEvent:
				u, err := url.Parse(value.URL)
				pick = value.ID == paneID && err == nil && u.Scheme == "berth-pick" && u.Host == "pick" && json.Valid([]byte(u.Query().Get("d")))
			}
		case <-ctx.Done():
			return "native_diagnostics"
		}
	}
	s.check("console_capture", console)
	s.check("picker_capture", pick)
	if m.Navigate(paneID, b) != nil || s.navigation(ctx, b) != nil {
		return "second_navigation"
	}
	if m.Back(paneID) != nil || s.navigation(ctx, a) != nil || m.Forward(paneID) != nil || s.navigation(ctx, b) != nil {
		return "native_history"
	}
	s.check("native_history", true)
	if m.Reload(paneID) != nil || s.navigation(ctx, b) != nil {
		return "native_reload"
	}
	s.check("native_reload", true)
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	s.check("evaluation_cancellation", errors.Is(m.Pick(canceled, paneID, "42"), context.Canceled))
	popup := fmt.Sprintf(`(function(){
const p = window.open("", "_blank");
const checks = {blank_popup_supported: !!p, popup_isolated: false, popup_closed: false};
if(p){try{checks.popup_isolated=!p._wails&&!p.__BURF_WAILS__;p.close();checks.popup_closed=p.closed;}catch{}}
fetch(%s,{method:"POST",body:JSON.stringify({phase:"popup",checks})});
})()`, reportURL)
	if m.Pick(ctx, paneID, popup) == nil {
		if popupReport, err := s.report(ctx, "popup"); err == nil {
			s.mu.Lock()
			for name, observed := range popupReport.Checks {
				s.out.Observed[name] = observed
			}
			s.mu.Unlock()
		}
	}
	s.check("hide_show_bounds", m.Hide(paneID) == nil && m.Show(paneID) == nil && m.SetBounds(paneID, nativebrowser.Bounds{X: 30, Y: 30, Width: 450, Height: 300}) == nil)
	s.check("owned_close", m.Close(paneID) == nil && m.Close(paneID) == nil && m.Pick(ctx, paneID, "42") != nil)
	return ""
}
