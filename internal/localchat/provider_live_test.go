//go:build burf_live_provider

package localchat

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"
)

// This opt-in smoke owns fresh synthetic conversations through the installed
// CLI. It does not run in the ordinary suite or change account configuration.
func TestInstalledCodexMessages(t *testing.T) {
	if os.Getenv("BURF_PROVIDER_PROOF") != "1" {
		t.Skip("set BURF_PROVIDER_PROOF=1 to send three synthetic no-tool prompts")
	}
	program, err := exec.LookPath("codex")
	if err != nil {
		t.Fatal("installed Codex CLI is unavailable")
	}
	cwd := t.TempDir()
	if err := os.WriteFile(cwd+"/AGENTS.md", []byte("This is a synthetic messaging smoke workspace. Do not use tools. Answer only the exact sentinel requested in each message.\n"), 0600); err != nil {
		t.Fatal("cannot create synthetic workspace")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	var traces []*providerTrace
	m := New(program, func(options LaunchOptions) (Process, error) {
		began := time.Now()
		p, err := StartProcess(options)
		if err != nil {
			return nil, err
		}
		trace := &providerTrace{Process: p, start: began, wake: make(chan struct{}, 1), calls: map[string]providerCall{}, events: map[string]int{}}
		traces = append(traces, trace)
		t.Logf("owned_process_spawn_ms=%d fork=%t", time.Since(began).Milliseconds(), options.Fork != "")
		return trace, nil
	})
	defer func() {
		m.Close()
		for n, trace := range traces {
			trace.mu.Lock()
			t.Logf("process=%d events=%v rpc_error_classes=%v", n+1, trace.events, trace.errors)
			trace.mu.Unlock()
		}
	}()

	started := time.Now()
	source, err := m.StartWith(ctx, LaunchOptions{Agent: "codex", Program: program, CWD: cwd})
	if err != nil {
		t.Fatalf("fresh thread startup failed class=%s", providerErrorClass(err))
	}
	t.Logf("thread_start_ms=%d state=%s", time.Since(started).Milliseconds(), source.State)
	if source.State != "idle" || source.ThreadID == "" {
		t.Fatal("fresh thread was not ready")
	}
	first := proveProviderTurn(t, ctx, m, source.ID, traces[0], "BURF_MESSAGE_ONE", 1)
	second := proveProviderTurn(t, ctx, m, source.ID, traces[0], "BURF_MESSAGE_TWO", 2)
	if len(m.List()) != 1 || first.ThreadID != second.ThreadID {
		t.Fatal("second message created another chat")
	}
	beforeFork := second
	started = time.Now()
	fork, err := m.StartWith(ctx, LaunchOptions{Agent: "codex", Program: program, CWD: cwd, Fork: source.ThreadID})
	if err != nil {
		t.Fatalf("independent fork startup failed class=%s", providerErrorClass(err))
	}
	t.Logf("thread_fork_ms=%d independent=%t", time.Since(started).Milliseconds(), fork.ThreadID != source.ThreadID)
	if fork.ThreadID == "" || fork.ThreadID == source.ThreadID || len(traces) != 2 {
		t.Fatal("fork did not create its own provider thread and process")
	}
	proveProviderTurn(t, ctx, m, fork.ID, traces[1], "BURF_MESSAGE_FORK", 1)
	afterFork, err := m.Get(source.ID)
	if err != nil || !reflect.DeepEqual(beforeFork, afterFork) {
		t.Fatal("sending to the independent fork changed the source chat")
	}
	t.Log("second_message_same_chat=true fork_source_unchanged=true exact_replies=true")
}

func proveProviderTurn(t *testing.T, parent context.Context, m *Manager, id string, trace *providerTrace, sentinel string, turn int) Session {
	t.Helper()
	ctx, cancel := context.WithTimeout(parent, 75*time.Second)
	defer cancel()
	// Wire bytes can arrive before the manager has applied their snapshot.
	// Poll that boundary while also waking promptly for incoming bytes.
	changed := time.NewTicker(10 * time.Millisecond)
	defer changed.Stop()
	trace.mu.Lock()
	trace.turnStart, trace.firstDelta, trace.completed = time.Now(), time.Time{}, time.Time{}
	trace.mu.Unlock()
	began := time.Now()
	text := "Do not use any tools, read files, or perform actions. Reply with exactly " + sentinel + " and nothing else."
	if err := m.SendWith(ctx, id, text, TurnOptions{Permission: "read-only"}); err != nil {
		t.Fatalf("turn=%d send failed class=%s", turn, providerErrorClass(err))
	}
	ack := time.Since(began)
	for {
		s, err := m.Get(id)
		if err != nil {
			t.Fatal("owned chat disappeared")
		}
		if len(s.Approvals) > 0 {
			t.Fatal("no-tool echo unexpectedly requested approval; it was not approved")
		}
		kinds := map[string]int{}
		ids := map[string]bool{}
		var replies []string
		for _, item := range s.Items {
			kinds[item.Kind]++
			if ids[item.ID] {
				t.Fatal("provider snapshot contains duplicate item identities")
			}
			ids[item.ID] = true
			if item.Kind == "tool" {
				t.Fatal("no-tool echo unexpectedly performed a tool action")
			}
			if item.Kind == "assistant" {
				replies = append(replies, strings.TrimSpace(item.Text))
			}
		}
		if s.State == "exited" || s.Error != "" {
			t.Fatalf("turn=%d failed state=%s error_class=%s", turn, s.State, providerErrorClass(errors.New(s.Error)))
		}
		if s.State == "idle" && s.TurnID == "" {
			trace.mu.Lock()
			first := trace.firstDelta.Sub(trace.turnStart)
			completion := trace.completed.Sub(trace.turnStart)
			hasDelta := !trace.firstDelta.IsZero()
			trace.mu.Unlock()
			t.Logf("turn=%d send_ack_ms=%d first_delta_ms=%d completion_ms=%d has_delta=%t items=%v", turn, ack.Milliseconds(), first.Milliseconds(), completion.Milliseconds(), hasDelta, kinds)
			if kinds["user"] != turn || len(replies) != turn || replies[len(replies)-1] != sentinel || !hasDelta {
				t.Fatalf("turn=%d completed with incorrect counts or reply exact_match=%t", turn, len(replies) > 0 && replies[len(replies)-1] == sentinel)
			}
			return s
		}
		select {
		case <-ctx.Done():
			t.Fatalf("turn=%d timed out without retry state=%s items=%v", turn, s.State, kinds)
		case <-trace.wake:
		case <-changed.C:
		}
	}
}

type providerCall struct {
	method string
	at     time.Time
}

// The trace records method names, timing, and error classes. It never writes
// protocol payloads, provider configuration, credentials, or message text.
type providerTrace struct {
	Process
	mu                               sync.Mutex
	start                            time.Time
	turnStart, firstDelta, completed time.Time
	readBuffer                       []byte
	calls                            map[string]providerCall
	events                           map[string]int
	errors                           []string
	wake                             chan struct{}
}

func (p *providerTrace) Write(data []byte) (int, error) {
	p.mu.Lock()
	for _, line := range bytes.Split(data, []byte{'\n'}) {
		var packet packet
		if json.Unmarshal(line, &packet) == nil && len(packet.ID) > 0 && packet.Method != "" {
			p.calls[string(packet.ID)] = providerCall{method: packet.Method, at: time.Now()}
		}
	}
	p.mu.Unlock()
	return p.Process.Write(data)
}

func (p *providerTrace) Read(data []byte) (int, error) {
	n, err := p.Process.Read(data)
	p.mu.Lock()
	p.readBuffer = append(p.readBuffer, data[:n]...)
	for {
		index := bytes.IndexByte(p.readBuffer, '\n')
		if index < 0 {
			break
		}
		var packet packet
		if json.Unmarshal(p.readBuffer[:index], &packet) == nil {
			if packet.Method != "" {
				p.events[packet.Method]++
				if packet.Method == "item/agentMessage/delta" && p.firstDelta.IsZero() {
					p.firstDelta = time.Now()
				}
				if packet.Method == "turn/completed" {
					p.completed = time.Now()
				}
			}
			if call, ok := p.calls[string(packet.ID)]; ok && packet.Method == "" {
				if packet.Error != nil {
					p.errors = append(p.errors, fmt.Sprintf("%s:%d:%s", call.method, packet.Error.Code, providerErrorClass(errors.New(packet.Error.Message))))
				}
				p.events[fmt.Sprintf("response:%s:%dms", call.method, time.Since(call.at).Milliseconds())]++
				delete(p.calls, string(packet.ID))
			}
		}
		p.readBuffer = p.readBuffer[index+1:]
	}
	p.mu.Unlock()
	select {
	case p.wake <- struct{}{}:
	default:
	}
	return n, err
}

func providerErrorClass(err error) string {
	if err == nil {
		return "none"
	}
	message := strings.ToLower(err.Error())
	for _, class := range []string{"unauthorized", "authentication", "not logged", "rate limit", "quota", "timed out", "deadline", "network", "unsupported", "invalid", "uncertain", "no turn identity", "exited", "eof"} {
		if strings.Contains(message, class) {
			return strings.ReplaceAll(class, " ", "_")
		}
	}
	return "provider_or_process_error"
}
