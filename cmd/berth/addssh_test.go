package main

import "testing"

func TestDaemonFor(t *testing.T) {
	for uname, want := range map[string]string{
		"Linux x86_64\n": "berthd-linux-amd64",
		"Linux aarch64":  "berthd-linux-arm64",
		"Darwin arm64":   "berthd-darwin-arm64",
	} {
		if got, err := daemonFor(uname); err != nil || got != want {
			t.Errorf("daemonFor(%q) = %q, %v; want %q", uname, got, err, want)
		}
	}
	for _, bad := range []string{"", "Linux", "FreeBSD amd64", "Linux riscv64", "Linux x86_64 extra"} {
		if got, err := daemonFor(bad); err == nil {
			t.Errorf("daemonFor(%q) = %q; want an error", bad, got)
		}
	}
}

func TestFindLink(t *testing.T) {
	out := []byte("Pairing link (single use, valid for 10m0s):\n\n  berth://100.101.102.103:7444?code=abc&fp=def\n\nOn your laptop:  berth pair 'berth://100.101.102.103:7444?code=abc&fp=def'\n")
	if got, err := findLink(out); err != nil || got != "berth://100.101.102.103:7444?code=abc&fp=def" {
		t.Fatalf("findLink = %q, %v", got, err)
	}
	if _, err := findLink([]byte("berthd: something failed")); err == nil {
		t.Fatal("found a link in output without one")
	}
}

func TestServiceURLFor(t *testing.T) {
	if got := serviceURLFor("3000", "devl", 80); got != "http://3000.devl.localhost/" {
		t.Fatalf("with redirect: %s", got)
	}
	if got := serviceURLFor("3000", "devl", 1377); got != "http://3000.devl.localhost:1377/" {
		t.Fatalf("without redirect: %s", got)
	}
}

func TestSSHOptionsKeepThePersonsOwn(t *testing.T) {
	args := []string{"-o", "ConnectTimeout=5", "-o", "IdentityAgent ~/agent.sock"}
	if !hasOption(args, "ConnectTimeout") || !hasOption(args, "identityagent") || hasOption(args, "ProxyJump") {
		t.Errorf("hasOption misread %v", args)
	}
	env := withEnv([]string{"HOME=/h", "SSH_AUTH_SOCK=/dead.sock"}, "SSH_AUTH_SOCK", "/live.sock")
	if len(env) != 2 || env[1] != "SSH_AUTH_SOCK=/live.sock" {
		t.Errorf("withEnv = %v", env)
	}
}
