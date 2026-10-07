package agent

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/sean-brydon/berthd/internal/localagent"
)

// Resolve installed native CLIs, never execute an npm batch shim through a shell.
func localAgentCommands() map[string]localagent.Command {
	out := make(map[string]localagent.Command)
	home, _ := os.UserHomeDir()
	for _, id := range []string{"claude", "codex"} {
		candidates := []string{filepath.Join(home, ".local", "bin", id+".exe")}
		if p, err := exec.LookPath(id + ".exe"); err == nil {
			candidates = append(candidates, p)
		}
		if id == "claude" {
			candidates = append(candidates, filepath.Join(os.Getenv("APPDATA"), "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe"))
		}
		for _, p := range candidates {
			if nativeCLI(p) {
				out[id] = localagent.Command{Program: p}
				break
			}
		}
	}
	if out["codex"].Program == "" {
		// Store installations expose the CLI under app/resources, not the GUI executable.
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		ps := filepath.Join(os.Getenv("SystemRoot"), "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
		cmd := exec.CommandContext(ctx, ps, "-NoProfile", "-NonInteractive", "-Command", "Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1 -ExpandProperty InstallLocation")
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
		if b, err := cmd.Output(); err == nil {
			root := strings.TrimSpace(string(b))
			if filepath.IsAbs(root) {
				p := filepath.Join(root, "app", "resources", "codex.exe")
				if nativeCLI(p) {
					out["codex"] = localagent.Command{Program: p}
				}
			}
		}
	}
	if command, ok := out["codex"]; ok {
		// Newer Codex CLIs default to their own background server. Keep the
		// interactive process owned by this terminal when that mode exists.
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		cmd := exec.CommandContext(ctx, command.Program, "--help")
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
		if help, err := cmd.Output(); err == nil && strings.Contains(string(help), "--no-daemon") {
			command.Args = []string{"--no-daemon"}
			out["codex"] = command
		}
		cancel()
	}
	return out
}

func nativeCLI(path string) bool {
	if !filepath.IsAbs(path) || !strings.EqualFold(filepath.Ext(path), ".exe") {
		return false
	}
	st, err := os.Stat(path)
	return err == nil && st.Mode().IsRegular()
}
