//go:build !windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// A --network name reaches ssh's ProxyCommand, which ssh runs with a shell:
// it must be a plain name, and is quoted besides (security audit L-3).
func TestNetworkNameCannotInjectIntoProxyCommand(t *testing.T) {
	marker := filepath.Join(t.TempDir(), "proxycmd-ran")
	for _, bad := range []string{"$(touch " + marker + ")", "`touch " + marker + "`", "x;touch " + marker, "x\ntouch " + marker, "a b", "x'y", "%h"} {
		if err := checkNetwork(bad); err == nil {
			t.Errorf("checkNetwork(%q) accepted it", bad)
		}
		// Even if a name slipped through, the shell sees one quoted word.
		opt := strings.TrimPrefix(proxyCommand("/bin/echo", bad), "ProxyCommand=")
		opt = expandProxyTokensForTest(opt)
		out, err := exec.Command("/bin/sh", "-c", opt).Output()
		if err != nil {
			t.Fatalf("%q: %v", opt, err)
		}
		if _, err := os.Stat(marker); err == nil {
			t.Fatalf("network name %q ran a command", bad)
		}
		if want := "network proxy " + bad + " host 22\n"; string(out) != want {
			t.Errorf("proxy got %q, want %q", out, want)
		}
	}
	for _, good := range []string{"", "work", "brydon.io", "team-net_2"} {
		if err := checkNetwork(good); err != nil {
			t.Errorf("checkNetwork(%q) = %v", good, err)
		}
	}
}
