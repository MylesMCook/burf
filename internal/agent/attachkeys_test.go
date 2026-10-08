package agent

import (
	"testing"
	"time"
)

// Keys followed by output, or by a ping that came back on their route,
// reached the box; only the ones after both are sent again, with any
// typed after the stream ended.
func TestOnlyKeysTheBoxMayNotHaveGotAreKept(t *testing.T) {
	j := &keyJournal{}
	j.typed([]byte("a"))
	j.output()
	time.Sleep(2 * time.Millisecond)
	j.typed([]byte("b"))
	confirmed := time.Now()
	time.Sleep(2 * time.Millisecond)
	j.typed([]byte("c"))
	j.typed([]byte("d"))
	j.seal(confirmed)
	if j.typed([]byte("e")) {
		t.Fatal("a key typed after the stream ended was to be written to it")
	}
	if got := string(j.unsent()); got != "cde" {
		t.Fatalf("unsent %q, want cde", got)
	}
}

func TestHeldKeysGoToTheNextAttachOfTheSameTerminalOnce(t *testing.T) {
	var h heldKeys
	h.put("devl", "fix", []byte("ls\r"))
	if got := h.take("devl", "other"); got != nil {
		t.Fatalf("another terminal got %q", got)
	}
	if got := string(h.take("devl", "fix")); got != "ls\r" {
		t.Fatalf("take %q", got)
	}
	if got := h.take("devl", "fix"); got != nil {
		t.Fatalf("taken twice: %q", got)
	}
}
