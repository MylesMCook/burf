package desktop

import (
	"net/http"
	"net/url"
	"runtime"
)

func trustedRuntimeOrigin(r *http.Request) bool {
	if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
		return false
	}
	raw := r.Header.Get("Origin")
	if raw == "" {
		return true // Native same-origin and SDK GET requests may omit it.
	}
	u, err := url.Parse(raw)
	if err != nil || u.User != nil || u.Host != r.Host || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") {
		return false
	}
	scheme := "http"
	if runtime.GOOS == "darwin" {
		scheme = "wails"
	}
	return u.Scheme == scheme
}
