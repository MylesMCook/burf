package localchat

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

var snapshotTool = BrowserTool{Name: "browser_snapshot", Description: "Read the active tab."}

// newBrowserChat starts a chat whose synthetic provider records how its
// thread was started and opens turn-1 for each message.
func newBrowserChat(t *testing.T, tools ...BrowserTool) (*Manager, *fakeServer, Session, error) {
	t.Helper()
	return newChatWith(t, LaunchOptions{Browser: &Browser{Tools: tools, Server: func(chat string) (string, []string) {
		return "/synthetic/burfd", []string{"browser-mcp", "--chat", chat}
	}}})
}

// newChatWith starts a chat with the given options on the synthetic provider.
// setup runs on the manager before the chat starts.
func newChatWith(t *testing.T, options LaunchOptions, setup ...func(*Manager)) (*Manager, *fakeServer, Session, error) {
	t.Helper()
	f := &fakeServer{}
	m := New("synthetic.exe", func(LaunchOptions) (Process, error) {
		client, server := net.Pipe()
		f.conn = server
		go func() {
			defer server.Close()
			sc := bufio.NewScanner(server)
			for sc.Scan() {
				var p packet
				_ = json.Unmarshal(sc.Bytes(), &p)
				f.mu.Lock()
				f.packets = append(f.packets, p)
				f.mu.Unlock()
				switch p.Method {
				case "initialize":
					f.send(map[string]any{"id": p.ID, "result": map[string]any{}})
				case "thread/start":
					f.send(map[string]any{"id": p.ID, "result": map[string]any{"thread": map[string]string{"id": "owned-thread"}}})
				case "turn/start":
					if f.onTurn != nil {
						f.onTurn(p)
						continue
					}
					f.event("turn/started", map[string]any{"threadId": "owned-thread", "turn": map[string]string{"id": "turn-1"}})
					f.send(map[string]any{"id": p.ID, "result": map[string]any{"turn": map[string]string{"id": "turn-1"}}})
				}
			}
		}()
		return client, nil
	})
	t.Cleanup(m.Close)
	for _, f := range setup {
		f(m)
	}
	options.Program, options.CWD = "synthetic.exe", t.TempDir()
	s, err := m.StartWith(context.Background(), options)
	return m, f, s, err
}

func (f *fakeServer) sent(method string) (packet, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, p := range f.packets {
		if p.Method == method {
			return p, true
		}
	}
	return packet{}, false
}

// startTurn sends a message and waits for the provider's turn to open.
func startTurn(t *testing.T, m *Manager, id string) {
	t.Helper()
	if err := m.Send(context.Background(), id, "open the page"); err != nil {
		t.Fatal(err)
	}
	waitChat(t, m, id, func(s Session) bool { return s.State == "running" && s.TurnID == "turn-1" })
}

type browserAnswer struct {
	result BrowserResult
	err    error
}

// callBrowser issues a provider call and returns once the browser can see it.
func callBrowser(t *testing.T, m *Manager, id, tool, arguments string) (BrowserCall, chan browserAnswer) {
	t.Helper()
	done := make(chan browserAnswer, 1)
	go func() {
		r, err := m.BrowserCall(context.Background(), id, tool, json.RawMessage(arguments))
		done <- browserAnswer{r, err}
	}()
	calls, err := m.BrowserCalls(context.Background(), id, 2*time.Second)
	if err != nil || len(calls) != 1 {
		t.Fatalf("the browser saw no call: %v %v", calls, err)
	}
	return calls[0], done
}

func answer(t *testing.T, done chan browserAnswer) browserAnswer {
	t.Helper()
	select {
	case a := <-done:
		return a
	case <-time.After(2 * time.Second):
		t.Fatal("the provider's call never returned")
		return browserAnswer{}
	}
}

func TestBrowserToolsAreOfferedToThisChatsThreadOnly(t *testing.T) {
	_, f, s, err := newBrowserChat(t, snapshotTool)
	if err != nil {
		t.Fatal(err)
	}
	start, _ := f.sent("thread/start")
	var params struct {
		Sandbox        string `json:"sandbox"`
		ApprovalPolicy string `json:"approvalPolicy"`
		Config         struct {
			Servers map[string]struct {
				Command  string   `json:"command"`
				Args     []string `json:"args"`
				Approval string   `json:"default_tools_approval_mode"`
				Timeout  int      `json:"tool_timeout_sec"`
			} `json:"mcp_servers"`
		} `json:"config"`
	}
	if err = json.Unmarshal(start.Params, &params); err != nil {
		t.Fatal(err)
	}
	server, ok := params.Config.Servers[BrowserServer]
	if !ok || len(params.Config.Servers) != 1 || server.Command != "/synthetic/burfd" || strings.Join(server.Args, " ") != "browser-mcp --chat "+s.ID {
		t.Fatalf("bridge not bound to this chat: %s", start.Params)
	}
	if server.Approval != "approve" || server.Timeout != browserToolTimeout || params.Sandbox != "read-only" || params.ApprovalPolicy != "untrusted" {
		t.Fatalf("unexpected thread permissions: %s", start.Params)
	}
	if s.Browser == nil || len(s.Browser.Tools) != 1 || s.Browser.Tools[0].Name != "browser_snapshot" || string(s.Browser.Tools[0].InputSchema) != `{"type":"object"}` || s.Browser.Calls == nil {
		t.Fatalf("browser state: %+v", s.Browser)
	}

	plain, pf, ps := newTestChat(t)
	start, _ = pf.sent("thread/start")
	if strings.Contains(string(start.Params), "config") || ps.Browser != nil {
		t.Fatalf("a chat without a browser changed: %s", start.Params)
	}
	if _, err = plain.BrowserCall(context.Background(), ps.ID, "browser_snapshot", nil); err == nil {
		t.Fatal("a chat without a browser took a browser call")
	}
	if _, err = plain.BrowserCalls(context.Background(), ps.ID, 0); err == nil {
		t.Fatal("a chat without a browser listed browser calls")
	}
}

func TestBrowserCallReachesTheBrowserAndReturnsItsAnswerOnce(t *testing.T) {
	m, _, s, err := newBrowserChat(t, snapshotTool)
	if err != nil {
		t.Fatal(err)
	}
	startTurn(t, m, s.ID)
	call, done := callBrowser(t, m, s.ID, "browser_snapshot", `{"tab":"active"}`)
	if call.ID == "" || call.Tool != "browser_snapshot" || string(call.Arguments) != `{"tab":"active"}` {
		t.Fatalf("call: %+v", call)
	}
	if got, _ := m.Get(s.ID); got.State != "running" || len(got.Browser.Calls) != 1 || got.Browser.Calls[0].ID != call.ID {
		t.Fatalf("pending call not visible: %+v", got.Browser)
	}
	want := BrowserResult{Content: []BrowserContent{{Type: "text", Text: "Example Domain"}, {Type: "image", MimeType: "image/png", Data: "aGk="}}}
	if err = m.BrowserResult(s.ID, call.ID, want); err != nil {
		t.Fatal(err)
	}
	got := answer(t, done)
	if got.err != nil || len(got.result.Content) != 2 || got.result.Content[0].Text != "Example Domain" || got.result.Content[1].Data != "aGk=" {
		t.Fatalf("answer: %+v", got)
	}
	if err = m.BrowserResult(s.ID, call.ID, want); err == nil {
		t.Fatal("an answered call took a second answer")
	}
	if after, _ := m.Get(s.ID); after.State != "running" || len(after.Browser.Calls) != 0 {
		t.Fatalf("answered call still pending: %+v", after.Browser)
	}
}

func TestBrowserCallsNeedATurnADeclaredToolAndObjectArguments(t *testing.T) {
	m, _, s, err := newBrowserChat(t, snapshotTool)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if _, err = m.BrowserCall(ctx, s.ID, "browser_snapshot", nil); err == nil || !strings.Contains(err.Error(), "during a turn") {
		t.Fatalf("idle chat took a call: %v", err)
	}
	startTurn(t, m, s.ID)
	if _, err = m.BrowserCall(ctx, s.ID, "browser_delete_everything", nil); err == nil || !strings.Contains(err.Error(), "did not offer") {
		t.Fatalf("undeclared tool: %v", err)
	}
	for _, arguments := range []string{`[1]`, `"text"`, `{"a":`, `{"pad":"` + strings.Repeat("x", maxBrowserArguments) + `"}`} {
		if _, err = m.BrowserCall(ctx, s.ID, "browser_snapshot", json.RawMessage(arguments)); err == nil {
			t.Fatalf("accepted arguments %.20s", arguments)
		}
	}
	if _, err = m.BrowserCall(ctx, "missing", "browser_snapshot", nil); err != ErrNotFound {
		t.Fatalf("unknown chat: %v", err)
	}
	if got, _ := m.Get(s.ID); len(got.Browser.Calls) != 0 || got.State != "running" {
		t.Fatalf("refused calls left state behind: %+v", got)
	}
}

func TestUnansweredBrowserCallFailsWithoutStoppingTheChat(t *testing.T) {
	old := browserWait
	browserWait = 30 * time.Millisecond
	t.Cleanup(func() { browserWait = old })
	m, _, s, err := newBrowserChat(t, snapshotTool)
	if err != nil {
		t.Fatal(err)
	}
	startTurn(t, m, s.ID)
	_, err = m.BrowserCall(context.Background(), s.ID, "browser_snapshot", nil)
	if err == nil || !strings.Contains(err.Error(), "no browser answered") {
		t.Fatalf("unanswered call: %v", err)
	}
	if got, _ := m.Get(s.ID); got.State != "running" || got.Error != "" || len(got.Browser.Calls) != 0 {
		t.Fatalf("timeout disturbed the chat: %+v", got)
	}
	// A caller that gives up (the bridge process went away) withdraws its call too.
	ctx, cancel := context.WithCancel(context.Background())
	browserWait = time.Minute
	done := make(chan error, 1)
	go func() { _, e := m.BrowserCall(ctx, s.ID, "browser_snapshot", nil); done <- e }()
	if calls, _ := m.BrowserCalls(context.Background(), s.ID, 2*time.Second); len(calls) != 1 {
		t.Fatal("call not pending")
	}
	cancel()
	if e := <-done; e == nil {
		t.Fatal("cancelled call succeeded")
	}
	if got, _ := m.Get(s.ID); len(got.Browser.Calls) != 0 {
		t.Fatalf("abandoned call still offered to the browser: %+v", got.Browser)
	}
}

func TestEndedTurnAndStoppedChatCancelWaitingBrowserCalls(t *testing.T) {
	m, f, s, err := newBrowserChat(t, snapshotTool)
	if err != nil {
		t.Fatal(err)
	}
	startTurn(t, m, s.ID)
	call, done := callBrowser(t, m, s.ID, "browser_snapshot", `{}`)
	f.event("turn/completed", map[string]any{"threadId": "owned-thread", "turn": map[string]string{"id": "turn-1", "status": "interrupted"}})
	if got := answer(t, done); got.err == nil || !strings.Contains(got.err.Error(), "turn ended") {
		t.Fatalf("call outlived its turn: %+v", got)
	}
	// A late answer must not reach a later turn.
	if err = m.BrowserResult(s.ID, call.ID, BrowserResult{Content: []BrowserContent{{Type: "text", Text: "late"}}}); err == nil {
		t.Fatal("a cancelled call took an answer")
	}
	idle := waitChat(t, m, s.ID, func(s Session) bool { return s.State == "idle" })
	if len(idle.Browser.Calls) != 0 {
		t.Fatalf("cancelled call still listed: %+v", idle.Browser)
	}

	startTurn(t, m, s.ID)
	_, done = callBrowser(t, m, s.ID, "browser_snapshot", `{}`)
	if err = m.Stop(s.ID); err != nil {
		t.Fatal(err)
	}
	if got := answer(t, done); got.err == nil {
		t.Fatalf("call outlived its chat: %+v", got)
	}
	calls, err := m.BrowserCalls(context.Background(), s.ID, time.Minute)
	if err != nil || len(calls) != 0 {
		t.Fatalf("a stopped chat kept a waiting browser: %v %v", calls, err)
	}
}

func TestBrowserResultsAreBoundedAndBadOnesLeaveTheCallPending(t *testing.T) {
	m, _, s, err := newBrowserChat(t, snapshotTool)
	if err != nil {
		t.Fatal(err)
	}
	startTurn(t, m, s.ID)
	call, done := callBrowser(t, m, s.ID, "browser_snapshot", `{}`)
	many := make([]BrowserContent, maxBrowserContent+1)
	for i := range many {
		many[i] = BrowserContent{Type: "text", Text: "x"}
	}
	for name, bad := range map[string]BrowserResult{
		"empty":        {},
		"too many":     {Content: many},
		"unknown type": {Content: []BrowserContent{{Type: "resource", Text: "x"}}},
		"too large":    {Content: []BrowserContent{{Type: "text", Text: strings.Repeat("x", maxBrowserResult/2)}, {Type: "image", MimeType: "image/png", Data: strings.Repeat("aGk=", maxBrowserResult/8+1)}}},
		"not base64":   {Content: []BrowserContent{{Type: "image", MimeType: "image/png", Data: "***"}}},
		"image type":   {Content: []BrowserContent{{Type: "image", MimeType: "image/svg+xml", Data: "aGk="}}},
		"mixed fields": {Content: []BrowserContent{{Type: "text", Text: "x", Data: "aGk="}}},
	} {
		if err = m.BrowserResult(s.ID, call.ID, bad); err == nil {
			t.Fatalf("accepted a %s result", name)
		}
	}
	if err = m.BrowserResult(s.ID, call.ID, BrowserResult{IsError: true, Content: []BrowserContent{{Type: "text", Text: "site not allowed"}}}); err != nil {
		t.Fatal(err)
	}
	if got := answer(t, done); got.err != nil || !got.result.IsError || got.result.Content[0].Text != "site not allowed" {
		t.Fatalf("refusal lost: %+v", got)
	}
}

func TestBrowserCallsWaitingForTheBrowserAreLimited(t *testing.T) {
	m, _, s, err := newBrowserChat(t, snapshotTool)
	if err != nil {
		t.Fatal(err)
	}
	startTurn(t, m, s.ID)
	for i := 0; i < maxBrowserPending; i++ {
		go func() { _, _ = m.BrowserCall(context.Background(), s.ID, "browser_snapshot", nil) }()
	}
	waitChat(t, m, s.ID, func(s Session) bool { return len(s.Browser.Calls) == maxBrowserPending })
	if _, err = m.BrowserCall(context.Background(), s.ID, "browser_snapshot", nil); err == nil || !strings.Contains(err.Error(), "busy") {
		t.Fatalf("unbounded waiting calls: %v", err)
	}
	// An empty wait returns at its limit instead of holding the request open.
	m2, _, s2, _ := newBrowserChat(t, snapshotTool)
	started := time.Now()
	calls, err := m2.BrowserCalls(context.Background(), s2.ID, 30*time.Millisecond)
	if err != nil || len(calls) != 0 || calls == nil || time.Since(started) > time.Second {
		t.Fatalf("empty wait: %v %v after %s", calls, err, time.Since(started))
	}
}

func TestBrowserToolsAreValidatedBeforeAnythingLaunches(t *testing.T) {
	var launches atomic.Int32
	m := New("synthetic.exe", func(LaunchOptions) (Process, error) {
		launches.Add(1)
		client, server := net.Pipe()
		server.Close()
		return client, nil
	})
	t.Cleanup(m.Close)
	server := func(string) (string, []string) { return "/synthetic/burfd", nil }
	var many []BrowserTool
	for i := 0; i <= maxBrowserTools; i++ {
		many = append(many, BrowserTool{Name: "tool_" + strings.Repeat("a", i+1), Description: "x"})
	}
	for name, browser := range map[string]*Browser{
		"no tools":         {Server: server},
		"too many":         {Server: server, Tools: many},
		"no server":        {Tools: []BrowserTool{snapshotTool}},
		"bad name":         {Server: server, Tools: []BrowserTool{{Name: "Browser Snapshot", Description: "x"}}},
		"repeated":         {Server: server, Tools: []BrowserTool{snapshotTool, snapshotTool}},
		"no description":   {Server: server, Tools: []BrowserTool{{Name: "browser_snapshot"}}},
		"long description": {Server: server, Tools: []BrowserTool{{Name: "browser_snapshot", Description: strings.Repeat("x", maxBrowserDescription+1)}}},
		"array schema":     {Server: server, Tools: []BrowserTool{{Name: "browser_snapshot", Description: "x", InputSchema: json.RawMessage(`[]`)}}},
		"long schema":      {Server: server, Tools: []BrowserTool{{Name: "browser_snapshot", Description: "x", InputSchema: json.RawMessage(`{"d":"` + strings.Repeat("x", maxBrowserSchema) + `"}`)}}},
	} {
		if s, err := m.StartWith(context.Background(), LaunchOptions{Program: "synthetic.exe", CWD: t.TempDir(), Browser: browser}); err == nil || s.ID != "" {
			t.Fatalf("%s: started %+v", name, s)
		}
	}
	if launches.Load() != 0 {
		t.Fatalf("invalid browser tools launched the provider %d times", launches.Load())
	}
}

func elicitation(server, turn string) map[string]any {
	return map[string]any{"serverName": server, "threadId": "owned-thread", "turnId": turn, "mode": "form",
		"message": "Allow burf_browser to run browser_snapshot?", "requestedSchema": map[string]any{"type": "object", "properties": map[string]any{}}}
}

func TestBrowserApprovalRequestIsOneUseAndOtherElicitationsStillStop(t *testing.T) {
	m, f, s, err := newBrowserChat(t, snapshotTool)
	if err != nil {
		t.Fatal(err)
	}
	startTurn(t, m, s.ID)
	f.send(map[string]any{"id": 41, "method": "mcpServer/elicitation/request", "params": elicitation(BrowserServer, "turn-1")})
	waiting := waitChat(t, m, s.ID, func(s Session) bool { return s.State == "waiting" && len(s.Approvals) == 1 })
	approval := waiting.Approvals[0]
	if approval.Kind != "browser" || approval.SessionAllowed || len(approval.Execpolicy) != 0 || !strings.Contains(approval.Detail, "browser_snapshot") {
		t.Fatalf("approval: %+v", approval)
	}
	for _, broader := range []string{"acceptForSession", "acceptAlways"} {
		if err = m.Decide(s.ID, approval.ID, broader); err == nil {
			t.Fatalf("%s granted more than one use", broader)
		}
	}
	if err = m.Decide(s.ID, approval.ID, "accept"); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(2 * time.Second)
	for {
		f.mu.Lock()
		var reply string
		for _, p := range f.packets {
			if string(p.ID) == "41" {
				reply = string(p.Result)
			}
		}
		f.mu.Unlock()
		if reply != "" {
			var got struct {
				Action  string         `json:"action"`
				Content map[string]any `json:"content"`
			}
			if json.Unmarshal([]byte(reply), &got) != nil || got.Action != "accept" || got.Content == nil || len(got.Content) != 0 {
				t.Fatalf("provider got %s", reply)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the provider never got the decision")
		}
		time.Sleep(time.Millisecond)
	}
	if err = m.Decide(s.ID, approval.ID, "accept"); err == nil {
		t.Fatal("an approval was used twice")
	}

	for name, params := range map[string]map[string]any{
		"another server": elicitation("someone_else", "turn-1"),
		"another turn":   elicitation(BrowserServer, "turn-0"),
		"a form to fill": {"serverName": BrowserServer, "threadId": "owned-thread", "turnId": "turn-1", "mode": "form", "message": "Password?",
			"requestedSchema": map[string]any{"type": "object", "properties": map[string]any{"password": map[string]string{"type": "string"}}}},
		"a link": {"serverName": BrowserServer, "threadId": "owned-thread", "turnId": "turn-1", "mode": "url", "message": "Open", "url": "https://example.com", "elicitationId": "e"},
	} {
		m, f, s, err := newBrowserChat(t, snapshotTool)
		if err != nil {
			t.Fatal(err)
		}
		startTurn(t, m, s.ID)
		f.send(map[string]any{"id": 7, "method": "mcpServer/elicitation/request", "params": params})
		stopped := waitChat(t, m, s.ID, func(s Session) bool { return s.State == "exited" })
		if len(stopped.Approvals) != 0 || !strings.Contains(stopped.Error, "unsupported interaction") {
			t.Fatalf("%s was not refused: %+v", name, stopped)
		}
	}

	// Without a browser, the bridge's name earns nothing.
	plain, pf, ps := newTestChat(t)
	if err = plain.Send(context.Background(), ps.ID, "hello"); err != nil {
		t.Fatal(err)
	}
	waitChat(t, plain, ps.ID, func(s Session) bool { return s.TurnID == "turn-1" })
	pf.send(map[string]any{"id": 9, "method": "mcpServer/elicitation/request", "params": elicitation(BrowserServer, "turn-1")})
	waitChat(t, plain, ps.ID, func(s Session) bool { return s.State == "exited" })
}

func TestListedChatsCarryPendingBrowserCallsWithoutToolDefinitions(t *testing.T) {
	m, _, s, err := newBrowserChat(t, snapshotTool)
	if err != nil {
		t.Fatal(err)
	}
	startTurn(t, m, s.ID)
	_, done := callBrowser(t, m, s.ID, "browser_snapshot", `{}`)
	list := m.List()
	if len(list) != 1 || list[0].Browser == nil || list[0].Browser.Tools != nil || len(list[0].Browser.Calls) != 1 {
		t.Fatalf("list: %+v", list[0].Browser)
	}
	// Snapshots are copies: a reader cannot withdraw a call.
	got, _ := m.Get(s.ID)
	got.Browser.Calls[0].Tool = "changed"
	got.Browser.Tools[0].Name = "changed"
	if again, _ := m.Get(s.ID); again.Browser.Calls[0].Tool != "browser_snapshot" || again.Browser.Tools[0].Name != "browser_snapshot" {
		t.Fatal("a snapshot shared state with the chat")
	}
	_ = m.Stop(s.ID)
	answer(t, done)
}
