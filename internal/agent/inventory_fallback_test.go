package agent

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/inventory"
)

func TestInventoryExplicitSSHFallbackPreservesUnavailableChats(t *testing.T) {
	ctx := context.Background()
	s, err := inventory.Open(ctx, filepath.Join(t.TempDir(), "inventory.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	m, err := s.Register(ctx, inventory.Machine{Name: "Lab", OS: "linux", Routes: []inventory.Route{{Kind: "paired", Target: "old-peer"}, {Kind: "ssh", Target: "lab"}}})
	if err != nil {
		t.Fatal(err)
	}
	at := time.Now().Add(-time.Minute)
	if err = s.Apply(ctx, m.ID, []inventory.Collection{{Coverage: inventory.Coverage{Source: "burf-chats", State: "ok", At: at}, Services: []inventory.Service{{Source: "burf-chats", Key: "chat-one", Name: "Codex agent", State: "running", Ports: []int{}}}}}, at); err != nil {
		t.Fatal(err)
	}
	called := false
	a := &Agent{inventory: &machineInventory{store: s, collect: func(_ context.Context, goos, target string) []inventory.Collection {
		called = true
		if goos != "linux" || target != "lab" {
			t.Fatal(goos, target)
		}
		return []inventory.Collection{{Coverage: inventory.Coverage{Source: "docker", State: "ok", At: time.Now()}, Services: []inventory.Service{{Source: "docker", Key: "container-one", Name: "Web", State: "running", Ports: []int{3000}}}}}
	}}}
	collections, err := a.collectMachine(ctx, m)
	if err != nil || !called {
		t.Fatal(called, err)
	}
	if err = s.Apply(ctx, m.ID, collections, time.Now()); err != nil {
		t.Fatal(err)
	}
	snapshot, err := s.Snapshot(ctx, m.ID)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, c := range snapshot.Coverage {
		if c.Source == "burf-chats" {
			found = c.State == "unavailable"
		}
	}
	if !found {
		t.Fatal("fallback claims daemon chat coverage")
	}
	for _, row := range snapshot.Services {
		if row.Source == "burf-chats" && (row.State != "running" || !row.ObservedAt.Equal(at.UTC())) {
			t.Fatal("fallback changed unseen chat", row)
		}
	}
}

func TestInventoryFailedSSHProbeMarksEveryPriorSourceStale(t *testing.T) {
	ctx := context.Background()
	s, err := inventory.Open(ctx, filepath.Join(t.TempDir(), "inventory.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	m, err := s.Register(ctx, inventory.Machine{Name: "Lab", Routes: []inventory.Route{{Kind: "ssh", Target: "lab"}}})
	if err != nil {
		t.Fatal(err)
	}
	before := time.Now().UTC().Add(-time.Minute)
	if err = s.Apply(ctx, m.ID, []inventory.Collection{{Coverage: inventory.Coverage{Source: "docker", State: "ok", At: before}, Services: []inventory.Service{{Source: "docker", Key: "web", Name: "Web", State: "running", Ports: []int{}}}}}, before); err != nil {
		t.Fatal(err)
	}
	a := &Agent{inventory: &machineInventory{store: s, collect: func(context.Context, string, string) []inventory.Collection {
		return []inventory.Collection{{Coverage: inventory.Coverage{Source: "ssh", State: "error", At: time.Now()}}}
	}}}
	e := inventory.NewEngine(ctx, s, a.collectMachine)
	defer e.Close()
	snapshot, err := e.Refresh(ctx, m.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range snapshot.Coverage {
		if c.State != "error" {
			t.Fatal("disconnected source still current", c)
		}
	}
	if len(snapshot.Services) != 1 || snapshot.Services[0].State != "running" || !snapshot.Services[0].ObservedAt.Equal(before) {
		t.Fatal("connection failure changed service", snapshot)
	}
}
