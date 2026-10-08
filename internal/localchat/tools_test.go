package localchat

import (
	"context"
	"encoding/json"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

var burfTools = &Tools{Server: func(chat string) (string, []string) {
	return "/synthetic/burfd", []string{"mcp", "--chat", chat}
}}

func newToolChat(t *testing.T) (*Manager, *fakeServer, Session) {
	t.Helper()
	m, f, s, err := newChatWith(t, LaunchOptions{Tools: burfTools})
	if err != nil {
		t.Fatal(err)
	}
	return m, f, s
}

// ask starts a tool's question and returns once the chat shows it.
func ask(t *testing.T, m *Manager, id, tool, detail string) (Approval, chan error) {
	t.Helper()
	done := make(chan error, 1)
	go func() { done <- m.ToolApproval(context.Background(), id, tool, detail) }()
	s := waitChat(t, m, id, func(s Session) bool { return len(s.Approvals) == 1 })
	return s.Approvals[0], done
}

func answered(t *testing.T, done chan error) error {
	t.Helper()
	select {
	case err := <-done:
		return err
	case <-time.After(2 * time.Second):
		t.Fatal("the tool is still waiting")
		return nil
	}
}

func TestBurfToolsAreOfferedToThisChatsThreadOnly(t *testing.T) {
	_, f, s := newToolChat(t)
	start, ok := f.sent("thread/start")
	if !ok {
		t.Fatal("no thread was started")
	}
	var params struct {
		Config struct {
			Servers map[string]struct {
				Command  string   `json:"command"`
				Args     []string `json:"args"`
				Approval string   `json:"default_tools_approval_mode"`
				Timeout  int      `json:"tool_timeout_sec"`
			} `json:"mcp_servers"`
		} `json:"config"`
	}
	if err := json.Unmarshal(start.Params, &params); err != nil {
		t.Fatal(err)
	}
	// One server, under the name the account's own Burf server has, started
	// for this chat. The chat asks before a tool acts, so the provider does not.
	server, ok := params.Config.Servers[ToolServer]
	if !ok || len(params.Config.Servers) != 1 || ToolServer != "berth" {
		t.Fatalf("thread servers: %+v", params.Config.Servers)
	}
	if server.Command != "/synthetic/burfd" || strings.Join(server.Args, " ") != "mcp --chat "+s.ID || server.Approval != "approve" || server.Timeout <= int(toolWait.Seconds()) {
		t.Fatalf("server: %+v", server)
	}

	// A chat with a browser as well gets both, each on its own.
	_, f, _, err := newChatWith(t, LaunchOptions{Tools: burfTools, Browser: &Browser{Tools: []BrowserTool{snapshotTool}, Server: func(chat string) (string, []string) {
		return "/synthetic/burfd", []string{"browser-mcp", "--chat", chat}
	}}})
	if err != nil {
		t.Fatal(err)
	}
	start, _ = f.sent("thread/start")
	if err = json.Unmarshal(start.Params, &params); err != nil || len(params.Config.Servers) != 2 || params.Config.Servers[BrowserServer].Args[0] != "browser-mcp" {
		t.Fatalf("both servers: %v %+v", err, params.Config.Servers)
	}

	// A chat without them names no server at all.
	_, f, _ = newTestChat(t)
	start, _ = f.sent("thread/start")
	if strings.Contains(string(start.Params), "mcp_servers") {
		t.Fatalf("plain chat was given servers: %s", start.Params)
	}
}

func TestAToolActsOnlyOnTheChatsPersonSayingYes(t *testing.T) {
	m, _, s := newToolChat(t)
	startTurn(t, m, s.ID)

	approval, done := ask(t, m, s.ID, "berth_exec", "location: shop/fix\n$ make deploy")
	if approval.Kind != "tool" || approval.Detail != "berth_exec\nlocation: shop/fix\n$ make deploy" || approval.SessionAllowed {
		t.Fatalf("approval: %+v", approval)
	}
	if got, _ := m.Get(s.ID); got.State != "waiting" {
		t.Fatalf("state while asking: %s", got.State)
	}
	// Only once, or not at all: there is no standing yes for a tool.
	for _, decision := range []string{"acceptForSession", "acceptAlways"} {
		if err := m.Decide(s.ID, approval.ID, decision); err == nil {
			t.Fatalf("%s was taken for a tool", decision)
		}
	}
	if err := m.Decide(s.ID, approval.ID, "accept"); err != nil {
		t.Fatal(err)
	}
	if err := answered(t, done); err != nil {
		t.Fatalf("an allowed tool was refused: %v", err)
	}
	if got, _ := m.Get(s.ID); got.State != "running" || len(got.Approvals) != 0 {
		t.Fatalf("after yes: %+v", got)
	}
	// The answer is used once.
	if err := m.Decide(s.ID, approval.ID, "accept"); err == nil {
		t.Fatal("an answered question took a second answer")
	}

	approval, done = ask(t, m, s.ID, "berth_send", "session: api\nShip it")
	if err := m.Decide(s.ID, approval.ID, "decline"); err != nil {
		t.Fatal(err)
	}
	if err := answered(t, done); err == nil || !strings.Contains(err.Error(), "declined") {
		t.Fatalf("a denied tool went ahead: %v", err)
	}
}

func TestAToolWaitsWithACommandApprovalWithoutEitherAnsweringTheOther(t *testing.T) {
	m, f, s := newToolChat(t)
	startTurn(t, m, s.ID)
	f.send(map[string]any{"id": 41, "method": "item/commandExecution/requestApproval", "params": map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "itemId": "cmd-1", "command": "git status"}})
	waitChat(t, m, s.ID, func(s Session) bool { return len(s.Approvals) == 1 })
	done := make(chan error, 1)
	go func() { done <- m.ToolApproval(context.Background(), s.ID, "berth_task_new", "location: shop") }()
	both := waitChat(t, m, s.ID, func(s Session) bool { return len(s.Approvals) == 2 })
	var command, tool Approval
	for _, a := range both.Approvals {
		if a.Kind == "tool" {
			tool = a
		} else {
			command = a
		}
	}
	// Allowing the command leaves the chat waiting on the tool.
	if err := m.Decide(s.ID, command.ID, "accept"); err != nil {
		t.Fatal(err)
	}
	if got, _ := m.Get(s.ID); got.State != "waiting" || len(got.Approvals) != 1 || got.Approvals[0].ID != tool.ID {
		t.Fatalf("after the command: %+v", got)
	}
	select {
	case err := <-done:
		t.Fatalf("the command's answer reached the tool: %v", err)
	default:
	}
	if err := m.Decide(s.ID, tool.ID, "accept"); err != nil {
		t.Fatal(err)
	}
	if err := answered(t, done); err != nil {
		t.Fatal(err)
	}
	if got, _ := m.Get(s.ID); got.State != "running" {
		t.Fatalf("after both: %s", got.State)
	}
}

func TestFullAccessActsWithoutAskingAndOtherModesAsk(t *testing.T) {
	m, _, s := newToolChat(t)
	if err := m.SendWith(context.Background(), s.ID, "go", TurnOptions{Permission: "full-access"}); err != nil {
		t.Fatal(err)
	}
	waitChat(t, m, s.ID, func(s Session) bool {
		return s.State == "running" && s.TurnID == "turn-1" && s.Options.Permission == "full-access"
	})
	if err := m.ToolApproval(context.Background(), s.ID, "berth_exec", "$ make"); err != nil {
		t.Fatalf("full access was asked: %v", err)
	}
	if got, _ := m.Get(s.ID); len(got.Approvals) != 0 || got.State != "running" {
		t.Fatalf("full access left a question: %+v", got)
	}
}

func TestAToolCannotActOutsideATurnOrInAChatWithoutTools(t *testing.T) {
	m, _, s := newToolChat(t)
	if err := m.ToolApproval(context.Background(), s.ID, "berth_exec", "$ make"); err == nil || !strings.Contains(err.Error(), "during a turn") {
		t.Fatalf("idle chat: %v", err)
	}
	startTurn(t, m, s.ID)
	for _, bad := range [][2]string{{"", "x"}, {strings.Repeat("a", 65), "x"}, {"berth_exec\nberth_send", "x"}, {"berth_exec", strings.Repeat("x", 8<<10+1)}} {
		if err := m.ToolApproval(context.Background(), s.ID, bad[0], bad[1]); err == nil {
			t.Fatalf("accepted tool %q with %d bytes", bad[0], len(bad[1]))
		}
	}
	if got, _ := m.Get(s.ID); len(got.Approvals) != 0 {
		t.Fatalf("a refused question was shown: %+v", got.Approvals)
	}

	plain, _, ps := newTestChat(t)
	startTurn(t, plain, ps.ID)
	if err := plain.ToolApproval(context.Background(), ps.ID, "berth_exec", "$ make"); err == nil || !strings.Contains(err.Error(), "no Burf tools") {
		t.Fatalf("chat without tools: %v", err)
	}
	if err := m.ToolApproval(context.Background(), "missing", "berth_exec", ""); err != ErrNotFound {
		t.Fatalf("unknown chat: %v", err)
	}
}

func TestAnEndedTurnAStoppedChatAndAGoneCallerWithdrawTheQuestion(t *testing.T) {
	m, f, s := newToolChat(t)
	startTurn(t, m, s.ID)
	approval, done := ask(t, m, s.ID, "berth_exec", "$ make")
	f.event("turn/completed", map[string]any{"threadId": "owned-thread", "turn": map[string]string{"id": "turn-1", "status": "interrupted"}})
	if err := answered(t, done); err == nil || !strings.Contains(err.Error(), "turn ended") {
		t.Fatalf("question outlived its turn: %v", err)
	}
	// A late yes must not let anything act in a later turn.
	if err := m.Decide(s.ID, approval.ID, "accept"); err == nil {
		t.Fatal("a withdrawn question took an answer")
	}
	waitChat(t, m, s.ID, func(s Session) bool { return s.State == "idle" && len(s.Approvals) == 0 })

	// The tool's own process went away: the question goes with it.
	startTurn(t, m, s.ID)
	ctx, cancel := context.WithCancel(context.Background())
	gone := make(chan error, 1)
	go func() { gone <- m.ToolApproval(ctx, s.ID, "berth_exec", "$ make") }()
	waitChat(t, m, s.ID, func(s Session) bool { return len(s.Approvals) == 1 })
	cancel()
	if err := answered(t, gone); err == nil {
		t.Fatal("a cancelled question was allowed")
	}
	waitChat(t, m, s.ID, func(s Session) bool { return len(s.Approvals) == 0 && s.State == "running" })

	_, done = ask(t, m, s.ID, "berth_exec", "$ make")
	if err := m.Stop(s.ID); err != nil {
		t.Fatal(err)
	}
	if err := answered(t, done); err == nil {
		t.Fatal("question outlived its chat")
	}
}

func TestAnUnansweredQuestionRefusesTheToolWithoutStoppingTheChat(t *testing.T) {
	old := toolWait
	toolWait = 20 * time.Millisecond
	t.Cleanup(func() { toolWait = old })
	m, _, s := newToolChat(t)
	startTurn(t, m, s.ID)
	if err := m.ToolApproval(context.Background(), s.ID, "berth_exec", "$ make"); err == nil || !strings.Contains(err.Error(), "no one answered") {
		t.Fatalf("unanswered: %v", err)
	}
	if got, _ := m.Get(s.ID); got.State != "running" || len(got.Approvals) != 0 {
		t.Fatalf("after the wait: %+v", got)
	}
}

func TestAReportIsBurfsOwnMessageAndNeedsAnIdleChat(t *testing.T) {
	m, f, s := newToolChat(t)
	if err := m.Report(context.Background(), s.ID, "<berth-notification>api ended</berth-notification>"); err != nil {
		t.Fatal(err)
	}
	got := waitChat(t, m, s.ID, func(s Session) bool { return s.State == "running" && s.TurnID == "turn-1" })
	if len(got.Items) != 1 || got.Items[0].Kind != "report" || !strings.Contains(got.Items[0].Text, "api ended") {
		t.Fatalf("report item: %+v", got.Items)
	}
	// The provider echoes every message as the user's; this one stays Burf's.
	f.event("item/completed", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": map[string]any{"id": "echo-1", "type": "userMessage", "content": []any{map[string]any{"type": "text", "text": "<berth-notification>api ended</berth-notification>"}}}})
	got = waitChat(t, m, s.ID, func(s Session) bool { return len(s.Items) == 1 && s.Items[0].ID == "echo-1" })
	if got.Items[0].Kind != "report" {
		t.Fatalf("echo turned the report into %q", got.Items[0].Kind)
	}
	// It reached the provider as an ordinary turn, with nothing chosen for it.
	turn, _ := f.sent("turn/start")
	if strings.Contains(string(turn.Params), "sandboxPolicy") || strings.Contains(string(turn.Params), "approvalPolicy") || strings.Contains(string(turn.Params), `"model"`) {
		t.Fatalf("a report changed the chat's settings: %s", turn.Params)
	}
	if err := m.Report(context.Background(), s.ID, "another"); err == nil {
		t.Fatal("a report interrupted a turn")
	}
}

func TestWhatBurfsOwnToolAnsweredIsShownAndAnotherServersIsNot(t *testing.T) {
	m, f, s := newToolChat(t)
	startTurn(t, m, s.ID)
	item := func(id, server string, extra map[string]any) {
		v := map[string]any{"id": id, "type": "mcpToolCall", "server": server, "tool": "berth_artifact_add", "status": "completed"}
		for k, x := range extra {
			v[k] = x
		}
		f.event("item/completed", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": v})
	}
	line := "Artifact a1b2c3d4e5 v1 · notes · Search speed-up plan"
	text := map[string]any{"result": map[string]any{"content": []any{map[string]any{"type": "text", "text": line}, map[string]any{"type": "image", "data": "AAAA"}}}}
	item("t1", ToolServer, text)
	item("t2", "someone_else", text)
	item("t3", ToolServer, map[string]any{"status": "failed", "error": map[string]any{"message": "not inside the chat's folder"}})
	got := waitChat(t, m, s.ID, func(s Session) bool { return len(s.Items) == 4 })
	byID := map[string]Item{}
	for _, it := range got.Items {
		byID[it.ID] = it
	}
	if byID["t1"].Kind != "tool" || byID["t1"].Text != "mcpToolCall · berth_artifact_add\n"+line {
		t.Fatalf("own tool: %q", byID["t1"].Text)
	}
	if strings.Contains(byID["t2"].Text, "Artifact") {
		t.Fatalf("another server's answer was shown: %q", byID["t2"].Text)
	}
	if !strings.HasSuffix(byID["t3"].Text, "\nnot inside the chat's folder") {
		t.Fatalf("own tool's failure: %q", byID["t3"].Text)
	}
}

func TestAnEndedTurnSaysTheChatIsIdle(t *testing.T) {
	var idle atomic.Int32
	m, f, s, err := newChatWith(t, LaunchOptions{Tools: burfTools}, func(m *Manager) { m.Idle = func() { idle.Add(1) } })
	if err != nil {
		t.Fatal(err)
	}
	startTurn(t, m, s.ID)
	if idle.Load() != 0 {
		t.Fatal("idle was called during a turn")
	}
	f.event("turn/completed", map[string]any{"threadId": "owned-thread", "turn": map[string]string{"id": "turn-1", "status": "completed"}})
	waitChat(t, m, s.ID, func(s Session) bool { return s.State == "idle" })
	deadline := time.Now().Add(2 * time.Second)
	for idle.Load() != 1 {
		if time.Now().After(deadline) {
			t.Fatalf("idle calls: %d", idle.Load())
		}
		time.Sleep(time.Millisecond)
	}
}

func TestATurnStartedWithoutFullAccessAsksFromItsFirstMoment(t *testing.T) {
	m, f, s := newToolChat(t)
	if err := m.SendWith(context.Background(), s.ID, "go", TurnOptions{Permission: "full-access"}); err != nil {
		t.Fatal(err)
	}
	waitChat(t, m, s.ID, func(s Session) bool { return s.TurnID == "turn-1" && s.Options.Permission == "full-access" })
	f.event("turn/completed", map[string]any{"threadId": "owned-thread", "turn": map[string]string{"id": "turn-1", "status": "completed"}})
	waitChat(t, m, s.ID, func(s Session) bool { return s.State == "idle" })

	// The next turn is asked for with less, and the provider has not yet
	// answered: the last permission it accepted is still full access.
	f.mu.Lock()
	f.onTurn = func(packet) {}
	f.mu.Unlock()
	go func() { _ = m.SendWith(context.Background(), s.ID, "carefully now", TurnOptions{Permission: "strict"}) }()
	waitChat(t, m, s.ID, func(s Session) bool { return s.State == "running" && s.Options.Permission == "full-access" })
	// Asked for but not opened: nothing may act, and no question is left
	// behind for a turn the provider may yet refuse.
	if err := m.ToolApproval(context.Background(), s.ID, "berth_exec", "$ make deploy"); err == nil || !strings.Contains(err.Error(), "during a turn") {
		t.Fatalf("a tool acted before its turn opened: %v", err)
	}
	if got, _ := m.Get(s.ID); len(got.Approvals) != 0 || got.State != "running" {
		t.Fatalf("a question was left for a turn that has not opened: %+v", got)
	}
	// Opened, the provider's answer still on its way.
	f.event("turn/started", map[string]any{"threadId": "owned-thread", "turn": map[string]string{"id": "turn-2"}})
	waitChat(t, m, s.ID, func(s Session) bool { return s.TurnID == "turn-2" && s.Options.Permission == "full-access" })
	done := make(chan error, 1)
	go func() { done <- m.ToolApproval(context.Background(), s.ID, "berth_exec", "$ make deploy") }()
	select {
	case err := <-done:
		t.Fatalf("a tool acted on the turn before's full access: %v", err)
	case <-time.After(100 * time.Millisecond):
	}
	waitChat(t, m, s.ID, func(s Session) bool { return len(s.Approvals) == 1 && s.Approvals[0].Kind == "tool" })

	// A turn that keeps the chat's settings keeps its full access too.
	m2, _, s2 := newToolChat(t)
	if err := m2.SendWith(context.Background(), s2.ID, "go", TurnOptions{Permission: "full-access"}); err != nil {
		t.Fatal(err)
	}
	waitChat(t, m2, s2.ID, func(s Session) bool { return s.TurnID == "turn-1" && s.Options.Permission == "full-access" })
	if err := m2.ToolApproval(context.Background(), s2.ID, "berth_exec", "$ make"); err != nil {
		t.Fatalf("full access was asked: %v", err)
	}
}

func TestAReportStaysBurfsThroughBothOfTheProvidersEchoes(t *testing.T) {
	m, f, s := newToolChat(t)
	text := "<berth-notification>api ended</berth-notification>"
	if err := m.Report(context.Background(), s.ID, text); err != nil {
		t.Fatal(err)
	}
	waitChat(t, m, s.ID, func(s Session) bool { return s.TurnID == "turn-1" })
	echo := map[string]any{"id": "echo-1", "type": "userMessage", "content": []any{map[string]any{"type": "text", "text": text}}}
	f.event("item/started", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": echo})
	waitChat(t, m, s.ID, func(s Session) bool { return len(s.Items) == 1 && s.Items[0].ID == "echo-1" })
	f.event("item/completed", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": echo})
	// Something after it, so the second echo has been read by the time we look.
	f.event("item/completed", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": map[string]any{"id": "reply-1", "type": "agentMessage", "text": "Noted."}})
	got := waitChat(t, m, s.ID, func(s Session) bool { return len(s.Items) == 2 })
	if got.Items[0].ID != "echo-1" || got.Items[0].Kind != "report" {
		t.Fatalf("the second echo made Burf's message the person's: %+v", got.Items[0])
	}
	// The person's own message is still theirs through both.
	m2, f2, s2 := newToolChat(t)
	startTurn(t, m2, s2.ID)
	mine := map[string]any{"id": "echo-2", "type": "userMessage", "content": []any{map[string]any{"type": "text", "text": "open the page"}}}
	f2.event("item/started", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": mine})
	f2.event("item/completed", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": mine})
	f2.event("item/completed", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": map[string]any{"id": "reply-2", "type": "agentMessage", "text": "Done."}})
	if got = waitChat(t, m2, s2.ID, func(s Session) bool { return len(s.Items) == 2 }); got.Items[0].Kind != "user" {
		t.Fatalf("the person's message became %q", got.Items[0].Kind)
	}
}

func TestATurnTheProviderRefusesLeavesNoQuestionAndAChatThatStillWorks(t *testing.T) {
	m, f, s := newToolChat(t)
	// The provider refuses this start, after a moment in which a tool tried to ask.
	asked := make(chan error, 1)
	f.mu.Lock()
	f.onTurn = func(p packet) {
		asked <- m.ToolApproval(context.Background(), s.ID, "berth_exec", "$ make deploy")
		f.send(map[string]any{"id": p.ID, "error": map[string]any{"code": -32600, "message": "model is not available"}})
	}
	f.mu.Unlock()
	if err := m.SendWith(context.Background(), s.ID, "go", TurnOptions{Model: "nope"}); err == nil {
		t.Fatal("a refused turn was reported as started")
	}
	if err := <-asked; err == nil || !strings.Contains(err.Error(), "during a turn") {
		t.Fatalf("a tool asked in a turn that never opened: %v", err)
	}
	got, _ := m.Get(s.ID)
	if got.State != "idle" || len(got.Approvals) != 0 || got.TurnID != "" {
		t.Fatalf("after the refusal: %+v", got)
	}
	// The chat takes the next message as usual.
	f.mu.Lock()
	f.onTurn = nil
	f.mu.Unlock()
	startTurn(t, m, s.ID)
	approval, done := ask(t, m, s.ID, "berth_exec", "$ make deploy")
	if err := m.Decide(s.ID, approval.ID, "accept"); err != nil {
		t.Fatal(err)
	}
	if err := answered(t, done); err != nil {
		t.Fatal(err)
	}
}
