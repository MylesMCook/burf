package agent

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNativeDevelopmentOriginRequiresAgentToken(t *testing.T) {
	a := &Agent{}
	handler := a.ui("synthetic-native-origin-token", "127.0.0.1:1378", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	for _, origin := range []string{"http://wails.localhost:1421", "http://wails.localhost:1439", "wails://localhost:1421", "http://localhost:1421"} {
		t.Run(origin, func(t *testing.T) {
			for _, token := range []string{"", "wrong", "synthetic-native-origin-token"} {
				request := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:1378/v1/status", nil)
				request.Header.Set("Origin", origin)
				request.Header.Set("Authorization", "Bearer "+token)
				response := httptest.NewRecorder()
				handler.ServeHTTP(response, request)
				if response.Header().Get("Access-Control-Allow-Origin") != origin {
					t.Fatal("native development window cannot read the authenticated agent response")
				}
				want := http.StatusUnauthorized
				if token == "synthetic-native-origin-token" {
					want = http.StatusOK
				}
				if response.Code != want {
					t.Fatalf("agent auth: got %d, want %d", response.Code, want)
				}
			}
		})
	}
	for _, origin := range []string{"http://wails.localhost:1440", "http://wails.localhost:1378", "https://wails.localhost:1421", "http://wails.localhost.evil:1421", "http://evil:1421", "wails://evil:1421"} {
		request := httptest.NewRequest(http.MethodOptions, "http://127.0.0.1:1378/v1/status", nil)
		request.Header.Set("Origin", origin)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Header().Get("Access-Control-Allow-Origin") != "" {
			t.Fatalf("unexpected origin allowed: %s", origin)
		}
	}
}
