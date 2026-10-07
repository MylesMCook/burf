package sshconfig

import (
	"os"
	"path/filepath"
	"runtime"
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
	orig := "Include other/*.conf\n\nHost dev\n  HostName 1.2.3.4\n"
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
	want := "ProxyCommand '/Applications/My Apps/berth' network proxy 'work net' %h %p"
	if runtime.GOOS == "windows" {
		want = `ProxyCommand "/Applications/My Apps/berth" network proxy "work net" %h %p`
	}
	if got := h.Render(); !strings.Contains(got, want) {
		t.Fatalf("render = %q", got)
	}
}

func TestProxyCommandKeepsLiteralPercentTokens(t *testing.T) {
	command := ProxyCommand("/opt/berth%h", "net%p")
	if !strings.Contains(command, "berth%%h") || !strings.Contains(command, "net%%p") || !strings.HasSuffix(command, " %h %p") {
		t.Fatalf("OpenSSH tokens were not separated from literal arguments: %q", command)
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

// The box reports its own user; a newline in it must not add ssh_config
// directives that run on this computer (security audit L-4).
func TestABoxCannotInjectSSHConfigThroughItsUser(t *testing.T) {
	dir := t.TempDir()
	evil := "sean\nHost *\n  ProxyCommand sh -c 'id > /tmp/berth-poc-proxycommand; nc %h %p'"
	h := Host{Box: "devl", Address: "100.64.0.5:7444", User: evil, Berth: "/usr/local/bin/berth"}
	if ValidUser(evil) {
		t.Fatal("ValidUser accepted a newline")
	}
	cfg := Config{Dir: dir}
	plan, err := cfg.Plan([]Host{h})
	if err != nil {
		t.Fatal(err)
	}
	if err := cfg.Apply(plan); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(filepath.Join(dir, "berth", "devl.conf"))
	if strings.Contains(string(b), "ProxyCommand") || strings.Contains(string(b), "User") || strings.Count(string(b), "Host ") != 1 {
		t.Fatalf("injected config:\n%s", b)
	}
	for _, u := range []string{"sean", "ubuntu", "first.last", "svc_berth-1"} {
		if !ValidUser(u) {
			t.Errorf("ValidUser(%q) = false", u)
		}
	}
	// Other fields that reach the file are refused outright.
	for _, bad := range []Host{
		{Box: "devl", Address: "1.2.3.4\nHost *"},
		{Box: "devl\nHost *", Address: "1.2.3.4"},
		{Box: "devl", Address: "1.2.3.4", Network: "x y"},
		{Box: "devl", Address: "1.2.3.4", IdentityAgent: "/a\"\nProxyCommand x"},
	} {
		if _, err := cfg.Plan([]Host{bad}); err == nil {
			t.Errorf("Plan accepted %+v", bad)
		}
	}
}
