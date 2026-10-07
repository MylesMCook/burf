package transcript

import (
	"path/filepath"
	"testing"
)

func TestCodexOmitsInternalMessages(t *testing.T) {
	p := filepath.Join(t.TempDir(), "rollout.jsonl")
	message := func(role, channel, text string) m {
		return m{"type": "response_item", "payload": m{"type": "message", "role": role, "channel": channel, "content": []m{{"type": "output_text", "text": text}}}}
	}
	write(t, p,
		message("system", "", "system context"),
		message("developer", "", "developer context"),
		message("user", "", "# AGENTS.md instructions for C:\\work\n<INSTRUCTIONS>private context</INSTRUCTIONS>"),
		message("user", "", "<environment_context>private context</environment_context>"),
		message("assistant", "analysis", "private reasoning"),
		message("assistant", "summary", "internal summary"),
		message("user", "", "Fix the tests"),
		message("assistant", "commentary", "Checking tests"),
		message("assistant", "final", "Tests pass"),
	)
	result, err := Before("codex", p, "", 0, 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 3 || result.Items[0].Text != "Fix the tests" || result.Items[1].Text != "Checking tests" || result.Items[2].Text != "Tests pass" {
		t.Fatalf("unexpected public items: %+v", result.Items)
	}
}
