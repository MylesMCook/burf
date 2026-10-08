package agent

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/MylesMCook/burf/internal/localagent"
	"github.com/MylesMCook/burf/internal/localchat"
)

func TestLocalChatRoutesAndRestartBoundary(t *testing.T) {
	a := &Agent{ctx: context.Background()}
	a.localClient.manager = localagent.New(nil, nil)
	a.localClient.chats = localchat.New("synthetic.exe", func(string, string) (localchat.Process, error) {
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
