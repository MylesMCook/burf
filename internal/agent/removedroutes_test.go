package agent

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRemovedSetupRoutesReturnNotFound(t *testing.T) {
	a := &Agent{}
	h := a.api(func() {})
	for _, route := range []string{
		"GET /v1/github", "POST /v1/github/login",
		"GET /v1/team", "GET /v1/team/acme", "GET /v1/team/acme/update",
		"POST /v1/team/acme/setup", "POST /v1/team/acme/retry",
		"GET /v1/kits", "GET /v1/kits/installed", "GET /v1/kits/dev",
		"POST /v1/kits/preview", "POST /v1/kits/add", "POST /v1/kits/dev/apply",
		"POST /v1/kits/dev/update", "DELETE /v1/kits/dev",
		"POST /v1/kits/remove", "POST /v1/kits/save",
	} {
		t.Run(route, func(t *testing.T) {
			method, path, _ := strings.Cut(route, " ")
			req := httptest.NewRequest(method, path, strings.NewReader("{}"))
			if _, pattern := h.(*http.ServeMux).Handler(req); pattern != "" {
				t.Fatalf("removed route still registered: %s", pattern)
			}
			w := httptest.NewRecorder()
			h.ServeHTTP(w, req)
			if w.Code != http.StatusNotFound {
				t.Fatalf("status = %d, want 404", w.Code)
			}
		})
	}
}
