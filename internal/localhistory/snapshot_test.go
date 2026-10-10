package localhistory

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestHistoryByteBoundaryDoesNotCompleteFutureSourceRecords(t *testing.T) {
	for _, source := range []string{"codex", "claude"} {
		t.Run(source, func(t *testing.T) {
			config, store := homes(t)
			cwd := t.TempDir()
			const id = "snapshot-12345"
			path := codexPath(config, "snapshot")
			future := codexMessage("user", "Future external message")
			if source == "codex" {
				writeRecord(t, path, codexMeta(id, cwd), codexMessage("user", "Saved request"))
			} else {
				path = filepath.Join(config.ClaudeHome, "projects", "project", id+".jsonl")
				writeRecord(t, path, claudeMessage(id, cwd, "Saved request"))
				future = claudeMessage(id, cwd, "Future external message")
			}
			list, err := store.List(context.Background())
			if err != nil || len(list) != 1 {
				t.Fatalf("history discovery: %v, %d", err, len(list))
			}
			original, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			futureLine, _ := json.Marshal(future)
			partial := len(futureLine) / 2
			boundary := int64(len(original) + partial)
			if err := os.WriteFile(path, append(append([]byte{}, original...), futureLine[:partial]...), 0600); err != nil {
				t.Fatal(err)
			}
			// The provider finishes a record after the continuation captured
			// its byte boundary. That new content was never in the fork.
			if err := os.WriteFile(path, append(append([]byte{}, original...), append(futureLine, '\n')...), 0600); err != nil {
				t.Fatal(err)
			}
			page, err := store.Read(context.Background(), list[0].ID, boundary)
			if err != nil || len(page.Items) != 1 || page.Items[0].Text != "Saved request" {
				t.Fatalf("history read crossed its byte boundary: %+v, %v", page.Items, err)
			}
		})
	}
}
