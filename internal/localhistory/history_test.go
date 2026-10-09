package localhistory

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

type object = map[string]any

func TestImportedToolOutputDoesNotMakeLocalArtifacts(t *testing.T) {
	const output = "Artifact 1a2b3c4d5e v1 · chart · Someone else's chart\nOrdinary command output."
	for _, fixture := range []string{"claude", "codex", "codex-wrapped"} {
		t.Run(fixture, func(t *testing.T) {
			source := strings.TrimSuffix(fixture, "-wrapped")
			config, store := homes(t)
			cwd := t.TempDir()
			path := codexPath(config, "artifact-text")
			entries := []object{
				codexMeta("artifact-12345", cwd), codexMessage("user", "Read the notes"),
				{"type": "response_item", "payload": object{"type": "function_call", "name": "shell", "call_id": "call-1", "arguments": `{"command":"printf notes"}`}},
				{"type": "response_item", "payload": object{"type": "function_call_output", "call_id": "call-1", "output": output}},
			}
			if fixture == "codex-wrapped" {
				wrapped, err := json.Marshal(object{"output": output, "metadata": object{"exit_code": 0}})
				if err != nil {
					t.Fatal(err)
				}
				entries[len(entries)-1]["payload"].(object)["output"] = string(wrapped)
			}
			if source == "claude" {
				path = filepath.Join(config.ClaudeHome, "projects", "project", "artifact-12345.jsonl")
				entries = []object{
					claudeMessage("artifact-12345", cwd, "Read the notes"),
					{"type": "assistant", "message": object{"content": []object{{"type": "tool_use", "id": "call-1", "name": "Bash", "input": object{"command": "printf notes"}}}}},
					{"type": "user", "message": object{"content": []object{{"type": "tool_result", "tool_use_id": "call-1", "content": output}}}},
				}
			}
			writeRecord(t, path, entries...)
			list, err := store.List(context.Background())
			if err != nil || len(list) != 1 {
				t.Fatalf("List: %v (%d items)", err, len(list))
			}
			page, err := store.Read(context.Background(), list[0].ID, 0)
			if err != nil {
				t.Fatal(err)
			}
			toolFound := false
			for _, item := range page.Items {
				if item.Kind == "artifact" && item.Local != "" {
					t.Errorf("tool output became an artifact: %+v", item)
				}
				for _, call := range item.Items {
					if item.Kind == "tools" && call.ID == "call-1" && call.Target == "printf notes" && item.Done {
						toolFound = true
					}
				}
			}
			if !toolFound {
				t.Fatal("ordinary tool step was lost")
			}
			data, err := os.ReadFile(path)
			if err != nil || !strings.Contains(string(data), "Ordinary command output.") {
				t.Fatal("tool output was lost", err)
			}
		})
	}
}

func TestImportedPublishedArtifactRemainsVisible(t *testing.T) {
	config, store := homes(t)
	writeRecord(t, filepath.Join(config.ClaudeHome, "projects", "project", "published-12345.jsonl"),
		claudeMessage("published-12345", t.TempDir(), "Publish the report"),
		object{"type": "assistant", "message": object{"content": []object{{"type": "tool_use", "id": "publish-1", "name": "Artifact", "input": object{"file_path": "report.html", "title": "Published report"}}}}},
		object{"type": "user", "message": object{"content": []object{{"type": "tool_result", "tool_use_id": "publish-1", "content": "Published at https://claude.ai/artifact/example1"}}}, "toolUseResult": object{"url": "https://claude.ai/artifact/example1", "title": "Published report", "seq": 1}},
	)
	list, err := store.List(context.Background())
	if err != nil || len(list) != 1 {
		t.Fatalf("List: %v (%d items)", err, len(list))
	}
	page, err := store.Read(context.Background(), list[0].ID, 0)
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range page.Items {
		if item.Kind == "artifact" && item.Local == "" && item.URL == "https://claude.ai/artifact/example1" && item.Done {
			return
		}
	}
	t.Fatal("published artifact was lost")
}

func TestListReportsContinuationFolderAvailability(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "file")
	if err := os.WriteFile(file, []byte("synthetic"), 0600); err != nil {
		t.Fatal(err)
	}
	foreign := `C:\Users\Example\shop`
	if runtime.GOOS == "windows" {
		foreign = "/Users/example/shop"
	}
	for _, tc := range []struct{ name, cwd, reason string }{
		{"available", dir, ""},
		{"relative", "shop", "Its folder, shop, is a relative path. Use a full folder path to continue here."},
		{"foreign", foreign, fmt.Sprintf("Its folder, %s, uses a path for another operating system.", foreign)},
		{"missing", filepath.Join(dir, "missing"), fmt.Sprintf("Its folder, %s, is not on this computer.", filepath.Join(dir, "missing"))},
		{"file", file, fmt.Sprintf("Its path, %s, is a file, not a folder.", file)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, source := range []string{"codex", "claude"} {
				config, store := homes(t)
				if source == "codex" {
					writeRecord(t, codexPath(config, "folder"), codexMeta("folder-12345", tc.cwd))
				} else {
					writeRecord(t, filepath.Join(config.ClaudeHome, "projects", "project", "folder-12345.jsonl"), claudeMessage("folder-12345", tc.cwd, "Saved conversation"))
				}
				list, err := store.List(context.Background())
				if err != nil || len(list) != 1 {
					t.Fatalf("List: %v (%d items)", err, len(list))
				}
				data, _ := json.Marshal(list[0])
				var wire struct {
					CanContinue    *bool  `json:"can_continue"`
					ContinueReason string `json:"continue_reason"`
				}
				if err := json.Unmarshal(data, &wire); err != nil || wire.CanContinue == nil || *wire.CanContinue != (tc.reason == "") || wire.ContinueReason != tc.reason {
					t.Fatalf("%s continuation metadata: %s (%v)", source, data, err)
				}
			}
		})
	}
}

func homes(t *testing.T) (Config, *Store) {
	t.Helper()
	config := Config{CodexHome: filepath.Join(t.TempDir(), "codex"), ClaudeHome: filepath.Join(t.TempDir(), "claude")}
	return config, New(config)
}

func writeRecord(t *testing.T, path string, entries ...object) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	var b strings.Builder
	for _, entry := range entries {
		line, err := json.Marshal(entry)
		if err != nil {
			t.Fatal(err)
		}
		b.Write(line)
		b.WriteByte('\n')
	}
	if err := os.WriteFile(path, []byte(b.String()), 0600); err != nil {
		t.Fatal(err)
	}
}

func codexPath(config Config, name string) string {
	return filepath.Join(config.CodexHome, "sessions", "2026", "10", "07", "rollout-"+name+".jsonl")
}

func codexMeta(id, cwd string) object {
	return object{"type": "session_meta", "payload": object{"id": id, "cwd": cwd, "source": "cli"}}
}

func codexMessage(role, text string) object {
	return object{"type": "response_item", "payload": object{"type": "message", "role": role, "content": []object{{"type": "input_text", "text": text}}}}
}

func claudeMessage(id, cwd, text string) object {
	return object{"type": "user", "sessionId": id, "cwd": cwd, "message": object{"role": "user", "content": text}}
}

func TestDiscoversTopLevelChatsAndUsesMetadataPaths(t *testing.T) {
	config, store := homes(t)
	const cwd = `C:\Users\Example User\work.with-dashes`
	writeRecord(t, codexPath(config, "first"), codexMeta("codex-12345", cwd), codexMessage("user", "# AGENTS.md instructions\n<INSTRUCTIONS>hidden</INSTRUCTIONS>"), codexMessage("user", "Check the Windows build\nDetails"))
	claude := filepath.Join(config.ClaudeHome, "projects", "lossy-encoded-directory", "claude-12345.jsonl")
	writeRecord(t, claude, claudeMessage("claude-12345", cwd, "Explain the test failure"))
	// Both known helper layouts and helpers with top-level-looking names
	// are excluded, without reversing Claude's lossy directory encoding.
	writeRecord(t, filepath.Join(filepath.Dir(claude), "claude-12345", "subagents", "agent-helper.jsonl"), claudeMessage("helper-12345", cwd, "helper"))
	helper := claudeMessage("helper-12345", cwd, "helper")
	helper["isSidechain"] = true
	writeRecord(t, filepath.Join(filepath.Dir(claude), "helper-12345.jsonl"), helper)
	subagent := codexMeta("codex-helper", cwd)
	subagent["payload"].(object)["source"] = object{"subagent": object{"thread_spawn": object{"parent_thread_id": "parent"}}}
	writeRecord(t, codexPath(config, "helper"), subagent, codexMessage("user", "helper"))
	writeRecord(t, filepath.Join(filepath.Dir(claude), "sessions-index.json"), object{"entries": []object{}})
	items, err := store.List(context.Background())
	if err != nil || len(items) != 2 {
		t.Fatalf("List: %v (%d items)", err, len(items))
	}
	for _, item := range items {
		if !item.ReadOnly || item.Cwd != cwd || len(item.ID) != 64 || item.UpdatedAt.IsZero() {
			t.Fatalf("bad metadata: %+v", item)
		}
		if item.Source == "codex" && item.Title != "Check the Windows build" {
			t.Fatalf("title: %q", item.Title)
		}
		if item.Source == "claude" && item.Title != "Explain the test failure" {
			t.Fatalf("title: %q", item.Title)
		}
		page, err := store.Read(context.Background(), item.ID, 0)
		if err != nil || len(page.Items) != 1 {
			t.Fatalf("Read: %v (%d items)", err, len(page.Items))
		}
	}
}

func TestOpaqueStableIDsDeduplicateWithinSource(t *testing.T) {
	config, store := homes(t)
	old, newer := codexPath(config, "old"), codexPath(config, "new")
	writeRecord(t, old, codexMeta("same-12345", "/work"), codexMessage("user", "old"))
	writeRecord(t, newer, codexMeta("same-12345", "/work"), codexMessage("user", "new"))
	timeOld := time.Now().Add(-time.Hour)
	if err := os.Chtimes(old, timeOld, timeOld); err != nil {
		t.Fatal(err)
	}
	writeRecord(t, filepath.Join(config.ClaudeHome, "projects", "project", "same-12345.jsonl"), claudeMessage("same-12345", "/work", "Claude"))
	list, err := store.List(context.Background())
	if err != nil || len(list) != 2 {
		t.Fatalf("List: %v, count %d", err, len(list))
	}
	var codexID string
	for _, item := range list {
		if item.Source == "codex" {
			codexID = item.ID
			if item.Title != "new" {
				t.Fatalf("did not select newest duplicate")
			}
		}
	}
	if list[0].ID == list[1].ID {
		t.Fatal("sources share an ID")
	}
	if err := os.Rename(newer, codexPath(config, "renamed")); err != nil {
		t.Fatal(err)
	}
	list, err = New(config).List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range list {
		if item.Source == "codex" && item.ID != codexID {
			t.Fatal("ID changed with filename or restart")
		}
	}
}

func TestReadPagesWithoutMutation(t *testing.T) {
	config, store := homes(t)
	path := codexPath(config, "pages")
	entries := []object{codexMeta("pages-12345", "/work")}
	for i := 0; i < 250; i++ {
		entries = append(entries, codexMessage("user", fmt.Sprintf("Message %d", i)))
	}
	writeRecord(t, path, entries...)
	original, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	list, err := store.List(context.Background())
	if err != nil || len(list) != 1 {
		t.Fatalf("List: %v (%d)", err, len(list))
	}
	before := int64(0)
	seen := map[string]bool{}
	for pageNumber := 0; pageNumber < 3; pageNumber++ {
		page, err := store.Read(context.Background(), list[0].ID, before)
		if err != nil {
			t.Fatal(err)
		}
		want := 100
		if pageNumber == 2 {
			want = 50
		}
		if len(page.Items) != want || page.More != (pageNumber < 2) {
			t.Fatalf("page %d: items %d, more %v", pageNumber, len(page.Items), page.More)
		}
		for _, item := range page.Items {
			if seen[item.ID] {
				t.Fatal("duplicate page item")
			}
			seen[item.ID] = true
		}
		before = page.Items[0].Off
	}
	after, err := os.ReadFile(path)
	if err != nil || string(original) != string(after) {
		t.Fatal("history read mutated source")
	}
}

func TestMalformedTruncatedAndMismatchedRecords(t *testing.T) {
	config, store := homes(t)
	path := codexPath(config, "partial")
	writeRecord(t, path, codexMeta("partial-12345", "/work"), codexMessage("user", "Complete prompt"))
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	_, err = f.WriteString("malformed\n{\"type\":\"response_item\",\"payload\":")
	f.Close()
	if err != nil {
		t.Fatal(err)
	}
	writeRecord(t, codexPath(config, "missing"), object{"type": "session_meta", "payload": object{"cwd": "/work"}})
	writeRecord(t, filepath.Join(config.ClaudeHome, "projects", "p", "mismatch-12345.jsonl"), claudeMessage("other-12345", "/work", "wrong file"))
	list, err := store.List(context.Background())
	if err != nil || len(list) != 1 {
		t.Fatalf("List: %v (%d)", err, len(list))
	}
	page, err := store.Read(context.Background(), list[0].ID, 0)
	if err != nil || len(page.Items) != 1 || page.Items[0].Text != "Complete prompt" {
		t.Fatalf("Read: %+v, %v", page, err)
	}
	writeRecord(t, path, codexMeta("replacement-12345", "/work"), codexMessage("user", "replacement"))
	if _, err := store.Read(context.Background(), list[0].ID, 0); !errors.Is(err, ErrNotFound) {
		t.Fatalf("replacement not rejected: %v", err)
	}
}

func TestSymlinkEscapesAndArbitraryPathsAreRejected(t *testing.T) {
	config, store := homes(t)
	path := codexPath(config, "safe")
	writeRecord(t, path, codexMeta("safe-12345", "/work"), codexMessage("user", "safe"))
	list, err := store.List(context.Background())
	if err != nil || len(list) != 1 {
		t.Fatal("fixture not discovered", err)
	}
	for _, id := range []string{path, "../../outside.jsonl", `C:\outside.jsonl`, "unknown"} {
		if _, err := store.Read(context.Background(), id, 0); !errors.Is(err, ErrNotFound) {
			t.Fatalf("path accepted: %q", id)
		}
	}
	outside := filepath.Join(t.TempDir(), "outside.jsonl")
	writeRecord(t, outside, codexMeta("safe-12345", "/work"), codexMessage("user", "outside"))
	link := codexPath(config, "link")
	if err := os.Symlink(outside, link); err != nil {
		t.Skipf("symlink creation unavailable: %v", err)
	}
	list, err = store.List(context.Background())
	if err != nil || len(list) != 1 {
		t.Fatalf("symlink discovered: %v (%d)", err, len(list))
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, path); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Read(context.Background(), list[0].ID, 0); !errors.Is(err, ErrNotFound) {
		t.Fatalf("replacement symlink accepted: %v", err)
	}
	// A whole linked project directory is also outside discovery.
	project := filepath.Join(t.TempDir(), "project")
	writeRecord(t, filepath.Join(project, "claude-12345.jsonl"), claudeMessage("claude-12345", "/work", "outside"))
	if err := os.MkdirAll(filepath.Join(config.ClaudeHome, "projects"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(project, filepath.Join(config.ClaudeHome, "projects", "linked")); err != nil {
		t.Fatal(err)
	}
	list, err = store.List(context.Background())
	if err != nil || len(list) != 0 {
		t.Fatalf("directory link discovered: %v (%d)", err, len(list))
	}
}

func TestDefaultsCancellationAndMetadataBudget(t *testing.T) {
	config, _ := homes(t)
	t.Setenv("CODEX_HOME", config.CodexHome)
	t.Setenv("CLAUDE_CONFIG_DIR", config.ClaudeHome)
	store := New(Config{})
	list, err := store.List(context.Background())
	if err != nil || len(list) != 0 {
		t.Fatal("missing source should be empty", err)
	}
	path := codexPath(config, "large")
	writeRecord(t, path, codexMeta("large-12345", "/work"), codexMessage("user", strings.Repeat("x", metadataBytes*2)))
	list, err = store.List(context.Background())
	if err != nil || len(list) != 1 || list[0].Title != "codex conversation" {
		t.Fatalf("metadata budget/default homes: %v (%+v)", err, list)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := store.List(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("List cancellation: %v", err)
	}
	if _, err := store.Read(ctx, list[0].ID, 0); !errors.Is(err, context.Canceled) {
		t.Fatalf("Read cancellation: %v", err)
	}
}

func TestListLimitAndDeterministicOrder(t *testing.T) {
	config, store := homes(t)
	for i := 0; i < maxConversations+2; i++ {
		path := codexPath(config, fmt.Sprintf("%04d", i))
		writeRecord(t, path, codexMeta(fmt.Sprintf("session-%04d", i), "/work"), codexMessage("user", fmt.Sprint(i)))
		at := time.Unix(int64(i+1000), 0)
		if err := os.Chtimes(path, at, at); err != nil {
			t.Fatal(err)
		}
	}
	list, err := store.List(context.Background())
	if err != nil || len(list) != maxConversations {
		t.Fatalf("List limit: %v (%d)", err, len(list))
	}
	if list[0].Title != "501" || list[len(list)-1].Title != "2" {
		t.Fatal("not newest-first")
	}
}
