package localchat

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
	"os"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
)

const savedThread = "12345678-1234-4321-8123-123456789abc"

func TestClaudeStructuredForkUsesIndependentResume(t *testing.T) {
	args, err := claudeArguments(LaunchOptions{Fork: savedThread})
	if err != nil || !slices.Contains(args, "--fork-session") {
		t.Fatalf("Claude did not request an independent fork: %q, %v", args, err)
	}
	resume := slices.Index(args, "--resume")
	if resume < 0 || resume+1 >= len(args) || args[resume+1] != savedThread {
		t.Fatalf("Claude did not resume the selected source: %q", args)
	}
}

func TestStructuredForkBranchesSavedThreadAndReusesContinuation(t *testing.T) {
	var launches atomic.Int32
	var forks atomic.Int32
	m := New("synthetic", func(LaunchOptions) (Process, error) {
		launches.Add(1)
		client, peer := net.Pipe()
		go func() {
			defer peer.Close()
			encoder := json.NewEncoder(peer)
			scanner := bufio.NewScanner(peer)
			for scanner.Scan() {
				var p packet
				_ = json.Unmarshal(scanner.Bytes(), &p)
				switch p.Method {
				case "initialize":
					_ = encoder.Encode(map[string]any{"id": p.ID, "result": map[string]any{}})
				case "thread/start", "thread/fork":
					if p.Method == "thread/fork" {
						forks.Add(1)
						var params map[string]any
						_ = json.Unmarshal(p.Params, &params)
						if params["threadId"] != savedThread || params["sandbox"] != "read-only" || params["approvalPolicy"] != "untrusted" {
							t.Errorf("unsafe fork: %s", p.Params)
						}
					}
					_ = encoder.Encode(map[string]any{"id": p.ID, "result": map[string]any{"thread": map[string]string{"id": "independent-thread"}}})
				}
			}
		}()
		return client, nil
	})
	t.Cleanup(m.Close)
	options := LaunchOptions{Program: "synthetic", CWD: t.TempDir(), Fork: savedThread, HistoryID: "first-opaque-history", HistoryBefore: 120}
	var wg sync.WaitGroup
	ids := make(chan string, 2)
	for range 2 {
		wg.Go(func() {
			s, err := m.StartWith(context.Background(), options)
			if err != nil || s.Mode != "chat" || s.ThreadID != "independent-thread" || s.State != "idle" {
				t.Errorf("fork did not open an independent chat: %+v, %v", s, err)
			}
			ids <- s.ID
		})
	}
	wg.Wait()
	first, second := <-ids, <-ids
	if first == "" || first != second || launches.Load() != 1 || forks.Load() != 1 {
		t.Fatalf("continuation was not reused: ids=%q/%q, launches=%d, forks=%d", first, second, launches.Load(), forks.Load())
	}
	grown := options
	grown.HistoryID = "latest-opaque-history"
	grown.HistoryBefore = 240
	reused, err := m.StartWith(context.Background(), grown)
	if err != nil || reused.ID != first || reused.HistoryBefore != 120 || reused.HistoryID != grown.HistoryID {
		t.Fatalf("reuse changed the source snapshot: %+v, %v", reused, err)
	}
	stored, err := m.Get(first)
	if err != nil || stored.HistoryBefore != 120 || stored.HistoryID != grown.HistoryID || m.List()[0].HistoryBefore != 120 {
		t.Fatal("reconnect lost the source snapshot", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := m.StartWith(ctx, options); err == nil {
		t.Fatal("cancelled continuation reused a chat")
	}
	otherAccount := options
	otherAccount.Env = []string{"CODEX_HOME=" + t.TempDir()}
	other, err := m.StartWith(context.Background(), otherAccount)
	if err != nil || other.ID == first || launches.Load() != 2 {
		t.Fatalf("continuation crossed account environment: %+v, %v", other, err)
	}
	if err := m.Stop(first); err != nil {
		t.Fatal(err)
	}
	restarted, err := m.StartWith(context.Background(), options)
	if err != nil || restarted.ID == first || launches.Load() != 3 {
		t.Fatalf("stopped continuation was reused: %+v, %v", restarted, err)
	}
	if err := os.Remove(options.CWD); err != nil {
		t.Fatal(err)
	}
	if _, err := m.StartWith(context.Background(), options); err == nil || launches.Load() != 3 {
		t.Fatal("continuation accepted a removed project directory", err)
	}
}

func TestStructuredForkRejectsOriginalThreadIdentity(t *testing.T) {
	m := New("synthetic", func(LaunchOptions) (Process, error) {
		client, peer := net.Pipe()
		go func() {
			defer peer.Close()
			encoder := json.NewEncoder(peer)
			scanner := bufio.NewScanner(peer)
			for scanner.Scan() {
				var p packet
				_ = json.Unmarshal(scanner.Bytes(), &p)
				if p.Method == "initialize" {
					_ = encoder.Encode(map[string]any{"id": p.ID, "result": map[string]any{}})
				} else if p.Method == "thread/start" || p.Method == "thread/fork" {
					_ = encoder.Encode(map[string]any{"id": p.ID, "result": map[string]any{"thread": map[string]string{"id": savedThread}}})
				}
			}
		}()
		return client, nil
	})
	t.Cleanup(m.Close)
	s, err := m.StartWith(context.Background(), LaunchOptions{Program: "synthetic", CWD: t.TempDir(), Fork: savedThread})
	if err == nil || s.State != "exited" {
		t.Fatalf("source identity accepted: %+v, %v", s, err)
	}
}

func TestClaudeStructuredForkRejectsOriginalIdentity(t *testing.T) {
	m := New("", func(LaunchOptions) (Process, error) {
		client, peer := net.Pipe()
		go func() {
			defer peer.Close()
			_ = json.NewEncoder(peer).Encode(map[string]any{"type": "system", "subtype": "init", "session_id": savedThread})
			_, _ = peer.Read(make([]byte, 1))
		}()
		return client, nil
	})
	t.Cleanup(m.Close)
	s, err := m.StartWith(context.Background(), LaunchOptions{Agent: "claude", Program: "synthetic", CWD: t.TempDir(), Fork: savedThread})
	if err == nil || s.State != "exited" {
		t.Fatalf("Claude source identity accepted: %+v, %v", s, err)
	}
}
