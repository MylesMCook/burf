package agent

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/MylesMCook/burf/internal/localagent"
	"github.com/MylesMCook/burf/internal/localchat"
	"github.com/MylesMCook/burf/internal/localhistory"
)

func TestStructuredLocalContinuationRevalidatesAndPreservesSource(t *testing.T) {
	for _, provider := range []string{"codex", "claude"} {
		t.Run(provider, func(t *testing.T) {
			dir := t.TempDir()
			const sourceID = "12345678-1234-4321-8123-123456789abc"
			path := filepath.Join(dir, "sessions", "2026", "10", "07", "rollout-synthetic.jsonl")
			entry := map[string]any{"type": "session_meta", "payload": map[string]any{"id": sourceID, "cwd": dir, "source": "cli"}}
			if provider == "claude" {
				path = filepath.Join(dir, "projects", "project", sourceID+".jsonl")
				entry = map[string]any{"type": "user", "sessionId": sourceID, "cwd": dir, "message": map[string]any{"role": "user", "content": "Saved request"}}
			}
			if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
				t.Fatal(err)
			}
			original, _ := json.Marshal(entry)
			original = append(original, '\n')
			if provider == "codex" {
				message, _ := json.Marshal(map[string]any{"type": "response_item", "payload": map[string]any{"type": "message", "role": "user", "content": []map[string]string{{"type": "input_text", "text": "Saved request"}}}})
				original = append(original, append(message, '\n')...)
			}
			if err := os.WriteFile(path, original, 0600); err != nil {
				t.Fatal(err)
			}
			var launches atomic.Int32
			a := &Agent{ctx: context.Background()}
			a.localClient.commands = map[string]localagent.Command{provider: {Program: "synthetic", CanChat: true, CanFork: true}}
			a.localClient.history = localhistory.New(localhistory.Config{CodexHome: dir, ClaudeHome: dir})
			a.localClient.chats = localchat.New("synthetic", func(options localchat.LaunchOptions) (localchat.Process, error) {
				launches.Add(1)
				if options.Agent != provider || options.Fork != sourceID || options.CWD != dir {
					t.Errorf("wrong source launch: agent=%q source=%q cwd=%q", options.Agent, options.Fork, options.CWD)
				}
				client, peer := net.Pipe()
				go func() {
					defer peer.Close()
					encoder := json.NewEncoder(peer)
					if provider == "claude" {
						_ = encoder.Encode(map[string]any{"type": "system", "subtype": "init", "session_id": "independent-claude"})
					}
					scanner := bufio.NewScanner(peer)
					for scanner.Scan() {
						var p struct {
							ID     json.RawMessage `json:"id"`
							Method string          `json:"method"`
						}
						_ = json.Unmarshal(scanner.Bytes(), &p)
						if p.Method == "initialize" {
							_ = encoder.Encode(map[string]any{"id": p.ID, "result": map[string]any{}})
						} else if p.Method == "thread/start" || p.Method == "thread/fork" {
							_ = encoder.Encode(map[string]any{"id": p.ID, "result": map[string]any{"thread": map[string]string{"id": "independent-codex"}}})
						} else if p.Method == "turn/start" {
							t.Error("continuation replayed a prompt")
						}
					}
				}()
				return client, nil
			})
			t.Cleanup(a.localClient.chats.Close)
			mux := http.NewServeMux()
			a.localChatRoutes(func(pattern string, h http.HandlerFunc) { mux.HandleFunc(pattern, h) })
			call := func(id string) *httptest.ResponseRecorder {
				w := httptest.NewRecorder()
				mux.ServeHTTP(w, httptest.NewRequest("POST", "/v1/local/conversations/"+id+"/continue", strings.NewReader("{}")))
				return w
			}
			if w := call(sourceID); w.Code != 404 {
				t.Fatal("raw source id accepted", w.Code)
			}
			list, err := a.localClient.history.List(context.Background())
			if err != nil || len(list) != 1 {
				t.Fatalf("history discovery: %v, %d", err, len(list))
			}
			// A cancelled request queued behind another launch must not start
			// its provider after that gate becomes available.
			a.localClient.launchMu.Lock()
			ctx, cancel := context.WithCancel(context.Background())
			started := make(chan struct{})
			cancelled := make(chan *httptest.ResponseRecorder, 1)
			go func() {
				close(started)
				w := httptest.NewRecorder()
				r := httptest.NewRequest("POST", "/v1/local/conversations/"+list[0].ID+"/continue", strings.NewReader("{}")).WithContext(ctx)
				mux.ServeHTTP(w, r)
				cancelled <- w
			}()
			<-started
			cancel()
			a.localClient.launchMu.Unlock()
			if w := <-cancelled; w.Code != 400 || launches.Load() != 0 {
				t.Fatal("cancelled pending continuation launched", w.Code, launches.Load())
			}
			for _, command := range []localagent.Command{{Program: "synthetic", CanChat: true}, {Program: "synthetic", CanFork: true}} {
				a.localClient.commands[provider] = command
				if w := call(list[0].ID); w.Code != 400 || launches.Load() != 0 {
					t.Fatal("unsupported structured fork launched or fell back", w.Code, launches.Load())
				}
			}
			a.localClient.commands[provider] = localagent.Command{Program: "synthetic", CanChat: true, CanFork: true}
			for range 2 {
				w := call(list[0].ID)
				var chat localchat.Session
				if w.Code != 201 || json.Unmarshal(w.Body.Bytes(), &chat) != nil || chat.Mode != "chat" || chat.Agent != provider || chat.ThreadID == sourceID || chat.HistoryID != list[0].ID || chat.HistoryID == sourceID || chat.HistoryBefore != int64(len(original)) {
					t.Fatalf("continuation did not open a chat: %d, %s", w.Code, w.Body)
				}
				stored, err := a.localClient.chats.Get(chat.ID)
				if err != nil || stored.HistoryID != list[0].ID || stored.HistoryBefore != int64(len(original)) || a.localClient.chats.List()[0].HistoryID != list[0].ID || a.localClient.chats.List()[0].HistoryBefore != int64(len(original)) {
					t.Fatal("history context was not kept for reconnect", err)
				}
			}
			if launches.Load() != 1 {
				t.Fatal("duplicate continuation", launches.Load())
			}
			after, err := os.ReadFile(path)
			if err != nil || string(after) != string(original) {
				t.Fatal("source history changed", err)
			}
			future := map[string]any{"type": "response_item", "payload": map[string]any{"type": "message", "role": "user", "content": []map[string]string{{"type": "input_text", "text": "Future external message"}}}}
			if provider == "claude" {
				future = map[string]any{"type": "user", "sessionId": sourceID, "cwd": dir, "message": map[string]any{"role": "user", "content": "Future external message"}}
			}
			futureLine, _ := json.Marshal(future)
			if err := os.WriteFile(path, append(append([]byte{}, original...), append(futureLine, '\n')...), 0600); err != nil {
				t.Fatal(err)
			}
			w := call(list[0].ID)
			var reused localchat.Session
			if w.Code != 201 || json.Unmarshal(w.Body.Bytes(), &reused) != nil || reused.HistoryBefore != int64(len(original)) || launches.Load() != 1 {
				t.Fatalf("grown history changed fork context: %d, %s", w.Code, w.Body)
			}
			page, err := a.localClient.history.Read(context.Background(), reused.HistoryID, reused.HistoryBefore)
			if err != nil || len(page.Items) != 1 || page.Items[0].Text != "Saved request" {
				t.Fatalf("future source messages entered the continuation: %+v, %v", page.Items, err)
			}
			if err := os.WriteFile(path, nil, 0600); err != nil {
				t.Fatal(err)
			}
			if w := call(list[0].ID); w.Code != 404 || launches.Load() != 1 {
				t.Fatal("changed source accepted", w.Code, launches.Load())
			}
		})
	}
}
