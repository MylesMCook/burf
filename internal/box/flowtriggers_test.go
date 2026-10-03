package box

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/sean-brydon/berthd/internal/events"
)

func TestTriggersAreValidated(t *testing.T) {
	steps := []Step{{Kind: "run", Command: "true"}}
	ok := []Trigger{{Event: "agent.finished"}, {Schedule: "@daily"}, {Schedule: "0 2 * * *", EachWorktree: true}, {GitHub: &GitHubTrigger{On: "check_failed", Poll: "5m"}}}
	for _, tr := range ok {
		if err := ValidateFlows([]Flow{{ID: "f", Name: "F", Trigger: tr, Steps: steps}}); err != nil {
			t.Errorf("%+v: %v", tr, err)
		}
	}
	bad := []Trigger{{}, {Event: "agent.finished", Schedule: "@daily"}, {Schedule: "every day"}, {GitHub: &GitHubTrigger{On: "push"}},
		{GitHub: &GitHubTrigger{On: "pr_merged", Poll: "10s"}}, {Event: "agent.finished", EachWorktree: true}}
	for _, tr := range bad {
		if err := ValidateFlows([]Flow{{ID: "f", Name: "F", Trigger: tr, Steps: steps}}); err == nil {
			t.Errorf("accepted %+v", tr)
		}
	}
}

func TestScheduledFlowsRunPerWorktreeOrAtTheRepoOnce(t *testing.T) {
	ctx := context.Background()
	out := filepath.Join(t.TempDir(), "ran")
	b, _, _ := flowBox(t, []Flow{
		{ID: "nightly", Name: "Nightly", Enabled: true, Trigger: Trigger{Schedule: "0 2 * * *", EachWorktree: true},
			Steps: []Step{{Kind: "run", Command: "echo 'each {{worktree.name}} {{event.schedule}}' >> " + out}}},
		{ID: "repo", Name: "Repo", Enabled: true, Trigger: Trigger{Schedule: "@hourly"},
			Steps: []Step{{Kind: "run", Command: "echo once {{worktree.name}} >> " + out}}},
	})
	b.Locations.CreateWorktree(ctx, "cal", "fix-login", "", "")
	at := time.Date(2026, 10, 3, 2, 0, 0, 0, time.Local)
	if n := b.fireScheduled(ctx, at); n != 3 {
		t.Fatalf("started %d runs at 02:00, want 2 worktrees + 1 repo run", n)
	}
	if n := b.fireScheduled(ctx, at); n != 0 {
		t.Fatalf("the same minute fired again (%d)", n)
	}
	if n := b.fireScheduled(ctx, at.Add(30*time.Minute)); n != 0 {
		t.Fatalf("02:30 started %d runs", n)
	}
	deadline := time.Now().Add(10 * time.Second)
	for {
		got, _ := os.ReadFile(out)
		lines := strings.Split(strings.TrimSpace(string(got)), "\n")
		if len(lines) == 3 {
			joined := string(got)
			if !strings.Contains(joined, "each billing 0 2 * * *") || !strings.Contains(joined, "each fix-login") || !strings.Contains(joined, "once cal") {
				t.Fatalf("runs wrote:\n%s", got)
			}
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("runs wrote:\n%s", got)
		}
		time.Sleep(50 * time.Millisecond)
	}
}

// fakeGH puts a gh on PATH that serves canned JSON from dir/pr.json and
// dir/lines.json.
func fakeGH(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	script := `#!/bin/sh
case "$1" in
  pr) cat "` + dir + `/pr.json" ;;
  api) cat "` + dir + `/lines.json" 2>/dev/null || echo '[]' ;;
esac
`
	os.WriteFile(filepath.Join(dir, "gh"), []byte(script), 0o755)
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
	return dir
}

func TestGitHubFlowsStartOnWhatIsNewSinceTheLastLook(t *testing.T) {
	ctx := context.Background()
	gh := fakeGH(t)
	out := filepath.Join(t.TempDir(), "ran")
	b, _, _ := flowBox(t, []Flow{
		{ID: "comments", Name: "Comments", Enabled: true, Trigger: Trigger{GitHub: &GitHubTrigger{On: "review_comment"}},
			Steps: []Step{{Kind: "run", Command: "echo '{{event.author}}: {{event.body}} [{{event.file}}] #{{event.pr}}' >> " + out}}},
		{ID: "checks", Name: "Checks", Enabled: true, Trigger: Trigger{GitHub: &GitHubTrigger{On: "check_failed"}},
			Steps: []Step{{Kind: "run", Command: "echo 'check {{event.check}}' >> " + out}}},
	})
	pr := func(comments, checks string) {
		os.WriteFile(filepath.Join(gh, "pr.json"), []byte(`{"number":42,"url":"https://github.com/acme/cal/pull/42","title":"Billing","state":"OPEN",
			"comments":[`+comments+`],"reviews":[],"statusCheckRollup":[`+checks+`]}`), 0o644)
	}
	pr(`{"id":"c1","body":"old","author":{"login":"ann"}}`, `{"name":"lint","conclusion":"SUCCESS"}`)
	now := time.Now()
	if n := b.pollGitHub(ctx, now); n != 0 {
		t.Fatalf("the first look started %d runs; it should only record what is there", n)
	}
	pr(`{"id":"c1","body":"old","author":{"login":"ann"}},{"id":"c2","body":"please rename","author":{"login":"bob"}}`,
		`{"name":"lint","conclusion":"SUCCESS"},{"name":"tests","conclusion":"FAILURE","completedAt":"t1","detailsUrl":"https://ci/1"}`)
	os.WriteFile(filepath.Join(gh, "lines.json"), []byte(`[{"id":7,"body":"off by one","path":"billing.ts","line":12,"user":{"login":"cy"}}]`), 0o644)
	if n := b.pollGitHub(ctx, now.Add(30*time.Second)); n != 0 {
		t.Fatalf("polled again before its interval (%d runs)", n)
	}
	// The line comment is new to the first look too, but that look had no
	// line comments; it counts from here on.
	if n := b.pollGitHub(ctx, now.Add(3*time.Minute)); n != 3 {
		t.Fatalf("started %d runs, want a comment, a line comment and a failed check", n)
	}
	deadline := time.Now().Add(10 * time.Second)
	for {
		got, _ := os.ReadFile(out)
		s := string(got)
		if strings.Count(s, "\n") >= 3 {
			for _, want := range []string{"bob: please rename [] #42", "cy: off by one [billing.ts] #42", "check tests"} {
				if !strings.Contains(s, want) {
					t.Fatalf("missing %q in:\n%s", want, s)
				}
			}
			if strings.Contains(s, "old") {
				t.Fatalf("an old comment ran:\n%s", s)
			}
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("runs wrote:\n%s", s)
		}
		time.Sleep(50 * time.Millisecond)
	}
}

func TestTheGuardStopsIdleServicesThenPausesIdleAgentsOnly(t *testing.T) {
	ctx := context.Background()
	b, sess, wt := flowBox(t, nil)
	units := &Units{Dir: t.TempDir()}
	ops, _ := fakeService()
	units.svc = ops
	b.Units = units
	loc, _ := b.Locations.Get(ctx, "cal")
	writeRepoConfig(t, loc.Path, RepoConfig{Services: []WorktreeService{{Name: "web", Run: "sleep 100"}}})
	trustRepo(t, b.Locations, "cal")
	b.Paused = &PauseStore{Path: filepath.Join(t.TempDir(), "paused.json")}
	if _, err := b.StartService(ctx, "cal", "billing", "web"); err != nil {
		t.Fatal(err)
	}
	cfgPath := filepath.Join(t.TempDir(), "guard.json")
	os.WriteFile(cfgPath, []byte(`{"enabled":true,"memory_percent":90,"sustain":"0s"}`), 0o600)
	used := uint64(95)
	clock := time.Now()
	b.Guard = &Guard{Path: cfgPath, Memory: func() Usage { return Usage{Total: 100, Used: used} }, Now: func() time.Time { return clock }, Cooldown: time.Nanosecond}

	// A working agent keeps everything in its worktree.
	b.Events.Publish(events.Event{Type: "agent.started", Data: map[string]any{"path": wt.Path}})
	time.Sleep(200 * time.Millisecond)
	if a := b.guardTick(ctx); a != nil {
		t.Fatalf("acted on a worktree with a working agent: %+v", a)
	}
	b.Events.Publish(events.Event{Type: "agent.finished", Data: map[string]any{"path": wt.Path}})
	time.Sleep(200 * time.Millisecond)

	clock = clock.Add(time.Second)
	a := b.guardTick(ctx)
	if a == nil || a.Action != "stop_services" || a.Services[0] != "web" {
		t.Fatalf("first step = %+v, want the idle worktree's services stopped", a)
	}
	clock = clock.Add(time.Second)
	a = b.guardTick(ctx)
	if a == nil || a.Action != "pause_worktree" || a.Sessions[0] != sess.Name || !b.Paused.has(wt.Path) {
		t.Fatalf("second step = %+v, want the finished agent's worktree paused", a)
	}
	b.ResumeWorktree(ctx, "cal", "billing")
	used = 50
	if a := b.guardTick(ctx); a != nil {
		t.Fatalf("acted with memory at 50%%: %+v", a)
	}
}
