//go:build darwin || linux

package localchat

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

func TestNativeClaudeParentDeathCleansOwnedProcesses(t *testing.T) {
	exe, _ := os.Executable()
	owner := exec.Command(exe, "--burf-synthetic-claude-owner")
	owner.Env = append(os.Environ(), "BURF_SYNTHETIC_CLAUDE=1", "BURF_CLAUDE_DESCENDANTS=1", "BURF_CLAUDE_CWD="+t.TempDir())
	output, err := owner.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := owner.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = owner.Process.Kill(); _ = owner.Wait() })
	report := readClaudeNativeReport(t, output)
	if err := owner.Process.Kill(); err != nil {
		t.Fatal(err)
	}
	_ = owner.Wait()
	requireStopped(t, report.Provider, report.Child)
}
func TestNativeClaudeExitCleansDescendantsAndPreservesAccount(t *testing.T) {
	exe, _ := os.Executable()
	cwd, account := t.TempDir(), t.TempDir()
	p, err := StartProcess(LaunchOptions{Agent: "claude", Program: exe, CWD: cwd, Env: append(os.Environ(), "BURF_SYNTHETIC_CLAUDE=1", "BURF_CLAUDE_DESCENDANTS=1", "BURF_CLAUDE_SCENARIO=exit", "CLAUDE_CONFIG_DIR="+account)})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = p.Close() })
	report := readClaudeNativeReport(t, p)
	wantCWD, _ := filepath.EvalSymlinks(cwd)
	if report.Account != account || report.CWD != wantCWD {
		t.Fatal("account or folder lost", report)
	}
	if _, err := p.Write([]byte("{\"type\":\"user\"}\n")); err != nil {
		t.Fatal(err)
	}
	select {
	case <-p.(*stdioProcess).done:
	case <-time.After(5 * time.Second):
		t.Fatal("provider did not exit")
	}
	requireStopped(t, report.Provider, report.Child)
}
