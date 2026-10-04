package agent

import (
	"testing"
)

func TestTheLastSeqSeenSurvivesARestart(t *testing.T) {
	dir := t.TempDir()
	s := newSeqStore(dir)
	if got := s.get("devl", "fp1"); got != -1 {
		t.Fatalf("a box never seen starts live, got %d", got)
	}
	s.set("devl", "fp1", 4242)
	s.save()
	s2 := newSeqStore(dir)
	if got := s2.get("devl", "fp1"); got != 4242 {
		t.Fatalf("after a restart: %d", got)
	}
	// Another box under the same name starts over.
	if got := s2.get("devl", "fp2"); got != -1 {
		t.Fatalf("a different box got %d", got)
	}
}
