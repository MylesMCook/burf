package inventory

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"
)

func TestStoreRoutesUniqueAndExplicitAttachmentMovesCache(t *testing.T) {
	ctx := context.Background()
	s, _, target := openTestStore(t)
	targetRoutes := []Route{{Kind: "local"}, {Kind: "ssh", Target: "target-host"}}
	if err := s.SetRoutes(ctx, target.ID, targetRoutes); err != nil {
		t.Fatal(err)
	}
	owner, err := s.Register(ctx, Machine{Name: "Same name", OS: "linux", Routes: []Route{{Kind: "paired", Target: "daemon-id"}}})
	if err != nil {
		t.Fatal(err)
	}
	duplicate := Machine{Name: "Same name", Routes: []Route{{Kind: "paired", Target: "daemon-id"}}}
	if _, err := s.Register(ctx, duplicate); err == nil {
		t.Fatal("duplicate route registered")
	}
	if err := s.SetRoutes(ctx, target.ID, owner.Routes); err == nil {
		t.Fatal("SetRoutes stole another owner's route")
	}
	at := time.Now().UTC().Add(-3 * time.Minute).Truncate(time.Millisecond)
	running := normalizeService(container("running"), "remote", at)
	stopped := running
	stopped.State = "stopped"
	stopped.ObservedAt = at.Add(time.Minute)
	snapshot := func(v Service) Snapshot {
		return Snapshot{Services: []Service{v}, Coverage: []Coverage{{Source: "docker", State: "ok", At: v.ObservedAt}}, At: v.ObservedAt}
	}
	first := Change{ID: 7, MachineID: "remote", ServiceID: running.ID, At: at, After: running}
	if err := s.Import(ctx, owner.ID, "daemon-id", snapshot(running), []Change{first}); err != nil {
		t.Fatal(err)
	}
	second := Change{ID: 8, MachineID: "remote", ServiceID: running.ID, At: stopped.ObservedAt, Before: &running, After: stopped}
	if err := s.Import(ctx, owner.ID, "daemon-id", snapshot(stopped), []Change{second}); err != nil {
		t.Fatal(err)
	}
	newer := stopped
	newer.PID = 888
	newer.ObservedAt = at.Add(2 * time.Minute)
	if err := s.Import(ctx, target.ID, "daemon-id", snapshot(newer), []Change{first}); err != nil {
		t.Fatal(err)
	}
	desired := append(targetRoutes, owner.Routes...)
	if err := s.AttachRoutes(ctx, target.ID, desired); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Machine(ctx, owner.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("merged owner remains: %v", err)
	}
	got, err := s.Snapshot(ctx, target.ID)
	if err != nil || !reflect.DeepEqual(got.Machine.Routes, desired) || len(got.Services) != 1 || got.Services[0].PID != 888 {
		t.Fatalf("merged snapshot %#v %v", got, err)
	}
	history, err := s.History(ctx, target.ID, "", 0, 100)
	if err != nil || len(history) != 2 {
		t.Fatalf("merged history %#v %v", history, err)
	}
	for _, c := range history {
		if c.MachineID != target.ID || c.ServiceID != got.Services[0].ID || c.After.MachineID != target.ID || (c.Before != nil && c.Before.MachineID != target.ID) {
			t.Fatal("history identities not remapped")
		}
	}
	seq, err := s.Cursor(ctx, target.ID, "daemon-id")
	if err != nil || seq != 8 {
		t.Fatalf("merged cursor %d %v", seq, err)
	}
	if _, err := s.Register(ctx, duplicate); err == nil {
		t.Fatal("route ownership uniqueness lost after attachment")
	}
	if _, err := s.Register(ctx, Machine{Name: "invalid OS", OS: "other"}); err == nil {
		t.Fatal("invalid OS accepted")
	}
}
func TestStoreRouteAttachmentPreservesOwnerWithOtherRoutes(t *testing.T) {
	ctx := context.Background()
	s, _, target := openTestStore(t)
	first := Route{Kind: "paired", Target: "daemon-id"}
	remaining := Route{Kind: "ssh", Target: "other-host"}
	owner, err := s.Register(ctx, Machine{Name: "owner", Routes: []Route{first, remaining}})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Apply(ctx, owner.ID, scan("ok", container("running")), time.Now()); err != nil {
		t.Fatal(err)
	}
	if err := s.AttachRoutes(ctx, target.ID, []Route{{Kind: "local"}, first}); err != nil {
		t.Fatal(err)
	}
	kept, err := s.Snapshot(ctx, owner.ID)
	if err != nil || !reflect.DeepEqual(kept.Machine.Routes, []Route{remaining}) || len(kept.Services) != 1 {
		t.Fatalf("remaining owner changed: %#v %v", kept, err)
	}
	got, err := s.Snapshot(ctx, target.ID)
	if err != nil || len(got.Services) != 0 {
		t.Fatal("cache moved from machine that still has a route")
	}
}
func TestStoreRouteAttachmentFailureRollsBackRouteAndCache(t *testing.T) {
	ctx := context.Background()
	s, _, target := openTestStore(t)
	route := Route{Kind: "paired", Target: "daemon-id"}
	owner, err := s.Register(ctx, Machine{Name: "owner", Routes: []Route{route}})
	if err != nil {
		t.Fatal(err)
	}
	at := time.Now().UTC()
	service := normalizeService(container("running"), "remote", at)
	remote := Snapshot{Services: []Service{service}, Coverage: []Coverage{{Source: "docker", State: "ok", At: at}}, At: at}
	if err := s.Import(ctx, owner.ID, "daemon-id", remote, []Change{{ID: 7, At: at, After: service}}); err != nil {
		t.Fatal(err)
	}
	before, err := s.Snapshot(ctx, owner.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.ExecContext(ctx, `CREATE TRIGGER reject_transfer BEFORE INSERT ON machine_routes WHEN NEW.kind='paired' BEGIN SELECT RAISE(ABORT, 'synthetic transfer failure'); END`); err != nil {
		t.Fatal(err)
	}
	if err := s.AttachRoutes(ctx, target.ID, []Route{{Kind: "local"}, route}); err == nil {
		t.Fatal("transfer failure did not occur")
	}
	after, err := s.Snapshot(ctx, owner.ID)
	if err != nil || !reflect.DeepEqual(before, after) {
		t.Fatalf("failed transfer changed owner %#v %v", after, err)
	}
	targetAfter, err := s.Snapshot(ctx, target.ID)
	if err != nil || len(targetAfter.Services) != 0 || !reflect.DeepEqual(targetAfter.Machine.Routes, target.Routes) {
		t.Fatal("failed transfer changed target")
	}
	history, err := s.History(ctx, owner.ID, "", 0, 100)
	if err != nil || len(history) != 1 {
		t.Fatal("failed transfer lost original history")
	}
	ownerCursor, err := s.Cursor(ctx, owner.ID, "daemon-id")
	if err != nil || ownerCursor != 7 {
		t.Fatal("failed transfer changed original cursor")
	}
	targetCursor, err := s.Cursor(ctx, target.ID, "daemon-id")
	if err != nil || targetCursor != 0 {
		t.Fatal("failed transfer changed target cursor")
	}
	if _, err := s.Register(ctx, Machine{Name: "duplicate", Routes: []Route{route}}); err == nil {
		t.Fatal("failed transfer lost route ownership")
	}
}
