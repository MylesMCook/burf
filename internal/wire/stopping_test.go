package wire

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestStoppingPingIsScopedToItsListener(t *testing.T) {
	s := &Server{Name: "acme"}
	stopped := new(atomic.Bool)
	stopped.Store(true)
	live := new(atomic.Bool)
	for _, tc := range []struct {
		name   string
		state  *atomic.Bool
		status int
	}{
		{"stopping listener", stopped, http.StatusServiceUnavailable},
		{"another or later listener", live, http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/v1/ping", nil)
			r = r.WithContext(context.WithValue(r.Context(), stoppingKey{}, tc.state))
			w := httptest.NewRecorder()
			s.handlePing(w, r)
			if w.Code != tc.status {
				t.Fatalf("ping = %d, want %d: %s", w.Code, tc.status, w.Body.String())
			}
		})
	}
}
