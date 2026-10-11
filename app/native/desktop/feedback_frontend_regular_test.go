//go:build !dev || production

package desktop

import (
	"runtime"
	"testing"
)

func TestFeedbackRegularOriginIgnoresDevelopmentEnvironment(t *testing.T) {
	want := "wails://localhost"
	if runtime.GOOS == "windows" {
		want = "http://wails.localhost"
	}
	for _, raw := range []string{"http://127.0.0.1:1425", "https://example.invalid", "invalid"} {
		t.Setenv("FRONTEND_DEVSERVER_URL", raw)
		actual, err := FeedbackOrigin()
		if err != nil || actual != want {
			t.Fatalf("normal origin changed for injected %s: %s %v", raw, actual, err)
		}
	}
}
