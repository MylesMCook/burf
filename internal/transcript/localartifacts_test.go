package transcript

import (
	"encoding/json"
	"path/filepath"
	"testing"
)

func TestLocalArtifactsFromClaude(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "s.jsonl")
	write(t, p,
		user("Show me p95 before and after"),
		assistant(tool("b1", "Bash", m{"command": `berthd artifact add perf/p95.json --title "p95 before and after"`})),
		user([]m{{"type": "tool_result", "tool_use_id": "b1", "content": "Artifact 1a2b3c4d5e v1 · chart · p95 before and after\nShown in your chat and on search-perf's board."}}),
		assistant(tool("b2", "Bash", m{"command": `berthd artifact add perf/p95.json --note "with the cache"`})),
		user([]m{{"type": "tool_result", "tool_use_id": "b2", "content": "Artifact 1a2b3c4d5e v2 · chart · p95 before and after\nVersion 2 is live."}}),
		// A refusal is no card.
		assistant(tool("b3", "Bash", m{"command": "berthd artifact add env.md --title env"})),
		user([]m{{"type": "tool_result", "tool_use_id": "b3", "is_error": true, "content": "Error: refused: this looks like it holds a secret"}}),
		// Nor is a line that only mentions one mid-sentence.
		assistant(tool("b4", "Bash", m{"command": "cat notes.txt"})),
		user([]m{{"type": "tool_result", "tool_use_id": "b4", "content": "see Artifact 1a2b3c4d5e v1 · chart · x"}}),
		assistant(m{"type": "text", "text": "Here it is."}),
	)
	res, err := NewReader().Read("claude", p, dir, 0)
	if err != nil {
		t.Fatal(err)
	}
	items := artifactItems(res.Items)
	if len(items) != 2 {
		t.Fatalf("artifact items = %d (%s)", len(items), kinds(res.Items))
	}
	if it := items[0]; it.Local != "1a2b3c4d5e" || it.Version != 1 || it.Updated || it.Text != "p95 before and after" || it.Tool != "b1" || !it.Done {
		t.Errorf("first = %+v", it)
	}
	if it := items[1]; it.Version != 2 || !it.Updated {
		t.Errorf("update = %+v", it)
	}
	if len(res.Artifacts) != 0 {
		t.Errorf("a local artifact is not a claude.ai page: %+v", res.Artifacts)
	}
}

func TestLocalArtifactsFromCodex(t *testing.T) {
	p := filepath.Join(t.TempDir(), "rollout.jsonl")
	ri := func(payload m) m {
		return m{"type": "response_item", "timestamp": "2026-10-04T12:00:00Z", "payload": payload}
	}
	args := func(v any) string { b, _ := json.Marshal(v); return string(b) }
	// Codex wraps a command's output in JSON of its own.
	wrapped, _ := json.Marshal(m{"output": "Artifact 0f0e0d0c0b v3 · table · Search test results\nVersion 3 is live.\n", "metadata": m{"exit_code": 0}})
	write(t, p,
		m{"type": "session_meta", "payload": m{"cwd": "/w/shop"}},
		ri(m{"type": "message", "role": "user", "content": []m{{"type": "input_text", "text": "Run the tests and show me"}}}),
		ri(m{"type": "function_call", "name": "shell", "call_id": "c1", "arguments": args(m{"command": []string{"bash", "-lc", "berthd artifact add tests.csv --title 'Search test results'"}})}),
		ri(m{"type": "function_call_output", "call_id": "c1", "output": string(wrapped)}),
	)
	res, err := NewReader().Read("codex", p, "/w/shop", 0)
	if err != nil {
		t.Fatal(err)
	}
	items := artifactItems(res.Items)
	if len(items) != 1 || items[0].Local != "0f0e0d0c0b" || items[0].Version != 3 || items[0].Text != "Search test results" {
		t.Fatalf("items = %+v", items)
	}
}
