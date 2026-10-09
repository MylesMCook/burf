package localchat

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"github.com/MylesMCook/burf/internal/backgroundcmd"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// This peer is the test executable, not an installed provider or a model.
func init() {
	if os.Getenv("BURF_SYNTHETIC_CLAUDE") != "1" || len(os.Args) < 2 {
		return
	}
	if os.Args[1] == "--burf-synthetic-claude-child" {
		for {
			time.Sleep(time.Hour)
		}
	}
	if os.Args[1] == "--burf-synthetic-claude-owner" {
		p, err := StartProcess(LaunchOptions{Agent: "claude", Program: os.Args[0], CWD: os.Getenv("BURF_CLAUDE_CWD"), Env: os.Environ()})
		if err != nil {
			os.Exit(11)
		}
		_, _ = io.Copy(os.Stdout, p)
		os.Exit(12)
	}
	if os.Args[1] == "--help" {
		fmt.Println(os.Getenv("BURF_CLAUDE_HELP"))
		os.Exit(0)
	}
	if os.Args[1] != "-p" {
		return
	}
	enc := json.NewEncoder(os.Stdout)
	emit := func(v any) { _ = enc.Encode(v) }
	emit(map[string]any{"type": "system", "subtype": "hook_started", "message": "unused hook detail", "result": map[string]any{}})
	emit(map[string]any{"type": "system", "subtype": "hook_response", "message": map[string]any{"content": "hook response"}})
	emit(map[string]any{"type": "future_event", "extra": true, "result": map[string]any{}, "message": "future shape"})
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
	emit(map[string]any{"type": "system", "subtype": "init", "session_id": "claude-owned", "model": "synthetic-model", "permissionMode": "default", "provider": os.Getpid(), "child": childPID, "cwd": cwd, "account": os.Getenv("CLAUDE_CONFIG_DIR")})
	emit(map[string]any{"type": "system", "subtype": "commands_changed"})
	message := func(kind string, content any) {
		emit(map[string]any{"type": kind, "session_id": "claude-owned", "message": map[string]any{"id": "message-1", "content": content}})
	}
	scan := bufio.NewScanner(os.Stdin)
	for scan.Scan() {
		if path := os.Getenv("BURF_CLAUDE_CONTROL_LOG"); path != "" {
			file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
			if err != nil {
				os.Exit(9)
			}
			_, _ = file.Write(append(append([]byte{}, scan.Bytes()...), '\n'))
			_ = file.Close()
		}
		var p struct {
			Type      string `json:"type"`
			RequestID string `json:"request_id"`
			Request   struct {
				Subtype string `json:"subtype"`
			} `json:"request"`
			Response struct {
				RequestID string         `json:"request_id"`
				Response  map[string]any `json:"response"`
			} `json:"response"`
		}
		_ = json.Unmarshal(scan.Bytes(), &p)
		switch p.Type {
		case "user":
			switch os.Getenv("BURF_CLAUDE_SCENARIO") {
			case "exit":
				os.Exit(7)
			case "rate-limit":
				emit(map[string]any{"type": "assistant", "error": "rate_limit", "message": map[string]any{"model": "<synthetic>", "content": []any{map[string]any{"type": "text", "text": "Claude Code usage limit reached. Try again later."}}}})
				emit(map[string]any{"type": "result", "is_error": true, "terminal_reason": "api_error"})
				os.Exit(1)
			case "auth":
				emit(map[string]any{"type": "assistant", "error": "authentication_failed", "message": map[string]any{"model": "<synthetic>", "content": []any{map[string]any{"type": "text", "text": "Not logged in · Please run /login"}}}})
				emit(map[string]any{"type": "result", "terminal_reason": "api_error", "is_error": true})
				os.Exit(1)
			case "approval":
				emit(map[string]any{"type": "control_request", "request_id": "permission-1", "request": map[string]any{"subtype": "can_use_tool", "tool_name": "Bash", "input": map[string]any{"command": "echo synthetic"}, "reason": "Needs permission", "permission_suggestions": []any{map[string]any{"type": "addRules", "destination": "session", "behavior": "allow", "rules": []any{map[string]any{"toolName": "Bash", "ruleContent": "echo synthetic"}}}}}})
			default:
				message("assistant", []any{map[string]any{"type": "thinking", "thinking": "private reasoning"}, map[string]any{"type": "text", "text": "Hello"}, map[string]any{"type": "tool_use", "id": "tool-1", "name": "Bash", "input": map[string]any{"command": "echo synthetic"}}})
				if os.Getenv("BURF_CLAUDE_SCENARIO") != "running" {
					message("user", []any{map[string]any{"type": "tool_result", "tool_use_id": "tool-1", "content": []any{map[string]any{"type": "text", "text": "synthetic output"}}, "is_error": false}})
					emit(map[string]any{"type": "result", "subtype": "success", "is_error": false, "result": "Hello", "session_id": "claude-owned"})
				}
			}
		case "control_request":
			if os.Getenv("BURF_CLAUDE_SCENARIO") == "lost-options" {
				continue
			}
			if os.Getenv("BURF_CLAUDE_SCENARIO") == "reject-options" {
				emit(map[string]any{"type": "control_response", "response": map[string]any{"subtype": "error", "request_id": p.RequestID, "error": "unsupported model"}})
				continue
			}
			if p.Request.Subtype == "interrupt" {
				emit(map[string]any{"type": "control_response", "response": map[string]any{"subtype": "success", "request_id": p.RequestID, "response": map[string]any{}}})
				emit(map[string]any{"type": "result", "subtype": "success", "session_id": "claude-owned"})
			} else {
				emit(map[string]any{"type": "control_response", "response": map[string]any{"subtype": "success", "request_id": p.RequestID, "response": map[string]any{}}})
			}
		case "control_response":
			// Echo the exact permission response so the test proves what was sent.
			message("assistant", []any{map[string]any{"type": "text", "text": string(scan.Bytes())}})
			emit(map[string]any{"type": "result", "subtype": "success", "session_id": "claude-owned"})
		}
	}
	os.Exit(0)
}

func newClaudeChat(t *testing.T, scenario string) (*Manager, Session) {
	t.Helper()
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	m := New("", StartProcess)
	t.Cleanup(m.Close)
	s, err := m.StartWith(context.Background(), LaunchOptions{Agent: "claude", Program: exe, CWD: t.TempDir(), Env: append(os.Environ(), "BURF_SYNTHETIC_CLAUDE=1", "BURF_CLAUDE_SCENARIO="+scenario)})
	if err != nil {
		t.Fatal(err)
	}
	if s.Agent != "claude" || s.ThreadID != "claude-owned" || s.State != "idle" || s.Options.Model != "synthetic-model" {
		t.Fatalf("bad Claude init: %+v", s)
	}
	return m, s
}

func TestClaudeTurnMapsTextAndToolResults(t *testing.T) {
	m, s := newClaudeChat(t, "turn")
	if err := m.Send(context.Background(), s.ID, "hello"); err != nil {
		t.Fatal(err)
	}
	got := waitChat(t, m, s.ID, func(s Session) bool { return s.State == "idle" })
	if len(got.Items) != 3 || got.Items[0].Kind != "user" || got.Items[1].Kind != "assistant" || got.Items[1].Text != "Hello" || got.Items[2].Kind != "tool" || got.Items[2].Text != "echo synthetic\nsynthetic output" || got.Items[2].Status != "completed" || got.TurnID != "" {
		t.Fatalf("bad turn: %+v", got)
	}
}
func TestClaudeRefusesOverlapAndInterrupts(t *testing.T) {
	m, s := newClaudeChat(t, "running")
	if err := m.Send(context.Background(), s.ID, "hello"); err != nil {
		t.Fatal(err)
	}
	got := waitChat(t, m, s.ID, func(s Session) bool { return len(s.Items) == 3 })
	if got.Items[2].Status != "inProgress" || got.TurnID == "" {
		t.Fatal(got)
	}
	if err := m.Send(context.Background(), s.ID, "duplicate"); err == nil {
		t.Fatal("overlapping send accepted")
	}
	if err := m.Interrupt(context.Background(), s.ID); err != nil {
		t.Fatal(err)
	}
	waitChat(t, m, s.ID, func(s Session) bool { return s.State == "idle" })
}
func TestClaudeApprovalsAreExplicitAndOneUse(t *testing.T) {
	for _, decision := range []string{"accept", "decline", "acceptForSession"} {
		t.Run(decision, func(t *testing.T) {
			m, s := newClaudeChat(t, "approval")
			if err := m.Send(context.Background(), s.ID, "hello"); err != nil {
				t.Fatal(err)
			}
			got := waitChat(t, m, s.ID, func(s Session) bool { return s.State == "waiting" })
			if len(got.Approvals) != 1 || got.Approvals[0].Kind != "command" || got.Approvals[0].Detail != "echo synthetic" || !got.Approvals[0].SessionAllowed || got.Approvals[0].Reason != "Needs permission" {
				t.Fatal(got)
			}
			if err := m.Decide(s.ID, "permission-1", "acceptAlways"); err == nil {
				t.Fatal("persistent grant accepted")
			}
			if err := m.Decide(s.ID, "permission-1", decision); err != nil {
				t.Fatal(err)
			}
			if err := m.Decide(s.ID, "permission-1", decision); err == nil {
				t.Fatal("approval replayed")
			}
			got = waitChat(t, m, s.ID, func(s Session) bool { return s.State == "idle" })
			var response struct {
				Type     string `json:"type"`
				Response struct {
					Subtype   string `json:"subtype"`
					RequestID string `json:"request_id"`
					Response  struct {
						Behavior           string           `json:"behavior"`
						Message            string           `json:"message"`
						UpdatedInput       map[string]any   `json:"updatedInput"`
						UpdatedPermissions []map[string]any `json:"updatedPermissions"`
					} `json:"response"`
				} `json:"response"`
			}
			if len(got.Items) != 2 || json.Unmarshal([]byte(got.Items[1].Text), &response) != nil {
				t.Fatal(got)
			}
			want := "allow"
			if decision == "decline" {
				want = "deny"
			}
			if response.Type != "control_response" || response.Response.Subtype != "success" || response.Response.RequestID != "permission-1" || response.Response.Response.Behavior != want {
				t.Fatal(got)
			}
			if decision == "decline" && response.Response.Response.Message == "" {
				t.Fatal("denial needs a plain explanation")
			}
			if decision != "decline" && response.Response.Response.UpdatedInput["command"] != "echo synthetic" {
				t.Fatal("input changed")
			}
			if decision == "acceptForSession" && (len(response.Response.Response.UpdatedPermissions) != 1 || response.Response.Response.UpdatedPermissions[0]["destination"] != "session") {
				t.Fatal("session grant not limited to session")
			}
		})
	}
}
func TestClaudeExitAndAuthenticationErrors(t *testing.T) {
	for _, scenario := range []string{"exit", "auth", "rate-limit"} {
		t.Run(scenario, func(t *testing.T) {
			m, s := newClaudeChat(t, scenario)
			_ = m.Send(context.Background(), s.ID, "hello")
			got := waitChat(t, m, s.ID, func(s Session) bool { return s.State == "exited" })
			if got.Error == "" || got.TurnID != "" || len(got.Items) != 1 {
				t.Fatalf("exit not actionable: %+v", got)
			}
			if scenario == "rate-limit" && !strings.Contains(got.Error, "usage limit") {
				t.Fatal(got.Error)
			}
			if scenario == "auth" && (!strings.Contains(got.Error, "not signed in") || !strings.Contains(got.Error, "claude")) {
				t.Fatal(got.Error)
			}
		})
	}
}
func TestClaudeOptionsAndProcessStop(t *testing.T) {
	m, s := newClaudeChat(t, "running")
	if err := m.SendWith(context.Background(), s.ID, "hello", TurnOptions{Model: "sonnet", Permission: "workspace"}); err != nil {
		t.Fatal(err)
	}
	got := waitChat(t, m, s.ID, func(s Session) bool { return len(s.Items) == 3 })
	if got.Options.Model != "sonnet" || got.Options.Permission != "workspace" {
		t.Fatal(got.Options)
	}
	if err := m.Stop(s.ID); err != nil {
		t.Fatal(err)
	}
	got, _ = m.Get(s.ID)
	if got.State != "exited" || len(got.Approvals) != 0 {
		t.Fatal(got)
	}
	if err := m.Send(context.Background(), s.ID, "after stop"); err == nil {
		t.Fatal("stopped chat accepted input")
	}
}

func TestClaudePermissionModesAndControlPayloads(t *testing.T) {
	for _, tc := range []struct{ permission, mode string }{{"strict", "manual"}, {"read-only", "plan"}, {"workspace", "acceptEdits"}, {"full-access", "bypassPermissions"}} {
		t.Run(tc.permission, func(t *testing.T) {
			log := t.TempDir() + "/controls.jsonl"
			t.Setenv("BURF_CLAUDE_CONTROL_LOG", log)
			m, s := newClaudeChat(t, "running")
			// Exercise even strict's mapping by changing away from its initial value.
			if tc.permission == "strict" {
				if err := m.SendWith(context.Background(), s.ID, "first", TurnOptions{Permission: "workspace"}); err != nil {
					t.Fatal(err)
				}
				if err := m.Interrupt(context.Background(), s.ID); err != nil {
					t.Fatal(err)
				}
				waitChat(t, m, s.ID, func(s Session) bool { return s.State == "idle" })
			}
			if err := m.SendWith(context.Background(), s.ID, "chosen", TurnOptions{Model: "sonnet", Permission: tc.permission}); err != nil {
				t.Fatal(err)
			}
			waitChat(t, m, s.ID, func(s Session) bool { return len(s.Items) >= 3 && s.Items[len(s.Items)-1].Kind == "tool" })
			raw, err := os.ReadFile(log)
			if err != nil {
				t.Fatal(err)
			}
			model, mode, user := false, false, false
			scanner := bufio.NewScanner(strings.NewReader(string(raw)))
			for scanner.Scan() {
				var line struct {
					Type      string         `json:"type"`
					Request   map[string]any `json:"request"`
					SessionID string         `json:"session_id"`
					Message   struct {
						Role    string `json:"role"`
						Content []struct {
							Text string `json:"text"`
						} `json:"content"`
					} `json:"message"`
				}
				if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
					t.Fatal(err)
				}
				if line.Request["subtype"] == "set_model" && line.Request["model"] == "sonnet" {
					model = true
				}
				if line.Request["subtype"] == "set_permission_mode" && line.Request["mode"] == tc.mode {
					mode = true
				}
				if line.Type == "user" && line.SessionID == "claude-owned" && line.Message.Role == "user" && len(line.Message.Content) == 1 && line.Message.Content[0].Text == "chosen" {
					user = true
				}
			}
			if !model || !mode || !user {
				t.Fatal("wrong option controls or message", string(raw))
			}

		})
	}
}
func TestClaudeLostOrRejectedOptionDoesNotSubmitMessage(t *testing.T) {
	for _, scenario := range []string{"reject-options", "lost-options"} {
		t.Run(scenario, func(t *testing.T) {
			log := t.TempDir() + "/controls.jsonl"
			t.Setenv("BURF_CLAUDE_CONTROL_LOG", log)
			m, s := newClaudeChat(t, scenario)
			ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
			defer cancel()
			err := m.SendWith(ctx, s.ID, "must not arrive", TurnOptions{Model: "sonnet"})
			if err == nil {
				t.Fatal("unconfirmed option accepted")
			}
			got, _ := m.Get(s.ID)
			if len(got.Items) != 0 || got.Options.Model != "synthetic-model" {
				t.Fatal("unconfirmed option changed session", got)
			}
			if scenario == "lost-options" && got.State != "exited" {
				t.Fatal("uncertain option did not stop chat", got)
			}
			if scenario == "reject-options" && (got.State != "idle" || !strings.Contains(err.Error(), "unsupported model")) {
				t.Fatal("rejection lost", got, err)
			}
			raw, e := os.ReadFile(log)
			if e != nil {
				t.Fatal(e)
			}
			if strings.Contains(string(raw), `"type":"user"`) {
				t.Fatal("message sent after failed option", string(raw))
			}
		})
	}
}
func TestClaudeLaunchFlagsStartWithManualPermissions(t *testing.T) {
	args, err := claudeArguments(LaunchOptions{})
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--permission-prompt-tool", "stdio", "--permission-mode", "manual", "--allow-dangerously-skip-permissions"}
	if strings.Join(args, "\x00") != strings.Join(want, "\x00") {
		t.Fatal(args)
	}
}
func TestClaudeTranscriptBoundAndPermissionValidation(t *testing.T) {
	m, s := newClaudeChat(t, "running")
	if err := m.Send(context.Background(), s.ID, "hello"); err != nil {
		t.Fatal(err)
	}
	waitChat(t, m, s.ID, func(s Session) bool { return len(s.Items) == 3 })
	r, _ := m.get(s.ID)
	c := r.provider.(*claudeProvider)
	for i := 0; i < maxItems; i++ {
		raw, _ := json.Marshal(map[string]any{"type": "assistant", "message": map[string]any{"id": fmt.Sprint(i), "content": []any{map[string]any{"type": "text", "text": strings.Repeat("x", maxText+1)}}}})
		if err := c.receive(r, raw); err != nil {
			t.Fatal(err)
		}
	}
	got, _ := m.Get(s.ID)
	bytes := 0
	for _, item := range got.Items {
		bytes += len(item.Text)
		if len(item.Text) > maxText+len("\n[output truncated]") {
			t.Fatal("unbounded item")
		}
	}
	if !got.Truncated || len(got.Items) > maxItems || bytes > maxSnapshot || !got.Items[len(got.Items)-1].Truncated {
		t.Fatal("unbounded transcript", bytes, got.Truncated)
	}
	raw := []byte(`{"type":"control_request","request_id":"oversize","request":{"subtype":"can_use_tool","tool_name":"Bash","input":{"command":"synthetic"},"permission_suggestions":[{"type":"setMode","mode":"bypassPermissions","destination":"session"},{"type":"addRules","destination":"userSettings","behavior":"allow","rules":[{"toolName":"Bash"}]}]}}`)
	if err := c.receive(r, raw); err != nil {
		t.Fatal(err)
	}
	got, _ = m.Get(s.ID)
	if len(got.Approvals) != 1 || got.Approvals[0].SessionAllowed {
		t.Fatal("persistent or broad mode grant offered", got.Approvals)
	}
	if err := m.Decide(s.ID, "oversize", "acceptForSession"); err == nil {
		t.Fatal("unsupported session grant allowed")
	}
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
func TestClaudeMCPServersAreScopedToTheOwnedChat(t *testing.T) {
	opts := LaunchOptions{Agent: "claude", chatID: "owned-id", Tools: &Tools{Server: func(id string) (string, []string) { return "/synthetic/burfd", []string{"mcp", "--chat", id} }}, Browser: &Browser{Server: func(id string) (string, []string) { return "/synthetic/burfd", []string{"browser-mcp", "--chat", id} }}}
	args, err := claudeArguments(opts)
	if err != nil {
		t.Fatal(err)
	}
	var cfg struct {
		Servers map[string]struct {
			Type    string   `json:"type"`
			Command string   `json:"command"`
			Args    []string `json:"args"`
		} `json:"mcpServers"`
	}
	if len(args) < 2 || args[len(args)-2] != "--mcp-config" || json.Unmarshal([]byte(args[len(args)-1]), &cfg) != nil {
		t.Fatal(args)
	}
	if len(cfg.Servers) != 2 {
		t.Fatal(cfg)
	}
	for _, name := range []string{ToolServer, BrowserServer} {
		server := cfg.Servers[name]
		if server.Type != "stdio" || !filepath.IsAbs(server.Command) || server.Args[len(server.Args)-1] != "owned-id" {
			t.Fatal(name, server)
		}
	}
}

func TestClaudeInvalidRequestRevokesApprovalBeforeTeardown(t *testing.T) {
	m, s := newClaudeChat(t, "approval")
	if err := m.Send(context.Background(), s.ID, "hello"); err != nil {
		t.Fatal(err)
	}
	waitChat(t, m, s.ID, func(s Session) bool { return s.State == "waiting" })
	r, _ := m.get(s.ID)
	// A reused permission id with changed input must revoke the old grant
	// under the state lock, before process teardown can start.
	err := r.provider.receive(r, []byte(`{"type":"control_request","request_id":"permission-1","request":{"subtype":"can_use_tool","tool_name":"Bash","input":{"command":"changed command"}}}`))
	if err == nil {
		t.Fatal("changed approval accepted")
	}
	got, _ := m.Get(s.ID)
	if got.State != "exited" || len(got.Approvals) != 0 {
		t.Fatal("old grant survived invalidation", got)
	}
	if err := m.Decide(s.ID, "permission-1", "accept"); err == nil {
		t.Fatal("stale details approved before teardown")
	}
}

func TestClaudeFileAndGenericToolApprovalsAndStringResults(t *testing.T) {
	for _, tc := range []struct{ tool, kind, key, target string }{{"Write", "files", "file_path", "notes.txt"}, {"WebFetch", "tool", "url", "https://example.invalid"}} {
		t.Run(tc.tool, func(t *testing.T) {
			m, s := newClaudeChat(t, "running")
			if err := m.Send(context.Background(), s.ID, "hello"); err != nil {
				t.Fatal(err)
			}
			waitChat(t, m, s.ID, func(s Session) bool { return len(s.Items) == 3 })
			r, _ := m.get(s.ID)
			emit := func(line any) {
				raw, _ := json.Marshal(line)
				if err := r.provider.receive(r, raw); err != nil {
					t.Fatal(err)
				}
			}
			input := map[string]any{tc.key: tc.target, "content": "synthetic input"}
			emit(map[string]any{"type": "assistant", "message": map[string]any{"content": []any{map[string]any{"type": "tool_use", "id": "other-tool", "name": tc.tool, "input": input}}}})
			emit(map[string]any{"type": "control_request", "request_id": "other-permission", "request": map[string]any{"subtype": "can_use_tool", "tool_name": tc.tool, "input": input}})
			got, _ := m.Get(s.ID)
			if got.State != "waiting" || len(got.Approvals) != 1 || got.Approvals[0].Kind != tc.kind || !strings.HasPrefix(got.Approvals[0].Detail, tc.tool+" "+tc.target+"\n") || got.Approvals[0].SessionAllowed {
				t.Fatal("wrong tool approval", got)
			}
			emit(map[string]any{"type": "user", "message": map[string]any{"content": []any{map[string]any{"type": "tool_result", "tool_use_id": "other-tool", "content": "plain tool output", "is_error": true}}}})
			got, _ = m.Get(s.ID)
			item := got.Items[len(got.Items)-1]
			if item.Kind != "tool" || item.Status != "failed" || !strings.HasSuffix(item.Text, "\nplain tool output") {
				t.Fatal("string tool result lost", item)
			}
		})
	}
}
func TestClaudeDefaultModelAndUnsupportedEffort(t *testing.T) {
	log := t.TempDir() + "/controls.jsonl"
	t.Setenv("BURF_CLAUDE_CONTROL_LOG", log)
	m, s := newClaudeChat(t, "running")
	if err := m.SendWith(context.Background(), s.ID, "not sent", TurnOptions{Effort: "high"}); err == nil {
		t.Fatal("unsupported effort ignored")
	}
	got, _ := m.Get(s.ID)
	if len(got.Items) != 0 || got.State != "idle" {
		t.Fatal("invalid effort submitted a turn", got)
	}
	if err := m.SendWith(context.Background(), s.ID, "default", TurnOptions{Model: "default"}); err != nil {
		t.Fatal(err)
	}
	waitChat(t, m, s.ID, func(s Session) bool { return len(s.Items) == 3 })
	raw, err := os.ReadFile(log)
	if err != nil {
		t.Fatal(err)
	}
	scanner := bufio.NewScanner(strings.NewReader(string(raw)))
	found := false
	for scanner.Scan() {
		var line struct {
			Request map[string]any `json:"request"`
		}
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			t.Fatal(err)
		}
		if line.Request["subtype"] == "set_model" {
			value, exists := line.Request["model"]
			if !exists || value != "" {
				t.Fatal("wrong default model reset", string(raw))
			}
			found = true
		}
	}
	if !found {
		t.Fatal("default reset not sent", string(raw))
	}
}
