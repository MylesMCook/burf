package localchat

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestSubmittedPromptVisibleWithoutProviderEcho(t *testing.T) {
	m, _, s := newTestChat(t)
	if err := m.Send(context.Background(), s.ID, "Visible immediately"); err != nil {
		t.Fatal(err)
	}
	got, _ := m.Get(s.ID)
	if len(got.Items) != 1 || got.Items[0].Kind != "user" || got.Items[0].Text != "Visible immediately" {
		t.Fatalf("submitted prompt missing: %#v", got.Items)
	}
}

func TestScopedApprovalChoices(t *testing.T) {
	for _, decision := range []string{"acceptForSession", "acceptAlways"} {
		t.Run(decision, func(t *testing.T) {
			m, f, s := newTestChat(t)
			if err := m.Send(context.Background(), s.ID, "test"); err != nil {
				t.Fatal(err)
			}
			r, _ := m.get(s.ID)
			params, _ := json.Marshal(map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "itemId": "cmd", "command": "git status", "proposedExecpolicyAmendment": []string{"git", "status"}})
			r.approval(packet{ID: json.RawMessage(`12`), Method: "item/commandExecution/requestApproval", Params: params})
			if err := m.Decide(s.ID, "12", decision); err != nil {
				t.Fatal(err)
			}
			want := `{"decision":"acceptForSession"}`
			if decision == "acceptAlways" {
				want = `{"decision":{"acceptWithExecpolicyAmendment":{"execpolicy_amendment":["git","status"]}}}`
			}
			deadline := time.Now().Add(time.Second)
			for {
				f.mu.Lock()
				found := false
				for _, p := range f.packets {
					if string(p.ID) == "12" {
						found = true
						if string(p.Result) != want {
							t.Errorf("wrong grant: %s", p.Result)
						}
					}
				}
				f.mu.Unlock()
				if found {
					break
				}
				if time.Now().After(deadline) {
					t.Fatal("grant not sent")
				}
				time.Sleep(time.Millisecond)
			}
			if err := m.Decide(s.ID, "12", decision); err == nil {
				t.Fatal("stale grant replayed")
			}
		})
	}
}

func TestPromptEchoReconcilesOnlyCurrentSubmission(t *testing.T) {
	m, f, s := newTestChat(t)
	for n := 0; n < 2; n++ {
		if err := m.Send(context.Background(), s.ID, "same prompt"); err != nil {
			t.Fatal(err)
		}
		r, _ := m.get(s.ID)
		r.mu.Lock()
		id := r.submitted
		r.mu.Unlock()
		item := map[string]any{"id": id + "-provider", "clientId": id, "type": "userMessage", "content": []any{map[string]string{"type": "text", "text": "same prompt"}}}
		for _, event := range []string{"item/started", "item/completed"} {
			f.event(event, map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": item})
		}
		got := waitChat(t, m, s.ID, func(s Session) bool { return len(s.Items) == n+1 && s.Items[n].ID == id+"-provider" })
		if len(got.Items) != n+1 {
			t.Fatal("duplicate prompt", got.Items)
		}
		if err := m.Interrupt(context.Background(), s.ID); err != nil {
			t.Fatal(err)
		}
	}
}

func TestTurnOptionsAreExplicitAndAcknowledged(t *testing.T) {
	m, f, s := newTestChat(t)
	got, _ := m.Get(s.ID)
	if got.Options.Permission != "strict" {
		t.Fatal("changed default")
	}
	options := TurnOptions{Model: "test-model", Effort: "high", Permission: "workspace"}
	if err := m.SendWith(context.Background(), s.ID, "edit", options); err != nil {
		t.Fatal(err)
	}
	got, _ = m.Get(s.ID)
	if got.Options != options {
		t.Fatal(got.Options)
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, p := range f.packets {
		if p.Method == "turn/start" {
			var v map[string]any
			_ = json.Unmarshal(p.Params, &v)
			if v["model"] != "test-model" || v["effort"] != "high" || v["approvalPolicy"] != "on-request" || v["clientUserMessageId"] == nil {
				t.Fatal(v)
			}
			policy := v["sandboxPolicy"].(map[string]any)
			if policy["type"] != "workspaceWrite" || policy["networkAccess"] != false || policy["excludeSlashTmp"] != true {
				t.Fatal(policy)
			}
		}
	}
	if err := m.SendWith(context.Background(), s.ID, "invalid", TurnOptions{Permission: "danger-full-access"}); err == nil {
		t.Fatal("accepted unrestricted mode")
	}
}

func TestPersistentProposalSnapshotCannotBeMutated(t *testing.T) {
	m, _, s := newTestChat(t)
	_ = m.Send(context.Background(), s.ID, "test")
	r, _ := m.get(s.ID)
	r.approval(packet{ID: json.RawMessage(`9`), Method: "item/commandExecution/requestApproval", Params: json.RawMessage(`{"threadId":"owned-thread","turnId":"turn-1","itemId":"cmd","command":"git status","proposedExecpolicyAmendment":["git","status"]}`)})
	got, _ := m.Get(s.ID)
	got.Approvals[0].Execpolicy[0] = "sh"
	got, _ = m.Get(s.ID)
	if got.Approvals[0].Execpolicy[0] != "git" {
		t.Fatal("proposal mutated")
	}
}

func TestRejectedTurnKeepsTheChatAndClaimsNothing(t *testing.T) {
	m, f, s := newTestChat(t)
	f.mu.Lock()
	f.onTurn = func(p packet) {
		f.send(map[string]any{"id": p.ID, "error": map[string]any{"code": -1, "message": "unsupported effort"}})
	}
	f.mu.Unlock()
	err := m.SendWith(context.Background(), s.ID, "test", TurnOptions{Permission: "workspace", Effort: "ultra"})
	if err == nil || !strings.Contains(err.Error(), "unsupported effort") {
		t.Fatal("rejection not reported", err)
	}
	got, _ := m.Get(s.ID)
	if got.Options != (TurnOptions{Permission: "strict"}) || got.State != "idle" || len(got.Items) != 0 || got.Error == "" {
		t.Fatalf("rejected turn changed the chat: %#v", got)
	}
	f.mu.Lock()
	f.onTurn = nil
	f.mu.Unlock()
	if err := m.Send(context.Background(), s.ID, "again"); err != nil {
		t.Fatal("chat unusable after a rejection", err)
	}
	if got, _ = m.Get(s.ID); len(got.Items) != 1 || got.Items[0].Text != "again" || got.Error != "" {
		t.Fatalf("deliberate resend: %#v", got)
	}
}

func TestLostTurnReplyStillStopsWithoutReplay(t *testing.T) {
	m, f, s := newTestChat(t)
	f.mu.Lock()
	f.onTurn = func(packet) { _ = f.conn.Close() }
	f.mu.Unlock()
	if err := m.Send(context.Background(), s.ID, "uncertain"); err == nil {
		t.Fatal("lost reply reported as sent")
	}
	if got, _ := m.Get(s.ID); got.State != "exited" || len(got.Items) != 1 {
		t.Fatalf("uncertain send must stop and keep its message: %#v", got)
	}
}

func TestModelsAreListedBeforeAnyChatWithoutAThread(t *testing.T) {
	var launches atomic.Int32
	var methods []string
	var mu sync.Mutex
	closed := make(chan struct{}, 4)
	m := New("synthetic.exe", func(LaunchOptions) (Process, error) {
		launches.Add(1)
		client, server := net.Pipe()
		go func() {
			defer func() { server.Close(); closed <- struct{}{} }()
			sc := bufio.NewScanner(server)
			for sc.Scan() {
				var p packet
				_ = json.Unmarshal(sc.Bytes(), &p)
				mu.Lock()
				methods = append(methods, p.Method)
				mu.Unlock()
				var result any = map[string]any{}
				if p.Method == "model/list" {
					result = map[string]any{"data": []any{
						map[string]any{"model": "alpha", "displayName": "Alpha", "defaultReasoningEffort": "medium", "supportedReasoningEfforts": []any{map[string]string{"reasoningEffort": "medium"}}},
						map[string]any{"model": "secret", "hidden": true},
					}}
				}
				if len(p.ID) > 0 {
					b, _ := json.Marshal(map[string]any{"id": p.ID, "result": result})
					_, _ = server.Write(append(b, '\n'))
				}
			}
		}()
		return client, nil
	})
	t.Cleanup(m.Close)
	options := LaunchOptions{Program: "synthetic.exe", CWD: t.TempDir(), Env: []string{"CODEX_HOME=/accounts/one"}}
	for range 2 {
		models, err := m.ListModels(context.Background(), options)
		if err != nil || len(models) != 1 || models[0].Model != "alpha" {
			t.Fatal(models, err)
		}
	}
	select {
	case <-closed:
	case <-time.After(2 * time.Second):
		t.Fatal("listing left its provider process running")
	}
	options.Env = []string{"CODEX_HOME=/accounts/two"}
	if _, err := m.ListModels(context.Background(), options); err != nil {
		t.Fatal(err)
	}
	if launches.Load() != 2 {
		t.Fatal("expected one launch per account, cached", launches.Load())
	}
	mu.Lock()
	defer mu.Unlock()
	for _, method := range methods {
		if method == "thread/start" || method == "turn/start" {
			t.Fatal("model listing opened a conversation", methods)
		}
	}
	if len(m.List()) != 0 {
		t.Fatal("model listing registered a chat")
	}
}

func TestNormalizedPromptEchoReplacesTheProvisionalMessage(t *testing.T) {
	m, f, s := newTestChat(t)
	if err := m.Send(context.Background(), s.ID, "  padded prompt  "); err != nil {
		t.Fatal(err)
	}
	item := map[string]any{"id": "provider-user", "type": "userMessage", "content": []any{map[string]string{"type": "text", "text": "padded prompt"}}}
	f.event("item/completed", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": item})
	got := waitChat(t, m, s.ID, func(s Session) bool { return len(s.Items) > 0 && s.Items[0].ID == "provider-user" })
	if len(got.Items) != 1 || got.Items[0].Text != "padded prompt" {
		t.Fatalf("duplicate or stale prompt: %#v", got.Items)
	}
}

func TestEffortIsAProviderNameNotAFixedList(t *testing.T) {
	for effort, ok := range map[string]bool{"": true, "high": true, "x-high_2": true, "High": false, "high effort": false, "a\nb": false, "0123456789012345678901234567890123": false} {
		if err := (TurnOptions{Effort: effort}).validate(); (err == nil) != ok {
			t.Errorf("effort %q: %v", effort, err)
		}
	}
}
