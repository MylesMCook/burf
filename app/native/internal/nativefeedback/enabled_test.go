//go:build dev && wailsfeedback && !production

package nativefeedback

import (
	"context"
	"net/http"
	"net/http/httptest"
	"reflect"
	"runtime"
	"strings"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type fakeWindow struct {
	application.Window
	id uint
}

func (window fakeWindow) ID() uint { return window.id }

func TestConfigurationRequiresExactAttachedCaller(t *testing.T) {
	bridge := &Bridge{service: &Service{endpoint: "private capability"}}
	main := fakeWindow{id: 1}
	foreign := fakeWindow{id: 2}
	for _, caller := range []any{nil, main, foreign, "main"} {
		ctx := context.Background()
		if caller != nil {
			ctx = context.WithValue(ctx, application.WindowKey, caller)
		}
		if _, err := bridge.service.Configuration(ctx); err == nil {
			t.Fatal("unattached caller received endpoint")
		}
	}
	Attach(bridge, main)
	for _, caller := range []any{foreign, "main"} {
		ctx := context.WithValue(context.Background(), application.WindowKey, caller)
		if _, err := bridge.service.Configuration(ctx); err == nil {
			t.Fatal("foreign caller received endpoint")
		}
	}
	ctx := context.WithValue(context.Background(), application.WindowKey, main)
	config, err := bridge.service.Configuration(ctx)
	if err != nil || config.Endpoint != "private capability" {
		t.Fatalf("trusted caller: %+v %v", config, err)
	}
	Stop(bridge)
	Attach(bridge, main)
	if config, err := bridge.service.Configuration(ctx); err == nil || config.Endpoint != "" {
		t.Fatal("closed bridge returned endpoint")
	}
}

func TestOnlyConfigurationIsBound(t *testing.T) {
	bound := reflect.TypeOf(&Service{})
	if bound.NumMethod() != 1 || bound.Method(0).Name != "Configuration" {
		t.Fatal("unexpected exported binding method")
	}
}

func TestRuntimeOptInAndNilHelpers(t *testing.T) {
	t.Setenv("WAILS_FEEDBACK", "0")
	bridge, err := Start(Config{CompanionURL: "invalid"})
	if bridge != nil || err != nil {
		t.Fatal("runtime default started bridge")
	}
	if got := Services(nil, nil); got != nil {
		t.Fatal("disabled bridge added service")
	}
	Attach(nil, nil)
	Stop(nil)
	if InstanceID(nil, "original") != "original" {
		t.Fatal("disabled bridge changed identity")
	}
	t.Setenv("WAILS_FEEDBACK", "1")
	for _, runID := range []string{"", "short", strings.Repeat("A", 32), strings.Repeat("0", 31), strings.Repeat("g", 32)} {
		t.Setenv("WAILS_FEEDBACK_RUN_ID", runID)
		if _, err := Start(Config{CompanionURL: "http://127.0.0.1:4747"}); err == nil {
			t.Fatal("unsafe or missing run ID accepted")
		}
	}
	t.Setenv("WAILS_FEEDBACK_RUN_ID", strings.Repeat("0", 32))
	if _, err := Start(Config{CompanionURL: "invalid"}); err == nil {
		t.Fatal("enabled bridge accepted unsafe URL")
	}
}

func TestFeedbackIdentityIsRunScoped(t *testing.T) {
	bridge := &Bridge{runID: strings.Repeat("a", 32)}
	if got := InstanceID(bridge, "dev.myles.burf"); got != "dev.myles.burf.feedback."+bridge.runID {
		t.Fatal("feedback identity is not isolated")
	}
}

func TestServicesPreservesExistingSlice(t *testing.T) {
	existing := make([]application.Service, 1, 2)
	bridge := &Bridge{service: &Service{}}
	result := Services(bridge, existing)
	if len(result) != 2 || result[1].Instance() != bridge.service {
		t.Fatal("feedback service not appended")
	}
	if existing[:2][1].Instance() != nil {
		t.Fatal("existing backing slice mutated")
	}
}

func TestActiveBridgeLifecycle(t *testing.T) {
	t.Setenv("WAILS_FEEDBACK", "1")
	t.Setenv("WAILS_FEEDBACK_RUN_ID", strings.Repeat("a", 32))
	t.Setenv("FRONTEND_DEVSERVER_URL", "")
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }))
	defer upstream.Close()
	bridge, err := Start(Config{CompanionURL: upstream.URL})
	if err != nil {
		t.Fatal(err)
	}
	defer Stop(bridge)
	main := fakeWindow{id: 7}
	Attach(bridge, main)
	ctx := context.WithValue(context.Background(), application.WindowKey, main)
	config, err := bridge.service.Configuration(ctx)
	if err != nil {
		t.Fatal(err)
	}
	request, _ := http.NewRequest("GET", config.Endpoint+"/health", nil)
	origin := "wails://localhost"
	if runtime.GOOS == "windows" {
		origin = "http://wails.localhost"
	}
	request.Header.Set("Origin", origin)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatal("active bridge failed")
	}
	Stop(bridge)
	if _, err := http.DefaultClient.Do(request); err == nil {
		t.Fatal("adapter Stop left listener alive")
	}
}

func TestNativeOriginUsesDevserverPort(t *testing.T) {
	for _, trial := range []struct{ platform, devserver, origin string }{
		{"darwin", "", "wails://localhost"},
		{"windows", "", "http://wails.localhost"},
		{"darwin", "http://127.0.0.1:1425", "wails://localhost:1425"},
		{"windows", "http://127.0.0.1:1426", "http://wails.localhost:1426"},
	} {
		origin, err := nativeOrigin(trial.devserver, trial.platform)
		if err != nil || origin != trial.origin {
			t.Errorf("%+v: origin %s, error %v", trial, origin, err)
		}
	}
}

func TestMalformedDevserverRejectedBeforeStart(t *testing.T) {
	t.Setenv("WAILS_FEEDBACK", "1")
	t.Setenv("WAILS_FEEDBACK_RUN_ID", strings.Repeat("a", 32))
	for _, devURL := range []string{"http://localhost:1425", "https://127.0.0.1:1425", "http://127.0.0.1", "http://127.0.0.1:80", "http://127.0.0.1:01425", "http://127.0.0.1:1425/", "http://user@127.0.0.1:1425", "http://127.0.0.1:1425?q=1", "http://127.0.0.1:1425#fragment"} {
		t.Setenv("FRONTEND_DEVSERVER_URL", devURL)
		bridge, err := Start(Config{CompanionURL: "http://127.0.0.1:4747"})
		Stop(bridge)
		if err == nil || bridge != nil {
			t.Errorf("accepted malformed devserver %s", devURL)
		}
	}
}
