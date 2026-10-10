package desktop

import (
	"net/http/httptest"
	"runtime"
	"testing"
)

func TestForeignOriginsCannotReachTheDesktopRuntime(t *testing.T) {
	scheme, host := "http", "wails.localhost"
	if runtime.GOOS == "darwin" {
		scheme, host = "wails", "localhost"
	}
	for _, test := range []struct {
		origin, site string
		allowed      bool
	}{
		{origin: "", allowed: true},
		{origin: scheme + "://" + host, allowed: true},
		{origin: scheme + "://" + host + ":1435", allowed: false},
		{origin: "https://example.test", allowed: false},
		{origin: "null", allowed: false},
		{origin: scheme + "://user@" + host, allowed: false},
		{origin: scheme + "://" + host, site: "cross-site", allowed: false},
	} {
		r := httptest.NewRequest("POST", scheme+"://"+host+"/wails/runtime", nil)
		r.Header.Set("Origin", test.origin)
		r.Header.Set("Sec-Fetch-Site", test.site)
		if got := trustedRuntimeOrigin(r); got != test.allowed {
			t.Fatalf("origin %q site %q: allowed=%v", test.origin, test.site, got)
		}
	}
}
