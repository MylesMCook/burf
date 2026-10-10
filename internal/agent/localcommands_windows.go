package agent

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/MylesMCook/burf/internal/backgroundcmd"
	"github.com/MylesMCook/burf/internal/localagent"
	"github.com/MylesMCook/burf/internal/localchat"
)

// Resolve installed native CLIs, never execute an npm batch shim through a shell.
func localAgentCommands() map[string]localagent.Command {
	out := make(map[string]localagent.Command)
	home, _ := os.UserHomeDir()
	npm := filepath.Join(os.Getenv("APPDATA"), "npm", "node_modules")

	// Claude structured chat: ACP adapter, not `claude -p` stream-json.
	for _, p := range []string{
		filepath.Join(home, ".local", "bin", "claude-agent-acp.exe"),
		filepath.Join(npm, "@agentclientprotocol", "claude-agent-acp", "bin", "claude-agent-acp.exe"),
		filepath.Join(npm, "@agentclientprotocol", "claude-agent-acp", "dist", "cli.exe"),
	} {
		if nativeCLI(p) {
			out["claude"] = localagent.Command{Program: p, CanChat: true, CanFork: true}
			break
		}
	}
	if out["claude"].Program == "" {
		if p, err := exec.LookPath("claude-agent-acp.exe"); err == nil && nativeCLI(p) {
			out["claude"] = localagent.Command{Program: p, CanChat: true, CanFork: true}
		}
	}
	// Cursor ACP: `agent acp`.
	for _, p := range []string{
		filepath.Join(home, ".local", "bin", "agent.exe"),
		filepath.Join(home, "AppData", "Local", "cursor-agent", "agent.exe"),
	} {
		if nativeCLI(p) {
			out["cursor"] = localagent.Command{Program: p, CanChat: true, CanFork: true}
			break
		}
	}
	if out["cursor"].Program == "" {
		if p, err := exec.LookPath("agent.exe"); err == nil && nativeCLI(p) {
			out["cursor"] = localagent.Command{Program: p, CanChat: true, CanFork: true}
		}
	}

	for _, id := range []string{"claude", "codex"} {
		if id == "claude" && out["claude"].Program != "" {
			continue
		}
		candidates := []string{filepath.Join(home, ".local", "bin", id+".exe")}
		if p, err := exec.LookPath(id + ".exe"); err == nil {
			candidates = append(candidates, p)
		}
		if id == "claude" {
			candidates = append(candidates, filepath.Join(npm, "@anthropic-ai", "claude-code", "bin", "claude.exe"))
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
		cmd := backgroundcmd.CommandContext(ctx, ps, "-NoProfile", "-NonInteractive", "-Command", "Get-AppxPackage -Name OpenAI.Codex | Select-Object -First 1 -ExpandProperty InstallLocation")
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
	for id, command := range out {
		if id == "cursor" {
			continue
		}
		help := localCommandHelp(command.Program, "--help")
		if id == "codex" {
			if strings.Contains(help, "--no-daemon") {
				command.Args = []string{"--no-daemon"}
			}
			command.CanFork = strings.Contains(localCommandHelp(command.Program, "fork", "--help"), "[SESSION_ID]")
			command.CanChat = strings.Contains(localCommandHelp(command.Program, "app-server", "--help"), "--listen")
		} else if id == "claude" {
			if localchat.ClaudeACPCommand(command.Program) {
				command.CanChat = true
				command.CanFork = true
			} else {
				// Terminal fork still uses Claude Code; structured chat needs the ACP adapter.
				command.CanFork = strings.Contains(help, "--fork-session") && strings.Contains(help, "--resume")
				command.CanChat = false
			}
		}
		out[id] = command
	}
	return out
}

func localCommandHelp(program string, args ...string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	cmd := backgroundcmd.CommandContext(ctx, program, args...)
	help, err := cmd.Output()
	if err != nil {
		return ""
	}
	return string(help)
}

func nativeCLI(path string) bool {
	if !filepath.IsAbs(path) || !strings.EqualFold(filepath.Ext(path), ".exe") {
		return false
	}
	st, err := os.Stat(path)
	return err == nil && st.Mode().IsRegular()
}
