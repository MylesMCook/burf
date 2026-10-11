package inventory

import (
	"context"
	"errors"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"
)

func TestEngineCoalescesAndRetainsOnDisconnect(t *testing.T) {
	ctx := context.Background()
	s, err := Open(ctx, filepath.Join(t.TempDir(), "inventory.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	m, err := s.Register(ctx, Machine{Name: "Lab", Routes: []Route{{Kind: "ssh", Target: "lab"}}})
	if err != nil {
		t.Fatal(err)
	}
	started, release := make(chan struct{}), make(chan struct{})
	var calls atomic.Int32
	e := NewEngine(ctx, s, func(ctx context.Context, _ Machine) ([]Collection, error) {
		if calls.Add(1) == 1 {
			close(started)
			select {
			case <-release:
			case <-ctx.Done():
				return nil, ctx.Err()
			}
			return []Collection{{Coverage: Coverage{Source: "docker", State: "ok", At: time.Now()}, Services: []Service{{Key: "container-one", Source: "docker", Name: "Web", State: "running", Ports: []int{3000}}}}, {Coverage: Coverage{Source: "connection", State: "ok", At: time.Now()}}}, nil
		}
		return nil, errors.New("unreachable")
	})
	defer e.Close()
	done := make(chan error, 2)
	go func() { _, err := e.Refresh(ctx, m.ID); done <- err }()
	<-started
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := e.Refresh(cancelled, m.ID); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	if calls.Load() != 1 {
		t.Fatal("duplicate collector")
	}
	close(release)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	before, _ := s.Snapshot(ctx, m.ID)
	after, err := e.Refresh(ctx, m.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(after.Services) != 1 || after.Services[0].State != "running" || !after.Services[0].ObservedAt.Equal(before.Services[0].ObservedAt) {
		t.Fatal(after)
	}
	if len(after.Coverage) < 2 {
		t.Fatal("disconnect did not mark coverage")
	}
	for _, c := range after.Coverage {
		if c.Source == "connection" && c.State != "error" {
			t.Fatal("connection remained fresh", c)
		}
	}
	e.mu.Lock()
	delay := time.Until(e.next[m.ID])
	e.mu.Unlock()
	if delay < time.Minute {
		t.Fatal("no failure backoff")
	}
}

func TestEngineCloseCancelsCollectors(t *testing.T) {
	s, err := Open(context.Background(), filepath.Join(t.TempDir(), "inventory.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	m, err := s.Register(context.Background(), Machine{Name: "Lab", Routes: []Route{{Kind: "ssh", Target: "lab"}}})
	if err != nil {
		t.Fatal(err)
	}
	started := make(chan struct{})
	e := NewEngine(context.Background(), s, func(ctx context.Context, _ Machine) ([]Collection, error) {
		close(started)
		<-ctx.Done()
		return nil, ctx.Err()
	})
	done := make(chan struct{})
	go func() { _, _ = e.Refresh(context.Background(), m.ID); close(done) }()
	<-started
	e.Close()
	<-done
	if _, err := e.Refresh(context.Background(), m.ID); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
}
