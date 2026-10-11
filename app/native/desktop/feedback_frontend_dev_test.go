//go:build dev && !production

package desktop

import (
	"runtime"
	"testing"
)

func TestFeedbackDevelopmentOriginPinsExactPort(t *testing.T) {
	want := "wails://localhost"
	if runtime.GOOS == "windows" {
		want = "http://wails.localhost"
	}
	t.Setenv("FRONTEND_DEVSERVER_URL", "")
	if actual, err := FeedbackOrigin(); err != nil || actual != want {
		t.Fatal("default development origin changed")
	}
	t.Setenv("FRONTEND_DEVSERVER_URL", "http://127.0.0.1:1425")
	if actual, err := FeedbackOrigin(); err != nil || actual != want+":1425" {
		t.Fatal("development port was not pinned")
	}
	for _, raw := range []string{
		"http://localhost:1425", "http://127.0.0.1:01425", "http://127.0.0.1:80", "http://127.0.0.1:65536",
		"https://127.0.0.1:1425", "http://user@127.0.0.1:1425", "http://127.0.0.1:1425/", "http://127.0.0.1:1425?",
		"http://127.0.0.1:1425#fragment", "http://[::1]:1425",
	} {
		t.Setenv("FRONTEND_DEVSERVER_URL", raw)
		if _, err := FeedbackOrigin(); err == nil {
			t.Fatalf("unsafe development origin accepted: %s", raw)
		}
	}
}
