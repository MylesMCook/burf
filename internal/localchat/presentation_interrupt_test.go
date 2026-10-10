package localchat

import (
	"context"
	"testing"
	"time"
)

func TestInterruptWithdrawsFormsBeforeCompletionWithoutRevokingApprovals(t *testing.T) {
	m, f, s := newToolChat(t)
	startTurn(t, m, s.ID)
	p, result := pendingForm(t, m, s.ID, context.Background())
	f.send(map[string]any{"id": 41, "method": "item/commandExecution/requestApproval", "params": map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "itemId": "cmd-1", "command": "git status"}})
	before := waitChat(t, m, s.ID, func(s Session) bool { return len(s.Approvals) == 1 })

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- m.Interrupt(ctx, s.ID) }()
	var request packet
	waitChat(t, m, s.ID, func(Session) bool {
		var ok bool
		request, ok = f.sent("turn/interrupt")
		return ok
	})
	// The provider acknowledges Stop but never emits turn/completed.
	f.send(map[string]any{"id": request.ID, "result": map[string]any{}})
	if err := answered(t, done); err != nil {
		t.Fatal(err)
	}
	if err := m.AnswerPresentation(s.ID, p.ID, PresentationAnswer{Action: "accept", Values: map[string]string{"choice": "Continue"}}); err == nil {
		t.Fatal("a form remained answerable after the interrupt acknowledgement")
	}
	if got := formResult(t, result); got.State != "cancelled" {
		t.Fatal("Stop did not settle the form as cancelled", got.State)
	}
	after, _ := m.Get(s.ID)
	if len(after.Approvals) != 1 || after.Approvals[0].ID != before.Approvals[0].ID || after.TurnID != "turn-1" || after.State == "exited" {
		t.Fatal("form cancellation changed unrelated approval or provider stopping state", after)
	}
}
