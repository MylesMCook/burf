package localchat

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/backgroundcmd"
)

// Synthetic ACP peer: the test executable speaking JSON-RPC for Claude.
func init() {
	if os.Getenv("BURF_SYNTHETIC_CLAUDE") != "1" {
		return
	}
	if len(os.Args) >= 2 && os.Args[1] == "--burf-synthetic-claude-child" {
		for {
			time.Sleep(time.Hour)
		}
	}
	if len(os.Args) >= 2 && os.Args[1] == "--burf-synthetic-claude-owner" {
		p, err := StartProcess(LaunchOptions{Agent: "claude", Program: os.Args[0], CWD: os.Getenv("BURF_CLAUDE_CWD"), Env: os.Environ()})
		if err != nil {
			os.Exit(11)
		}
		_, _ = io.Copy(os.Stdout, p)
		os.Exit(12)
	}
	if len(os.Args) >= 2 && os.Args[1] == "--help" {
		fmt.Println(os.Getenv("BURF_CLAUDE_HELP"))
		if os.Getenv("BURF_CLAUDE_HELP") == "" {
			fmt.Println("claude-agent-acp\nAgent Client Protocol\nsession/new")
		}
		os.Exit(0)
	}
	enc := json.NewEncoder(os.Stdout)
	emit := func(v any) { _ = enc.Encode(v) }
	childPID := 0
	if os.Getenv("BURF_CLAUDE_DESCENDANTS") == "1" {
		child := backgroundcmd.CommandContext(context.Background(), os.Args[0], "--burf-synthetic-claude-child")
		child.Stdout = os.Stdout
		if err := child.Start(); err != nil {
			os.Exit(10)
		}
		childPID = child.Process.Pid
	}
	cwd, _ := os.Getwd()
	// Process-cleanup tests still read this native report line.
	emit(map[string]any{"type": "system", "subtype": "init", "session_id": "claude-owned", "provider": os.Getpid(), "child": childPID, "cwd": cwd, "account": os.Getenv("CLAUDE_CONFIG_DIR")})
	sessionID := "claude-owned"
	scan := bufio.NewScanner(os.Stdin)
	for scan.Scan() {
		line := scan.Bytes()
		// Legacy process tests poke a non-ACP user line to force exit.
		if os.Getenv("BURF_CLAUDE_SCENARIO") == "exit" && (strings.Contains(string(line), `"type":"user"`) || strings.Contains(string(line), "session/prompt")) {
			os.Exit(7)
		}
		var msg struct {
			JSONRPC string          `json:"jsonrpc"`
			ID      json.RawMessage `json:"id"`
			Method  string          `json:"method"`
			Params  json.RawMessage `json:"params"`
		}
		if json.Unmarshal(line, &msg) != nil || msg.Method == "" {
			continue
		}
		reply := func(result any) {
			emit(map[string]any{"jsonrpc": "2.0", "id": json.RawMessage(msg.ID), "result": result})
		}
		switch msg.Method {
		case "initialize":
			reply(map[string]any{
				"protocolVersion":   1,
				"agentCapabilities": map[string]any{"loadSession": true},
				"agentInfo":         map[string]any{"name": "synthetic-claude", "version": "1"},
			})
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
			switch os.Getenv("BURF_CLAUDE_SCENARIO") {
			case "exit":
				os.Exit(7)
			case "approval":
				emit(map[string]any{
					"jsonrpc": "2.0", "id": "permission-1", "method": "session/request_permission",
					"params": map[string]any{
						"sessionId": sessionID,
						"toolCall":  map[string]any{"toolCallId": "tool-1", "title": "echo synthetic", "kind": "execute"},
						"options": []any{
							map[string]any{"optionId": "allow-once", "name": "Allow", "kind": "allow_once"},
							map[string]any{"optionId": "reject-once", "name": "Reject", "kind": "reject_once"},
							map[string]any{"optionId": "allow-always", "name": "Always", "kind": "allow_always"},
						},
					},
				})
				for scan.Scan() {
					var ans struct {
						ID json.RawMessage `json:"id"`
					}
					if json.Unmarshal(scan.Bytes(), &ans) == nil && string(ans.ID) == `"permission-1"` {
						break
					}
				}
				emit(map[string]any{
					"jsonrpc": "2.0", "method": "session/update",
					"params": map[string]any{"sessionId": sessionID, "update": map[string]any{
						"sessionUpdate": "agent_message_chunk", "messageId": "a1",
						"content": map[string]any{"type": "text", "text": "allowed"},
					}},
				})
				reply(map[string]any{"stopReason": "end_turn"})
			case "running":
				emit(map[string]any{
					"jsonrpc": "2.0", "method": "session/update",
					"params": map[string]any{"sessionId": sessionID, "update": map[string]any{
						"sessionUpdate": "agent_message_chunk", "messageId": "a1",
						"content": map[string]any{"type": "text", "text": "Hello"},
					}},
				})
				for scan.Scan() {
					var next struct {
						Method string `json:"method"`
					}
					_ = json.Unmarshal(scan.Bytes(), &next)
					if next.Method == "session/cancel" {
						reply(map[string]any{"stopReason": "cancelled"})
						return
					}
				}
			default:
				emit(map[string]any{
					"jsonrpc": "2.0", "method": "session/update",
					"params": map[string]any{"sessionId": sessionID, "update": map[string]any{
						"sessionUpdate": "agent_message_chunk", "messageId": "a1",
						"content": map[string]any{"type": "text", "text": "Hello"},
					}},
				})
				emit(map[string]any{
					"jsonrpc": "2.0", "method": "session/update",
					"params": map[string]any{"sessionId": sessionID, "update": map[string]any{
						"sessionUpdate": "tool_call", "toolCallId": "tool-1", "title": "echo synthetic", "kind": "execute", "status": "completed",
						"rawInput": map[string]any{"command": "echo synthetic"},
					}},
				})
				reply(map[string]any{"stopReason": "end_turn"})
			}
		case "session/cancel":
		default:
			if len(msg.ID) > 0 {
				emit(map[string]any{"jsonrpc": "2.0", "id": json.RawMessage(msg.ID), "error": map[string]any{"code": -32601, "message": "method not found"}})
			}
		}
	}
	os.Exit(0)
}

type claudeNativeReport struct {
	Type     string `json:"type"`
	Subtype  string `json:"subtype"`
	Provider int    `json:"provider"`
	Child    int    `json:"child"`
	CWD      string `json:"cwd"`
	Account  string `json:"account"`
}

func readClaudeNativeReport(t *testing.T, r io.Reader) claudeNativeReport {
	t.Helper()
	done := make(chan claudeNativeReport, 1)
	go func() {
		decoder := json.NewDecoder(r)
		for {
			var report claudeNativeReport
			if err := decoder.Decode(&report); err != nil {
				done <- claudeNativeReport{}
				return
			}
			if report.Type == "system" && report.Subtype == "init" {
				done <- report
				return
			}
		}
	}()
	select {
	case report := <-done:
		if report.Provider == 0 || report.Child == 0 {
			t.Fatal("synthetic provider did not report its descendants")
		}
		return report
	case <-time.After(5 * time.Second):
		t.Fatal("synthetic provider did not start")
		return claudeNativeReport{}
	}
}

func newClaudeChat(t *testing.T, scenario string) (*Manager, Session) {
	t.Helper()
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	m := New("", StartProcess)
	t.Cleanup(m.Close)
	s, err := m.StartWith(context.Background(), LaunchOptions{
		Agent: "claude", Program: exe, CWD: t.TempDir(),
		Env: append(os.Environ(), "BURF_SYNTHETIC_CLAUDE=1", "BURF_CLAUDE_SCENARIO="+scenario),
	})
	if err != nil {
		t.Fatal(err)
	}
	if s.Agent != "claude" || s.ThreadID != "claude-owned" || s.State != "idle" {
		t.Fatalf("bad Claude ACP init: %+v", s)
	}
	return m, s
}

func waitIdle(t *testing.T, m *Manager, id string) Session {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		s, err := m.Get(id)
		if err != nil {
			t.Fatal(err)
		}
		if s.State == "idle" || s.State == "exited" {
			return s
		}
		time.Sleep(20 * time.Millisecond)
	}
	s, _ := m.Get(id)
	t.Fatalf("not idle: %+v", s)
	return s
}

func TestClaudeTurnMapsTextAndToolResults(t *testing.T) {
	m, s := newClaudeChat(t, "turn")
	if err := m.Send(context.Background(), s.ID, "hello"); err != nil {
		t.Fatal(err)
	}
	s = waitIdle(t, m, s.ID)
	var kinds []string
	for _, it := range s.Items {
		kinds = append(kinds, it.Kind+":"+it.Text[:min(20, len(it.Text))])
	}
	joined := strings.Join(kinds, "|")
	if !strings.Contains(joined, "user:") || !strings.Contains(joined, "assistant:Hello") || !strings.Contains(joined, "tool:") {
		t.Fatalf("items: %v", kinds)
	}
}

func TestClaudeApproval(t *testing.T) {
	m, s := newClaudeChat(t, "approval")
	if err := m.Send(context.Background(), s.ID, "run"); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(5 * time.Second)
	var approval string
	for time.Now().Before(deadline) {
		cur, err := m.Get(s.ID)
		if err != nil {
			t.Fatal(err)
		}
		if len(cur.Approvals) > 0 {
			approval = cur.Approvals[0].ID
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if approval == "" {
		t.Fatal("no approval")
	}
	if err := m.Decide(s.ID, approval, "accept"); err != nil {
		t.Fatal(err)
	}
	s = waitIdle(t, m, s.ID)
	found := false
	for _, it := range s.Items {
		if it.Kind == "assistant" && strings.Contains(it.Text, "allowed") {
			found = true
		}
	}
	if !found {
		t.Fatalf("items: %+v", s.Items)
	}
}

func TestClaudeInterrupt(t *testing.T) {
	m, s := newClaudeChat(t, "running")
	if err := m.Send(context.Background(), s.ID, "hello"); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		cur, _ := m.Get(s.ID)
		if cur.State == "running" && cur.TurnID != "" {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if err := m.Interrupt(context.Background(), s.ID); err != nil {
		t.Fatal(err)
	}
	s = waitIdle(t, m, s.ID)
}

func TestClaudeLoadSession(t *testing.T) {
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	m := New("", StartProcess)
	t.Cleanup(m.Close)
	s, err := m.StartWith(context.Background(), LaunchOptions{
		Agent: "claude", Program: exe, CWD: t.TempDir(), Fork: "saved-session",
		Env: append(os.Environ(), "BURF_SYNTHETIC_CLAUDE=1"),
	})
	if err != nil {
		t.Fatal(err)
	}
	if s.ThreadID != "saved-session" {
		t.Fatalf("thread %q", s.ThreadID)
	}
}

func TestClaudeModelAliasesComeOnlyFromInstalledHelp(t *testing.T) {
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	env := append(os.Environ(), "BURF_SYNTHETIC_CLAUDE=1", "BURF_CLAUDE_HELP=  --model <model> Provide an alias (e.g. 'future-model', 'opus', or 'opus')\n  --next-option")
	models, err := ClaudeModels(context.Background(), exe, env)
	if err != nil || len(models) != 3 || models[0].Model != "default" || models[1].Model != "future-model" || models[2].Model != "opus" {
		t.Fatal(models, err)
	}
	env = append(os.Environ(), "BURF_SYNTHETIC_CLAUDE=1", "BURF_CLAUDE_HELP=older help without aliases")
	models, err = ClaudeModels(context.Background(), exe, env)
	if err != nil || len(models) != 1 || models[0].Model != "default" {
		t.Fatal(models, err)
	}
}

func TestClaudeMCPServersPassOnSessionNew(t *testing.T) {
	p := newClaudeACP()
	servers := p.mcpServers(LaunchOptions{
		chatID:  "owned-id",
		Tools:   &Tools{Server: func(id string) (string, []string) { return "/synthetic/burfd", []string{"mcp", "--chat", id} }},
		Browser: &Browser{Server: func(id string) (string, []string) { return "/synthetic/burfd", []string{"browser-mcp", "--chat", id} }},
	})
	if len(servers) != 2 {
		t.Fatalf("%+v", servers)
	}
	raw, _ := json.Marshal(servers)
	if !strings.Contains(string(raw), "owned-id") || !strings.Contains(string(raw), ToolServer) || !strings.Contains(string(raw), BrowserServer) {
		t.Fatalf("%s", raw)
	}
}

func TestClaudeACPCommand(t *testing.T) {
	if !ClaudeACPCommand(`/usr/bin/claude-agent-acp`) {
		t.Fatal("expected acp command")
	}
}
