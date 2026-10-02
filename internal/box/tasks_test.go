package box

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/sean-brydon/berthd/internal/events"
	"github.com/sean-brydon/berthd/internal/hooks"
)

func TestATaskIsAWorktreeWithItsAgentRunning(t *testing.T) {
	c, _ := servedBox(t)
	repo := gitRepo(t)
	call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "cal", "path": repo}, nil)

	var task Task
	status := call(t, c, "POST", "/v1/tasks", "", TaskRequest{Location: "cal", Name: "billing", Command: "cat"}, &task)
	if status != 200 {
		t.Fatalf("task: %d", status)
	}
	if task.Worktree.Name != "billing" || task.Session.Location != "cal/billing" || task.Session.Dir == "" {
		t.Fatalf("task = %+v", task)
	}
	if _, err := os.Stat(task.Worktree.Path); err != nil {
		t.Fatalf("worktree folder: %v", err)
	}
	if status := call(t, c, "POST", "/v1/tasks", "", TaskRequest{Location: "cal", Name: "x", Agent: "no-such-agent"}, nil); status != 400 {
		t.Fatalf("an unknown agent gave %d, want 400", status)
	}
}

func TestABeforeHookRefusesAWorktreeWithItsMessage(t *testing.T) {
	dir := t.TempDir()
	cfg := filepath.Join(dir, "hooks.json")
	os.WriteFile(cfg, []byte(`{"hooks":[{"on":"before:worktree.create","run":"echo no worktrees on fridays; exit 1"}]}`), 0o600)
	c, _ := servedBox(t, func(b *Box) { b.Hooks = &hooks.Runner{Path: cfg} })
	repo := gitRepo(t)
	call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "cal", "path": repo}, nil)

	var resp struct{ Error string }
	status := call(t, c, "POST", "/v1/tasks", "", TaskRequest{Location: "cal", Name: "billing", Command: "cat"}, &resp)
	if status != 403 || !strings.Contains(resp.Error, "no worktrees on fridays") {
		t.Fatalf("got %d %q, want 403 with the hook's message", status, resp.Error)
	}
	if _, err := os.Stat(filepath.Join(filepath.Dir(repo), filepath.Base(repo)+"-billing")); err == nil {
		t.Fatal("the worktree was made anyway")
	}
}

func TestAgentCommandsQuoteThePrompt(t *testing.T) {
	claude := AgentPreset{ID: "claude", Command: "claude"}
	if got := AgentCommand(claude, "fix the user's bug"); got != `claude 'fix the user'\''s bug'` {
		t.Fatalf("claude = %s", got)
	}
	gemini := AgentPreset{ID: "gemini", Command: "gemini", PromptFlag: "-i"}
	if got := AgentCommand(gemini, "hi"); got != "gemini -i 'hi'" {
		t.Fatalf("gemini = %s", got)
	}
	if agentOf("/usr/local/bin/claude --resume") != "claude" || agentOf("cat") != "" {
		t.Fatal("agentOf misread a command")
	}
}

func TestSessionNamesUseTheProgramNotItsPath(t *testing.T) {
	if n := defaultSessionName("cal/billing", "/home/me/.local/bin/claude --resume"); !strings.HasPrefix(n, "cal-billing-claude-") {
		t.Fatalf("name = %s", n)
	}
}

func TestAgentStatesSurviveARestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "agent-states.json")
	bus := &events.Bus{}
	ctx, cancel := context.WithCancel(context.Background())
	first := &AgentStates{Path: path}
	go first.Run(ctx, bus)
	deadline := time.Now().Add(5 * time.Second)
	for {
		bus.Publish(events.Event{Type: "agent.finished", Data: map[string]any{"path": "/w/fix"}})
		if _, err := os.Stat(path); err == nil || time.Now().After(deadline) {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	cancel()

	second := &AgentStates{Path: path}
	second.load()
	if st, ok := second.get("/w/fix"); !ok || st.state != "finished" {
		t.Fatalf("after a restart: %+v, %v", st, ok)
	}
}
