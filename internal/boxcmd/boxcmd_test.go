package boxcmd

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sean-brydon/berthd/internal/box"
)

// recorder is a fake box that records each request and replies with body.
type recorder struct {
	method, path, origin string
	body                 map[string]any
	reply                string
}

func (r *recorder) DoWithHeader(_ context.Context, method, path string, body io.Reader, h http.Header) (*http.Response, error) {
	r.method, r.path, r.origin = method, path, h.Get(box.OriginHeader)
	r.body = nil
	if body != nil {
		json.NewDecoder(body).Decode(&r.body)
	}
	rec := httptest.NewRecorder()
	rec.WriteString(r.reply)
	return rec.Result(), nil
}

func run(t *testing.T, reply string, args ...string) (*recorder, string) {
	t.Helper()
	r := &recorder{reply: reply}
	var out bytes.Buffer
	if err := Run(context.Background(), &box.Client{Doer: r}, args, &out); err != nil {
		t.Fatalf("%v: %v", args, err)
	}
	return r, out.String()
}

func TestFlagsMayFollowTheReference(t *testing.T) {
	r, _ := run(t, `{"name":"billing","path":"/w/cal-billing","branch":"alex/billing"}`,
		"worktree", "new", "cal/billing", "--base", "main", "--branch", "alex/billing")
	if r.method != "POST" || r.path != "/v1/locations/cal/worktrees" {
		t.Fatalf("request %s %s", r.method, r.path)
	}
	for k, want := range map[string]string{"name": "billing", "base": "main", "branch": "alex/billing"} {
		if r.body[k] != want {
			t.Errorf("body[%s] = %v, want %s", k, r.body[k], want)
		}
	}
}

func TestSessionNewPassesTheCommandAfterDoubleDash(t *testing.T) {
	r, _ := run(t, `{"name":"s","dir":"/w"}`, "session", "new", "cal/billing", "--name", "fix", "--", "claude", "--resume", "--model", "x")
	if r.body["location"] != "cal/billing" || r.body["name"] != "fix" || r.body["command"] != "claude --resume --model x" {
		t.Fatalf("session body = %v", r.body)
	}
}

func TestLocationAddAndRemoveWorktree(t *testing.T) {
	r, out := run(t, `{"name":"cal","path":"/home/alex/work/cal","repo":true,"worktrees":[{"name":"cal","main":true}]}`, "location", "add", "cal", "~/work/cal")
	if r.body["name"] != "cal" || r.body["path"] != "~/work/cal" || !strings.Contains(out, "git repository") {
		t.Fatalf("location add: %v %q", r.body, out)
	}
	r, _ = run(t, `{}`, "worktree", "rm", "cal/billing", "--force")
	if r.method != "DELETE" || r.path != "/v1/locations/cal/worktrees/billing?force=1" {
		t.Fatalf("worktree rm: %s %s", r.method, r.path)
	}
}

func TestEmitCarriesDataAndOrigin(t *testing.T) {
	r, _ := run(t, `{"ok":true}`, "emit", "agent.finished", "path=/w/cal", "--origin", "cursor", "status=done")
	if r.body["type"] != "agent.finished" || r.origin != "cursor" {
		t.Fatalf("emit: %v origin %q", r.body, r.origin)
	}
	data, _ := r.body["data"].(map[string]any)
	if data["path"] != "/w/cal" || data["status"] != "done" {
		t.Fatalf("emit data = %v", data)
	}
}

func TestShareUsesThePort(t *testing.T) {
	r, out := run(t, `{"id":"ab12","port":3000,"url":"https://x.trycloudflare.com"}`, "share", "3000")
	if r.body["port"] != float64(3000) || !strings.Contains(out, "https://x.trycloudflare.com") || !strings.Contains(out, "unshare ab12") {
		t.Fatalf("share: %v %q", r.body, out)
	}
}

func TestUsageErrors(t *testing.T) {
	for _, args := range [][]string{
		{"worktree", "new", "no-slash"},
		{"location", "add", "only-name"},
		{"share", "not-a-port"},
		{"emit"},
		{"nope"},
	} {
		if err := Run(context.Background(), &box.Client{Doer: &recorder{reply: "{}"}}, args, io.Discard); err == nil {
			t.Errorf("%v accepted", args)
		}
	}
}

func TestUnitsListsWhatTheBoxReports(t *testing.T) {
	reply := `[{"name":"berth-orca","state":"installed","log_path":"/home/sean/.config/berth/units/berth-orca.log"}]`
	rec, out := run(t, reply, "units")
	if rec.path != "/v1/units" {
		t.Fatalf("called %q; want /v1/units", rec.path)
	}
	if !strings.Contains(out, "berth-orca") || !strings.Contains(out, "installed") {
		t.Fatalf("units output = %q; want the unit and its state", out)
	}
}

func TestUnitAddSendsTheCommandAfterDoubleDash(t *testing.T) {
	reply := `{"name":"berth-orca","state":"installed","log_path":"/tmp/berth-orca.log"}`
	rec, _ := run(t, reply, "unit", "add", "berth-orca", "--", "orca", "serve")
	if rec.body["program"] != "orca" {
		t.Fatalf("program = %v; want orca", rec.body["program"])
	}
	args, ok := rec.body["args"].([]any)
	if !ok || len(args) != 1 || args[0] != "serve" {
		t.Fatalf("args = %v; want [serve]", rec.body["args"])
	}
}

func TestPreviewAnnouncesTheWorktreesPage(t *testing.T) {
	locs := `[{"name":"cal","path":"/w/cal","repo":true,"worktrees":[{"name":"cal","path":"/w/cal","main":true,"port":41000},{"name":"billing","path":"/w/cal-billing","port":41010}]}]`
	r, out := run(t, locs, "preview", "cal/billing", "--path", "settings")
	if r.path != "/v1/events" || r.body["type"] != "preview.open" {
		t.Fatalf("request %s %v", r.path, r.body)
	}
	data, _ := r.body["data"].(map[string]any)
	if data["path"] != "/w/cal-billing" || data["port"] != float64(41010) || data["url_path"] != "/settings" || data["location"] != "cal" {
		t.Fatalf("data = %v", data)
	}
	if !strings.Contains(out, "41010/settings") {
		t.Fatalf("out = %q", out)
	}
	// A port given explicitly wins; a bare location means its main checkout.
	r, _ = run(t, locs, "preview", "cal", "5173")
	data, _ = r.body["data"].(map[string]any)
	if data["port"] != float64(5173) || data["path"] != "/w/cal" {
		t.Fatalf("data = %v", data)
	}
}

func TestWordsAfterDoubleDashKeepTheirQuoting(t *testing.T) {
	for words, want := range map[string]string{
		"claude\x00Create loop.sh, don't commit": `claude 'Create loop.sh, don'\''t commit'`,
		"pnpm test && echo ok":                   "pnpm test && echo ok",
		"ls\x00-la":                              "ls -la",
	} {
		if got := commandLine(strings.Split(words, "\x00")); got != want {
			t.Errorf("%q → %s, want %s", words, got, want)
		}
	}
}
