package localchat

import (
	"bufio"
	"context"
	"encoding/json"
	"os"
	"testing"
)

func init() {
	if os.Getenv("BURF_SYNTHETIC_CURSOR") != "1" {
		return
	}
	enc := json.NewEncoder(os.Stdout)
	emit := func(v any) { _ = enc.Encode(v) }
	sessionID := "cursor-owned"
	scan := bufio.NewScanner(os.Stdin)
	for scan.Scan() {
		var msg struct {
			ID     json.RawMessage `json:"id"`
			Method string          `json:"method"`
			Params json.RawMessage `json:"params"`
		}
		if json.Unmarshal(scan.Bytes(), &msg) != nil || msg.Method == "" {
			continue
		}
		reply := func(result any) {
			emit(map[string]any{"jsonrpc": "2.0", "id": json.RawMessage(msg.ID), "result": result})
		}
		switch msg.Method {
		case "initialize":
			reply(map[string]any{
				"protocolVersion": 1,
				"agentCapabilities": map[string]any{"loadSession": true},
				"authMethods":       []any{map[string]any{"id": "cursor_login", "name": "Cursor"}},
			})
		case "authenticate":
			reply(map[string]any{})
		case "session/new", "session/load":
			var params struct {
				SessionID string `json:"sessionId"`
			}
			_ = json.Unmarshal(msg.Params, &params)
			if params.SessionID != "" {
				sessionID = params.SessionID
			}
			reply(map[string]any{"sessionId": sessionID})
		case "session/prompt":
			emit(map[string]any{"jsonrpc": "2.0", "method": "session/update", "params": map[string]any{
				"sessionId": sessionID,
				"update":    map[string]any{"sessionUpdate": "agent_message_chunk", "messageId": "c1", "content": map[string]any{"type": "text", "text": "Cursor hi"}},
			}})
			reply(map[string]any{"stopReason": "end_turn"})
		}
	}
	os.Exit(0)
}

func TestCursorACPStartAndTurn(t *testing.T) {
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	m := New("", StartProcess)
	t.Cleanup(m.Close)
	s, err := m.StartWith(context.Background(), LaunchOptions{
		Agent: "cursor", Program: exe, CWD: t.TempDir(),
		Env: append(os.Environ(), "BURF_SYNTHETIC_CURSOR=1"),
	})
	if err != nil {
		t.Fatal(err)
	}
	if s.Agent != "cursor" || s.ThreadID != "cursor-owned" || s.State != "idle" {
		t.Fatalf("%+v", s)
	}
	if err := m.Send(context.Background(), s.ID, "hi"); err != nil {
		t.Fatal(err)
	}
	s = waitIdle(t, m, s.ID)
	found := false
	for _, it := range s.Items {
		if it.Kind == "assistant" && it.Text == "Cursor hi" {
			found = true
		}
	}
	if !found {
		t.Fatalf("%+v", s.Items)
	}
}

func TestCursorLoadSession(t *testing.T) {
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	m := New("", StartProcess)
	t.Cleanup(m.Close)
	s, err := m.StartWith(context.Background(), LaunchOptions{
		Agent: "cursor", Program: exe, CWD: t.TempDir(), Fork: "saved-cursor",
		Env: append(os.Environ(), "BURF_SYNTHETIC_CURSOR=1"),
	})
	if err != nil {
		t.Fatal(err)
	}
	if s.ThreadID != "saved-cursor" {
		t.Fatalf("%q", s.ThreadID)
	}
}
