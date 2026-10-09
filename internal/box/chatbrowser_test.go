package box

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/browsermcp"
	"github.com/MylesMCook/burf/internal/events"
	"github.com/MylesMCook/burf/internal/hooks"
	"github.com/MylesMCook/burf/internal/localchat"
	"github.com/MylesMCook/burf/internal/wire"
)

const browserStart = `{"location":"project","browser":{"tools":[{"name":"browser_snapshot","description":"Read the active tab.","input_schema":{"type":"object","properties":{"tab":{"type":"string"}}}}]}}`

// browserFixture is a box with a synthetic provider, reachable two ways: h is
// a paired client's view, and local is the box's own socket.
type browserFixture struct {
	box      *Box
	h        http.Handler
	local    *Client
	launches atomic.Int32
	started  chan json.RawMessage
}

// extra mounts routes of a test's own beside the chat routes.
func newBrowserFixture(t *testing.T, extra ...func(b *Box, add func(string, func(http.ResponseWriter, *http.Request) error))) *browserFixture {
	t.Helper()
	bin := t.TempDir()
	if err := os.WriteFile(filepath.Join(bin, "codex"), []byte("#!/bin/sh\n"), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("CODEX_HOME", t.TempDir())
	f := &browserFixture{started: make(chan json.RawMessage, 4)}
	// A Unix socket path must stay short; t.TempDir is too long on macOS.
	dir, err := os.MkdirTemp("/tmp", "burf-bridge-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	b := &Box{Locations: NewLocations(filepath.Join(t.TempDir(), "locations.json")), Events: &events.Bus{}, Socket: filepath.Join(dir, "box.sock")}
	if _, err = b.Locations.Add(context.Background(), "project", t.TempDir()); err != nil {
		t.Fatal(err)
	}
	b.Chats = localchat.New("", func(localchat.LaunchOptions) (localchat.Process, error) {
		f.launches.Add(1)
		client, server := net.Pipe()
		go func() {
			defer server.Close()
			scan := bufio.NewScanner(server)
			for scan.Scan() {
				var p struct {
					ID     json.RawMessage
					Method string
					Params json.RawMessage
				}
				_ = json.Unmarshal(scan.Bytes(), &p)
				result := any(map[string]any{})
				switch p.Method {
				case "thread/start":
					f.started <- append(json.RawMessage(nil), p.Params...)
					result = map[string]any{"thread": map[string]string{"id": "owned-thread"}}
				case "turn/start":
					result = map[string]any{"turn": map[string]string{"id": "owned-turn"}}
				}
				if len(p.ID) > 0 {
					data, _ := json.Marshal(map[string]any{"id": p.ID, "result": result})
					_, _ = server.Write(append(data, '\n'))
				}
			}
		}()
		return client, nil
	})
	t.Cleanup(b.CloseChats)
	mux := http.NewServeMux()
	ws := &wire.Server{}
	add := func(pattern string, h func(http.ResponseWriter, *http.Request) error) {
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if err := h(w, r); err != nil {
				writeErr(w, err)
			}
		})
		mux.Handle(pattern, handler)
		ws.Handle(pattern, handler)
	}
	b.mountChats(add)
	for _, mount := range extra {
		mount(b, add)
	}
	ln, err := net.Listen("unix", b.Socket)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go ws.ServeLocal(ctx, ln)
	f.box, f.h, f.local = b, mux, NewClient(NewLocal(b.Socket))
	return f
}

// startBrowserChat starts a chat with one browser tool and opens a turn.
func (f *browserFixture) startBrowserChat(t *testing.T) Chat {
	t.Helper()
	w := chatRequest(f.h, "POST", "/v1/chats", browserStart)
	var s Chat
	if err := json.Unmarshal(w.Body.Bytes(), &s); err != nil || w.Code != 201 {
		t.Fatalf("start: %d %s", w.Code, w.Body)
	}
	if w = chatRequest(f.h, "POST", "/v1/chats/"+s.ID+"/messages", `{"text":"open the page"}`); w.Code != 200 {
		t.Fatalf("message: %d %s", w.Code, w.Body)
	}
	return s
}

// bridge runs the real `burfd browser-mcp` server for a chat over pipes.
type bridge struct {
	t   *testing.T
	in  io.Writer
	out *bufio.Scanner
}

func (f *browserFixture) bridge(t *testing.T, chat string) *bridge {
	t.Helper()
	inR, inW := io.Pipe()
	outR, outW := io.Pipe()
	done := make(chan error, 1)
	go func() { done <- browsermcp.Serve(context.Background(), f.local, chat, inR, outW); outW.Close() }()
	t.Cleanup(func() {
		inW.Close()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Error("the bridge did not end with its input")
		}
	})
	sc := bufio.NewScanner(outR)
	sc.Buffer(make([]byte, 0, 64<<10), 8<<20)
	return &bridge{t: t, in: inW, out: sc}
}

func (b *bridge) send(id int, method string, params any) {
	b.t.Helper()
	data, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": id, "method": method, "params": params})
	if _, err := b.in.Write(append(data, '\n')); err != nil {
		b.t.Fatal(err)
	}
}

type bridgeReply struct {
	ID     int             `json:"id"`
	Result json.RawMessage `json:"result"`
	Error  *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (b *bridge) read() bridgeReply {
	b.t.Helper()
	if !b.out.Scan() {
		b.t.Fatal("the bridge closed without answering")
	}
	var r bridgeReply
	if err := json.Unmarshal(b.out.Bytes(), &r); err != nil {
		b.t.Fatal(err)
	}
	return r
}

type toolResult struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
		Data string `json:"data"`
		// The provider side speaks MCP's own field names.
		MimeType string `json:"mimeType"`
	} `json:"content"`
	IsError bool `json:"isError"`
}

func TestBrowserChatCarriesProviderCallsToTheClientsBrowserAndBack(t *testing.T) {
	f := newBrowserFixture(t)
	s := f.startBrowserChat(t)
	var start struct {
		Config struct {
			Servers map[string]struct {
				Command string   `json:"command"`
				Args    []string `json:"args"`
			} `json:"mcp_servers"`
		} `json:"config"`
	}
	_ = json.Unmarshal(<-f.started, &start)
	exe, _ := os.Executable()
	server := start.Config.Servers[localchat.BrowserServer]
	if server.Command != exe || !slices.Equal(server.Args, []string{"browser-mcp", "--socket", f.box.Socket, "--chat", s.ID}) {
		t.Fatalf("the provider was not told to start this chat's bridge: %+v", start.Config.Servers)
	}
	if s.Browser == nil || len(s.Browser.Tools) != 1 || s.Browser.Tools[0].Name != "browser_snapshot" {
		t.Fatalf("start reply: %+v", s.Browser)
	}

	b := f.bridge(t, s.ID)
	b.send(1, "initialize", map[string]any{"protocolVersion": "2025-06-18"})
	if r := b.read(); r.ID != 1 || r.Error != nil || !strings.Contains(string(r.Result), `"tools"`) {
		t.Fatalf("initialize: %+v %s", r, r.Result)
	}
	b.send(2, "tools/list", nil)
	var listed struct {
		Tools []struct {
			Name        string         `json:"name"`
			Description string         `json:"description"`
			InputSchema map[string]any `json:"inputSchema"`
		} `json:"tools"`
	}
	if r := b.read(); json.Unmarshal(r.Result, &listed) != nil || len(listed.Tools) != 1 || listed.Tools[0].Name != "browser_snapshot" || listed.Tools[0].InputSchema["type"] != "object" || listed.Tools[0].Description == "" {
		t.Fatalf("tools/list: %s", r.Result)
	}

	b.send(3, "tools/call", map[string]any{"name": "browser_snapshot", "arguments": map[string]string{"tab": "active"}})
	w := chatRequest(f.h, "GET", "/v1/chats/"+s.ID+"/browser/calls?wait=5", "")
	var waiting struct {
		Calls []localchat.BrowserCall `json:"calls"`
	}
	if json.Unmarshal(w.Body.Bytes(), &waiting) != nil || w.Code != 200 || len(waiting.Calls) != 1 || waiting.Calls[0].Tool != "browser_snapshot" || string(waiting.Calls[0].Arguments) != `{"tab":"active"}` {
		t.Fatalf("the browser saw: %d %s", w.Code, w.Body)
	}
	var shown Chat
	w = chatRequest(f.h, "GET", "/v1/chats/"+s.ID, "")
	if json.Unmarshal(w.Body.Bytes(), &shown) != nil || len(shown.Browser.Calls) != 1 || shown.State != "running" {
		t.Fatalf("the chat does not show its waiting call: %s", w.Body)
	}
	answer := fmt.Sprintf(`{"id":%q,"content":[{"type":"text","text":"Example Domain"},{"type":"image","mime_type":"image/png","data":"aGk="}]}`, waiting.Calls[0].ID)
	if w = chatRequest(f.h, "POST", "/v1/chats/"+s.ID+"/browser/results", answer); w.Code != 200 {
		t.Fatalf("answer: %d %s", w.Code, w.Body)
	}
	var got toolResult
	if r := b.read(); r.ID != 3 || json.Unmarshal(r.Result, &got) != nil || got.IsError || len(got.Content) != 2 || got.Content[0].Text != "Example Domain" || got.Content[1].Type != "image" || got.Content[1].Data != "aGk=" || got.Content[1].MimeType != "image/png" {
		t.Fatalf("the provider got: %+v %s", r, r.Result)
	}
	if w = chatRequest(f.h, "POST", "/v1/chats/"+s.ID+"/browser/results", answer); w.Code != 409 {
		t.Fatalf("a second answer: %d %s", w.Code, w.Body)
	}

	// A tool the browser never offered fails as a tool result, not a dead bridge.
	b.send(4, "tools/call", map[string]any{"name": "browser_delete_everything"})
	if r := b.read(); r.ID != 4 || json.Unmarshal(r.Result, &got) != nil || !got.IsError || !strings.Contains(got.Content[0].Text, "did not offer") {
		t.Fatalf("undeclared tool: %+v %s", r, r.Result)
	}
	b.send(5, "ping", nil)
	if r := b.read(); r.ID != 5 || r.Error != nil {
		t.Fatalf("ping: %+v", r)
	}

	// The browser's refusal (the user did not allow the site) reaches the
	// provider as a failed tool call.
	b.send(6, "tools/call", map[string]any{"name": "browser_snapshot"})
	w = chatRequest(f.h, "GET", "/v1/chats/"+s.ID+"/browser/calls?wait=5", "")
	if json.Unmarshal(w.Body.Bytes(), &waiting) != nil || len(waiting.Calls) != 1 || string(waiting.Calls[0].Arguments) != `{}` {
		t.Fatalf("second call: %s", w.Body)
	}
	refusal := fmt.Sprintf(`{"id":%q,"is_error":true,"content":[{"type":"text","text":"example.com is not allowed for this chat"}]}`, waiting.Calls[0].ID)
	if w = chatRequest(f.h, "POST", "/v1/chats/"+s.ID+"/browser/results", refusal); w.Code != 200 {
		t.Fatalf("refusal: %d %s", w.Code, w.Body)
	}
	if r := b.read(); r.ID != 6 || json.Unmarshal(r.Result, &got) != nil || !got.IsError || !strings.Contains(got.Content[0].Text, "not allowed") {
		t.Fatalf("the provider did not see the refusal: %+v %s", r, r.Result)
	}
}

func TestOnlyTheBoxItselfMayAskTheBrowserToAct(t *testing.T) {
	f := newBrowserFixture(t)
	s := f.startBrowserChat(t)
	// A paired client can watch and answer, never act as the provider.
	for _, tc := range []struct{ method, path, body string }{
		{"POST", "/browser/calls", `{"tool":"browser_snapshot","arguments":{}}`},
		{"GET", "/browser/tools", ""},
	} {
		if w := chatRequest(f.h, tc.method, "/v1/chats/"+s.ID+tc.path, tc.body); w.Code != 403 {
			t.Fatalf("paired client %s %s: %d %s", tc.method, tc.path, w.Code, w.Body)
		}
	}
	if got, _ := f.box.Chats.Get(s.ID); len(got.Browser.Calls) != 0 {
		t.Fatalf("a refused request left a call for the browser: %+v", got.Browser)
	}
	var listed struct {
		Tools []localchat.BrowserTool `json:"tools"`
	}
	if err := f.local.Call(context.Background(), "GET", "/v1/chats/"+s.ID+"/browser/tools", nil, &listed); err != nil || len(listed.Tools) != 1 {
		t.Fatalf("the box's own socket: %v %+v", err, listed)
	}
	// Another chat's bridge cannot reach this browser: tools belong to a chat.
	plain := chatRequest(f.h, "POST", "/v1/chats", `{"location":"project"}`)
	var other Chat
	_ = json.Unmarshal(plain.Body.Bytes(), &other)
	if err := f.local.Call(context.Background(), "POST", "/v1/chats/"+other.ID+"/browser/calls", map[string]any{"tool": "browser_snapshot"}, nil); err == nil || !strings.Contains(err.Error(), "no browser") {
		t.Fatalf("a chat without a browser took a call: %v", err)
	}
}

func TestBrowserToolsNeedTheBoxSocketAndPlainChatsAreUnchanged(t *testing.T) {
	f := newBrowserFixture(t)
	if !slices.Contains(f.box.Capabilities(), "chat.browser") {
		t.Fatal("a box with a socket does not advertise chat.browser")
	}
	w := chatRequest(f.h, "POST", "/v1/chats", `{"location":"project"}`)
	if w.Code != 201 || strings.Contains(w.Body.String(), `"browser"`) {
		t.Fatalf("plain chat: %d %s", w.Code, w.Body)
	}
	// Its thread names no bridge; Burf's own tools are every chat's (chattools.go).
	if params := <-f.started; strings.Contains(string(params), localchat.BrowserServer) {
		t.Fatalf("a plain chat's thread was given a browser: %s", params)
	}
	var plain Chat
	_ = json.Unmarshal(w.Body.Bytes(), &plain)
	if w = chatRequest(f.h, "GET", "/v1/chats/"+plain.ID+"/browser/calls", ""); w.Code != 409 {
		t.Fatalf("plain chat calls: %d %s", w.Code, w.Body)
	}

	f.box.Socket = ""
	before := f.launches.Load()
	if w = chatRequest(f.h, "POST", "/v1/chats", browserStart); w.Code != 501 || f.launches.Load() != before {
		t.Fatalf("no socket: %d %s (launches %d)", w.Code, w.Body, f.launches.Load()-before)
	}
	if slices.Contains(f.box.Capabilities(), "chat.browser") {
		t.Fatal("a box without a socket advertises chat.browser")
	}
}

func TestBrowserRequestsAreStrictAndInvalidToolsNeverLaunch(t *testing.T) {
	f := newBrowserFixture(t)
	for name, body := range map[string]string{
		"unknown field":    `{"location":"project","browser":{"tools":[{"name":"browser_snapshot","description":"x"}],"command":"/bin/sh"}}`,
		"unknown tool key": `{"location":"project","browser":{"tools":[{"name":"browser_snapshot","description":"x","run":"rm -rf"}]}}`,
		"no tools":         `{"location":"project","browser":{"tools":[]}}`,
		"bad name":         `{"location":"project","browser":{"tools":[{"name":"Browser Snapshot","description":"x"}]}}`,
		"too large":        `{"location":"project","browser":{"tools":[{"name":"browser_snapshot","description":"` + strings.Repeat("x", maxChatStartBody) + `"}]}}`,
	} {
		if w := chatRequest(f.h, "POST", "/v1/chats", body); w.Code != 400 && w.Code != 409 {
			t.Fatalf("%s: %d %s", name, w.Code, w.Body)
		}
	}
	if f.launches.Load() != 0 {
		t.Fatalf("invalid browser tools launched the provider %d times", f.launches.Load())
	}
	s := f.startBrowserChat(t)
	for name, body := range map[string]string{
		"unknown field": `{"id":"x","content":[{"type":"text","text":"x"}],"turn":"other"}`,
		"too large":     `{"id":"x","content":[{"type":"text","text":"` + strings.Repeat("x", maxBrowserResultBody) + `"}]}`,
		"not pending":   `{"id":"x","content":[{"type":"text","text":"x"}]}`,
	} {
		if w := chatRequest(f.h, "POST", "/v1/chats/"+s.ID+"/browser/results", body); w.Code != 400 && w.Code != 409 {
			t.Fatalf("result %s: %d %s", name, w.Code, w.Body)
		}
	}
	// A wait is clamped, so an empty poll returns by itself.
	started := time.Now()
	if w := chatRequest(f.h, "GET", "/v1/chats/"+s.ID+"/browser/calls?wait=-5", ""); w.Code != 200 || !strings.Contains(w.Body.String(), `"calls":[]`) || time.Since(started) > 2*time.Second {
		t.Fatalf("empty poll: %d %s after %s", w.Code, w.Body, time.Since(started))
	}
}

func TestBrowserAnswersPassTheSendGate(t *testing.T) {
	f := newBrowserFixture(t)
	s := f.startBrowserChat(t)
	done := make(chan error, 1)
	go func() {
		done <- f.local.Call(context.Background(), "POST", "/v1/chats/"+s.ID+"/browser/calls", map[string]any{"tool": "browser_snapshot"}, nil)
	}()
	w := chatRequest(f.h, "GET", "/v1/chats/"+s.ID+"/browser/calls?wait=5", "")
	var waiting struct {
		Calls []localchat.BrowserCall `json:"calls"`
	}
	if json.Unmarshal(w.Body.Bytes(), &waiting) != nil || len(waiting.Calls) != 1 {
		t.Fatalf("no waiting call: %s", w.Body)
	}
	cfg := filepath.Join(t.TempDir(), "hooks.json")
	data, _ := json.Marshal(hooks.Config{Hooks: []hooks.Hook{{On: "before:session.send", Run: "echo answer denied; exit 1"}}})
	if err := os.WriteFile(cfg, data, 0600); err != nil {
		t.Fatal(err)
	}
	f.box.Hooks = &hooks.Runner{Path: cfg}
	answer := fmt.Sprintf(`{"id":%q,"content":[{"type":"text","text":"private page text"}]}`, waiting.Calls[0].ID)
	if w = chatRequest(f.h, "POST", "/v1/chats/"+s.ID+"/browser/results", answer); w.Code != 403 || !strings.Contains(w.Body.String(), "answer denied") {
		t.Fatalf("vetoed answer: %d %s", w.Code, w.Body)
	}
	if got, _ := f.box.Chats.Get(s.ID); len(got.Browser.Calls) != 1 {
		t.Fatalf("a vetoed answer consumed the call: %+v", got.Browser)
	}
	// Stopping the chat ends the provider's wait; the vetoed text never arrived.
	f.box.Hooks = nil
	if w = chatRequest(f.h, "DELETE", "/v1/chats/"+s.ID, ""); w.Code != 200 {
		t.Fatalf("stop: %d %s", w.Code, w.Body)
	}
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("the provider's call succeeded without an answer")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("the provider's call outlived its chat")
	}
}
