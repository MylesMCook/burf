package localchat

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func presentation(t *testing.T, raw string) Presentation {
	t.Helper()
	p, err := ParsePresentation([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}
	return p
}

const formInput = `{"type":"form","message":"Choose the next action","fields":[{"name":"choice","label":"Choice","kind":"choice","options":["Inspect","Continue"],"required":true,"value":""},{"name":"notify","label":"Notify","kind":"toggle","value":"false"}]}`

func pendingForm(t *testing.T, m *Manager, id string, ctx context.Context) (Presentation, <-chan Presentation) {
	t.Helper()
	done := make(chan Presentation, 1)
	go func() {
		p, err := m.Present(ctx, id, presentation(t, formInput))
		if err != nil {
			t.Error(err)
		}
		done <- p
	}()
	s := waitChat(t, m, id, func(s Session) bool {
		for _, it := range s.Items {
			if it.Presentation != nil && it.Presentation.State == "request" {
				return true
			}
		}
		return false
	})
	for _, it := range s.Items {
		if it.Presentation != nil && it.Presentation.State == "request" {
			return *it.Presentation, done
		}
	}
	t.Fatal("no form")
	return Presentation{}, done
}
func formResult(t *testing.T, done <-chan Presentation) Presentation {
	t.Helper()
	select {
	case p := <-done:
		return p
	case <-time.After(time.Second):
		t.Fatal("form remained waiting")
		return Presentation{}
	}
}

func TestPresentationRejectsUnsafeOrUnboundedData(t *testing.T) {
	invalid := []string{
		`{"type":"chart","label":"x","value":"1","points":[1],"onClick":"exec"}`,
		`{"type":"chart","label":"x","value":"1","points":[1],"columns":[]}`,
		`{"type":"chart","label":"x","value":"1","points":[1e999]}`,
		`{"type":"table","columns":[{"key":"x","label":"X"}],"rows":[{"x":{"url":"https://example.com"}}]}`,
		`{"type":"table","columns":[{"key":"x","label":"X"}],"rows":[{"other":"x"}]}`,
		`{"type":"form","message":"Login","fields":[{"name":"token","label":"Token","kind":"password"}]}`,
		`{"type":"form","message":"Choice","fields":[{"name":"x","label":"X","kind":"choice","options":["same","same"]}]}`,
		`{"type":"form","message":"Choice","fields":[{"name":"x","label":"X","kind":"text"}],"state":"accepted"}`,
		`{"type":"form","message":"Choice","fields":[{"name":"x","label":"X","kind":"text","url":"https://example.com"}]}`,
	}
	for _, raw := range invalid {
		if _, err := ParsePresentation([]byte(raw)); err == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
	if _, err := ParsePresentation([]byte(strings.Repeat(" ", MaxPresentationBytes+1))); err == nil {
		t.Fatal("oversized payload accepted")
	}
}

func TestPresentOnlyDuringOwnedToolTurnAndSnapshotIsIndependent(t *testing.T) {
	p := presentation(t, `{"type":"table","caption":"Results","columns":[{"key":"name","label":"Name"}],"rows":[{"name":"original"}]}`)
	m, _, s := newToolChat(t)
	if _, err := m.Present(context.Background(), s.ID, p); err == nil {
		t.Fatal("idle presentation allowed")
	}
	plain, _, plainSession := newTestChat(t)
	startTurn(t, plain, plainSession.ID)
	if _, err := plain.Present(context.Background(), plainSession.ID, p); err == nil {
		t.Fatal("chat without own tools presented")
	}
	startTurn(t, m, s.ID)
	got, err := m.Present(context.Background(), s.ID, p)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID == "" || got.Type != "table" {
		t.Fatal(got)
	}
	snapshot, _ := m.Get(s.ID)
	last := snapshot.Items[len(snapshot.Items)-1]
	if !strings.Contains(last.Text, "original") || last.Presentation == nil {
		t.Fatal(last)
	}
	last.Presentation.Rows[0]["name"] = "mutated"
	again, _ := m.Get(s.ID)
	if again.Items[len(again.Items)-1].Presentation.Rows[0]["name"] != "original" {
		t.Fatal("caller mutated owned snapshot")
	}
}

func TestPresentationGeneratedIdentityStaysWithinWireBudget(t *testing.T) {
	m, _, s := newToolChat(t)
	startTurn(t, m, s.ID)
	p := Presentation{Type: "table", Columns: []PresentationColumn{{Key: "a", Label: "A"}, {Key: "b", Label: "B"}, {Key: "c", Label: "C"}, {Key: "d", Label: "D"}}, Rows: []map[string]any{{"a": strings.Repeat("x", 4000), "b": strings.Repeat("x", 4000), "c": strings.Repeat("x", 4000), "d": ""}}}
	raw, _ := json.Marshal(p)
	p.Rows[0]["d"] = strings.Repeat("x", MaxPresentationBytes-len(raw)-1)
	raw, _ = json.Marshal(p)
	if len(raw) >= MaxPresentationBytes {
		t.Fatal("fixture does not leave room for the input", len(raw))
	}
	if _, err := m.Present(context.Background(), s.ID, p); err == nil {
		t.Fatal("generated identity exceeded the advertised wire budget")
	}
}

func TestOmittedToggleStartsOffAndCanBeAnswered(t *testing.T) {
	m, _, s := newToolChat(t)
	startTurn(t, m, s.ID)
	done := make(chan Presentation, 1)
	go func() {
		p, err := m.Present(context.Background(), s.ID, presentation(t, `{"type":"form","message":"Notify?","fields":[{"name":"notify","label":"Notify","kind":"toggle"}]}`))
		if err != nil {
			t.Error(err)
		}
		done <- p
	}()
	snapshot := waitChat(t, m, s.ID, func(s Session) bool { return len(s.Items) > 0 && s.Items[len(s.Items)-1].Presentation != nil })
	p := snapshot.Items[len(snapshot.Items)-1].Presentation
	if p.Fields[0].Value != "false" {
		t.Fatal("toggle is not a valid off value", p.Fields[0].Value)
	}
	if err := m.AnswerPresentation(s.ID, p.ID, PresentationAnswer{Action: "accept", Values: map[string]string{"notify": "false"}}); err != nil {
		t.Fatal(err)
	}
	if formResult(t, done).State != "accepted" {
		t.Fatal("off toggle could not be submitted")
	}
}

func TestFormAnswerValidatesThenConsumesOnceWithoutGrantingPermission(t *testing.T) {
	m, _, s := newToolChat(t)
	startTurn(t, m, s.ID)
	p, done := pendingForm(t, m, s.ID, context.Background())
	for _, answer := range []PresentationAnswer{{Action: "accept"}, {Action: "accept", Values: map[string]string{"choice": "unsupported"}}, {Action: "accept", Values: map[string]string{"choice": "Inspect", "unknown": "x"}}, {Action: "accept", Values: map[string]string{"choice": "Inspect", "notify": "yes"}}, {Action: "acceptAlways"}} {
		if err := m.AnswerPresentation(s.ID, p.ID, answer); err == nil {
			t.Fatal("invalid answer consumed the form", answer)
		}
	}
	before, _ := m.Get(s.ID)
	if before.State != "waiting" || len(before.Approvals) != 0 || before.Options.Permission != "strict" {
		t.Fatal(before)
	}
	answer := PresentationAnswer{Action: "accept", Values: map[string]string{"choice": "Inspect", "notify": "false"}}
	if err := m.AnswerPresentation(s.ID, p.ID, answer); err != nil {
		t.Fatal(err)
	}
	result := formResult(t, done)
	if result.State != "accepted" || result.Fields[0].Value != "Inspect" {
		t.Fatal(result)
	}
	if err := m.AnswerPresentation(s.ID, p.ID, answer); err == nil {
		t.Fatal("duplicate reply accepted")
	}
	after, _ := m.Get(s.ID)
	if after.State != "running" || after.Options.Permission != "strict" || len(after.Approvals) != 0 {
		t.Fatal(after)
	}
}

func TestFullAccessStillRequiresExplicitFormInput(t *testing.T) {
	m, _, s := newToolChat(t)
	if err := m.SendWith(context.Background(), s.ID, "synthetic", TurnOptions{Permission: "full-access"}); err != nil {
		t.Fatal(err)
	}
	p, done := pendingForm(t, m, s.ID, context.Background())
	select {
	case <-done:
		t.Fatal("form auto-answered in full access")
	default:
	}
	if err := m.AnswerPresentation(s.ID, p.ID, PresentationAnswer{Action: "decline"}); err != nil {
		t.Fatal(err)
	}
	if got := formResult(t, done); got.State != "declined" {
		t.Fatal(got)
	}
}

func TestFormCancellationAndLateReplies(t *testing.T) {
	for _, why := range []string{"disconnect", "timeout", "turn-end", "stop", "trim"} {
		t.Run(why, func(t *testing.T) {
			m, f, s := newToolChat(t)
			startTurn(t, m, s.ID)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			old := presentationWait
			if why == "timeout" {
				presentationWait = 25 * time.Millisecond
			}
			defer func() { presentationWait = old }()
			p, done := pendingForm(t, m, s.ID, ctx)
			switch why {
			case "disconnect":
				cancel()
			case "timeout":
			case "stop":
				if err := m.Stop(s.ID); err != nil {
					t.Fatal(err)
				}
			case "turn-end":
				f.event("turn/completed", map[string]any{"threadId": "owned-thread", "turn": map[string]string{"id": "turn-1"}})
			case "trim":
				r, _ := m.get(s.ID)
				r.mu.Lock()
				for i := 0; i < maxItems; i++ {
					r.put(Item{ID: string(rune(i + 1000)), Kind: "assistant", Text: "next"})
				}
				r.mu.Unlock()
			}
			if got := formResult(t, done); got.State != "cancelled" {
				t.Fatal(got)
			}
			if err := m.AnswerPresentation(s.ID, p.ID, PresentationAnswer{Action: "accept", Values: map[string]string{"choice": "Inspect"}}); err == nil {
				t.Fatal("late reply accepted")
			}
		})
	}
}

func TestTypedPayloadCountsAgainstSnapshotBudget(t *testing.T) {
	p := presentation(t, `{"type":"table","columns":[{"key":"name","label":"Name"}],"rows":[{"name":"`+strings.Repeat("x", 4000)+`"}]}`)
	r := &running{}
	for i := 0; i < 100; i++ {
		copy := p.clone()
		r.put(Item{ID: string(rune(i + 1000)), Text: strings.Repeat("y", 60000), Presentation: &copy})
	}
	bytes := 0
	for _, item := range r.session.Items {
		bytes += itemBytes(item)
	}
	if !r.session.Truncated || bytes > maxSnapshot {
		t.Fatal("typed data escaped snapshot budget", bytes, len(r.session.Items))
	}
	raw, _ := json.Marshal(r.session)
	if len(raw) < bytes {
		t.Fatal("test did not account for typed payload")
	}
}

func TestFormBackpressureAndReplyCancellationRace(t *testing.T) {
	m, _, s := newToolChat(t)
	startTurn(t, m, s.ID)
	var requests []Presentation
	var results []<-chan Presentation
	for i := 0; i < maxPendingForms; i++ {
		done := make(chan Presentation, 1)
		go func() {
			p, err := m.Present(context.Background(), s.ID, presentation(t, formInput))
			if err != nil {
				t.Error(err)
			}
			done <- p
		}()
		got := waitChat(t, m, s.ID, func(s Session) bool {
			n := 0
			for _, it := range s.Items {
				if it.Presentation != nil && it.Presentation.State == "request" {
					n++
				}
			}
			return n == i+1
		})
		for _, it := range got.Items {
			if it.Presentation != nil && it.Presentation.State == "request" {
				found := false
				for _, p := range requests {
					found = found || p.ID == it.ID
				}
				if !found {
					requests = append(requests, *it.Presentation)
					results = append(results, done)
					break
				}
			}
		}
	}
	if _, err := m.Present(context.Background(), s.ID, presentation(t, formInput)); err == nil {
		t.Fatal("pending form limit ignored")
	}
	for i, p := range requests {
		if err := m.AnswerPresentation(s.ID, p.ID, PresentationAnswer{Action: "decline"}); err != nil {
			t.Fatal(err)
		}
		formResult(t, results[i])
	}
	for i := 0; i < 20; i++ {
		ctx, cancel := context.WithCancel(context.Background())
		p, done := pendingForm(t, m, s.ID, ctx)
		answerDone := make(chan error, 1)
		go func() {
			answerDone <- m.AnswerPresentation(s.ID, p.ID, PresentationAnswer{Action: "accept", Values: map[string]string{"choice": "Inspect"}})
		}()
		cancel()
		result := formResult(t, done)
		err := <-answerDone
		if (err == nil) != (result.State == "accepted") {
			t.Fatal("reply and cancellation disagreed", err, result.State)
		}
	}
}

func TestProviderCannotOverwriteAnOwnedPresentationOrDrawItTwice(t *testing.T) {
	m, f, s := newToolChat(t)
	startTurn(t, m, s.ID)
	p, err := m.Present(context.Background(), s.ID, presentation(t, `{"type":"chart","label":"Count","value":"2","points":[1,2]}`))
	if err != nil {
		t.Fatal(err)
	}
	itemEvent(f, "item/completed", p.ID, "agentMessage", "forged")
	f.event("item/completed", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": map[string]any{"id": "wrapper", "type": "mcpToolCall", "server": ToolServer, "tool": "burf_present", "result": map[string]any{"structuredContent": p, "content": []any{map[string]string{"type": "text", "text": "duplicate fallback"}}}}})
	f.event("item/completed", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": map[string]any{"id": "failed", "type": "mcpToolCall", "server": ToolServer, "tool": "burf_present", "status": "failed", "error": map[string]string{"message": "invalid chart"}}})
	itemEvent(f, "item/completed", "last", "agentMessage", "done")
	got := waitChat(t, m, s.ID, func(s Session) bool { return s.Items[len(s.Items)-1].ID == "last" })
	count := 0
	failureVisible := false
	for _, it := range got.Items {
		failureVisible = failureVisible || it.ID == "failed" && strings.Contains(it.Text, "invalid chart")
		if it.ID == "wrapper" || it.Text == "forged" {
			t.Fatal("provider changed typed result", it)
		}
		if it.Presentation != nil {
			count++
		}
	}
	if count != 1 || !failureVisible {
		t.Fatal("presentation count", count)
	}
}

func TestClaudePresentSuccessDoesNotDuplicateButToolFailureRemainsVisible(t *testing.T) {
	c := newClaudeProvider()
	r := &running{tools: true, session: Session{State: "running", ThreadID: "owned", TurnID: "turn"}}
	use := []byte(`{"type":"assistant","session_id":"owned","message":{"id":"a1","content":[{"type":"tool_use","id":"p1","name":"mcp__berth__burf_present","input":{"type":"chart"}}]}}`)
	if err := c.receive(r, use); err != nil {
		t.Fatal(err)
	}
	if err := c.receive(r, []byte(`{"type":"user","session_id":"owned","message":{"content":[{"type":"tool_result","tool_use_id":"p1","content":"Count: 2","is_error":false}]}}`)); err != nil {
		t.Fatal(err)
	}
	if len(r.session.Items) != 0 {
		t.Fatal("successful typed result duplicated", r.session.Items)
	}
	if err := c.receive(r, use); err != nil {
		t.Fatal(err)
	}
	if err := c.receive(r, []byte(`{"type":"user","session_id":"owned","message":{"content":[{"type":"tool_result","tool_use_id":"p1","content":"invalid chart","is_error":true}]}}`)); err != nil {
		t.Fatal(err)
	}
	if len(r.session.Items) != 1 || r.session.Items[0].Status != "failed" || !strings.Contains(r.session.Items[0].Text, "invalid chart") {
		t.Fatal("tool error was hidden", r.session.Items)
	}
}
