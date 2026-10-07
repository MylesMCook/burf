package agent

import (
	"context"
	"io"
	"strings"
	"sync"
	"testing"
	"time"
)

// A box's output, as lines written now and then into a pipe.
type sent struct {
	mu   sync.Mutex
	msgs []string
}

func (s *sent) send(b []byte) error {
	s.mu.Lock()
	s.msgs = append(s.msgs, string(b))
	s.mu.Unlock()
	return nil
}

func (s *sent) all() (int, string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.msgs), strings.Join(s.msgs, "")
}

func startPaced(t *testing.T) (*pacedOutput, *io.PipeWriter, *sent, chan error) {
	t.Helper()
	r, w := io.Pipe()
	p := newPacedOutput()
	s := &sent{}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go p.read(ctx, r)
	done := make(chan error, 1)
	go func() { done <- p.write(ctx, s.send) }()
	return p, w, s, done
}

func TestShownOutputGoesAsItComes(t *testing.T) {
	_, w, s, _ := startPaced(t)
	for i := 0; i < 5; i++ {
		w.Write([]byte("line\n"))
		time.Sleep(10 * time.Millisecond)
	}
	waitUntil(t, func() bool { _, all := s.all(); return all == strings.Repeat("line\n", 5) })
	if n, _ := s.all(); n < 3 {
		t.Fatalf("shown output was held back: %d messages for 5 lines 10ms apart", n)
	}
}

func TestHiddenOutputGoesOncePerPaceAndCatchesUpWhenShown(t *testing.T) {
	p, w, s, _ := startPaced(t)
	p.setPace(300)
	for i := 0; i < 20; i++ {
		w.Write([]byte("x"))
		time.Sleep(10 * time.Millisecond)
	}
	// 200ms of output: at most one message yet (the first pace ends at 300ms).
	if n, _ := s.all(); n > 1 {
		t.Fatalf("hidden output sent %d messages in 200ms", n)
	}
	w.Write([]byte("!"))
	p.setPace(0)
	waitUntil(t, func() bool { _, all := s.all(); return all == strings.Repeat("x", 20)+"!" })
	if n, _ := s.all(); n > 2 {
		t.Fatalf("%d messages: shown again, what waited should go at once", n)
	}
}

func TestALotOfHiddenOutputGoesWithoutWaitingForThePace(t *testing.T) {
	p, w, s, _ := startPaced(t)
	p.setPace(int(maxPace / time.Millisecond))
	big := strings.Repeat("y", flushAt+1)
	go w.Write([]byte(big))
	waitUntil(t, func() bool { _, all := s.all(); return len(all) == len(big) })
}

func TestTheEndOfOutputIsSentAndEndsTheRelay(t *testing.T) {
	p, w, s, done := startPaced(t)
	p.setPace(2000)
	w.Write([]byte("bye"))
	w.Close()
	select {
	case err := <-done:
		if err != io.EOF {
			t.Fatalf("ended with %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("the relay didn't end with the output")
	}
	if _, all := s.all(); all != "bye" {
		t.Fatalf("sent %q", all)
	}
}

func waitUntil(t *testing.T, ok func() bool) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for !ok() {
		if time.Now().After(deadline) {
			t.Fatal("timed out")
		}
		time.Sleep(5 * time.Millisecond)
	}
}
