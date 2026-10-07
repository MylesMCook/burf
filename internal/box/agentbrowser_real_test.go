package box

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

// With the real agent-browser and a Chromium (BERTH_TEST_REAL_AGENT_BROWSER=1,
// agent-browser on PATH, and AGENT_BROWSER_EXECUTABLE_PATH and
// AGENT_BROWSER_ARGS if it needs them): an agent in a berth session opens a
// page, the session stops, and its agent-browser daemon, its Chrome and its
// profile go, while one run by hand stays. The daemon also carries berth's
// idle timeout.
func TestRealAgentBrowserGoesWithItsSession(t *testing.T) {
	if os.Getenv("BERTH_TEST_REAL_AGENT_BROWSER") != "1" {
		t.Skip("set BERTH_TEST_REAL_AGENT_BROWSER=1 to drive the real agent-browser")
	}
	ab, err := exec.LookPath("agent-browser")
	if err != nil {
		t.Fatal(err)
	}
	os.Unsetenv(AgentBrowserIdleEnv)
	s := testSessions(t)
	a := NewAgentBrowsers(s)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go a.Run(ctx, t.Logf)

	page := "data:text/html,<h1>berth</h1>"
	if _, err := s.Create(ctx, "agent1", "", t.TempDir(), "agent-browser --session qa open '"+page+"'; sleep 600", nil); err != nil {
		t.Fatal(err)
	}
	// By hand, outside berth: never touched.
	byHand := exec.Command(ab, "--session", "byhand", "open", page)
	byHand.Env = append(os.Environ(), "BERTH_SESSION=")
	if out, err := byHand.CombinedOutput(); err != nil {
		t.Fatalf("agent-browser by hand: %v\n%s", err, out)
	}
	defer exec.Command(ab, "--session", "byhand", "close").Run()

	var mine AgentBrowserSession
	deadline := time.Now().Add(60 * time.Second)
	for {
		all, err := a.List(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if len(all) == 1 && all[0].Daemon != 0 && len(all[0].PIDs) > 1 && len(all[0].Profiles) == 1 {
			mine = all[0]
			break
		}
		if time.Now().After(deadline) {
			screen, _ := s.Screen(ctx, "agent1", 50)
			t.Fatalf("no agent-browser session for agent1: %+v\n%s", all, screen)
		}
		time.Sleep(250 * time.Millisecond)
	}
	if mine.BerthSession != "agent1" || mine.Session != "qa" || !mine.Live {
		t.Fatalf("found %+v", mine)
	}
	if v := mine.env[AgentBrowserIdleEnv]; v != AgentBrowserIdleDefault {
		t.Fatalf("the daemon's %s = %q", AgentBrowserIdleEnv, v)
	}
	t.Logf("agent1's agent-browser: daemon %d (%s), %d processes, profile %s", mine.Daemon, mine.exe, len(mine.PIDs), mine.Profiles[0])
	byHandProcs := func() int {
		ps, _ := scanProcs("AGENT_BROWSER_DAEMON=")
		n := 0
		for _, p := range ps {
			if p.Env["AGENT_BROWSER_SESSION"] == "byhand" {
				n++
			}
		}
		return n
	}
	before := byHandProcs()
	if before == 0 {
		t.Fatal("the agent-browser run by hand isn't running")
	}

	if err := s.Kill(ctx, "agent1"); err != nil {
		t.Fatal(err)
	}
	deadline = time.Now().Add(30 * time.Second)
	for {
		if len(sessionBrowserProcs("agent1")) == 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("still running after the session stopped: %+v", sessionBrowserProcs("agent1"))
		}
		time.Sleep(250 * time.Millisecond)
	}
	if _, err := os.Stat(mine.Profiles[0]); !os.IsNotExist(err) {
		t.Fatalf("its profile %s is still there: %v", mine.Profiles[0], err)
	}
	if n := byHandProcs(); n != before {
		t.Fatalf("the agent-browser run by hand had %d processes, now %d", before, n)
	}

	// agent-browser's own idle shutdown, as a box or project would set it:
	// the daemon closes its Chrome, removes its profile and exits while the
	// session runs on.
	if _, err := s.Create(ctx, "agent2", "", t.TempDir(), "agent-browser --session idle open '"+page+"'; sleep 600", []string{AgentBrowserIdleEnv + "=3000"}); err != nil {
		t.Fatal(err)
	}
	var idle AgentBrowserSession
	deadline = time.Now().Add(60 * time.Second)
	for idle.Daemon == 0 {
		all, _ := a.List(ctx)
		for _, g := range all {
			if g.BerthSession == "agent2" && g.Daemon != 0 && len(g.Profiles) == 1 {
				idle = g
			}
		}
		if time.Now().After(deadline) {
			t.Fatal("agent2's agent-browser never started")
		}
		time.Sleep(100 * time.Millisecond)
	}
	if v := idle.env[AgentBrowserIdleEnv]; v != "3000" {
		t.Fatalf("agent2's daemon has %s = %q", AgentBrowserIdleEnv, v)
	}
	deadline = time.Now().Add(30 * time.Second)
	for {
		if len(sessionBrowserProcs("agent2")) == 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("agent2's agent-browser didn't close itself when idle: %+v", sessionBrowserProcs("agent2"))
		}
		time.Sleep(250 * time.Millisecond)
	}
	if live, _ := s.live(ctx); !live["agent2"] {
		t.Fatal("agent2 ended, so the reaper may have closed it rather than the idle timeout")
	}
	if _, err := os.Stat(idle.Profiles[0]); !os.IsNotExist(err) {
		t.Fatalf("the idle daemon left its profile %s", idle.Profiles[0])
	}
	left, _ := filepath.Glob(filepath.Join(os.TempDir(), "agent-browser-chrome-*"))
	t.Logf("profiles left in %s (the hand-run one's): %v", os.TempDir(), left)
}

// sessionBrowserProcs are the agent-browser processes (daemon and browser)
// a berth session started.
func sessionBrowserProcs(session string) []proc {
	ps, _ := scanProcs("AGENT_BROWSER_DAEMON=")
	var out []proc
	for _, p := range ps {
		if p.Env["BERTH_SESSION"] == session {
			out = append(out, p)
		}
	}
	return out
}
