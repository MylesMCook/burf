package inventory

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"testing"
	"time"
)

func openTestStore(t *testing.T) (*Store, string, Machine) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "inventory", "inventory.db")
	s, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	m, err := s.Register(context.Background(), Machine{Name: "Test machine", Routes: []Route{{Kind: "local"}}})
	if err != nil {
		t.Fatal(err)
	}
	return s, path, m
}
func scan(state string, services ...Service) []Collection {
	return []Collection{{Coverage: Coverage{Source: "docker", State: state}, Services: services}}
}
func container(state string) Service {
	return Service{Key: "container-123", Source: "docker", Name: "web", State: state, Ports: []int{8080}, PID: 123}
}
func TestStoreRestartRoutesAndBackup(t *testing.T) {
	ctx := context.Background()
	s, path, m := openTestStore(t)
	at := time.Now().UTC()
	if err := s.Apply(ctx, m.ID, scan("ok", container("running")), at); err != nil {
		t.Fatal(err)
	}
	routes := []Route{{Kind: "ssh", Target: "test-host"}, {Kind: "paired", Target: "pair-123"}}
	if err := s.SetRoutes(ctx, m.ID, routes); err != nil {
		t.Fatal(err)
	}
	backup := filepath.Join(filepath.Dir(path), "backup.db")
	if err := s.Backup(ctx, backup); err != nil {
		t.Fatal(err)
	}
	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	s, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	got, err := s.Snapshot(ctx, m.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Services) != 1 || !reflect.DeepEqual(got.Machine.Routes, routes) {
		t.Fatalf("restart = %#v", got)
	}
	restored, err := Open(ctx, backup)
	if err != nil {
		t.Fatal(err)
	}
	defer restored.Close()
	saved, err := restored.Snapshot(ctx, m.ID)
	if err != nil || !reflect.DeepEqual(saved, got) {
		t.Fatalf("backup = %#v, %v", saved, err)
	}
	other, err := s.Register(ctx, Machine{Name: m.Name, Routes: []Route{{Kind: "ssh", Target: "another-host"}}})
	if err != nil || other.ID == m.ID {
		t.Fatalf("names merged: %#v %v", other, err)
	}
}
func TestStoreHistoryPartialDisappearanceAndGap(t *testing.T) {
	ctx := context.Background()
	s, _, m := openTestStore(t)
	at := time.Now().UTC().Truncate(time.Millisecond)
	apply := func(c []Collection, when time.Time) {
		t.Helper()
		if err := s.Apply(ctx, m.ID, c, when); err != nil {
			t.Fatal(err)
		}
	}
	apply(scan("ok", container("running")), at)
	apply(scan("ok", container("running")), at.Add(time.Minute))
	history, err := s.History(ctx, m.ID, "", 0, 100)
	if err != nil || len(history) != 1 {
		t.Fatalf("unchanged history %v %v", history, err)
	}
	apply(scan("error"), at.Add(2*time.Minute))
	apply(scan("partial"), at.Add(3*time.Minute))
	got, _ := s.Snapshot(ctx, m.ID)
	if got.Services[0].State != "running" || !got.Services[0].ObservedAt.Equal(at.Add(time.Minute)) {
		t.Fatalf("error changed observation %#v", got)
	}
	apply(scan("ok"), at.Add(4*time.Minute))
	history, _ = s.History(ctx, m.ID, "", 0, 100)
	if len(history) != 2 || history[1].After.State != "disappeared" || !history[1].Gap {
		t.Fatalf("missing disappearance/gap %#v", history)
	}
	apply(scan("ok"), at.Add(5*time.Minute))
	history, _ = s.History(ctx, m.ID, "", 0, 100)
	if len(history) != 2 {
		t.Fatal("repeat disappearance generated change")
	}
	service := container("running")
	service.PID = 999
	service.ProcessStarted = "new-process"
	apply(scan("ok", service), at.Add(6*time.Minute))
	got, _ = s.Snapshot(ctx, m.ID)
	if got.Services[0].ID != history[0].ServiceID {
		t.Fatal("PID changed service identity")
	}
}
func TestStoreInvalidScanAtomicRollbackAndRetention(t *testing.T) {
	ctx := context.Background()
	s, _, m := openTestStore(t)
	at := time.Now().UTC()
	if err := s.Apply(ctx, m.ID, scan("ok", container("running")), at.Add(-31*24*time.Hour)); err != nil {
		t.Fatal(err)
	}
	bad := container("invalid")
	if err := s.Apply(ctx, m.ID, scan("ok", container("stopped"), bad), at); err == nil {
		t.Fatal("invalid scan accepted")
	}
	got, _ := s.Snapshot(ctx, m.ID)
	if got.Services[0].State != "running" {
		t.Fatal("invalid scan partially committed")
	}
	if err := s.Apply(ctx, m.ID, scan("error"), at); err != nil {
		t.Fatal(err)
	}
	history, _ := s.History(ctx, m.ID, "", 0, 100)
	if len(history) != 0 {
		t.Fatal("history retained beyond 30 days")
	}
	got, _ = s.Snapshot(ctx, m.ID)
	if len(got.Services) != 1 {
		t.Fatal("retention removed latest")
	}
	if err := s.SetRoutes(ctx, m.ID, []Route{{Kind: "ssh", Target: "-oProxyCommand=bad"}}); err == nil {
		t.Fatal("SSH option accepted")
	}
	if err := s.Apply(ctx, "missing", scan("ok"), at); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing machine: %v", err)
	}
}
func TestStoreConcurrentAccessAndCanceledContext(t *testing.T) {
	ctx := context.Background()
	s, _, m := openTestStore(t)
	var wg sync.WaitGroup
	for i := range 12 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := s.Apply(ctx, m.ID, scan("ok", container("running")), time.Now().Add(time.Duration(i)*time.Second)); err != nil {
				t.Error(err)
			}
			if _, err := s.Snapshot(ctx, m.ID); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := s.Machines(canceled); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancel: %v", err)
	}
}
func TestStoreCorruptDatabasePreserved(t *testing.T) {
	path := filepath.Join(t.TempDir(), "bad.db")
	original := []byte("not a sqlite database")
	if err := os.WriteFile(path, original, 0600); err != nil {
		t.Fatal(err)
	}
	if s, err := Open(context.Background(), path); err == nil {
		s.Close()
		t.Fatal("corrupt database opened")
	}
	got, _ := os.ReadFile(path)
	if !reflect.DeepEqual(got, original) {
		t.Fatal("corrupt database replaced")
	}
}

func TestStoreImportDeduplicatesRemapsAndCommitsCursor(t *testing.T) {
	ctx := context.Background()
	s, _, m := openTestStore(t)
	at := time.Now().UTC().Truncate(time.Millisecond)
	remote := normalizeService(container("running"), "remote-id", at)
	change := Change{ID: 7, MachineID: "remote-id", ServiceID: remote.ID, At: at, After: remote}
	snapshot := Snapshot{Machine: Machine{ID: "remote-id"}, Services: []Service{remote}, Coverage: []Coverage{{Source: "docker", State: "ok", At: at}}, At: at}
	for range 2 {
		if err := s.Import(ctx, m.ID, "daemon-key", snapshot, []Change{change}); err != nil {
			t.Fatal(err)
		}
	}
	seq, err := s.Cursor(ctx, m.ID, "daemon-key")
	if err != nil || seq != 7 {
		t.Fatalf("cursor = %d %v", seq, err)
	}
	history, err := s.History(ctx, m.ID, "", 0, 100)
	if err != nil || len(history) != 1 {
		t.Fatalf("import duplicated history: %v %v", history, err)
	}
	latest, _ := s.Snapshot(ctx, m.ID)
	if history[0].ServiceID != latest.Services[0].ID || latest.Services[0].MachineID != m.ID || latest.Services[0].ID == remote.ID {
		t.Fatal("remote IDs not remapped")
	}
	snapshot.Services[0].State = "invalid"
	change.ID = 8
	if err := s.Import(ctx, m.ID, "daemon-key", snapshot, []Change{change}); err == nil {
		t.Fatal("invalid snapshot accepted")
	}
	seq, _ = s.Cursor(ctx, m.ID, "daemon-key")
	if seq != 7 {
		t.Fatal("failed import advanced cursor")
	}
}

func TestStoreNewerSchemaPreservesDatabase(t *testing.T) {
	ctx := context.Background()
	s, path, _ := openTestStore(t)
	if _, err := s.db.ExecContext(ctx, "PRAGMA user_version=2"); err != nil {
		t.Fatal(err)
	}
	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if other, err := Open(ctx, path); err == nil {
		other.Close()
		t.Fatal("newer schema opened")
	}
	after, err := os.ReadFile(path)
	if err != nil || !reflect.DeepEqual(before, after) {
		t.Fatal("newer schema bytes changed")
	}
}
func TestStoreMigrationRollsBackAllTables(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "inventory.db")
	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, "CREATE VIEW coverage AS SELECT 1"); err != nil {
		t.Fatal(err)
	}
	db.Close()
	if s, err := Open(ctx, path); err == nil {
		s.Close()
		t.Fatal("conflicting schema migrated")
	}
	db, err = sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var count, version int
	if err := db.QueryRowContext(ctx, "SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRowContext(ctx, "PRAGMA user_version").Scan(&version); err != nil {
		t.Fatal(err)
	}
	if count != 0 || version != 0 {
		t.Fatalf("migration partially committed: %d tables, version %d", count, version)
	}
}
func TestStoreCrossConnectionWriterLockAndRollback(t *testing.T) {
	ctx := context.Background()
	first, path, m := openTestStore(t)
	second, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close()
	if _, err := second.db.ExecContext(ctx, "PRAGMA busy_timeout=20"); err != nil {
		t.Fatal(err)
	}
	tx, err := first.db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := second.Apply(ctx, m.ID, scan("ok", container("running")), time.Now()); err == nil {
		tx.Rollback()
		t.Fatal("concurrent writer bypassed transaction lock")
	}
	if err := tx.Rollback(); err != nil {
		t.Fatal(err)
	}
	if err := second.Apply(ctx, m.ID, scan("ok", container("running")), time.Now()); err != nil {
		t.Fatal(err)
	}
	snapshot, err := first.Snapshot(ctx, m.ID)
	if err != nil || len(snapshot.Services) != 1 {
		t.Fatalf("writer recovery: %#v %v", snapshot, err)
	}
}
func TestStoreActualSQLFailureRollsBackSnapshotAndCoverage(t *testing.T) {
	ctx := context.Background()
	s, _, m := openTestStore(t)
	at := time.Now().UTC()
	if err := s.Apply(ctx, m.ID, scan("ok", container("running")), at); err != nil {
		t.Fatal(err)
	}
	// Reject a history insert after latest/coverage for another collector has been written.
	if _, err := s.db.ExecContext(ctx, `CREATE TRIGGER reject_changes BEFORE INSERT ON changes BEGIN SELECT RAISE(ABORT, 'synthetic write failure'); END`); err != nil {
		t.Fatal(err)
	}
	changed := container("stopped")
	collections := []Collection{{Coverage: Coverage{Source: "systemd", State: "ok"}}, scan("ok", changed)[0]}
	if err := s.Apply(ctx, m.ID, collections, at.Add(time.Minute)); err == nil {
		t.Fatal("synthetic failure did not occur")
	}
	snapshot, err := s.Snapshot(ctx, m.ID)
	if err != nil || snapshot.Services[0].State != "running" || len(snapshot.Coverage) != 1 || !snapshot.At.Equal(at) {
		t.Fatalf("transaction partially wrote: %#v %v", snapshot, err)
	}
}

func TestStoreRejectsOlderPollAndBackupOverwrite(t *testing.T) {
	ctx := context.Background()
	s, path, m := openTestStore(t)
	at := time.Now().UTC()
	if err := s.Apply(ctx, m.ID, scan("ok", container("running")), at); err != nil {
		t.Fatal(err)
	}
	if err := s.Apply(ctx, m.ID, scan("ok", container("stopped")), at.Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	snapshot, err := s.Snapshot(ctx, m.ID)
	if err != nil || snapshot.Services[0].State != "running" || !snapshot.At.Equal(at) {
		t.Fatalf("stale poll replaced latest: %#v %v", snapshot, err)
	}
	backup := filepath.Join(filepath.Dir(path), "existing-backup.db")
	contents := []byte("keep this backup")
	if err := os.WriteFile(backup, contents, 0600); err != nil {
		t.Fatal(err)
	}
	if err := s.Backup(ctx, backup); err == nil {
		t.Fatal("backup replaced existing destination")
	}
	got, err := os.ReadFile(backup)
	if err != nil || !reflect.DeepEqual(got, contents) {
		t.Fatal("existing backup changed")
	}
}
