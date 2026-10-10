//go:build darwin && cgo

package nativebrowser

import (
	"strings"
	"testing"
	"time"
)

func TestMacDiagnosticsStayBoundedAndUseKnownKinds(t *testing.T) {
	v := &darwinView{events: make(chan macEvent, 4)}
	for _, e := range []macEvent{
		{kind: 2, data: "not JSON"},
		{kind: 2, data: `"` + strings.Repeat("a", macMaxDiagnosticBytes) + `"`},
		{kind: 1, data: "berth-pick://other?d=%7B%7D"},
		{kind: 1, data: "berth-pick://pick?d=not-json"},
		{kind: 0, data: "https://example.com", state: "page-controlled-state"},
		{kind: 9, data: `{}`},
	} {
		v.queueEvent(e.kind, e.data, e.state)
	}
	if len(v.events) != 0 {
		t.Fatal("invalid remote diagnostics reached the app event queue")
	}
	v.queueEvent(2, `{"v":1,"id":"untrusted-page-id","entries":[]}`, "")
	v.queueEvent(1, "berth-pick://pick?d=%7B%22tag%22%3A%22button%22%7D", "")
	if len(v.events) != 2 {
		t.Fatal("valid console and picker reports were discarded")
	}
	v.closed.Store(true)
	v.queueEvent(0, "https://example.com", "finished")
	if len(v.events) != 2 {
		t.Fatal("a closed pane accepted a late native event")
	}
}

func TestMacRemoteJSONCannotChooseTheEventPane(t *testing.T) {
	emitted := make(chan ConsoleEvent, 1)
	v := &darwinView{
		id: "owned-pane", stop: make(chan struct{}), events: make(chan macEvent, 4),
		driver: &darwinDriver{config: Config{Emit: func(name string, payload any) {
			if name != "berth://browser-console" {
				t.Errorf("event name = %q", name)
				return
			}
			emitted <- payload.(ConsoleEvent)
		}}},
	}
	go v.emitEvents()
	defer close(v.stop)
	v.queueEvent(2, `{"id":"another-pane","entries":[]}`, "")
	select {
	case got := <-emitted:
		if got.ID != "owned-pane" {
			t.Fatalf("remote JSON chose pane %q", got.ID)
		}
	case <-time.After(time.Second):
		t.Fatal("console event was not emitted")
	}
}

func TestMacLateEvaluationCannotCompleteANewerRequest(t *testing.T) {
	newer := make(chan macEvaluation, 1)
	v := &darwinView{pending: map[uint64]chan macEvaluation{2: newer}}
	// Request 1 was cancelled and its waiter removed while WebKit ran.
	v.finishEvaluation(1, macEvaluation{json: `"stale"`})
	select {
	case <-newer:
		t.Fatal("a late result completed a different request")
	default:
	}
	v.finishEvaluation(2, macEvaluation{json: `"current"`})
	if got := <-newer; got.json != `"current"` || got.err != nil {
		t.Fatalf("current result = %#v", got)
	}
	if len(v.pending) != 0 {
		t.Fatal("completed evaluations retained waiters")
	}
	// Duplicate WebKit completions are ignored rather than blocking Cocoa.
	v.finishEvaluation(2, macEvaluation{json: `"duplicate"`})
}
