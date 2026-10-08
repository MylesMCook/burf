package localagent

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"testing"
	"time"
)

func TestForkPreservesOriginalAndReusesRunningSession(t *testing.T) {
	const id = "12345678-1234-4321-8123-123456789abc"
	for _, agent := range []string{"codex", "claude"} {
		t.Run(agent, func(t *testing.T) {
			calls := 0
			dir := t.TempDir()
			command := Command{Program: "native.exe", CanFork: true}
			want := []string{"--resume", id, "--fork-session"}
			if agent == "codex" {
				command.Args = []string{"--no-daemon"}
				want = []string{"--no-daemon", "fork", id}
			}
			m := New(map[string]Command{agent: command}, func(program string, args []string, cwd string, _ []string, _, _ int) (Process, error) {
				calls++
				if program != command.Program || cwd != dir || !reflect.DeepEqual(args, want) {
					t.Fatalf("unsafe continuation command: %q %q", program, args)
				}
				return fake(), nil
			})
			defer m.Close()
			s, err := m.Fork(agent, dir, id)
			if err != nil {
				t.Fatal(err)
			}
			again, err := m.Fork(agent, dir, id)
			if err != nil || again.ID != s.ID || calls != 1 {
				t.Fatalf("duplicate launch: %v, calls %d", err, calls)
			}
			if err := m.Stop(s.ID); err != nil {
				t.Fatal(err)
			}
			waitFor(t, func() bool { return m.List()[0].State == "exited" })
			if _, err := m.Fork(agent, dir, id); err != nil || calls != 2 {
				t.Fatalf("retry after stop: %v", err)
			}
		})
	}
}

func TestConcurrentForksAndFailedLaunchRetry(t *testing.T) {
	const id = "12345678-1234-4321-8123-123456789abc"
	failed := errors.New("synthetic launch failure")
	calls := 0
	m := New(map[string]Command{"codex": {Program: "synthetic.exe", CanFork: true}}, func(string, []string, string, []string, int, int) (Process, error) {
		calls++
		if calls == 1 {
			return nil, failed
		}
		return fake(), nil
	})
	defer m.Close()
	dir := t.TempDir()
	if _, err := m.Fork("codex", dir, id); !errors.Is(err, failed) || len(m.List()) != 0 {
		t.Fatalf("failed launch reserved a session: %v", err)
	}
	const clients = 24
	results := make(chan Session, clients)
	errs := make(chan error, clients)
	gate := make(chan struct{})
	var wg sync.WaitGroup
	for range clients {
		wg.Go(func() {
			<-gate
			s, err := m.Fork("codex", dir, id)
			results <- s
			errs <- err
		})
	}
	close(gate)
	wg.Wait()
	close(results)
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	var owned string
	for s := range results {
		if owned == "" {
			owned = s.ID
		}
		if s.ID != owned {
			t.Fatal("concurrent request created another session")
		}
	}
	if calls != 2 || len(m.List()) != 1 {
		t.Fatalf("duplicate retry launches: calls %d, sessions %d", calls, len(m.List()))
	}
}

func TestWaitingLaunchRevalidatesSourceAndHonorsCancellation(t *testing.T) {
	for _, cancelRequest := range []bool{false, true} {
		t.Run(map[bool]string{false: "deleted source", true: "cancelled request"}[cancelRequest], func(t *testing.T) {
			const id = "12345678-1234-4321-8123-123456789abc"
			dir := t.TempDir()
			path := filepath.Join(dir, "source")
			if err := os.WriteFile(path, []byte("synthetic"), 0600); err != nil {
				t.Fatal(err)
			}
			entered, release := make(chan struct{}), make(chan struct{})
			calls := 0
			m := New(map[string]Command{"codex": {Program: "synthetic.exe", CanFork: true}}, func(string, []string, string, []string, int, int) (Process, error) {
				calls++
				if calls == 1 {
					close(entered)
					<-release
				}
				return fake(), nil
			})
			defer m.Close()
			first := make(chan error, 1)
			go func() { _, err := m.Start("codex", dir); first <- err }()
			<-entered
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			fork := make(chan error, 1)
			go func() {
				_, err := m.ForkFrom(ctx, func() (string, string, string, error) {
					_, err := os.Stat(path)
					return "codex", dir, id, err
				})
				fork <- err
			}()
			var start chan error
			if cancelRequest {
				start = make(chan error, 1)
				go func() { _, err := m.StartContext(ctx, "codex", dir); start <- err }()
				cancel()
			} else if err := os.Remove(path); err != nil {
				t.Fatal(err)
			}
			close(release)
			if err := <-first; err != nil {
				t.Fatal(err)
			}
			select {
			case err := <-fork:
				if cancelRequest && !errors.Is(err, context.Canceled) || !cancelRequest && !errors.Is(err, os.ErrNotExist) {
					t.Fatalf("pending fork: %v", err)
				}
			case <-time.After(3 * time.Second):
				t.Fatal("pending fork did not complete")
			}
			if cancelRequest {
				if err := <-start; !errors.Is(err, context.Canceled) {
					t.Fatalf("cancelled start: %v", err)
				}
			}
			if calls != 1 {
				t.Fatal("stale or cancelled request launched a process")
			}
		})
	}
}

func TestForkRejectsInvalidOrUnsupportedSource(t *testing.T) {
	m := New(map[string]Command{"codex": {Program: "codex.exe", CanFork: true}, "claude": {Program: "claude.exe"}}, func(string, []string, string, []string, int, int) (Process, error) {
		t.Fatal("invalid fork launched")
		return nil, nil
	})
	defer m.Close()
	for _, tc := range [][3]string{
		{"codex", t.TempDir(), "--last"},
		{"codex", t.TempDir(), "session-name"},
		{"codex", "relative", "12345678-1234-4321-8123-123456789abc"},
		{"claude", t.TempDir(), "12345678-1234-4321-8123-123456789abc"},
		{"shell", t.TempDir(), "12345678-1234-4321-8123-123456789abc"},
	} {
		if _, err := m.Fork(tc[0], tc[1], tc[2]); err == nil {
			t.Fatalf("accepted %q", tc)
		}
	}
}
