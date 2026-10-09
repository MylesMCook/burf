package transcript

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// Codex writes its instructions into a session file's first line, beside the
// folder the session runs in, so that line runs to tens of kilobytes. The
// session is still found by its folder, and its start is still read.
func TestACodexSessionWithALongFirstLineIsFoundByItsFolder(t *testing.T) {
	home := t.TempDir()
	dir := "/work/shop"
	day := filepath.Join(home, "sessions", "2026", "10", "08")
	if err := os.MkdirAll(day, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, size := range []int{1 << 10, 23 << 10, 200 << 10} {
		first, err := json.Marshal(map[string]any{
			"timestamp": "2026-10-08T22:03:16.000Z",
			"type":      "session_meta",
			"payload":   map[string]any{"base_instructions": strings.Repeat("x", size), "cwd": dir},
		})
		if err != nil {
			t.Fatal(err)
		}
		p := filepath.Join(day, "rollout-2026-10-08T22-03-16-01a11e9d-6ca9-7492-bac8-3bbc9852d807.jsonl")
		if err := os.WriteFile(p, append(first, '\n'), 0o644); err != nil {
			t.Fatal(err)
		}
		if got := CodexPathIn(home, dir, "", time.Now().Add(-time.Hour)); got != p {
			t.Errorf("first line of %d KB: found %q, want %q", size>>10, got, p)
		}
		want := time.Date(2026, 10, 8, 22, 3, 16, 0, time.UTC)
		if got, ok := readStart(p); !ok || !got.Equal(want) {
			t.Errorf("first line of %d KB: start %v (%v), want %v", size>>10, got, ok, want)
		}
	}
}
