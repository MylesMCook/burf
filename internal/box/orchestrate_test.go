package box

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/sean-brydon/berth/internal/events"
	"github.com/sean-brydon/berth/internal/hooks"
)

func TestSendWaitAndExecOrchestrateASession(t *testing.T) {
	states := &AgentStates{}
	c, bus := servedBox(t, func(b *Box) { b.AgentStates = states })
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go states.Run(ctx, bus)
	repo := gitRepo(t)
	call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "cal", "path": repo}, nil)

	// A stand-in agent: named claude, it echoes what it is sent.
	bin := t.TempDir()
	fake := filepath.Join(bin, "claude")
	os.WriteFile(fake, []byte("#!/bin/sh\nexec cat\n"), 0o755)
	var sess Session
	call(t, c, "POST", "/v1/sessions", "", map[string]string{"location": "cal", "name": "agent", "command": fake}, &sess)

	if status := call(t, c, "POST", "/v1/sessions/agent/send", "", map[string]any{"text": "line one\nline two"}, nil); status != 200 {
		t.Fatalf("send: %d", status)
	}
	deadline := time.Now().Add(5 * time.Second)
	for {
		var screen struct{ Screen string }
		call(t, c, "GET", "/v1/sessions/agent/screen", "", nil, &screen)
		if strings.Contains(screen.Screen, "line two") {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("the paste never arrived: %q", screen.Screen)
		}
		time.Sleep(50 * time.Millisecond)
	}

	// An old "finished" does not end a wait that started after it.
	bus.Publish(events.Event{Type: "agent.finished", Data: map[string]any{"path": sess.Dir}})
	time.Sleep(100 * time.Millisecond)
	after := time.Now().UTC().Format(time.RFC3339Nano)
	var res WaitResult
	call(t, c, "GET", "/v1/sessions/agent/wait?for=finished&timeout=1s&after="+after, "", nil, &res)
	if !res.TimedOut {
		t.Fatalf("a stale state ended the wait: %+v", res)
	}
	go func() {
		time.Sleep(300 * time.Millisecond)
		bus.Publish(events.Event{Type: "agent.finished", Data: map[string]any{"path": sess.Dir}})
	}()
	res = WaitResult{}
	call(t, c, "GET", "/v1/sessions/agent/wait?for=finished&timeout=10s&after="+after, "", nil, &res)
	if res.State != "finished" || res.TimedOut {
		t.Fatalf("wait = %+v", res)
	}

	var ex ExecResult
	call(t, c, "POST", "/v1/exec", "", ExecRequest{Location: "cal", Command: "echo checking; exit 3"}, &ex)
	if ex.ExitCode != 3 || !strings.Contains(ex.Output, "checking") {
		t.Fatalf("exec = %+v", ex)
	}
}

func TestHooksCanBeReadAndReplacedOverTheAPI(t *testing.T) {
	path := filepath.Join(t.TempDir(), "hooks.json")
	c, _ := servedBox(t, func(b *Box) { b.Hooks = &hooks.Runner{Path: path} })
	var doc HooksDoc
	if status := call(t, c, "PUT", "/v1/hooks", "", HooksDoc{Hooks: []hooks.Hook{{On: "nope", Run: "x"}}}, nil); status != 400 {
		t.Fatalf("an invalid hook gave %d", status)
	}
	call(t, c, "PUT", "/v1/hooks", "", HooksDoc{Hooks: []hooks.Hook{{On: "agent.waiting", Run: "say hi"}}}, &doc)
	call(t, c, "GET", "/v1/hooks", "", nil, &doc)
	if len(doc.Hooks) != 1 || doc.Hooks[0].Run != "say hi" || doc.Path != path {
		t.Fatalf("hooks = %+v", doc)
	}
}

func TestExecKeepsTheEndOfLongOutput(t *testing.T) {
	var tb tailBuffer
	tb.Write([]byte(strings.Repeat("a", execOutputLimit)))
	tb.Write([]byte("the end"))
	if !tb.dropped || tb.Len() != execOutputLimit || !strings.HasSuffix(tb.String(), "the end") {
		t.Fatalf("len %d dropped %v", tb.Len(), tb.dropped)
	}
}
