package desktop

import (
	"net/http"
	"net/http/httptest"
	"runtime"
	"strings"
	"testing"
)

func appOrigin() string {
	if runtime.GOOS == "darwin" {
		return "wails://localhost"
	}
	return "http://wails.localhost"
}

func TestApplicationHTMLCannotBeEmbedded(t *testing.T) {
	app := AssetMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<html><head><script>window.boot = true</script></head></html>`))
	}))
	for _, dest := range []string{"", "document", "iframe", "frame", "object", "embed"} {
		r := httptest.NewRequest("GET", appOrigin()+"/", nil)
		r.Header.Set("Sec-Fetch-Dest", dest)
		w := httptest.NewRecorder()
		app.ServeHTTP(w, r)
		if dest != "" && dest != "document" {
			if w.Code != http.StatusForbidden || strings.Contains(w.Body.String(), "window.boot") {
				t.Fatalf("embedded %s received app HTML: %d %s", dest, w.Code, w.Body.String())
			}
			continue
		}
		if w.Code != http.StatusOK || w.Header().Get("X-Frame-Options") != "DENY" || !strings.Contains(w.Header().Get("Content-Security-Policy"), "frame-ancestors 'none'") {
			t.Fatalf("top-level response lacks embedding policy: %d %v", w.Code, w.Header())
		}
	}
}

func TestRuntimeRequestsRequireTheSDKJSONPost(t *testing.T) {
	for _, test := range []struct {
		method, contentType, mode, origin, site string
		want                                    int
	}{
		{method: "POST", contentType: "application/json", want: http.StatusOK},
		{method: "POST", contentType: "application/json; charset=utf-8", origin: appOrigin(), want: http.StatusOK},
		{method: "GET", want: http.StatusMethodNotAllowed},
		{method: "HEAD", want: http.StatusMethodNotAllowed},
		{method: "POST", contentType: "text/plain", want: http.StatusUnsupportedMediaType},
		{method: "POST", contentType: "application/x-www-form-urlencoded", want: http.StatusUnsupportedMediaType},
		{method: "POST", contentType: "application/json", mode: "no-cors", want: http.StatusUnsupportedMediaType},
		{method: "POST", contentType: "application/json", origin: "https://foreign.test", want: http.StatusForbidden},
		{method: "POST", contentType: "application/json", site: "cross-site", want: http.StatusForbidden},
	} {
		called := false
		app := AssetMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { called = true; w.WriteHeader(http.StatusOK) }))
		r := httptest.NewRequest(test.method, appOrigin()+"/wails/runtime?object=0&method=0&args=%7B%7D", strings.NewReader(`{"object":0,"method":0,"args":{}}`))
		r.Header.Set("Content-Type", test.contentType)
		r.Header.Set("Sec-Fetch-Mode", test.mode)
		r.Header.Set("Sec-Fetch-Site", test.site)
		r.Header.Set("Origin", test.origin)
		w := httptest.NewRecorder()
		app.ServeHTTP(w, r)
		if w.Code != test.want || called != (test.want == http.StatusOK) {
			t.Fatalf("%s %s mode=%q origin=%q: status=%d called=%v", test.method, test.contentType, test.mode, test.origin, w.Code, called)
		}
	}
}

func TestRuntimeScriptsStillAllowSameOriginGET(t *testing.T) {
	called := false
	app := AssetMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { called = true; w.WriteHeader(http.StatusOK) }))
	r := httptest.NewRequest("GET", appOrigin()+"/wails/runtime.js", nil)
	r.Header.Set("Sec-Fetch-Mode", "no-cors")
	w := httptest.NewRecorder()
	app.ServeHTTP(w, r)
	if w.Code != http.StatusOK || !called {
		t.Fatalf("SDK script was blocked: %d", w.Code)
	}
}
