package agent

import (
	"context"
	"io"
	"sync"
	"time"
)

// A terminal's output to the app, at a pace the app sets. Shown, a terminal
// gets each read from the box as it comes (pace 0), whatever has piled up
// since the last write in one message. Hidden (its tab in the background,
// the window minimised), the app asks for a pace, {"type":"pace","ms":1000}:
// output is gathered and sent once a pace, or as soon as a lot has gathered,
// so a noisy program in a hidden tab costs the app one message a second
// rather than one per line. Showing it again (pace 0) sends what waits at
// once. Nothing is dropped, and the box is never held up: past maxPending
// bytes the reader waits for the writer, as it waited for each write before.

const (
	// The most a hidden terminal waits.
	maxPace = 5 * time.Second
	// Past this much waiting, it goes now, paced or not.
	flushAt = 256 << 10
	// Past this much, reading from the box waits for the app to take it.
	maxPending = 4 << 20
)

type pacedOutput struct {
	mu      sync.Mutex
	cond    *sync.Cond
	pending []byte
	pace    time.Duration
	ended   error
	// wake: something to write; hurry: write now, whatever the pace.
	wake, hurry chan struct{}
}

func newPacedOutput() *pacedOutput {
	p := &pacedOutput{wake: make(chan struct{}, 1), hurry: make(chan struct{}, 1)}
	p.cond = sync.NewCond(&p.mu)
	return p
}

func signal(c chan struct{}) {
	select {
	case c <- struct{}{}:
	default:
	}
}

// setPace sets the wait between writes; 0 writes as output comes.
func (p *pacedOutput) setPace(ms int) {
	d := min(max(time.Duration(ms)*time.Millisecond, 0), maxPace)
	p.mu.Lock()
	p.pace = d
	p.mu.Unlock()
	if d == 0 {
		signal(p.hurry)
	}
}

// read copies the box's output in until it ends.
func (p *pacedOutput) read(ctx context.Context, src io.Reader) {
	buf := make([]byte, 32<<10)
	for {
		n, err := src.Read(buf)
		p.mu.Lock()
		for len(p.pending) >= maxPending && ctx.Err() == nil {
			p.cond.Wait()
		}
		p.pending = append(p.pending, buf[:n]...)
		full := len(p.pending) >= flushAt
		if err != nil {
			p.ended = err
		}
		p.mu.Unlock()
		signal(p.wake)
		if full || err != nil {
			signal(p.hurry)
		}
		if err != nil || ctx.Err() != nil {
			return
		}
	}
}

// resume lets write carry on after the output it was reading ended, for
// the output of another attach to the same terminal.
func (p *pacedOutput) resume() {
	p.mu.Lock()
	p.ended = nil
	p.mu.Unlock()
}

// write sends output with send at the pace, until the output ends (its
// error) or ctx does.
func (p *pacedOutput) write(ctx context.Context, send func([]byte) error) error {
	stop := context.AfterFunc(ctx, func() {
		p.mu.Lock()
		p.cond.Broadcast()
		p.mu.Unlock()
	})
	defer stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-p.wake:
		}
		p.mu.Lock()
		pace := p.pace
		p.mu.Unlock()
		if pace > 0 {
			t := time.NewTimer(pace)
			select {
			case <-ctx.Done():
				t.Stop()
				return ctx.Err()
			case <-t.C:
			case <-p.hurry:
				t.Stop()
			}
		}
		p.mu.Lock()
		out, ended := p.pending, p.ended
		p.pending = nil
		p.cond.Broadcast()
		p.mu.Unlock()
		if len(out) > 0 {
			if err := send(out); err != nil {
				return err
			}
		}
		if ended != nil {
			return ended
		}
	}
}
