package agent

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// A restart for an update waits for the work under way: here an upgrade of
// a box the app started, which takes a moment. Meanwhile the agent still
// answers, says what it waits for, and turns new long work away; once the
// upgrade has finished, it stops cleanly, its lock free for the next one.
func TestARestartLetsWorkUnderWayFinishFirst(t *testing.T) {
	b := newBox(t)
	a := startAgent(t, b.pairLaptop())
	tok := uiToken(t, a)
	release := filepath.Join(a.dir, "release")
	installCLI(t, cliFixturePath(a.dir, "fake-berth"), cliFixture{Mode: "restart", Release: release})

	ctx := context.Background()

	info, err := a.client.Info(ctx)
	if err != nil || info.PID != os.Getpid() || info.Exe == "" || info.Build == "" || info.Started.IsZero() {
		t.Fatalf("GET /v1/agent: %+v, %v", info, err)
	}

	upgraded := make(chan string, 1)
	go func() {
		_, body := uiSend(t, a, "POST", "/v1/boxes/devl/upgrade", tok, "")
		upgraded <- body
	}()
	eventually(t, "the upgrade under way", func() bool {
		info, _ := a.client.Info(ctx)
		return len(info.Busy) == 1 && info.Busy[0] == "berth upgrade devl"
	})

	if err := a.client.StopDrained(ctx); err != nil {
		t.Fatal(err)
	}
	eventually(t, "draining", func() bool {
		info, _ := a.client.Info(ctx)
		return info.Draining
	})
	// New long work waits for the next agent; everything else still answers.
	if resp, body := uiSend(t, a, "POST", "/v1/boxes/devl/upgrade", tok, ""); resp.StatusCode != 503 || !strings.Contains(body, "restarting") {
		t.Fatalf("an upgrade while draining: %d %s", resp.StatusCode, body)
	}
	if _, err := a.client.Status(ctx); err != nil {
		t.Fatalf("status while draining: %v", err)
	}
	time.Sleep(200 * time.Millisecond)
	select {
	case <-a.done:
		t.Fatal("the agent stopped before the upgrade under way finished")
	default:
	}

	os.WriteFile(release, nil, 0o600)
	if body := <-upgraded; !strings.Contains(body, "ran upgrade devl") || !strings.Contains(body, `"done":true`) || strings.Contains(body, `"error"`) {
		t.Fatalf("the upgrade under way: %s", body)
	}
	select {
	case err := <-a.done:
		if err != nil {
			t.Fatalf("agent exited with %v", err)
		}
		a.cancel = nil
	case <-time.After(5 * time.Second):
		t.Fatal("the agent did not stop once its work was done")
	}
	wctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := a.client.WaitStopped(wctx, a.dir); err != nil {
		t.Fatal(err)
	}
	// The next agent takes the state directory.
	startAgent(t, a.dir)
}

// An agent is restarted for an update when the berth asking is newer: its
// own program replaced (the app updated under it), or an older release, or
// one from before agents said what they run.
func TestStaleAgents(t *testing.T) {
	app := "/Applications/Berth.app/Contents/MacOS/berth-cli"
	for _, c := range []struct {
		name  string
		info  AgentInfo
		err   error
		stale bool
	}{
		{"from before /v1/agent", AgentInfo{}, ErrNoAgentInfo, true},
		{"the app's own, replaced", AgentInfo{Exe: app, Build: "aaa", Version: "v0.3.8"}, nil, true},
		{"the app's own, current", AgentInfo{Exe: app, Build: "bbb", Version: "v0.3.8"}, nil, false},
		{"another berth, older", AgentInfo{Exe: "/usr/local/bin/berth", Build: "ccc", Version: "v0.3.7"}, nil, true},
		{"another berth, same release", AgentInfo{Exe: "/usr/local/bin/berth", Build: "ccc", Version: "v0.3.8"}, nil, false},
		{"another berth, newer", AgentInfo{Exe: "/usr/local/bin/berth", Build: "ccc", Version: "v0.4.0"}, nil, false},
		{"a dev build elsewhere", AgentInfo{Exe: "/src/berth/bin/berth", Build: "ddd", Version: "dev"}, nil, false},
		{"no answer", AgentInfo{}, context.DeadlineExceeded, false},
	} {
		stale, why := Stale(c.info, c.err, app, "bbb", "v0.3.8")
		if stale != c.stale || (stale && why == "") {
			t.Errorf("%s: stale %v (%q), want %v", c.name, stale, why, c.stale)
		}
	}
}
