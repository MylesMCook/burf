package transcript

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestAssignClaudeAccountIsolation(t *testing.T) {
	defaultHome, otherHome := t.TempDir(), t.TempDir()
	t.Setenv("CLAUDE_CONFIG_DIR", defaultHome)
	dir := "/w/shop"
	started := time.Now().UTC()
	paths := map[string]string{}
	for _, home := range []string{defaultHome, otherHome} {
		proj := ClaudeDirIn(home, dir)
		if err := os.MkdirAll(proj, 0o700); err != nil {
			t.Fatal(err)
		}
		paths[home] = filepath.Join(proj, "aaaaaaaa-1.jsonl")
		write(t, paths[home], m{"type": "user", "timestamp": started.Format(time.RFC3339Nano), "message": m{"role": "user", "content": "synthetic"}})
	}
	for _, id := range []string{"", "aaaaaaaa-1"} {
		got := AssignClaude(dir, []Claim{
			{Name: "default", ID: id, Started: started},
			{Name: "other", ID: id, Started: started, ConfigDir: otherHome},
			{Name: "empty", ID: id, Started: started, ConfigDir: t.TempDir()},
		})
		if got["default"] != paths[defaultHome] || got["other"] != paths[otherHome] || got["empty"] != "" {
			t.Fatalf("id %q: wrong account assignment: %v", id, got)
		}
	}
}

func TestAssignClaudeDefaultAndExplicitHomeShareClaims(t *testing.T) {
	home := t.TempDir()
	t.Setenv("CLAUDE_CONFIG_DIR", home)
	dir := "/w/shop"
	proj := ClaudeDir(dir)
	if err := os.MkdirAll(proj, 0o700); err != nil {
		t.Fatal(err)
	}
	started := time.Now().UTC()
	path := filepath.Join(proj, "aaaaaaaa-1.jsonl")
	write(t, path, m{"type": "user", "timestamp": started.Format(time.RFC3339Nano), "message": m{"role": "user", "content": "synthetic"}})
	got := AssignClaude(dir, []Claim{
		{Name: "default", Started: started},
		{Name: "explicit", Started: started.Add(time.Second), ConfigDir: home + string(os.PathSeparator)},
	})
	if got["default"] != path || got["explicit"] != "" {
		t.Fatalf("same account assigned twice: %v", got)
	}
}

func TestCodexPathAccountIsolation(t *testing.T) {
	defaultHome, otherHome := t.TempDir(), t.TempDir()
	t.Setenv("CODEX_HOME", defaultHome)
	dir := "/w/shop"
	started := time.Now()
	paths := map[string]string{}
	for _, home := range []string{defaultHome, otherHome} {
		folder := filepath.Join(home, "sessions", "2026", "10", "08")
		if err := os.MkdirAll(folder, 0o700); err != nil {
			t.Fatal(err)
		}
		paths[home] = filepath.Join(folder, "rollout-test-aaaaaaaa-1.jsonl")
		write(t, paths[home], m{"type": "session_meta", "payload": m{"cwd": dir}})
	}
	for _, id := range []string{"", "aaaaaaaa-1"} {
		if got := CodexPath(dir, id, started); got != paths[defaultHome] {
			t.Fatalf("default id %q: %q", id, got)
		}
		if got := CodexPathIn(otherHome, dir, id, started); got != paths[otherHome] {
			t.Fatalf("other id %q: %q", id, got)
		}
		if got := CodexPathIn(t.TempDir(), dir, id, started); got != "" {
			t.Fatalf("missing profile leaked default: %q", got)
		}
	}
}
