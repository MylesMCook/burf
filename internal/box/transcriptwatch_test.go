package box

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/events"
	"github.com/MylesMCook/burf/internal/hooks"
	"github.com/MylesMCook/burf/internal/transcript"
	"github.com/MylesMCook/burf/internal/wire"
)

func TestUnavailableSessionEnvironmentDoesNotReadDefaultAccount(t *testing.T) {
	t.Setenv("CLAUDE_CONFIG_DIR", t.TempDir())
	t.Setenv("CODEX_HOME", t.TempDir())
	dir := "/w/shop"
	at := time.Now().UTC()
	for _, provider := range []string{"claude", "codex"} {
		var path string
		if provider == "claude" {
			path = filepath.Join(transcript.ClaudeDir(dir), "aaaaaaaa-1.jsonl")
		} else {
			path = filepath.Join(os.Getenv("CODEX_HOME"), "sessions", "2026", "10", "08", "rollout-aaaaaaaa-1.jsonl")
		}
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			t.Fatal(err)
		}
		line, err := json.Marshal(map[string]any{"type": "user", "timestamp": at.Format(time.RFC3339Nano), "payload": map[string]string{"cwd": dir}, "message": map[string]string{"role": "user", "content": "default account"}})
		if err != nil {
			t.Fatal(err)
		}
		appendTo(t, path, string(line)+"\n")
	}
	b := &Box{Sessions: testSessions(t)}
	for _, provider := range []string{"claude", "codex"} {
		for _, canceled := range []bool{false, true} {
			ctx, cancel := context.WithCancel(context.Background())
			if canceled {
				cancel()
			}
			r := httptest.NewRequest("GET", "/", nil).WithContext(ctx)
			_, path, _ := b.transcriptFile(r, Session{Name: "missing", Preset: provider, Dir: dir, Created: at})
			cancel()
			if path != "" {
				t.Fatalf("%s canceled=%v: unavailable session read %q", provider, canceled, path)
			}
		}
	}
}

// clockWatch is a watcher on a clock the test moves, driven by hand.
func clockWatch(t *testing.T) (*transcriptWatch, *time.Time, *[]string) {
	now := time.Unix(1_700_000_000, 0)
	var sent []string
	w := newTranscriptWatch(func(session, dir string, size int64) { sent = append(sent, session) })
	w.manual = true
	w.now = func() time.Time { return now }
	return w, &now, &sent
}

func TestATranscriptOnAnotherAccountIsRead(t *testing.T) {
	bin := t.TempDir()
	if err := os.WriteFile(filepath.Join(bin, "claude"), []byte("#!/bin/sh\nexec sleep 600\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("CLAUDE_CONFIG_DIR", t.TempDir())
	account := t.TempDir()
	envFile := filepath.Join(t.TempDir(), "env.json")
	if err := saveBoxEnv(envFile, BoxEnv{Env: map[string]string{"CLAUDE_CONFIG_DIR": account}}); err != nil {
		t.Fatal(err)
	}
	c, _ := servedBox(t, func(b *Box) { b.EnvFile = envFile })
	call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "shop", "path": gitRepo(t)}, nil)
	call(t, c, "POST", "/v1/locations/shop/worktrees", "", WorktreeRequest{Name: "fix"}, nil)
	var sess Session
	if status := call(t, c, "POST", "/v1/sessions", "", SessionRequest{Location: "shop/fix", Command: "claude"}, &sess); status != 200 {
		t.Fatalf("session: %d", status)
	}
	proj := filepath.Join(account, "projects", filepath.Base(transcript.ClaudeDir(sess.Dir)))
	if err := os.MkdirAll(proj, 0o700); err != nil {
		t.Fatal(err)
	}
	at := time.Now().UTC().Add(time.Second).Format(time.RFC3339Nano)
	b, err := json.Marshal(map[string]any{"type": "user", "timestamp": at, "message": map[string]any{"role": "user", "content": "Fix the flaky test"}})
	if err != nil {
		t.Fatal(err)
	}
	appendTo(t, filepath.Join(proj, "conv.jsonl"), string(b)+"\n")
	var res transcript.Result
	if status := call(t, c, "GET", "/v1/sessions/"+url.PathEscape(sess.Name)+"/transcript?since=0", "", nil, &res); status != 200 || len(res.Items) != 1 {
		t.Fatalf("transcript: %d %+v", status, res)
	}
	if res.Items[0].Text != "Fix the flaky test" {
		t.Fatalf("wrong account content: %+v", res.Items)
	}
}

func appendTo(t *testing.T, path, s string) {
	t.Helper()
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0o600)
	if err != nil {
		t.Fatal(err)
	}
	f.WriteString(s)
	f.Close()
}

func TestTranscriptWatchSendsOnceAWriteSettles(t *testing.T) {
	w, now, sent := clockWatch(t)
	path := filepath.Join(t.TempDir(), "conv.jsonl")
	appendTo(t, path, "{}\n")
	w.seen("fix-claude", "/w/fix", path)
	step := func(d time.Duration) {
		*now = now.Add(d)
		w.tick()
	}
	// What the chat read is not news.
	step(watchBusy)
	step(watchBusy)
	if len(*sent) != 0 {
		t.Fatalf("sent %v before any write", *sent)
	}
	// A step written: sent once the file is still for a moment.
	appendTo(t, path, `{"type":"assistant"}`+"\n")
	step(watchBusy)
	if len(*sent) != 0 {
		t.Fatalf("sent while the write may go on")
	}
	step(watchBusy)
	if len(*sent) != 1 || (*sent)[0] != "fix-claude" {
		t.Fatalf("sent %v", *sent)
	}
	step(watchBusy)
	if len(*sent) != 1 {
		t.Fatalf("sent again without a write: %v", *sent)
	}
}

// An agent that writes without pause is still sent every settleMax, so a
// long burst doesn't hold the chat back.
func TestTranscriptWatchSendsDuringALongBurst(t *testing.T) {
	w, now, sent := clockWatch(t)
	path := filepath.Join(t.TempDir(), "conv.jsonl")
	w.seen("fix-claude", "/w/fix", path)
	for i := 0; i < 12; i++ {
		appendTo(t, path, "{}\n")
		*now = now.Add(watchBusy)
		w.seen("fix-claude", "/w/fix", path)
		w.tick()
	}
	if n := len(*sent); n < 2 || n > 4 {
		t.Fatalf("sent %d times in %v of writing", n, 12*watchBusy)
	}
}

// An agent at rest is looked at every second, not every 100ms.
func TestTranscriptWatchLooksLessOftenAtRest(t *testing.T) {
	w, now, sent := clockWatch(t)
	w.busy = func(string) bool { return false }
	path := filepath.Join(t.TempDir(), "conv.jsonl")
	appendTo(t, path, "{}\n")
	w.seen("fix-claude", "/w/fix", path)
	w.tick() // looked at now; next in a second
	appendTo(t, path, "{}\n")
	for i := 0; i < 5; i++ {
		*now = now.Add(watchBusy)
		w.tick()
	}
	if len(*sent) != 0 {
		t.Fatalf("an idle agent's file was looked at within a second")
	}
	*now = now.Add(watchIdle)
	w.tick()
	*now = now.Add(watchBusy)
	w.tick()
	if len(*sent) != 1 {
		t.Fatalf("sent %v", *sent)
	}
}

// A chat that stops reading (hidden, closed) stops the watching, and with
// nothing left the loop ends.
func TestTranscriptWatchForgetsAChatThatStoppedReading(t *testing.T) {
	w, now, sent := clockWatch(t)
	path := filepath.Join(t.TempDir(), "conv.jsonl")
	w.seen("fix-claude", "/w/fix", path)
	*now = now.Add(watchFor + time.Second)
	appendTo(t, path, "{}\n")
	if w.tick() {
		t.Fatal("still watching")
	}
	*now = now.Add(watchBusy)
	w.tick()
	if len(*sent) != 0 || len(w.files) != 0 {
		t.Fatalf("sent %v, watching %d", *sent, len(w.files))
	}
}

// A chat whose agent moved to another record (/clear) watches that one.
func TestTranscriptWatchFollowsANewRecord(t *testing.T) {
	w, now, sent := clockWatch(t)
	dir := t.TempDir()
	old, cur := filepath.Join(dir, "a.jsonl"), filepath.Join(dir, "b.jsonl")
	appendTo(t, old, "{}\n")
	w.seen("fix-claude", "/w/fix", old)
	appendTo(t, cur, "{}\n")
	w.seen("fix-claude", "/w/fix", cur)
	appendTo(t, cur, "{}\n")
	for i := 0; i < 3; i++ {
		*now = now.Add(watchBusy)
		w.tick()
	}
	if len(*sent) != 1 {
		t.Fatalf("sent %v", *sent)
	}
}

func TestChattyEventsSkipWildcardHooks(t *testing.T) {
	e := events.Event{Type: events.TranscriptChanged}
	for on, want := range map[string]bool{"*": false, "transcript.*": true, "transcript.changed": true, "session.*": false} {
		if got := hooks.Matches(hooks.Hook{On: on, Run: "true"}, e); got != want {
			t.Errorf("%q: %v", on, got)
		}
	}
	if !hooks.Matches(hooks.Hook{On: "*", Run: "true"}, events.Event{Type: "agent.started"}) {
		t.Error(`"*" no longer matches other events`)
	}
}

// claudeBox is a box with a worktree whose sessions run a stand-in for
// claude (script), and its event bus.
func claudeBox(t *testing.T, script string) (*wire.Client, *events.Bus, Session) {
	t.Helper()
	bin := t.TempDir()
	os.WriteFile(filepath.Join(bin, "claude"), []byte("#!/bin/sh\n"+script+"\n"), 0o755)
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("CLAUDE_CONFIG_DIR", t.TempDir())
	c, bus := servedBox(t)
	if status := call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "shop", "path": gitRepo(t)}, nil); status != 200 {
		t.Fatalf("add location: %d", status)
	}
	if status := call(t, c, "POST", "/v1/locations/shop/worktrees", "", WorktreeRequest{Name: "fix"}, nil); status != 200 {
		t.Fatalf("add worktree: %d", status)
	}
	var sess Session
	if status := call(t, c, "POST", "/v1/sessions", "", SessionRequest{Location: "shop/fix", Command: "claude"}, &sess); status != 200 {
		t.Fatalf("session: %d", status)
	}
	return c, bus, sess
}

// The whole way: a chat reads a session's transcript, the agent writes a
// step, and the box says so on its event stream at once.
func TestTranscriptChangedReachesTheEventStream(t *testing.T) {
	c, bus, sess := claudeBox(t, "exec sleep 600")
	time.Sleep(50 * time.Millisecond)
	line := func(v map[string]any) string { b, _ := json.Marshal(v); return string(b) + "\n" }
	at := time.Now().UTC().Add(time.Second).Format(time.RFC3339Nano)
	proj := transcript.ClaudeDir(sess.Dir)
	os.MkdirAll(proj, 0o755)
	rec := filepath.Join(proj, "conv.jsonl")
	appendTo(t, rec, line(map[string]any{"type": "user", "timestamp": at, "message": map[string]any{"role": "user", "content": "Fix the flaky test"}}))

	var res struct{ Items []map[string]any }
	if status := call(t, c, "GET", "/v1/sessions/"+url.PathEscape(sess.Name)+"/transcript?since=0", "", nil, &res); status != 200 || len(res.Items) != 1 {
		t.Fatalf("transcript: %d %v", status, res.Items)
	}
	ch, stop := bus.Subscribe()
	defer stop()
	start := time.Now()
	appendTo(t, rec, line(map[string]any{"type": "assistant", "timestamp": at, "message": map[string]any{"role": "assistant", "content": []map[string]any{{"type": "text", "text": "Found it."}}}}))
	deadline := time.After(3 * time.Second)
	for {
		select {
		case e := <-ch:
			if e.Type != events.TranscriptChanged {
				continue
			}
			if e.Data["session"] != sess.Name || e.Data["path"] != sess.Dir {
				t.Fatalf("event data %v", e.Data)
			}
			if took := time.Since(start); took > time.Second {
				t.Fatalf("took %v", took)
			}
			return
		case <-deadline:
			t.Fatal("no transcript.changed")
		}
	}
}

// GET …/draft reads the session's screen with its styles. The stand-in
// draws a captured Claude Code screen.
func TestDraftEndpointReadsTheScreen(t *testing.T) {
	fixture, _ := filepath.Abs(filepath.Join("testdata", "draft", "text-after-tools.ansi"))
	c, _, sess := claudeBox(t, `cat "`+fixture+`"; exec sleep 600`)
	var d Draft
	for i := 0; i < 40; i++ {
		if status := call(t, c, "GET", "/v1/sessions/"+url.PathEscape(sess.Name)+"/draft", "", nil, &d); status != 200 {
			t.Fatalf("draft: %d", status)
		}
		if d.Text != "" {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if d.Agent != "claude" || !strings.HasPrefix(d.Text, "The ancient Pharos of Alexandria") || d.Status == nil || d.Status.Word != "Whirring…" {
		t.Fatalf("draft: %+v %+v", d, d.Status)
	}
	// A session that isn't Claude Code's has none.
	var shell Session
	call(t, c, "POST", "/v1/sessions", "", SessionRequest{Location: "shop/fix", Command: "sleep 600"}, &shell)
	var none Draft
	if status := call(t, c, "GET", "/v1/sessions/"+url.PathEscape(shell.Name)+"/draft", "", nil, &none); status != 200 || none.Text != "" {
		t.Fatalf("shell: %d %+v", status, none)
	}
}

// A session started on another account (the usage plugin's
// CLAUDE_CONFIG_DIR in the box's env.json) reads its conversation from
// that account's folder, not berthd's own.
func TestConfiguredAccountTranscriptIsReadFromItsOwnHome(t *testing.T) {
	bin := t.TempDir()
	os.WriteFile(filepath.Join(bin, "claude"), []byte("#!/bin/sh\nexec sleep 600\n"), 0o755)
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("CLAUDE_CONFIG_DIR", t.TempDir())
	account := t.TempDir()
	envFile := filepath.Join(t.TempDir(), "env.json")
	if err := saveBoxEnv(envFile, BoxEnv{Env: map[string]string{"CLAUDE_CONFIG_DIR": account}}); err != nil {
		t.Fatal(err)
	}
	c, _ := servedBox(t, func(b *Box) { b.EnvFile = envFile })
	call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "shop", "path": gitRepo(t)}, nil)
	call(t, c, "POST", "/v1/locations/shop/worktrees", "", WorktreeRequest{Name: "fix"}, nil)
	var sess Session
	if status := call(t, c, "POST", "/v1/sessions", "", SessionRequest{Location: "shop/fix", Command: "claude"}, &sess); status != 200 {
		t.Fatalf("session: %d", status)
	}
	proj := transcript.ClaudeDirIn(account, sess.Dir)
	os.MkdirAll(proj, 0o755)
	at := time.Now().UTC().Add(time.Second).Format(time.RFC3339Nano)
	b, _ := json.Marshal(map[string]any{"type": "user", "timestamp": at, "message": map[string]any{"role": "user", "content": "Fix the flaky test"}})
	appendTo(t, filepath.Join(proj, "conv.jsonl"), string(b)+"\n")

	var res struct {
		Items  []map[string]any
		Reason string
	}
	if status := call(t, c, "GET", "/v1/sessions/"+url.PathEscape(sess.Name)+"/transcript?since=0", "", nil, &res); status != 200 || len(res.Items) != 1 {
		t.Fatalf("transcript: %d %v %s", status, res.Items, res.Reason)
	}
}
