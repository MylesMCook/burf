package agent

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/localagent"
	"github.com/MylesMCook/burf/internal/localchat"
)

func TestLocalChatRoutesAndRestartBoundary(t *testing.T) {
	a := &Agent{ctx: context.Background()}
	a.localClient.manager = localagent.New(nil, nil)
	a.localClient.chats = localchat.New("synthetic.exe", func(localchat.LaunchOptions) (localchat.Process, error) {
		c, s := net.Pipe()
		go func() {
			defer s.Close()
			scanner := bufio.NewScanner(s)
			for scanner.Scan() {
				var p struct {
					ID     json.RawMessage `json:"id"`
					Method string          `json:"method"`
				}
				_ = json.Unmarshal(scanner.Bytes(), &p)
				if p.Method == "initialized" {
					continue
				}
				result := any(map[string]any{})
				if p.Method == "thread/start" {
					result = map[string]any{"thread": map[string]string{"id": "owned"}}
				}
				_ = json.NewEncoder(s).Encode(map[string]any{"id": p.ID, "result": result})
			}
		}()
		return c, nil
	})
	defer a.localClient.chats.Close()
	mux := http.NewServeMux()
	a.localChatRoutes(func(pattern string, h http.HandlerFunc) { mux.HandleFunc(pattern, h) })
	call := func(method, path, body string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest(method, "http://localhost"+path, strings.NewReader(body)))
		return w
	}
	if got := call("GET", "/v1/local/chats/foreign", ""); got.Code != 404 {
		t.Fatal(got.Code)
	}
	body, _ := json.Marshal(map[string]string{"cwd": t.TempDir()})
	got := call("POST", "/v1/local/chats", string(body))
	if got.Code != 201 {
		t.Fatal(got.Code, got.Body.String())
	}
	var chat localchat.Session
	if err := json.Unmarshal(got.Body.Bytes(), &chat); err != nil {
		t.Fatal(err)
	}
	if chat.ThreadID != "owned" || chat.Mode != "chat" {
		t.Fatal(chat)
	}
	if err := a.prepareLocalRestart(); err == nil {
		t.Fatal("restart accepted live structured chat")
	}
	// A failed restart must not close the terminal manager to future launches.
	if _, err := a.localClient.manager.Start("missing", t.TempDir()); err == nil || strings.Contains(err.Error(), "shutting down") {
		t.Fatal(err)
	}
	if got := call("POST", "/v1/local/chats/"+chat.ID+"/approvals", `{"id":"foreign","decision":"accept"}`); got.Code != 400 {
		t.Fatal(got.Code)
	}
	if got := call("POST", "/v1/local/chats/"+chat.ID+"/messages", `{"text":""}`); got.Code != 400 {
		t.Fatal(got.Code)
	}
	if got := call("DELETE", "/v1/local/chats/"+chat.ID, ""); got.Code != 200 {
		t.Fatal(got.Code)
	}
	if err := a.prepareLocalRestart(); err != nil {
		t.Fatal(err)
	}
}

func TestLocalClaudeUsesSharedHandlersAndAccountEnvironment(t *testing.T) {
	t.Setenv("CLAUDE_CONFIG_DIR", t.TempDir())
	a := &Agent{ctx: context.Background()}
	a.localClient.manager = localagent.New(nil, nil)
	a.localClient.commands = map[string]localagent.Command{"claude": {Program: "synthetic-claude", CanChat: true}}
	a.localClient.chats = localchat.New("synthetic-codex", func(options localchat.LaunchOptions) (localchat.Process, error) {
		if options.Agent != "claude" || options.Program != "synthetic-claude" || !strings.Contains(strings.Join(options.Env, "\n"), "CLAUDE_CONFIG_DIR="+os.Getenv("CLAUDE_CONFIG_DIR")) {
			t.Error("wrong Claude launch", options)
		}
		client, peer := net.Pipe()
		go func() {
			defer peer.Close()
			encoder := json.NewEncoder(peer)
			scanner := bufio.NewScanner(peer)
			for scanner.Scan() {
				var msg struct {
					ID     json.RawMessage `json:"id"`
					Method string          `json:"method"`
				}
				if json.Unmarshal(scanner.Bytes(), &msg) != nil || msg.Method == "" {
					continue
				}
				reply := func(result any) {
					_ = encoder.Encode(map[string]any{"jsonrpc": "2.0", "id": json.RawMessage(msg.ID), "result": result})
				}
				switch msg.Method {
				case "initialize":
					reply(map[string]any{"protocolVersion": 1, "agentCapabilities": map[string]any{"loadSession": true}})
				case "session/new", "session/load":
					reply(map[string]any{"sessionId": "local-claude"})
				case "session/prompt":
					_ = encoder.Encode(map[string]any{"jsonrpc": "2.0", "method": "session/update", "params": map[string]any{
						"sessionId": "local-claude",
						"update":    map[string]any{"sessionUpdate": "agent_message_chunk", "messageId": "a1", "content": map[string]any{"type": "text", "text": "reply"}},
					}})
					reply(map[string]any{"stopReason": "end_turn"})
				}
			}
		}()
		return client, nil
	})
	t.Cleanup(a.localClient.chats.Close)
	mux := http.NewServeMux()
	a.localChatRoutes(func(pattern string, h http.HandlerFunc) { mux.HandleFunc(pattern, h) })
	call := func(method, path, body string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest(method, path, strings.NewReader(body)))
		return w
	}
	body, _ := json.Marshal(map[string]string{"cwd": t.TempDir(), "agent": "claude"})
	// An installed terminal CLI without structured capability is refused.
	a.localClient.commands["claude"] = localagent.Command{Program: "synthetic-claude"}
	if w := call("POST", "/v1/local/chats", string(body)); w.Code != 400 || !strings.Contains(w.Body.String(), "Claude Code") {
		t.Fatal(w.Code, w.Body)
	}
	a.localClient.commands["claude"] = localagent.Command{Program: "synthetic-claude", CanChat: true}
	w := call("POST", "/v1/local/chats", string(body))
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body)
	}
	var chat localchat.Session
	if err := json.Unmarshal(w.Body.Bytes(), &chat); err != nil {
		t.Fatal(err)
	}
	if chat.Agent != "claude" || chat.ThreadID != "local-claude" {
		t.Fatal(chat)
	}
	if err := a.prepareLocalRestart(); err == nil {
		t.Fatal("restart allowed a live Claude chat")
	}
	if w := call("POST", "/v1/local/chats/"+chat.ID+"/messages", `{"text":"hello"}`); w.Code != 200 {
		t.Fatal(w.Code, w.Body)
	}
	deadline := time.Now().Add(time.Second)
	for {
		w = call("GET", "/v1/local/chats/"+chat.ID, "")
		if w.Code != 200 {
			t.Fatal(w.Code, w.Body)
		}
		if err := json.Unmarshal(w.Body.Bytes(), &chat); err != nil {
			t.Fatal(err)
		}
		if chat.State == "idle" && len(chat.Items) == 2 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("Claude turn did not finish", chat)
		}
		time.Sleep(time.Millisecond)
	}
	if chat.Items[1].Kind != "assistant" || chat.Items[1].Text != "reply" {
		t.Fatal(chat.Items)
	}
	if w := call("DELETE", "/v1/local/chats/"+chat.ID, ""); w.Code != 200 {
		t.Fatal(w.Code, w.Body)
	}
	if err := a.prepareLocalRestart(); err != nil {
		t.Fatal(err)
	}
}
