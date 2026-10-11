package inventory

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

func TestEngineSchedulesMachinesIndependentlyAtTheirDeadline(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	s, err := Open(ctx, filepath.Join(t.TempDir(), "inventory.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	slow, err := s.Register(ctx, Machine{Name: "Slow", Routes: []Route{{Kind: "ssh", Target: "slow"}}})
	if err != nil {
		t.Fatal(err)
	}
	fast, err := s.Register(ctx, Machine{Name: "Fast", Routes: []Route{{Kind: "ssh", Target: "fast"}}})
	if err != nil {
		t.Fatal(err)
	}
	observed := make(chan struct{}, 2)
	e := NewEngine(ctx, s, func(ctx context.Context, m Machine) ([]Collection, error) {
		if m.ID == slow.ID {
			<-ctx.Done()
			return nil, ctx.Err()
		}
		observed <- struct{}{}
		return []Collection{{Coverage: Coverage{Source: "synthetic", State: "ok", At: time.Now()}}}, nil
	})
	defer e.Close()
	e.Start()
	select {
	case <-observed:
	case <-ctx.Done():
		t.Fatal("slow machine blocked other inventory")
	}
	// Set a near deadline while the slow machine remains blocked; fixed minute tickers miss it.
	e.mu.Lock()
	job := e.jobs[fast.ID]
	e.mu.Unlock()
	if job != nil {
		select {
		case <-job.done:
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		}
	}
	e.mu.Lock()
	e.next[fast.ID] = time.Now().Add(5 * time.Millisecond)
	e.mu.Unlock()
	select {
	case e.wake <- struct{}{}:
	default:
	}
	select {
	case <-observed:
	case <-ctx.Done():
		t.Fatal("machine deadline was ignored")
	}
}
