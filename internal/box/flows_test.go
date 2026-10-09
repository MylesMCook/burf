package box

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/box/runs"
	"github.com/MylesMCook/burf/internal/events"
)

func TestFlowsAreValidated(t *testing.T) {
	ok := Flow{ID: "check", Name: "Check", Trigger: Trigger{Event: "agent.finished"}, Steps: []Step{{Kind: "run", Command: "pnpm test"}}}
	if err := ValidateFlows([]Flow{ok}); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []Flow{
		{ID: "Bad Id", Name: "x", Trigger: ok.Trigger, Steps: ok.Steps},
		{ID: "a", Name: "x", Trigger: Trigger{Event: "before:worktree.create"}, Steps: ok.Steps},
		{ID: "a", Name: "x", Trigger: ok.Trigger},
		{ID: "a", Name: "x", Trigger: ok.Trigger, Steps: []Step{{Kind: "teleport"}}},
		{ID: "a", Name: "x", Trigger: ok.Trigger, Steps: []Step{{Kind: "prompt"}}},
		{ID: "a", Name: "x", Trigger: ok.Trigger, Steps: []Step{{Kind: "run", Command: "x", When: "sometimes"}}},
		{ID: "a", Name: "x", Trigger: ok.Trigger, Steps: []Step{{Kind: "webhook", URL: "file:///etc/passwd"}}},
	} {
		if err := ValidateFlows([]Flow{bad}); err == nil {
			t.Errorf("accepted %+v", bad)
		}
	}
}

// flowBox is a box with one repository, a stand-in agent session in a
// worktree of it, and flows running.
func flowBox(t *testing.T, flows []Flow) (*Box, Session, Worktree) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	repo := gitRepo(t)
	writeRepoConfig(t, repo, RepoConfig{Flows: flows})
	dir := t.TempDir()
	b := &Box{Name: "devbox", Locations: NewLocations(filepath.Join(dir, "locations.json")), Events: &events.Bus{},
		Sessions: testSessions(t), Turns: &Turns{}, Flows: &Flows{Path: filepath.Join(dir, "flows.json")}}
	b.Locations.Add(ctx, "cal", repo)
	trustRepo(t, b.Locations, "cal")
	wt, err := b.Locations.CreateWorktree(ctx, "cal", "billing", "", "")
	if err != nil {
		t.Fatal(err)
	}
	fake := filepath.Join(t.TempDir(), "claude")
	os.WriteFile(fake, []byte("#!/bin/sh\nexec cat\n"), 0o755)
	sess, err := b.Sessions.Create(ctx, "agent", "cal/billing", wt.Path, fake, nil)
	if err != nil {
		t.Fatal(err)
	}
	b.Turns.Attach(b.Events)
	go b.Flows.Run(ctx, b)
	// Runs finish in the background, saving their records into the temp
	// dirs; let them settle before those dirs are removed (cleanups run
	// last-registered first, so this one runs before TempDir's).
	// Then stop the flows and runs themselves, so nothing writes into those
	// dirs while they go (cancel, registered first, would run after them).
	t.Cleanup(func() {
		settleRuns(b)
		cancel()
		if eng := b.runsNow(); eng != nil {
			eng.Wait()
		}
	})
	time.Sleep(100 * time.Millisecond)
	return b, sess, wt
}

// settleRuns waits, briefly, until no run is still going, then cancels
// what is (a run waiting on an agent that never answers).
func settleRuns(b *Box) {
	eng := b.runsNow()
	if eng == nil {
		return
	}
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if len(eng.List(runs.Filter{Status: "active"})) == 0 {
			// The last record may still be on its way to disk.
			time.Sleep(50 * time.Millisecond)
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	for _, s := range eng.List(runs.Filter{Status: "active"}) {
		eng.Cancel(s.ID)
	}
	deadline = time.Now().Add(3 * time.Second)
	for eng.Active() > 0 && time.Now().Before(deadline) {
		time.Sleep(20 * time.Millisecond)
	}
	time.Sleep(50 * time.Millisecond)
}

func waitRun(t *testing.T, b *Box, flow string) FlowRun {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if runs := b.Flows.Runs(flow, 1); len(runs) == 1 && runs[0].Status != "running" {
			return runs[0]
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("flow %s never finished", flow)
	return FlowRun{}
}

func TestAFailedCheckIsSentBackToTheAgentThatFinished(t *testing.T) {
	b, sess, wt := flowBox(t, []Flow{{
		ID: "check", Name: "Check after each turn", Enabled: true,
		Trigger: Trigger{Event: "agent.finished"},
		Steps: []Step{
			{ID: "test", Kind: "run", Command: "echo boom-on-$BERTH_WORKTREE_NAME; exit 2"},
			{Kind: "prompt", When: "failure", Text: "The check failed ({{prev.exit_code}}): {{steps.test.output}}"},
			{Kind: "notify", When: "always", Title: "Checked {{worktree.name}}"},
		},
	}})
	notes, stop := b.Events.Subscribe()
	defer stop()
	b.Events.Publish(events.Event{Type: "agent.finished", Origin: "claude", Data: map[string]any{"path": wt.Path, "agent": "claude"}})

	run := waitRun(t, b, "check")
	if run.Status != "succeeded" || len(run.Steps) != 3 || run.Steps[0].Status != "failed" || run.Steps[1].Status != "succeeded" || run.Steps[2].Status != "succeeded" {
		t.Fatalf("run = %+v", run)
	}
	deadline := time.Now().Add(5 * time.Second)
	for {
		screen, _ := b.Sessions.Screen(context.Background(), sess.Name, 0)
		if strings.Contains(screen, "The check failed (2): boom-on-billing") {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("the agent never got the failure: %q", screen)
		}
		time.Sleep(50 * time.Millisecond)
	}
	for {
		select {
		case e := <-notes:
			if e.Type == "notify" {
				if e.Data["title"] != "Checked billing" || e.Origin != "flow:check" {
					t.Fatalf("notify = %+v", e)
				}
				return
			}
		case <-time.After(5 * time.Second):
			t.Fatal("no notify event")
		}
	}
}

func TestRepoFlowsIgnoreOtherReposAndStopRunningAway(t *testing.T) {
	b, _, wt := flowBox(t, []Flow{{
		ID: "count", Name: "Count", Enabled: true, MaxRunsPerHour: 2,
		Trigger: Trigger{Event: "worktree.*", Where: Where{Branch: "bill*"}},
		Steps:   []Step{{Kind: "run", Command: "true"}},
	}})
	b.Events.Publish(events.Event{Type: "worktree.created", Data: map[string]any{"path": "/somewhere/else"}})
	for range 4 {
		b.Events.Publish(events.Event{Type: "worktree.changed", Data: map[string]any{"path": wt.Path}})
		time.Sleep(300 * time.Millisecond)
	}
	if runs := b.Flows.Runs("count", 10); len(runs) != 2 {
		t.Fatalf("%d runs, want the hourly limit of 2", len(runs))
	}
}

func TestWebhooksPostTheRunsContext(t *testing.T) {
	got := make(chan map[string]any, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var m map[string]any
		b, _ := io.ReadAll(r.Body)
		json.Unmarshal(b, &m)
		got <- m
	}))
	defer srv.Close()
	b, _, wt := flowBox(t, []Flow{{ID: "hook", Name: "Tell Slack", Enabled: true, Trigger: Trigger{Event: "agent.waiting"},
		Steps: []Step{{Kind: "webhook", URL: srv.URL, Text: `{"text":"{{worktree.name}} needs you"}`}}}})
	b.Flows.AllowOutbound = []string{"127.0.0.1"}
	b.Events.Publish(events.Event{Type: "agent.waiting", Data: map[string]any{"path": wt.Path}})
	select {
	case m := <-got:
		if m["text"] != "billing needs you" {
			t.Fatalf("body = %v", m)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("the webhook was never called")
	}
}

func echoFlow(id, says string, enabled bool) Flow {
	return Flow{ID: id, Name: id, Enabled: enabled, Trigger: Trigger{Event: "agent.finished"}, Steps: []Step{{Kind: "run", Command: "echo " + says}}}
}

func TestFlowLayersMergeByIDTheMostLocalWinning(t *testing.T) {
	ctx := context.Background()
	b, _, _ := flowBox(t, []Flow{echoFlow("check", "repo", true), echoFlow("repo-only", "repo", true), echoFlow("lint", "repo", true)})
	if err := b.Locations.setKit("cal", &InstalledKit{ID: "cal-dev", Name: "Cal dev", Config: RepoConfig{Flows: []Flow{echoFlow("check", "kit", true), echoFlow("kit-only", "kit", true), echoFlow("lint", "kit", true)}}}); err != nil {
		t.Fatal(err)
	}
	if err := b.Locations.SetLocalConfig("cal", RepoConfig{Flows: []Flow{echoFlow("check", "local", false)}}); err != nil {
		t.Fatal(err)
	}
	all, err := b.AllFlows(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var listed []string
	for _, sf := range all {
		s := sf.Source + "/" + sf.Flow.ID
		if sf.Overridden {
			s += " (overridden)"
		}
		if sf.Scope != "repo:cal" || sf.Editable != (sf.Source == "local") {
			t.Errorf("%s: scope %s, editable %v", s, sf.Scope, sf.Editable)
		}
		listed = append(listed, s)
	}
	want := "repo/check (overridden),repo/repo-only,repo/lint (overridden),kit/check (overridden),kit/kit-only,kit/lint,local/check"
	if got := strings.Join(listed, ","); got != want {
		t.Fatalf("listed %s\nwant   %s", got, want)
	}
	active, _ := b.ActiveFlows(ctx)
	var running []string
	for _, sf := range active {
		running = append(running, sf.Source+"/"+sf.Flow.ID)
	}
	if got := strings.Join(running, ","); got != "repo/repo-only,kit/kit-only,kit/lint,local/check" {
		t.Fatalf("active = %s", got)
	}
}

func TestKitFlowsRunAndAnOverrideRunsInsteadOfTheCommittedFlow(t *testing.T) {
	b, _, wt := flowBox(t, []Flow{echoFlow("check", "committed", true)})
	b.Locations.setKit("cal", &InstalledKit{ID: "cal-dev", Name: "Cal dev", Config: RepoConfig{Flows: []Flow{echoFlow("kit-check", "from-the-kit", true)}}})
	b.Locations.SetLocalConfig("cal", RepoConfig{Flows: []Flow{echoFlow("check", "overridden-here", true)}})
	b.Events.Publish(events.Event{Type: "agent.finished", Data: map[string]any{"path": wt.Path}})

	if run := waitRun(t, b, "kit-check"); run.Status != "succeeded" || strings.TrimSpace(run.Steps[0].Output) != "from-the-kit" || run.Scope != "repo:cal" {
		t.Fatalf("kit run = %+v", run)
	}
	if run := waitRun(t, b, "check"); strings.TrimSpace(run.Steps[0].Output) != "overridden-here" {
		t.Fatalf("check ran %q, want the override", run.Steps[0].Output)
	}
	time.Sleep(300 * time.Millisecond)
	if runs := b.Flows.Runs("check", 10); len(runs) != 1 {
		t.Fatalf("check ran %d times, want only the override", len(runs))
	}
}

func TestADisabledOverrideStopsTheFlowItReplaces(t *testing.T) {
	b, _, wt := flowBox(t, []Flow{echoFlow("check", "committed", true), echoFlow("sentinel", "ok", true)})
	b.Locations.setKit("cal", &InstalledKit{ID: "cal-dev", Name: "Cal dev", Config: RepoConfig{Flows: []Flow{echoFlow("lint", "kit", true)}}})
	b.Locations.SetLocalConfig("cal", RepoConfig{Flows: []Flow{echoFlow("check", "committed", false), echoFlow("lint", "kit", false)}})
	b.Events.Publish(events.Event{Type: "agent.finished", Data: map[string]any{"path": wt.Path}})

	waitRun(t, b, "sentinel")
	time.Sleep(300 * time.Millisecond)
	for _, id := range []string{"check", "lint"} {
		if runs := b.Flows.Runs(id, 10); len(runs) != 0 {
			t.Errorf("%s ran %d times though this box switched it off", id, len(runs))
		}
	}
}
