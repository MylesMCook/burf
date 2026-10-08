package localchat

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"strings"
	"sync"
	"testing"
	"time"
)

type fakeServer struct {
	conn    net.Conn
	mu      sync.Mutex
	writeMu sync.Mutex
	packets []packet
	onTurn  func(packet)
}

func (f *fakeServer) send(v any) {
	f.writeMu.Lock()
	defer f.writeMu.Unlock()
	b, _ := json.Marshal(v)
	_, _ = f.conn.Write(append(b, '\n'))
}
func (f *fakeServer) event(method string, params any) {
	f.send(map[string]any{"method": method, "params": params})
}
func newTestChat(t *testing.T) (*Manager, *fakeServer, Session) {
	t.Helper()
	f := &fakeServer{}
	m := New("synthetic.exe", func(program, cwd string) (Process, error) {
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
				fn := f.onTurn
				f.mu.Unlock()
				switch p.Method {
				case "initialize":
					f.send(map[string]any{"id": p.ID, "result": map[string]any{}})
				case "thread/start":
					var params map[string]any
					_ = json.Unmarshal(p.Params, &params)
					if params["sandbox"] != "read-only" || params["approvalPolicy"] != "untrusted" || params["approvalsReviewer"] != "user" {
						t.Error("unsafe launch", string(p.Params))
					}
					f.send(map[string]any{"id": p.ID, "result": map[string]any{"thread": map[string]string{"id": "owned-thread"}}})
				case "turn/start":
					if fn != nil {
						fn(p)
					} else {
						f.event("turn/started", map[string]any{"threadId": "owned-thread", "turn": map[string]string{"id": "turn-1"}})
						f.send(map[string]any{"id": p.ID, "result": map[string]any{"turn": map[string]string{"id": "turn-1"}}})
					}
				case "turn/interrupt":
					f.event("turn/completed", map[string]any{"threadId": "owned-thread", "turn": map[string]string{"id": "turn-1", "status": "interrupted"}})
					f.send(map[string]any{"id": p.ID, "result": map[string]any{}})
				}
			}
		}()
		return client, nil
	})
	t.Cleanup(m.Close)
	s, err := m.Start(context.Background(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return m, f, s
}
func waitChat(t *testing.T, m *Manager, id string, predicate func(Session) bool) Session {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for {
		s, e := m.Get(id)
		if e != nil {
			t.Fatal(e)
		}
		if predicate(s) {
			return s
		}
		if time.Now().After(deadline) {
			t.Fatalf("chat did not reach expected state: %+v", s)
		}
		time.Sleep(time.Millisecond)
	}
}
func itemEvent(f *fakeServer, method, id, kind, text string) {
	it := map[string]any{"id": id, "type": kind, "text": text}
	if kind == "userMessage" {
		it["content"] = []any{map[string]string{"type": "text", "text": text}}
	}
	f.event(method, map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": it})
}

func TestStructuredChatStreamsOwnIdentityAndInterrupts(t *testing.T) {
	m, f, s := newTestChat(t)
	if s.ThreadID != "owned-thread" || s.State != "idle" || s.Mode != "chat" {
		t.Fatal(s)
	}
	if e := m.Send(context.Background(), s.ID, "hello"); e != nil {
		t.Fatal(e)
	}
	itemEvent(f, "item/started", "user-1", "userMessage", "hello")
	itemEvent(f, "item/started", "assistant-1", "agentMessage", "")
	f.event("item/agentMessage/delta", map[string]string{"threadId": "foreign-thread", "turnId": "turn-1", "itemId": "assistant-1", "delta": "private unrelated text"})
	f.event("item/agentMessage/delta", map[string]string{"threadId": "owned-thread", "turnId": "turn-1", "itemId": "assistant-1", "delta": "hi"})
	got := waitChat(t, m, s.ID, func(s Session) bool { return len(s.Items) == 2 && s.Items[1].Text == "hi" })
	if got.Items[0].Text != "hello" {
		t.Fatal(got)
	}
	if e := m.Send(context.Background(), s.ID, "duplicate"); e == nil {
		t.Fatal("allowed overlapping turn")
	}
	if e := m.Interrupt(context.Background(), s.ID); e != nil {
		t.Fatal(e)
	}
	waitChat(t, m, s.ID, func(s Session) bool { return s.State == "idle" })
	f.mu.Lock()
	defer f.mu.Unlock()
	sends := 0
	for _, p := range f.packets {
		if p.Method == "turn/start" {
			sends++
		}
	}
	if sends != 1 {
		t.Fatal(sends)
	}
}
func TestApprovalIsExplicitScopedAndOneUse(t *testing.T) {
	m, f, s := newTestChat(t)
	if e := m.Send(context.Background(), s.ID, "test approval"); e != nil {
		t.Fatal(e)
	}
	f.send(map[string]any{"id": 7, "method": "item/commandExecution/requestApproval", "params": map[string]string{"threadId": "owned-thread", "turnId": "turn-1", "itemId": "cmd-1", "command": "echo synthetic", "cwd": s.CWD, "reason": "test"}})
	got := waitChat(t, m, s.ID, func(s Session) bool { return s.State == "waiting" })
	if len(got.Approvals) != 1 {
		t.Fatal(got)
	}
	f.mu.Lock()
	for _, p := range f.packets {
		if string(p.ID) == "7" {
			t.Fatal("auto approved")
		}
	}
	f.mu.Unlock()
	if e := m.Decide(s.ID, got.Approvals[0].ID, "acceptForSession"); e == nil {
		t.Fatal("allowed persistent approval")
	}
	if e := m.Decide(s.ID, "foreign", "accept"); e == nil {
		t.Fatal("allowed unrelated approval")
	}
	if e := m.Decide(s.ID, got.Approvals[0].ID, "decline"); e != nil {
		t.Fatal(e)
	}
	if e := m.Decide(s.ID, got.Approvals[0].ID, "accept"); e == nil {
		t.Fatal("replayed approval")
	}
	deadline := time.Now().Add(time.Second)
	for {
		f.mu.Lock()
		found := false
		for _, p := range f.packets {
			if string(p.ID) == "7" {
				found = string(p.Result) == `{"decision":"decline"}`
			}
		}
		f.mu.Unlock()
		if found {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("no deny response")
		}
		time.Sleep(time.Millisecond)
	}
}
func TestUnknownAndForeignRequestsStopWithoutGrant(t *testing.T) {
	for _, tc := range []struct{ method, thread string }{{"item/tool/requestUserInput", "owned-thread"}, {"item/commandExecution/requestApproval", "foreign-thread"}, {"item/fileChange/requestApproval", "owned-thread"}} {
		t.Run(tc.method+tc.thread, func(t *testing.T) {
			m, f, s := newTestChat(t)
			_ = m.Send(context.Background(), s.ID, "test")
			f.send(map[string]any{"id": "request", "method": tc.method, "params": map[string]string{"threadId": tc.thread, "turnId": "turn-1", "command": "echo x", "itemId": "unknown"}})
			got := waitChat(t, m, s.ID, func(s Session) bool { return s.State == "exited" })
			if got.Error == "" || len(got.Approvals) != 0 {
				t.Fatal(got)
			}
			if e := m.Decide(s.ID, `"request"`, "accept"); e == nil {
				t.Fatal("grant after stop")
			}
		})
	}
}
func TestUncertainSendStopsAndNeverRetries(t *testing.T) {
	m, f, s := newTestChat(t)
	f.mu.Lock()
	f.onTurn = func(p packet) { _ = f.conn.Close() }
	f.mu.Unlock()
	if e := m.Send(context.Background(), s.ID, "once"); e == nil {
		t.Fatal("expected uncertain send")
	}
	waitChat(t, m, s.ID, func(s Session) bool { return s.State == "exited" })
	if e := m.Send(context.Background(), s.ID, "once"); e == nil {
		t.Fatal("retry accepted")
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	n := 0
	for _, p := range f.packets {
		if p.Method == "turn/start" {
			n++
		}
	}
	if n != 1 {
		t.Fatal(n)
	}
}
func TestCancelledStartDoesNotLaunchAndRestartProtectsChats(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	m := New("synthetic", func(string, string) (Process, error) { t.Fatal("launched canceled request"); return nil, nil })
	if _, e := m.Start(ctx, t.TempDir()); e == nil {
		t.Fatal("accepted cancellation")
	}
	m, _, s := newTestChat(t)
	if e := m.PrepareRestart(); e == nil {
		t.Fatal("restart allowed live chat")
	}
	if e := m.Stop(s.ID); e != nil {
		t.Fatal(e)
	}
	if e := m.PrepareRestart(); e != nil {
		t.Fatal(e)
	}
	if _, e := m.Start(context.Background(), t.TempDir()); e == nil {
		t.Fatal("start after restart gate")
	}
}
func TestBoundedItemsAndSnapshotIsolation(t *testing.T) {
	m, f, s := newTestChat(t)
	_ = m.Send(context.Background(), s.ID, "test")
	for i := 0; i < maxItems+2; i++ {
		itemEvent(f, "item/completed", fmt.Sprint(i), "agentMessage", "bounded")
	}
	got := waitChat(t, m, s.ID, func(s Session) bool {
		return s.Truncated && len(s.Items) == maxItems && s.Items[maxItems-1].ID == fmt.Sprint(maxItems+1)
	})
	got.Items[0].Text = "mutated"
	next, _ := m.Get(s.ID)
	if next.Items[0].Text == "mutated" {
		t.Fatal("snapshot modified session")
	}
}

func TestCompletedBeforeStartReplyDoesNotReopenTurn(t *testing.T) {
	m, f, s := newTestChat(t)
	f.mu.Lock()
	f.onTurn = func(p packet) {
		f.event("turn/started", map[string]any{"threadId": "owned-thread", "turn": map[string]string{"id": "fast-turn"}})
		f.event("turn/completed", map[string]any{"threadId": "owned-thread", "turn": map[string]string{"id": "fast-turn", "status": "completed"}})
		f.send(map[string]any{"id": p.ID, "result": map[string]any{"turn": map[string]string{"id": "fast-turn"}}})
	}
	f.mu.Unlock()
	if err := m.Send(context.Background(), s.ID, "quick reply"); err != nil {
		t.Fatal(err)
	}
	got, _ := m.Get(s.ID)
	if got.State != "idle" || got.TurnID != "" {
		t.Fatal(got)
	}
}

func TestFileApprovalShowsExactChangeAndRejectsTruncatedDetails(t *testing.T) {
	for _, large := range []bool{false, true} {
		t.Run(fmt.Sprint(large), func(t *testing.T) {
			m, f, s := newTestChat(t)
			if err := m.Send(context.Background(), s.ID, "change a file"); err != nil {
				t.Fatal(err)
			}
			diff := "+synthetic change"
			if large {
				diff = strings.Repeat("x", maxText+1)
			}
			f.event("item/started", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": map[string]any{"id": "patch", "type": "fileChange", "status": "inProgress", "changes": []any{map[string]any{"path": "test.txt", "diff": diff, "kind": map[string]string{"type": "update"}}}}})
			f.send(map[string]any{"id": "file-approval", "method": "item/fileChange/requestApproval", "params": map[string]string{"threadId": "owned-thread", "turnId": "turn-1", "itemId": "patch"}})
			if large {
				waitChat(t, m, s.ID, func(s Session) bool { return s.State == "exited" })
				return
			}
			got := waitChat(t, m, s.ID, func(s Session) bool { return s.State == "waiting" })
			if got.Approvals[0].Detail != "update: test.txt\n+synthetic change\n" {
				t.Fatal(got.Approvals)
			}
			if err := m.Decide(s.ID, got.Approvals[0].ID, "accept"); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestTotalSnapshotBound(t *testing.T) {
	r := &running{}
	for i := 0; i < maxItems; i++ {
		r.put(Item{ID: fmt.Sprint(i), Text: strings.Repeat("a", maxText)})
	}
	n := 0
	for _, it := range r.session.Items {
		n += len(it.Text)
	}
	if n > maxSnapshot || !r.session.Truncated {
		t.Fatal(n, r.session.Truncated)
	}
}

func TestSlowHandshakeDoesNotBlockOtherChats(t *testing.T) {
	m, _, first := newTestChat(t)
	entered := make(chan struct{})
	m.mu.Lock()
	m.launch = func(string, string) (Process, error) {
		client, server := net.Pipe()
		go func() {
			defer server.Close()
			scanner := bufio.NewScanner(server)
			if scanner.Scan() {
				close(entered)
			}
			for scanner.Scan() {
			}
		}()
		return client, nil
	}
	m.mu.Unlock()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { _, err := m.Start(ctx, t.TempDir()); done <- err }()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("second handshake did not begin")
	}
	stopped := make(chan error, 1)
	go func() {
		if _, err := m.Get(first.ID); err != nil {
			stopped <- err
			return
		}
		stopped <- m.Stop(first.ID)
	}()
	select {
	case err := <-stopped:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("slow startup blocked stopping another chat")
	}
	cancel()
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("cancelled handshake succeeded")
		}
	case <-time.After(time.Second):
		t.Fatal("cancelled handshake did not finish")
	}
}

func TestFileMovesAndUpdatedPatchesAreNeverApprovedWithStaleDetails(t *testing.T) {
	for _, pending := range []bool{false, true} {
		t.Run(fmt.Sprint(pending), func(t *testing.T) {
			m, f, s := newTestChat(t)
			if err := m.Send(context.Background(), s.ID, "test patch"); err != nil {
				t.Fatal(err)
			}
			initial := []any{map[string]any{"path": "before.txt", "diff": "+first", "kind": map[string]string{"type": "update", "move_path": "after.txt"}}}
			f.event("item/started", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": map[string]any{"id": "patch", "type": "fileChange", "changes": initial}})
			ask := func() {
				f.send(map[string]any{"id": 8, "method": "item/fileChange/requestApproval", "params": map[string]string{"threadId": "owned-thread", "turnId": "turn-1", "itemId": "patch"}})
			}
			if pending {
				ask()
				got := waitChat(t, m, s.ID, func(s Session) bool { return s.State == "waiting" })
				if !strings.Contains(got.Approvals[0].Detail, "Move to: after.txt") {
					t.Fatal(got.Approvals)
				}
			}
			updated := []any{map[string]any{"path": "before.txt", "diff": "+second", "kind": map[string]string{"type": "update", "move_path": "new-destination.txt"}}}
			f.event("item/fileChange/patchUpdated", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "itemId": "patch", "changes": updated})
			if pending {
				waitChat(t, m, s.ID, func(s Session) bool { return s.State == "exited" })
				if err := m.Decide(s.ID, "8", "accept"); err == nil {
					t.Fatal("approved stale patch")
				}
				return
			}
			ask()
			got := waitChat(t, m, s.ID, func(s Session) bool { return s.State == "waiting" })
			detail := got.Approvals[0].Detail
			if !strings.Contains(detail, "Move to: new-destination.txt") || !strings.Contains(detail, "+second") || strings.Contains(detail, "+first") {
				t.Fatal(detail)
			}
		})
	}
}

func TestInvalidationRevokesApprovalBeforeTeardown(t *testing.T) {
	m, f, s := newTestChat(t)
	if err := m.Send(context.Background(), s.ID, "test"); err != nil {
		t.Fatal(err)
	}
	f.send(map[string]any{"id": 9, "method": "item/commandExecution/requestApproval", "params": map[string]string{"threadId": "owned-thread", "turnId": "turn-1", "itemId": "command", "command": "synthetic"}})
	waitChat(t, m, s.ID, func(s Session) bool { return s.State == "waiting" })
	r, _ := m.get(s.ID)
	r.mu.Lock()
	r.invalidate("unsafe change")
	if len(r.approvals) != 0 || len(r.session.Approvals) != 0 || r.session.State != "exited" {
		t.Fatal("approval remained valid under lock")
	}
	r.mu.Unlock()
	// Teardown deliberately has not begun: Decide still cannot enqueue a grant.
	if err := m.Decide(s.ID, "9", "accept"); err == nil {
		t.Fatal("approval accepted between invalidation and teardown")
	}
}
