package localchat

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/MylesMCook/burf/internal/backgroundcmd"
)

// Claude structured chat launches claude-agent-acp (ACP). The private
// `claude -p` stream-json dialect is not extended here.

// ClaudeACPCommand is true when program is the ACP adapter (or a test peer).
func ClaudeACPCommand(program string) bool {
	base := strings.ToLower(filepath.Base(program))
	base = strings.TrimSuffix(base, ".exe")
	return base == "claude-agent-acp" || strings.Contains(base, "claude-agent-acp")
}

// ClaudeHelpSupportsChat reports whether an installed adapter can speak ACP chat.
// Kept for callers that still pass help text; prefer ClaudeACPCommand on the path.
func ClaudeHelpSupportsChat(help string) bool {
	return strings.Contains(help, "acp") || strings.Contains(help, "Agent Client Protocol") || strings.Contains(help, "session/new")
}

func claudeHelp(ctx context.Context, program string, env []string) (string, error) {
	if program == "" {
		return "", context.Canceled
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	cmd := backgroundcmd.CommandContext(ctx, program, "--help")
	cmd.Env = env
	pipe, err := cmd.StdoutPipe()
	if err != nil {
		return "", err
	}
	if err = cmd.Start(); err != nil {
		return "", err
	}
	out, readErr := io.ReadAll(io.LimitReader(pipe, (256<<10)+1))
	if len(out) > 256<<10 {
		_ = cmd.Process.Kill()
	}
	err = cmd.Wait()
	if readErr != nil {
		return "", readErr
	}
	if err != nil {
		return "", err
	}
	if len(out) > 256<<10 {
		return "", io.ErrUnexpectedEOF
	}
	return string(out), nil
}

func ClaudeSupportsChat(ctx context.Context, program string, env []string) bool {
	if ClaudeACPCommand(program) {
		return true
	}
	help, err := claudeHelp(ctx, program, env)
	return err == nil && ClaudeHelpSupportsChat(help)
}

func ClaudeModels(ctx context.Context, program string, env []string) ([]Model, error) {
	out := []Model{{Model: "default", DisplayName: "Default", SupportedReasoningEfforts: []struct {
		Effort string `json:"reasoningEffort"`
	}{}}}
	// Model aliases still come from Claude Code when that CLI is beside the ACP adapter.
	claude := strings.TrimSuffix(program, "claude-agent-acp")
	claude = strings.TrimSuffix(claude, "claude-agent-acp.exe")
	if claude == program {
		dir := filepath.Dir(program)
		for _, name := range []string{"claude", "claude.exe"} {
			candidate := filepath.Join(dir, name)
			if st, err := os.Stat(candidate); err == nil && st.Mode().IsRegular() {
				program = candidate
				break
			}
		}
	}
	help, err := claudeHelp(ctx, program, env)
	if err != nil {
		return out, nil
	}
	start := strings.Index(help, "--model <model>")
	if start < 0 {
		return out, nil
	}
	section := help[start:]
	if end := strings.Index(section, "\n  -"); end >= 0 {
		section = section[:end]
	}
	if !strings.Contains(section, "alias") {
		return out, nil
	}
	seen := map[string]bool{"default": true}
	aliases := regexp.MustCompile(`['"]([a-z][a-z0-9_-]{0,63})['"]`)
	for _, match := range aliases.FindAllStringSubmatch(section, -1) {
		alias := match[1]
		if seen[alias] {
			continue
		}
		seen[alias] = true
		out = append(out, Model{Model: alias, DisplayName: alias, SupportedReasoningEfforts: []struct {
			Effort string `json:"reasoningEffort"`
		}{}})
	}
	return out, nil
}
