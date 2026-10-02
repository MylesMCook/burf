package hooks

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/sean-brydon/berthd/internal/events"
)

func TestMatches(t *testing.T) {
	created := events.Event{Type: "worktree.created", Origin: "berth"}
	fromOrca := events.Event{Type: "worktree.created", Origin: "orca"}
	for _, tc := range []struct {
		hook Hook
		e    events.Event
		want bool
	}{
		{Hook{On: "worktree.created", Run: "x"}, created, true},
		{Hook{On: "worktree.*", Run: "x"}, created, true},
		{Hook{On: "*", Run: "x"}, created, true},
		{Hook{On: "session.*", Run: "x"}, created, false},
		{Hook{On: "worktree", Run: "x"}, created, false},
		{Hook{On: "worktree.created"}, created, false},
		// The loop guard: a hook never reacts to its own tool's changes.
		{Hook{On: "worktree.created", Run: "x", Tool: "orca"}, fromOrca, false},
		{Hook{On: "worktree.created", Run: "x", Tool: "orca"}, created, true},
		{Hook{On: "worktree.created", Run: "x", Tool: "herdr"}, fromOrca, true},
	} {
		if got := Matches(tc.hook, tc.e); got != tc.want {
			t.Errorf("Matches(%+v, %s from %s) = %v, want %v", tc.hook, tc.e.Type, tc.e.Origin, got, tc.want)
		}
	}
}

func TestEnvDescribesTheEventAndStampsTheOrigin(t *testing.T) {
	e := events.Event{Type: "worktree.created", Box: "devl", Origin: "berth", Data: map[string]any{"path": "/home/alex/work/cal-x", "location": "cal", "first-port": 3000}}
	env := Env(e, "orca")
	for _, want := range []string{
		"BERTH_EVENT=worktree.created", "BERTH_EVENT_BOX=devl", "BERTH_EVENT_ORIGIN=berth",
		"BERTH_ORIGIN=orca", "BERTH_PATH=/home/alex/work/cal-x", "BERTH_LOCATION=cal", "BERTH_FIRST_PORT=3000",
	} {
		if !slices.Contains(env, want) {
			t.Errorf("env missing %s: %v", want, env)
		}
	}
	if !slices.Contains(Env(e, ""), "BERTH_ORIGIN=hook") {
		t.Error("a hook without a tool must still stamp an origin")
	}
}

// exec keeps the last of duplicate variables, so data named like a fixed
// variable could otherwise replace the origin that stops hook loops.
func TestEventDataCannotReplaceFixedVariables(t *testing.T) {
	e := events.Event{Type: "agent.finished", Origin: "claude", Data: map[string]any{"origin": "berth", "event": "x.y", "path": "/w"}}
	env := Env(e, "orca")
	for _, bad := range []string{"BERTH_ORIGIN=berth", "BERTH_EVENT=x.y"} {
		if slices.Contains(env, bad) {
			t.Errorf("event data set %s: %v", bad, env)
		}
	}
	if !slices.Contains(env, "BERTH_ORIGIN=orca") || !slices.Contains(env, "BERTH_PATH=/w") {
		t.Errorf("env = %v", env)
	}
}

func TestRunnerRunsMatchingHooksWithTheEventOnStdin(t *testing.T) {
	dir := t.TempDir()
	out := filepath.Join(dir, "out")
	cfg := Config{Hooks: []Hook{
		{On: "worktree.*", Run: "cat > " + out + "; echo \" $BERTH_ORIGIN\" >> " + out, Tool: "herdr"},
		{On: "session.started", Run: "echo should-not-run >> " + out},
	}}
	b, _ := json.Marshal(cfg)
	path := filepath.Join(dir, "hooks.json")
	os.WriteFile(path, b, 0o600)

	var bus events.Bus
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	r := &Runner{Path: path, Log: log.New(io.Discard, "", 0)}
	go r.Run(ctx, &bus)
	time.Sleep(50 * time.Millisecond)
	bus.Publish(events.Event{Type: "worktree.created", Box: "devl", Data: map[string]any{"name": "billing"}})

	deadline := time.Now().Add(5 * time.Second)
	for {
		got, _ := os.ReadFile(out)
		if strings.Contains(string(got), `"name":"billing"`) && strings.Contains(string(got), " herdr") {
			if strings.Contains(string(got), "should-not-run") {
				t.Fatal("a non-matching hook ran")
			}
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("hook output = %q", got)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func TestABrokenConfigRunsNothingAndDoesNotCrash(t *testing.T) {
	path := filepath.Join(t.TempDir(), "hooks.json")
	os.WriteFile(path, []byte("{not json"), 0o600)
	r := &Runner{Path: path, Log: log.New(io.Discard, "", 0)}
	r.handle(context.Background(), events.Event{Type: "worktree.created"})
}

func TestBeforeHooksGateOnlyTheirAction(t *testing.T) {
	dir := t.TempDir()
	cfg := `{"hooks":[
		{"on":"before:worktree.create","run":"echo 'branches must start with fix/' >&2; exit 1"},
		{"on":"worktree.create","run":"exit 1"}
	]}`
	os.WriteFile(filepath.Join(dir, "hooks.json"), []byte(cfg), 0o600)
	r := &Runner{Path: filepath.Join(dir, "hooks.json")}
	err := r.Before(context.Background(), events.Event{Type: "worktree.create"})
	if err == nil || !strings.Contains(err.Error(), "branches must start with fix/") {
		t.Fatalf("err = %v, want the hook's refusal", err)
	}
	if err := r.Before(context.Background(), events.Event{Type: "session.start"}); err != nil {
		t.Fatalf("an unrelated action was stopped: %v", err)
	}
	if Matches(Hook{On: "before:*", Run: "x"}, events.Event{Type: "worktree.create"}) {
		t.Fatal("a before hook also ran as an event hook")
	}
	var nilRunner *Runner
	if err := nilRunner.Before(context.Background(), events.Event{Type: "worktree.create"}); err != nil {
		t.Fatalf("a nil runner refused: %v", err)
	}
}

func TestPluginHooksRunInThePluginsFolderUnlessDisabled(t *testing.T) {
	plugins := t.TempDir()
	dir := filepath.Join(plugins, "notify")
	os.MkdirAll(dir, 0o700)
	os.WriteFile(filepath.Join(dir, PluginManifest), []byte(`{"id":"notify","hooks":[{"on":"before:session.start","run":"pwd; exit 3"}]}`), 0o600)
	r := &Runner{Path: filepath.Join(t.TempDir(), "missing.json"), PluginsDir: plugins}
	err := r.Before(context.Background(), events.Event{Type: "session.start"})
	resolved, _ := filepath.EvalSymlinks(dir)
	if err == nil || !strings.Contains(err.Error(), resolved) {
		t.Fatalf("err = %v, want the hook to run in %s", err, resolved)
	}
	os.WriteFile(filepath.Join(dir, "disabled"), nil, 0o600)
	if err := r.Before(context.Background(), events.Event{Type: "session.start"}); err != nil {
		t.Fatalf("a disabled plugin's hook ran: %v", err)
	}
}

func TestSaveWritesOnlyYourOwnValidHooks(t *testing.T) {
	plugins := t.TempDir()
	os.MkdirAll(filepath.Join(plugins, "p"), 0o700)
	os.WriteFile(filepath.Join(plugins, "p", PluginManifest), []byte(`{"hooks":[{"on":"agent.finished","run":"true"}]}`), 0o600)
	r := &Runner{Path: filepath.Join(t.TempDir(), "hooks.json"), PluginsDir: plugins}
	for _, bad := range []Hook{{On: "Worktree Created", Run: "x"}, {On: "agent.finished", Run: " "}, {On: "agent.*", Run: "x", Timeout: "soon"}} {
		if err := r.Save([]Hook{bad}); err == nil {
			t.Fatalf("saved %+v", bad)
		}
	}
	cfg, _ := r.Load()
	all := append(cfg.Hooks, Hook{On: "before:worktree.create", Run: "true", Timeout: "10s"})
	if err := r.Save(all); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(r.Path)
	if strings.Contains(string(b), "plugin:") || !strings.Contains(string(b), "before:worktree.create") {
		t.Fatalf("hooks.json = %s", b)
	}
	cfg, _ = r.Load()
	if len(cfg.Hooks) != 2 || cfg.Hooks[1].Source != "plugin:p" {
		t.Fatalf("loaded %+v", cfg.Hooks)
	}
}
