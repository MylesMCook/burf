package box

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/sean-brydon/berthd/internal/events"
)

func TestNewLinesFindsWhereTheLastLookEnded(t *testing.T) {
	cases := []struct {
		name        string
		tail, lines []string
		want        []string
		found       bool
	}{
		{"first look", nil, []string{"a", "b"}, []string{"a", "b"}, true},
		{"more after", []string{"a", "b", "c"}, []string{"a", "b", "c", "d", "e"}, []string{"d", "e"}, true},
		{"nothing new", []string{"a", "b", "c"}, []string{"x", "a", "b", "c"}, []string{}, true},
		{"old lines scrolled off", []string{"x", "y", "a", "b", "c"}, []string{"a", "b", "c", "d"}, []string{"d"}, true},
		// A block that repeats resolves to its latest copy.
		{"repeated block", []string{"ok", "ok", "ok"}, []string{"ok", "ok", "ok", "run", "ok", "ok", "ok", "new"}, []string{"new"}, true},
		{"cleared", []string{"a", "b", "c"}, []string{"p", "q"}, []string{"p", "q"}, false},
		// One line in common is not enough to trust.
		{"weak overlap", []string{"a", "b", "c"}, []string{"c", "z"}, []string{"c", "z"}, false},
	}
	for _, c := range cases {
		got, found := newLines(c.tail, c.lines)
		if found != c.found || strings.Join(got, ",") != strings.Join(c.want, ",") {
			t.Errorf("%s: newLines = %q, %v; want %q, %v", c.name, got, found, c.want, c.found)
		}
	}
}

func TestCleanAndRedact(t *testing.T) {
	if got := clean("\x1b[1;32mgreen\x1b[0m \x1b]0;title\x07done\r\x08\n"); got != "green done\n" {
		t.Fatalf("clean = %q", got)
	}
	hidden := []string{
		"API_TOKEN=abcdefghijklmnopqrstuvwxyz",
		"export DATABASE_URL='postgres://user:pass@host/db'",
		"using gh" + "p_abcdefghijklmnopqrstuvwxyz0123", // split so scanners do not take it for a token
		"-----BEGIN OPENSSH PRIVATE KEY-----",
	}
	for _, l := range hidden {
		if redact(l) != hiddenLine {
			t.Errorf("redact(%q) kept it", l)
		}
	}
	for _, l := range []string{"PORT=3000", "go test ./...", "Fixed the login redirect", "NODE_ENV=production"} {
		if redact(l) != l {
			t.Errorf("redact(%q) hid it", l)
		}
	}
}

func historyBox(t *testing.T) (*Box, *History) {
	t.Helper()
	dir := t.TempDir()
	b := &Box{Name: "devbox", Locations: NewLocations(filepath.Join(dir, "locations.json")), Events: &events.Bus{}, Sessions: testSessions(t)}
	claude := filepath.Join(dir, "claude")
	b.History = &History{Dir: filepath.Join(dir, "history"), ClaudeDirs: func() []string { return []string{claude} }}
	return b, b.History
}

func waitHistory(t *testing.T, b *Box, name string, atLeast int) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		out, _ := b.Sessions.tmux(context.Background(), "display-message", "-p", "-t", "="+name+":", "#{history_size}")
		if n, _ := strconv.Atoi(strings.TrimSpace(string(out))); n >= atLeast {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("%s never had %d lines of history", name, atLeast)
}

func TestTerminalHistoryKeepsEachLineOnceAndOutlivesTheSession(t *testing.T) {
	ctx := context.Background()
	b, h := historyBox(t)
	dir := t.TempDir()
	if _, err := b.Sessions.Create(ctx, "worker", "", dir, "seq 1 120; read x; echo DEPLOY_KEY=abcdefghijklmnopqrstuvwx; seq 121 300; sleep 60", nil); err != nil {
		t.Fatal(err)
	}
	waitHistory(t, b, "worker", 60)
	h.CaptureAll(ctx, b)
	h.CaptureAll(ctx, b) // nothing new: nothing appended
	b.Sessions.tmux(ctx, "send-keys", "-t", "=worker:", "Enter")
	waitHistory(t, b, "worker", 240)
	h.CaptureAll(ctx, b)

	// Stopping it the way the API does keeps its last screen.
	h.CaptureSession(ctx, b, "worker")
	if err := b.Sessions.Kill(ctx, "worker"); err != nil {
		t.Fatal(err)
	}
	h.CaptureAll(ctx, b)

	list := h.Sessions(ctx, b, HistoryFilter{Source: "terminal"})
	if len(list) != 1 || list[0].Name != "worker" || !list[0].Ended || list[0].State != "stopped" || list[0].Running != "" {
		t.Fatalf("sessions = %+v", list)
	}
	tr, err := h.Read(ctx, b, list[0].ID, 0, 5000)
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, l := range tr.Lines {
		if l.Text != "" {
			got = append(got, l.Text)
		}
		if l.Time.IsZero() {
			t.Fatalf("line %d has no time", l.N)
		}
	}
	got = append(got, tr.Screen...)
	// Every number once, in order, whether it ended in the log or on the
	// last screen, and the secret is never shown.
	next := 1
	for _, l := range got {
		if strings.Contains(l, "abcdefghij") {
			t.Fatalf("a secret was shown: %q", l)
		}
		if n, err := strconv.Atoi(l); err == nil {
			if n != next {
				t.Fatalf("line %q after %d; transcript:\n%s", l, next-1, strings.Join(got, "\n"))
			}
			next++
		}
	}
	if next != 301 {
		t.Fatalf("saw 1..%d, want 1..300", next-1)
	}
	if tr.Total < 200 || len(tr.Lines) != tr.Total {
		t.Fatalf("total %d, lines %d", tr.Total, len(tr.Lines))
	}
	page, _ := h.Read(ctx, b, list[0].ID, 10, 5)
	if len(page.Lines) != 5 || page.Lines[0].N != 10 || page.Lines[0].Text != "11" {
		t.Fatalf("page = %+v", page.Lines)
	}

	matches, err := h.Search(ctx, b, "^15$", true, HistoryFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(matches) != 1 || matches[0].Line != "15" || strings.Join(matches[0].Before, ",") != "13,14" || strings.Join(matches[0].After, ",") != "16,17" {
		t.Fatalf("matches = %+v", matches)
	}
	if m, _ := h.Search(ctx, b, "^15$", true, HistoryFilter{ID: "term:other-1"}); len(m) != 0 {
		t.Fatalf("another session's search matched: %+v", m)
	}
	if m, _ := h.Search(ctx, b, "deploy_key", false, HistoryFilter{}); len(m) != 0 {
		t.Fatalf("a hidden line matched: %+v", m)
	}
	if _, err := h.Search(ctx, b, "(", true, HistoryFilter{}); err == nil {
		t.Fatal("a bad pattern was accepted")
	}

	// A fresh History reads what the last one saved.
	again := &History{Dir: h.Dir, ClaudeDirs: h.ClaudeDirs}
	if l := again.Sessions(ctx, b, HistoryFilter{}); len(l) != 1 || l[0].Lines != list[0].Lines {
		t.Fatalf("reloaded = %+v", l)
	}
}

const fakeTranscript = `{"type":"user","timestamp":"2026-01-02T10:00:00Z","sessionId":"abc123","cwd":"/work/app","message":{"role":"user","content":"Fix the login redirect"}}
{"type":"assistant","timestamp":"2026-01-02T10:00:05Z","sessionId":"abc123","cwd":"/work/app","message":{"role":"assistant","content":[{"type":"thinking","thinking":"secret plans"},{"type":"text","text":"Looking at the redirect."},{"type":"tool_use","name":"Bash","input":{"command":"grep -rn redirect src/"}}]}}
{"type":"user","timestamp":"2026-01-02T10:00:06Z","sessionId":"abc123","cwd":"/work/app","message":{"role":"user","content":[{"type":"tool_result","content":"src/login.ts:12: redirect('/home')\nSTRIPE_SECRET=placeholder0123456789abcdef"}]}}
{"type":"assistant","timestamp":"2026-01-02T10:00:09Z","sessionId":"abc123","cwd":"/work/app","isSidechain":true,"message":{"role":"assistant","content":[{"type":"text","text":"a subagent's aside"}]}}
{"type":"user","timestamp":"2026-01-02T10:01:00Z","sessionId":"abc123","cwd":"/work/app","message":{"role":"user","content":"<command-name>/clear</command-name>"}}
{"type":"assistant","timestamp":"2026-01-02T10:01:30Z","sessionId":"abc123","cwd":"/work/app","message":{"role":"assistant","content":[{"type":"text","text":"Fixed: the redirect now keeps the return path."}]}}
not json
{"type":"ai-title","aiTitle":"Fix login redirect","sessionId":"abc123"}
`

func TestClaudeTranscriptsHaveTurnsAndLinkToTheirTerminal(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	claude := filepath.Join(dir, "claude")
	os.MkdirAll(filepath.Join(claude, "projects", "-work-app"), 0o755)
	os.WriteFile(filepath.Join(claude, "projects", "-work-app", "abc123.jsonl"), []byte(fakeTranscript), 0o644)
	h := &History{Dir: filepath.Join(dir, "history"), ClaudeDirs: func() []string { return []string{claude} }}
	b := &Box{Name: "devbox", Events: &events.Bus{}}

	// A terminal session that ran claude in the same folder at the time.
	h.mu.Lock()
	h.load()
	started := time.Date(2026, 1, 2, 9, 59, 50, 0, time.UTC)
	h.index["term:worker-x"] = &HistorySession{ID: "term:worker-x", Source: "terminal", Name: "worker", Agent: "claude", Path: "/work/app",
		Started: started, Updated: started.Add(5 * time.Minute), Ended: true}
	h.mu.Unlock()

	list := h.Sessions(ctx, b, HistoryFilter{Source: "claude"})
	if len(list) != 1 {
		t.Fatalf("sessions = %+v", list)
	}
	s := list[0]
	if s.ID != "claude:abc123" || s.Title != "Fix login redirect" || s.Path != "/work/app" || s.Lines != 5 ||
		!s.Started.Equal(time.Date(2026, 1, 2, 10, 0, 0, 0, time.UTC)) || len(s.Linked) != 1 || s.Linked[0] != "term:worker-x" {
		t.Fatalf("session = %+v", s)
	}

	tr, err := h.Read(ctx, b, "claude:abc123", 0, 100)
	if err != nil {
		t.Fatal(err)
	}
	var roles []string
	for _, turn := range tr.Turns {
		roles = append(roles, turn.Role)
		if strings.Contains(turn.Text, "secret plans") || strings.Contains(turn.Text, "placeholder0123") || strings.Contains(turn.Text, "aside") {
			t.Fatalf("turn shows what it should not: %+v", turn)
		}
	}
	if strings.Join(roles, ",") != "user,assistant,tool,result,assistant" || tr.Total != 5 {
		t.Fatalf("roles = %v, total %d", roles, tr.Total)
	}
	if tr.Turns[2].Tool != "Bash" || tr.Turns[2].Text != "grep -rn redirect src/" || !strings.Contains(tr.Turns[3].Text, hiddenLine) {
		t.Fatalf("tool turns = %+v", tr.Turns[2:4])
	}
	page, _ := h.Read(ctx, b, "claude:abc123", 4, 10)
	if len(page.Turns) != 1 || page.Turns[0].N != 4 {
		t.Fatalf("page = %+v", page.Turns)
	}

	m, err := h.Search(ctx, b, "REDIRECT", false, HistoryFilter{Agent: "claude", Source: "claude"})
	if err != nil {
		t.Fatal(err)
	}
	if len(m) != 5 || m[0].Role != "user" || m[0].Position != 0 || m[3].Role != "result" || m[3].Line != "src/login.ts:12: redirect('/home')" {
		t.Fatalf("matches = %+v", m)
	}
	if m, _ := h.Search(ctx, b, "redirect", false, HistoryFilter{Since: time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC)}); len(m) != 0 {
		t.Fatalf("since did not filter: %+v", m)
	}
	if _, err := h.Read(ctx, b, "claude:nope", 0, 10); err != ErrUnknownHistory {
		t.Fatalf("unknown id: %v", err)
	}
}

func TestHistoryIDsAndAges(t *testing.T) {
	for _, id := range []string{"term:worker-abc", "claude:2f1c-9a"} {
		if !historyID.MatchString(id) {
			t.Errorf("%q refused", id)
		}
	}
	for _, id := range []string{"term:../x", "claude:", "other:x", "term:a/b"} {
		if historyID.MatchString(id) {
			t.Errorf("%q allowed", id)
		}
	}
	if d, err := parseAge("7d"); err != nil || d != 7*24*time.Hour {
		t.Errorf("7d = %v, %v", d, err)
	}
	if d, err := parseAge("90m"); err != nil || d != 90*time.Minute {
		t.Errorf("90m = %v, %v", d, err)
	}
}
