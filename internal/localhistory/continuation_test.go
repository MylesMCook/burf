package localhistory

import (
	"context"
	"errors"
	"os"
	"testing"
)

func TestContinuationRevalidatesDiscoveredSourceWithoutMutation(t *testing.T) {
	config, store := homes(t)
	ctx := context.Background()
	const id = "12345678-1234-4321-8123-123456789abc"
	path := codexPath(config, "continuation")
	writeRecord(t, path, codexMeta(id, "/project"), codexMessage("user", "Saved request"))
	list, err := store.List(ctx)
	if err != nil || len(list) != 1 {
		t.Fatal(err)
	}
	original, _ := os.ReadFile(path)
	ref, err := store.Continuation(ctx, list[0].ID)
	if err != nil || ref.Source != "codex" || ref.SessionID != id || ref.Cwd != "/project" {
		t.Fatalf("source: %+v, %v", ref, err)
	}
	after, _ := os.ReadFile(path)
	if string(original) != string(after) {
		t.Fatal("source was modified")
	}
	if _, err := store.Continuation(ctx, id); !errors.Is(err, ErrNotFound) {
		t.Fatal("accepted raw ID", err)
	}
	writeRecord(t, path, codexMeta(id, "/other-project"))
	if _, err := store.Continuation(ctx, list[0].ID); !errors.Is(err, ErrNotFound) {
		t.Fatal("accepted changed source", err)
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Continuation(ctx, list[0].ID); !errors.Is(err, ErrNotFound) {
		t.Fatal("accepted removed source", err)
	}
}
