package agent

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/cosscom/shipyard/internal/statefile"
)

// seqStore keeps the last event Seq seen from each box across restarts of
// the agent, so after one the relay asks each box's journal for what it
// missed instead of starting from now. An entry belongs to the box's key:
// a box re-installed under the same name starts over.
type seqStore struct {
	path string
	mu   sync.Mutex
	m    map[string]seqEntry
	// dirty since the last save
	dirty bool
}

type seqEntry struct {
	Fingerprint string    `json:"fingerprint"`
	Seq         int64     `json:"seq"`
	At          time.Time `json:"at"`
}

// seqMaxAge is how old a saved Seq may be and still be caught up from:
// older, the notifications it would replay are no longer news.
const seqMaxAge = 24 * time.Hour

func newSeqStore(dir string) *seqStore {
	s := &seqStore{path: filepath.Join(dir, "event-seqs.json"), m: map[string]seqEntry{}}
	if b, err := os.ReadFile(s.path); err == nil {
		json.Unmarshal(b, &s.m)
	}
	return s
}

// get returns the Seq to resume box from, or -1 for live.
func (s *seqStore) get(box, fingerprint string) int64 {
	if s == nil {
		return -1
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.m[box]
	if !ok || e.Fingerprint != fingerprint || time.Since(e.At) > seqMaxAge {
		return -1
	}
	return e.Seq
}

func (s *seqStore) set(box, fingerprint string, seq int64) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.m[box] = seqEntry{Fingerprint: fingerprint, Seq: seq, At: time.Now().UTC()}
	s.dirty = true
}

// save writes the file when something changed.
func (s *seqStore) save() {
	if s == nil {
		return
	}
	s.mu.Lock()
	if !s.dirty {
		s.mu.Unlock()
		return
	}
	b, err := json.Marshal(s.m)
	s.dirty = false
	s.mu.Unlock()
	if err == nil {
		statefile.Write(s.path, b)
	}
}
