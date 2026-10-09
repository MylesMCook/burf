package localhistory

import (
	"context"
	"errors"
	"os"
	"path/filepath"
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
	if err != nil || ref.Source != "codex" || ref.SessionID != id || ref.Cwd != "/project" || ref.Title != "Saved request" {
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

func TestContinuationRejectsReplacedFileWithSameMetadata(t *testing.T) {
	config, store := homes(t)
	const id = "12345678-1234-4321-8123-123456789abc"
	path := codexPath(config, "original")
	writeRecord(t, path, codexMeta(id, "/project"), codexMessage("user", "Original"))
	list, err := store.List(context.Background())
	if err != nil || len(list) != 1 {
		t.Fatalf("discovery: %v, %d", err, len(list))
	}
	replacement := filepath.Join(filepath.Dir(path), "replacement.tmp")
	writeRecord(t, replacement, codexMeta(id, "/project"), codexMessage("user", "Replacement"))
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(replacement, path); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Continuation(context.Background(), list[0].ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("replaced source accepted: %v", err)
	}
	if _, err := store.Read(context.Background(), list[0].ID, 0); !errors.Is(err, ErrNotFound) {
		t.Fatalf("replaced history read accepted: %v", err)
	}
	// An explicit refresh may discover the replacement as a new current source.
	if _, err := store.List(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Continuation(context.Background(), list[0].ID); err != nil {
		t.Fatal(err)
	}
}

func TestContinuationAllowsAppendButRejectsTruncation(t *testing.T) {
	config, store := homes(t)
	const id = "12345678-1234-4321-8123-123456789abc"
	path := codexPath(config, "append")
	meta := codexMeta(id, "/project")
	writeRecord(t, path, meta, codexMessage("user", "Original request"))
	list, err := store.List(context.Background())
	if err != nil || len(list) != 1 {
		t.Fatalf("discovery: %v, %d", err, len(list))
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	_, err = f.WriteString("{}\n")
	f.Close()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Continuation(context.Background(), list[0].ID); err != nil {
		t.Fatalf("normal history append rejected: %v", err)
	}
	writeRecord(t, path, meta)
	if _, err := store.Continuation(context.Background(), list[0].ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("truncated history accepted: %v", err)
	}
}
