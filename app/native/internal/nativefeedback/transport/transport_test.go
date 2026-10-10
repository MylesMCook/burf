package transport

import (
	"bufio"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func request(t *testing.T, bridge *Bridge, method, path, origin string, body io.Reader) *http.Response {
	t.Helper()
	r, err := http.NewRequest(method, Endpoint(bridge)+path, body)
	if err != nil {
		t.Fatal(err)
	}
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	response, err := http.DefaultClient.Do(r)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = response.Body.Close() })
	return response
}

func TestUnsafeCompanionsAndOrigins(t *testing.T) {
	for _, raw := range []string{"", "http://localhost:4747", "https://127.0.0.1:4747", "http://127.0.0.1", "http://127.0.0.1:80", "http://127.0.0.1:65536", "http://127.0.0.1:04747", "http://127.0.0.1:4747/", "http://user@127.0.0.1:4747", "http://127.0.0.1:4747?q=1", "http://127.0.0.1:4747?", "http://127.0.0.1:4747#part", "http://[::1]:4747"} {
		if _, err := Start(raw, "wails://localhost"); err == nil {
			t.Errorf("accepted %s", raw)
		}
	}
	for _, origin := range []string{"https://example.com", "wails://localhost:80", "wails://localhost:01425", "http://wails.localhost:65536", "wails://localhost:1425/", "http://wails.localhost:1425?", "wails://localhost:1425#fragment", "wails://localhost.evil:1425"} {
		if _, err := Start("http://127.0.0.1:4747", origin); err == nil {
			t.Errorf("accepted unsafe native origin %s", origin)
		}
	}
	Stop(nil)
}

func TestAllowedRoutesAndHeaderIsolation(t *testing.T) {
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.Header.Get("Origin") != "" || r.Header.Get("Referer") != "" || r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" || r.Header.Get("X-Forwarded-Host") != "" {
			t.Error("private browser headers forwarded")
		}
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Set-Cookie", "unexpected=1")
		_, _ = io.WriteString(w, r.Method+" "+r.URL.Path)
	}))
	defer upstream.Close()
	bridge, err := Start(upstream.URL, "wails://localhost")
	if err != nil {
		t.Fatal(err)
	}
	defer Stop(bridge)
	u, _ := url.Parse(Endpoint(bridge))
	if len(strings.TrimPrefix(u.Path, "/")) != 32 || u.Hostname() != "127.0.0.1" {
		t.Fatal("endpoint is not a private loopback capability")
	}
	for _, route := range []struct{ method, path string }{
		{"GET", "/health"}, {"POST", "/sessions"}, {"GET", "/sessions/session-1"}, {"POST", "/sessions/session_1/annotations"}, {"PATCH", "/annotations/id-1"}, {"DELETE", "/annotations/id_1"},
	} {
		r, _ := http.NewRequest(route.method, Endpoint(bridge)+route.path, strings.NewReader("{}"))
		r.Header.Set("Origin", "wails://localhost")
		r.Header.Set("Referer", "private")
		r.Header.Set("Cookie", "secret=1")
		r.Header.Set("Authorization", "secret")
		r.Header.Set("X-Forwarded-Host", "example.com")
		response, err := http.DefaultClient.Do(r)
		if err != nil {
			t.Fatal(err)
		}
		body, _ := io.ReadAll(response.Body)
		_ = response.Body.Close()
		if response.StatusCode != 200 || string(body) != route.method+" "+route.path || response.Header.Get("Access-Control-Allow-Origin") != "wails://localhost" || response.Header.Get("Set-Cookie") != "" {
			t.Fatalf("route %+v: %d %s", route, response.StatusCode, body)
		}
	}
	if calls.Load() != 6 {
		t.Fatal("routes not forwarded")
	}
}

func TestHostCapabilityOriginMethodsAndPreflight(t *testing.T) {
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { calls.Add(1); w.WriteHeader(200) }))
	defer upstream.Close()
	bridge, err := Start(upstream.URL, "http://wails.localhost")
	if err != nil {
		t.Fatal(err)
	}
	defer Stop(bridge)
	for _, trial := range []struct {
		method, path, origin, host string
		code                       int
	}{
		{"GET", "/health", "wails://localhost", "", 403},
		{"GET", "/health", "http://wails.localhost.evil", "", 403},
		{"GET", "/health", "http://wails.localhost", "localhost", 404},
		{"GET", "/sessions", "", "", 405},
		{"POST", "/health", "", "", 405},
		{"GET", "/mcp", "", "", 404},
		{"GET", "/pending", "", "", 404},
		{"GET", "/events", "", "", 404},
		{"GET", "/status", "", "", 404},
		{"GET", "/accounts", "", "", 404},
		{"POST", "/annotations/id/resolve", "", "", 404},
		{"POST", "/annotations/id/thread", "", "", 404},
		{"GET", "/health?q=1", "", "", 404},
		{"GET", "/sessions/%69d", "", "", 404},
	} {
		r, _ := http.NewRequest(trial.method, Endpoint(bridge)+trial.path, nil)
		if trial.origin != "" {
			r.Header.Set("Origin", trial.origin)
		}
		if trial.host != "" {
			r.Host = trial.host
		}
		response, err := http.DefaultClient.Do(r)
		if err != nil {
			t.Fatal(err)
		}
		_ = response.Body.Close()
		if response.StatusCode != trial.code {
			t.Errorf("%+v received %d", trial, response.StatusCode)
		}
	}
	u, _ := url.Parse(Endpoint(bridge))
	u.Path = "/wrong/health"
	response, err := http.Get(u.String())
	if err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()
	if response.StatusCode != 404 {
		t.Fatal("incorrect capability accepted")
	}
	r, _ := http.NewRequest("OPTIONS", Endpoint(bridge)+"/sessions", nil)
	r.Header.Set("Origin", "http://wails.localhost")
	r.Header.Set("Access-Control-Request-Method", "POST")
	response, err = http.DefaultClient.Do(r)
	if err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()
	if response.StatusCode != 204 || response.Header.Get("Access-Control-Allow-Origin") != "http://wails.localhost" {
		t.Fatal("Windows preflight denied")
	}
	r.Header.Set("Access-Control-Request-Method", "GET")
	response, err = http.DefaultClient.Do(r)
	if err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()
	if response.StatusCode != 403 {
		t.Fatal("preflight accepted forbidden method")
	}
	if calls.Load() != 0 {
		t.Fatal("denied request reached companion")
	}
	if response := request(t, bridge, "GET", "/health", "http://wails.localhost", nil); response.StatusCode != 200 {
		t.Fatal("Windows origin rejected")
	}
}

func TestOversizedBodyNeverReachesCompanion(t *testing.T) {
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { calls.Add(1); w.WriteHeader(200) }))
	defer upstream.Close()
	bridge, err := Start(upstream.URL, "wails://localhost")
	if err != nil {
		t.Fatal(err)
	}
	defer Stop(bridge)
	response := request(t, bridge, "POST", "/sessions", "wails://localhost", strings.NewReader(strings.Repeat("x", maxBody+1)))
	if response.StatusCode != 413 || calls.Load() != 0 {
		t.Fatal("oversized request reached companion")
	}
}

func TestRedirectNotFollowed(t *testing.T) {
	var followed atomic.Bool
	redirectTarget := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { followed.Store(true); w.WriteHeader(200) }))
	defer redirectTarget.Close()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, redirectTarget.URL, 302) }))
	defer upstream.Close()
	bridge, err := Start(upstream.URL, "wails://localhost")
	if err != nil {
		t.Fatal(err)
	}
	defer Stop(bridge)
	if response := request(t, bridge, "GET", "/health", "wails://localhost", nil); response.StatusCode != 502 || followed.Load() {
		t.Fatal("redirect accepted")
	}
}

func TestSSEFlushCancellationAndStop(t *testing.T) {
	cancelled := make(chan struct{}, 2)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = io.WriteString(w, "data: ready\n\n")
		w.(http.Flusher).Flush()
		<-r.Context().Done()
		cancelled <- struct{}{}
	}))
	defer upstream.Close()
	bridge, err := Start(upstream.URL, "wails://localhost")
	if err != nil {
		t.Fatal(err)
	}
	defer Stop(bridge)
	for _, stop := range []bool{false, true} {
		ctx, cancel := context.WithCancel(context.Background())
		r, _ := http.NewRequestWithContext(ctx, "GET", Endpoint(bridge)+"/sessions/id/events", nil)
		r.Header.Set("Origin", "wails://localhost")
		response, err := (&http.Client{Timeout: time.Second}).Do(r)
		if err != nil {
			cancel()
			t.Fatal("event stream was not flushed:", err)
		}
		line, err := bufio.NewReader(response.Body).ReadString('\n')
		if err != nil || line != "data: ready\n" {
			cancel()
			t.Fatalf("event stream: %q %v", line, err)
		}
		if stop {
			Stop(bridge)
			Stop(bridge)
		} else {
			cancel()
		}
		_ = response.Body.Close()
		cancel()
		select {
		case <-cancelled:
		case <-time.After(time.Second):
			t.Fatal("upstream event stream survived cancellation")
		}
	}
	if _, err := http.Get(Endpoint(bridge) + "/health"); err == nil {
		t.Fatal("listener survived Stop")
	}
}

func TestDevserverOriginKeepsExactPort(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))
	defer upstream.Close()
	for _, origin := range []string{"wails://localhost:1425", "http://wails.localhost:1425"} {
		bridge, err := Start(upstream.URL, origin)
		if err != nil {
			t.Fatal("valid devserver origin denied:", err)
		}
		for _, trial := range []struct {
			origin string
			code   int
		}{
			{origin, 200},
			{strings.TrimSuffix(origin, ":1425"), 403},
			{strings.TrimSuffix(origin, "1425") + "1426", 403},
			{origin + ".evil", 403},
		} {
			if response := request(t, bridge, "GET", "/health", trial.origin, nil); response.StatusCode != trial.code {
				t.Errorf("origin %s received %d", trial.origin, response.StatusCode)
			}
		}
		Stop(bridge)
	}
}
