package localchat

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestOnlyPublicReasoningSummaryReachesTheChat(t *testing.T) {
	m, f, s := newTestChat(t)
	startTurn(t, m, s.ID)
	f.event("item/completed", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "item": map[string]any{"id": "summary", "type": "reasoning", "summary": []string{"Comparing the requested choices."}, "content": []string{"private raw reasoning"}, "encryptedContent": "private ciphertext"}})
	// A subsequent ordinary item establishes the event has been processed.
	itemEvent(f, "item/completed", "reply", "agentMessage", "Done.")
	got := waitChat(t, m, s.ID, func(s Session) bool {
		for _, it := range s.Items {
			if it.ID == "reply" {
				return true
			}
		}
		return false
	})
	found := false
	for _, it := range got.Items {
		if it.ID == "summary" {
			found = it.Kind == "reasoning" && it.Text == "Comparing the requested choices."
		}
		if strings.Contains(it.Text, "private") {
			t.Fatal("private reasoning escaped", it)
		}
	}
	if !found {
		t.Fatal("public summary is missing", got.Items)
	}
}

func TestReasoningStreamsPublicSummaryOnlyWithinItsTurn(t *testing.T) {
	m, f, s := newTestChat(t)
	startTurn(t, m, s.ID)
	f.event("item/reasoning/summaryTextDelta", map[string]any{"threadId": "owned-thread", "turnId": "foreign", "itemId": "summary", "summaryIndex": 0, "delta": "foreign"})
	f.event("item/reasoning/textDelta", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "itemId": "summary", "delta": "raw private reasoning"})
	f.event("item/reasoning/summaryTextDelta", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "itemId": "summary", "summaryIndex": 0, "delta": "Compare "})
	f.event("item/reasoning/summaryTextDelta", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "itemId": "summary", "summaryIndex": 0, "delta": "the choices."})
	f.event("item/reasoning/summaryTextDelta", map[string]any{"threadId": "owned-thread", "turnId": "turn-1", "itemId": "summary", "summaryIndex": 1, "delta": "Check the result."})
	got := waitChat(t, m, s.ID, func(s Session) bool {
		for _, it := range s.Items {
			if it.ID == "summary" && it.Text == "Compare the choices.\n\nCheck the result." {
				return true
			}
		}
		return false
	})
	raw, _ := json.Marshal(got)
	if strings.Contains(string(raw), "private") || strings.Contains(string(raw), "foreign") {
		t.Fatal(string(raw))
	}
}
