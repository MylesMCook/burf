package sshconfig

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func hosts() []Host {
	return []Host{
		{Box: "cal", Address: "100.64.0.12:7444", User: "sean"},
		{Box: "devl", Address: "100.64.0.11:7444", User: "sean", Network: "personal", Berth: "/Applications/Berth.app/Contents/MacOS/berth"},
	}
}

func TestPlanShowsEverythingAndWritesNothing(t *testing.T) {
	c := Config{Dir: t.TempDir()}
	os.WriteFile(filepath.Join(c.Dir, "config"), []byte("Host dev\n  HostName 1.2.3.4\n"), 0o600)
	plan, err := c.Plan(hosts())
	if err != nil {
		t.Fatal(err)
	}
	if len(plan) != 3 {
		t.Fatalf("plan = %+v", plan)
	}
	devl := plan[1]
	if devl.Action != "create" || !strings.Contains(devl.Diff, "+   ProxyCommand /Applications/Berth.app/Contents/MacOS/berth network proxy personal %h %p") {
		t.Fatalf("devl change = %+v", devl)
	}
	if strings.Contains(plan[0].New, "ProxyCommand") || !strings.Contains(plan[0].New, "HostName 100.64.0.12\n") {
		t.Fatalf("a box on this tailnet = %q", plan[0].New)
	}
	if _, err := os.Stat(filepath.Join(c.Dir, "berth")); !os.IsNotExist(err) {
		t.Fatal("planning wrote files")
	}
}

func TestApplyIsIdempotentBacksUpOnceAndNeverDuplicatesTheInclude(t *testing.T) {
	c := Config{Dir: t.TempDir()}
	orig := "Include calport/*.conf\n\nHost dev\n  HostName 1.2.3.4\n"
	os.WriteFile(filepath.Join(c.Dir, "config"), []byte(orig), 0o600)
	plan, _ := c.Plan(hosts())
	if err := c.Apply(plan); err != nil {
		t.Fatal(err)
	}
	cfg, _ := os.ReadFile(filepath.Join(c.Dir, "config"))
	if !strings.HasPrefix(string(cfg), "# Added by berth") || !strings.HasSuffix(string(cfg), orig) {
		t.Fatalf("config = %q", cfg)
	}
	if b, _ := os.ReadFile(filepath.Join(c.Dir, "config.berth-backup")); string(b) != orig {
		t.Fatalf("backup = %q", b)
	}
	if !c.Ready("devl") || c.Ready("omarchy") {
		t.Fatal("Ready is wrong")
	}
	again, _ := c.Plan(hosts())
	if len(again) != 0 {
		t.Fatalf("a second plan changes %+v", again)
	}
	c.Apply(plan) // applying a stale plan again must not add a second Include
	cfg, _ = os.ReadFile(filepath.Join(c.Dir, "config"))
	if strings.Count(string(cfg), IncludeLine) != 1 {
		t.Fatalf("the Include is there %d times", strings.Count(string(cfg), IncludeLine))
	}
}

func TestOnlyBerthsOwnFilesAreRemoved(t *testing.T) {
	c := Config{Dir: t.TempDir()}
	c.Apply(mustPlan(t, c, hosts()))
	mine := filepath.Join(c.Dir, "berth", "notmine.conf")
	os.WriteFile(mine, []byte("Host x\n"), 0o600)
	plan := mustPlan(t, c, hosts()[:1])
	if len(plan) != 1 || plan[0].Action != "remove" || !strings.HasSuffix(plan[0].Path, "devl.conf") {
		t.Fatalf("plan = %+v", plan)
	}
	c.Apply(plan)
	if _, err := os.Stat(mine); err != nil {
		t.Fatal("a file berth did not write was removed")
	}
}

func TestPathsWithSpacesAreQuoted(t *testing.T) {
	h := Host{Box: "b", Address: "10.0.0.1", Network: "work net", Berth: "/Applications/My Apps/berth"}
	if got := h.Render(); !strings.Contains(got, "ProxyCommand '/Applications/My Apps/berth' network proxy 'work net' %h %p") {
		t.Fatalf("render = %q", got)
	}
}

func TestAnIdentityAgentIsQuotedForSSH(t *testing.T) {
	h := Host{Box: "b", Address: "10.0.0.1", IdentityAgent: "/Users/me/Library/Group Containers/x/agent.sock"}
	if got := h.Render(); !strings.Contains(got, `  IdentityAgent "/Users/me/Library/Group Containers/x/agent.sock"`) {
		t.Fatalf("render = %q", got)
	}
}

func TestLocalBoxesAreThisComputer(t *testing.T) {
	for addr, want := range map[string]bool{"127.0.0.1:7444": true, "[::1]:7444": true, "localhost": true, "100.64.0.11:7444": false} {
		if Local(addr) != want {
			t.Errorf("Local(%s) != %v", addr, want)
		}
	}
}

func mustPlan(t *testing.T, c Config, h []Host) []Change {
	t.Helper()
	p, err := c.Plan(h)
	if err != nil {
		t.Fatal(err)
	}
	return p
}
