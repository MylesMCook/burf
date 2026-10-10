//go:build dev && wailsfeedback && !production

package nativefeedback

import (
	"context"
	"encoding/hex"
	"errors"
	"net/url"
	"os"
	"runtime"
	"strconv"
	"sync"

	"github.com/MylesMCook/burf/app/native/internal/nativefeedback/transport"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type Bridge struct {
	transport *transport.Bridge
	service   *Service
	runID     string
}

// Service has exactly one exported binding. Attachment and shutdown are free
// functions so frontend callers cannot change the trusted window or lifecycle.
type Service struct {
	mu       sync.RWMutex
	main     application.Window
	endpoint string
	closed   bool
}

type Configuration struct {
	Endpoint string `json:"endpoint"`
}

func Start(config Config) (*Bridge, error) {
	if os.Getenv("WAILS_FEEDBACK") != "1" {
		return nil, nil
	}
	runID := os.Getenv("WAILS_FEEDBACK_RUN_ID")
	decoded, err := hex.DecodeString(runID)
	if err != nil || len(decoded) != 16 || runID != hex.EncodeToString(decoded) {
		return nil, errors.New("native feedback requires a private runner's 32-character lowercase hex run ID")
	}
	origin, err := nativeOrigin(os.Getenv("FRONTEND_DEVSERVER_URL"), runtime.GOOS)
	if err != nil {
		return nil, err
	}
	proxy, err := transport.Start(config.CompanionURL, origin)
	if err != nil {
		return nil, err
	}
	return &Bridge{transport: proxy, service: &Service{endpoint: transport.Endpoint(proxy)}, runID: runID}, nil
}

// Wails keeps the devserver port on its internal asset-server origin. Match
// that one origin instead of permitting every port on the native hostname.
func nativeOrigin(devserverURL, platform string) (string, error) {
	origin := "wails://localhost"
	if platform == "windows" {
		origin = "http://wails.localhost"
	}
	if platform != "darwin" && platform != "windows" {
		return "", errors.New("native feedback is supported on macOS and Windows")
	}
	if devserverURL == "" {
		return origin, nil
	}
	u, err := url.Parse(devserverURL)
	if err != nil {
		return "", errors.New("invalid feedback frontend devserver URL")
	}
	port, err := strconv.Atoi(u.Port())
	if err != nil || port < 1024 || port > 65535 || u.Scheme != "http" || u.Host != "127.0.0.1:"+strconv.Itoa(port) || u.User != nil || u.Path != "" || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" {
		return "", errors.New("feedback frontend devserver must be http://127.0.0.1 with an explicit unprivileged port")
	}
	return origin + ":" + strconv.Itoa(port), nil
}

// InstanceID keeps a feedback development launch separate from an installed
// application's single-instance identity. Ordinary and production launches keep it.
func InstanceID(bridge *Bridge, original string) string {
	if bridge == nil {
		return original
	}
	return original + ".feedback." + bridge.runID
}

func Services(bridge *Bridge, existing []application.Service) []application.Service {
	if bridge == nil {
		return existing
	}
	result := make([]application.Service, len(existing), len(existing)+1)
	copy(result, existing)
	return append(result, application.NewService(bridge.service))
}

func Attach(bridge *Bridge, main application.Window) {
	if bridge == nil {
		return
	}
	bridge.service.mu.Lock()
	defer bridge.service.mu.Unlock()
	if !bridge.service.closed {
		bridge.service.main = main
	}
}

func Stop(bridge *Bridge) {
	if bridge == nil {
		return
	}
	bridge.service.mu.Lock()
	bridge.service.closed = true
	bridge.service.main = nil
	bridge.service.endpoint = ""
	bridge.service.mu.Unlock()
	transport.Stop(bridge.transport)
}

func (service *Service) Configuration(ctx context.Context) (Configuration, error) {
	service.mu.RLock()
	defer service.mu.RUnlock()
	caller, ok := ctx.Value(application.WindowKey).(application.Window)
	if !ok || caller == nil || service.main == nil || service.closed || caller.ID() != service.main.ID() {
		return Configuration{}, errors.New("native feedback is only available to the trusted main window")
	}
	return Configuration{Endpoint: service.endpoint}, nil
}
