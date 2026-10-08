package agent

import (
	"sync"
	"time"
)

// A terminal whose route is declared down (boxroutes.go) ends, and the app
// attaches again, now over another route, sending the keys typed while it
// was away (terminal-view.tsx holds them). Keys typed just before, into the
// stream on the route that was going down, may never have reached the box:
// the agent keeps those for the next attach and sends them first.
//
// A key counts as delivered once something written after it came back: a
// ping on the same route sent after it (wire.Client.RouteState), or output
// from the terminal itself. Only the keys after both are kept.

const (
	// Keys older than this aren't sent again: the person has moved on.
	heldKeysFor = 30 * time.Second
	// Nor more than this many bytes of them.
	heldKeysMax = 4 << 10
)

type keyEntry struct {
	at   time.Time
	data []byte
}

// keyJournal is what a terminal's attach typed recently and when it last
// heard from the box.
type keyJournal struct {
	mu    sync.Mutex
	keys  []keyEntry
	bytes int
	heard time.Time
	// sealed: the stream ended; keys from now are kept, not sent.
	sealed bool
	late   []byte
}

// typed records keys about to be written, and says whether to write them:
// once the stream has ended they are kept for the next attach instead.
func (j *keyJournal) typed(b []byte) bool {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.sealed {
		if len(j.late)+len(b) <= heldKeysMax {
			j.late = append(j.late, b...)
		}
		return false
	}
	now := time.Now()
	j.keys = append(j.keys, keyEntry{at: now, data: append([]byte(nil), b...)})
	j.bytes += len(b)
	for len(j.keys) > 0 && (j.bytes > heldKeysMax || now.Sub(j.keys[0].at) > heldKeysFor) {
		j.bytes -= len(j.keys[0].data)
		j.keys = j.keys[1:]
	}
	return true
}

// output notes that the box wrote to the terminal.
func (j *keyJournal) output() {
	j.mu.Lock()
	j.heard = time.Now()
	j.mu.Unlock()
}

// seal ends the journal: it keeps the keys typed after confirmed and after
// the box last wrote, and any typed from now on, for unsent.
func (j *keyJournal) seal(confirmed time.Time) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.sealed = true
	after := confirmed
	if j.heard.After(after) {
		after = j.heard
	}
	for _, k := range j.keys {
		if k.at.After(after) && time.Since(k.at) < heldKeysFor {
			j.late = append(j.late, k.data...)
		}
	}
	// Those were the earliest; anything typed since sealing follows.
	j.keys = nil
}

// unsent is what seal kept, in the order it was typed.
func (j *keyJournal) unsent() []byte {
	j.mu.Lock()
	defer j.mu.Unlock()
	return append([]byte(nil), j.late...)
}

// heldKeys are keys waiting for a terminal's next attach, by box and
// session.
type heldKeys struct {
	mu   sync.Mutex
	keys map[string]keyEntry
}

func (h *heldKeys) put(box, session string, b []byte) {
	if len(b) == 0 {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.keys == nil {
		h.keys = map[string]keyEntry{}
	}
	h.keys[box+"\x00"+session] = keyEntry{at: time.Now(), data: b}
}

// take returns and forgets the keys held for a terminal, if they are
// recent enough to send.
func (h *heldKeys) take(box, session string) []byte {
	h.mu.Lock()
	defer h.mu.Unlock()
	k, ok := h.keys[box+"\x00"+session]
	delete(h.keys, box+"\x00"+session)
	if !ok || time.Since(k.at) > heldKeysFor {
		return nil
	}
	return k.data
}
