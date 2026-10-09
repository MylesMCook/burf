package boxclient

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
)

type requestFunc func(context.Context, string, string, io.Reader, http.Header) (*http.Response, error)

func (f requestFunc) DoWithHeader(ctx context.Context, method, path string, body io.Reader, header http.Header) (*http.Response, error) {
	return f(ctx, method, path, body, header)
}

func TestClientSendPreservesWireRequest(t *testing.T) {
	c := NewClient(requestFunc(func(_ context.Context, method, path string, body io.Reader, header http.Header) (*http.Response, error) {
		if method != http.MethodPost || path != "/v1/sessions/work%2Ffix/send" {
			t.Fatalf("request = %s %s", method, path)
		}
		if header.Get(OriginHeader) != "app" || header.Get(CallerHeader) != "lead" || header.Get("Content-Type") != "application/json" {
			t.Fatalf("headers = %v", header)
		}
		var got map[string]any
		if err := json.NewDecoder(body).Decode(&got); err != nil {
			t.Fatal(err)
		}
		want := map[string]any{"text": "repair the build", "enter": true, "when": "idle"}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("body = %#v; want %#v", got, want)
		}
		w := httptest.NewRecorder()
		w.WriteHeader(http.StatusAccepted)
		io.WriteString(w, `{"sent":false,"at":"2026-10-07T10:00:00Z","turn":"work/fix#2","queued":true}`)
		return w.Result(), nil
	}))
	c.Origin = "app"
	called := c.WithCaller("lead")
	enter := true
	out, err := called.Send(context.Background(), "work/fix", SendRequest{Text: "repair the build", Enter: &enter, When: "idle"})
	if err != nil || out.Turn != "work/fix#2" || !out.Queued || out.At.IsZero() {
		t.Fatalf("send = %#v, %v", out, err)
	}
	if c.Caller != "" {
		t.Fatalf("WithCaller changed the original client: %q", c.Caller)
	}
}

func TestOriginValidationAndHeaders(t *testing.T) {
	for _, tc := range []struct {
		origin string
		valid  bool
	}{
		{"app", true},
		{strings.Repeat("a", 32), true},
		{"", false},
		{"App", false},
		{"bad\r\nheader", false},
		{strings.Repeat("a", 33), false},
	} {
		t.Run(tc.origin, func(t *testing.T) {
			if ValidOrigin(tc.origin) != tc.valid {
				t.Fatalf("ValidOrigin(%q) = %v", tc.origin, !tc.valid)
			}
			c := NewClient(requestFunc(func(_ context.Context, _, _ string, _ io.Reader, header http.Header) (*http.Response, error) {
				if (header.Get(OriginHeader) != "") != tc.valid {
					t.Fatalf("origin header = %q", header.Get(OriginHeader))
				}
				return httptest.NewRecorder().Result(), nil
			}))
			c.Origin = tc.origin
			if err := c.Call(context.Background(), http.MethodPost, "/v1/events", nil, nil); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestSkillsRequestAcceptsExistingJSONForms(t *testing.T) {
	for _, raw := range []string{`{"skills":"all","agent":"codex","target":"user"}`, `{"skills":["all"],"agent":"codex","target":"user"}`} {
		var got SkillsRequest
		if err := json.Unmarshal([]byte(raw), &got); err != nil {
			t.Fatal(err)
		}
		want := SkillsRequest{Skills: []string{"all"}, Agent: "codex", Target: "user"}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("decoded = %#v; want %#v", got, want)
		}
	}
}

func TestSessionKeepsBoxBookkeepingOffWire(t *testing.T) {
	raw, err := json.Marshal(Session{Name: "work", Dir: "/srv/work", CommandFile: "/private/command"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "command_file") || strings.Contains(string(raw), "/private/command") {
		t.Fatalf("session exposed box bookkeeping: %s", raw)
	}
}
