package localchat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/MylesMCook/burf/internal/backgroundcmd"
)

// Claude's stream protocol and its CLI options live here. Unknown events and
// fields are ignored. Tool, permission and interrupt shapes need a signed-in
// CLI check; the executable peer tests exercise the assumed SDK contract.
type claudeProvider struct {
	initialized chan struct{}
	initOnce    sync.Once
	sequence    uint64
	spoke       bool
}

func newClaudeProvider() *claudeProvider { return &claudeProvider{initialized: make(chan struct{})} }

func claudePermission(permission string) string {
	switch permission {
	case "read-only":
		return "plan"
	case "workspace":
		return "acceptEdits"
	case "full-access":
		return "bypassPermissions"
	default:
		return "manual"
	}
}

func claudeArguments(options LaunchOptions) ([]string, error) {
	args := []string{"-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--permission-prompt-tool", "stdio", "--permission-mode", "manual", "--allow-dangerously-skip-permissions"}
	// This enables the user's later explicit full-access choice, but does not
	// turn bypass on. Every new chat starts in manual mode.
	servers := map[string]any{}
	if options.Tools != nil {
		command, arguments := options.Tools.Server(options.chatID)
		servers[ToolServer] = map[string]any{"type": "stdio", "command": command, "args": arguments}
	}
	if options.Browser != nil {
		command, arguments := options.Browser.Server(options.chatID)
		servers[BrowserServer] = map[string]any{"type": "stdio", "command": command, "args": arguments}
	}
	if len(servers) > 0 {
		config, err := json.Marshal(map[string]any{"mcpServers": servers})
		if err != nil {
			return nil, err
		}
		args = append(args, "--mcp-config", string(config))
	}
	return args, nil
}

func (c *claudeProvider) start(ctx context.Context, r *running, _ LaunchOptions) error {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	select {
	case <-c.initialized:
		s := r.snapshot()
		if s.State == "exited" {
			return errors.New(s.Error)
		}
		return nil
	case <-ctx.Done():
		return fmt.Errorf("Claude Code chat could not start: %w", ctx.Err())
	case <-r.done:
		return errors.New(r.snapshot().Error)
	}
}

// A control request must be acknowledged before a message is written. No
// request or message is retried after a timeout or an uncertain write.
func (c *claudeProvider) control(ctx context.Context, r *running, request map[string]any) error {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	r.mu.Lock()
	r.next++
	id := fmt.Sprintf("burf-%d", r.next)
	ch := make(chan packet, 1)
	key := "claude:" + id
	r.pending[key] = ch
	r.mu.Unlock()
	defer func() { r.mu.Lock(); delete(r.pending, key); r.mu.Unlock() }()
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := r.queue(map[string]any{"type": "control_request", "request_id": id, "request": request}); err != nil {
		return err
	}
	select {
	case reply := <-ch:
		if reply.Error != nil {
			return rejection(reply.Error.Message)
		}
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-r.done:
		return errors.New("Claude Code disconnected")
	}
}

func (c *claudeProvider) send(ctx context.Context, r *running, text string, options TurnOptions, kind string) error {
	if options.Effort != "" {
		return errors.New("Claude Code chat does not support per-message reasoning effort")
	}
	r.mu.Lock()
	if r.session.State != "idle" {
		r.mu.Unlock()
		return errors.New("chat is not ready for a message")
	}
	previous := r.session.Options
	r.mu.Unlock()
	// Apply one choice at a time, recording only acknowledged settings. A
	// rejected second choice does not pretend the first one was rolled back.
	controls := []struct{ subtype, key, value, previous string }{
		{"set_model", "model", options.Model, previous.Model},
		{"set_permission_mode", "mode", options.Permission, previous.Permission},
	}
	for _, setting := range controls {
		if setting.value == "" || setting.value == setting.previous {
			continue
		}
		value := setting.value
		if setting.key == "mode" {
			value = claudePermission(value)
		}
		if setting.key == "model" && value == "default" {
			value = ""
		}
		err := c.control(ctx, r, map[string]any{"subtype": setting.subtype, setting.key: value})
		if err != nil {
			if !errors.Is(err, ErrRejected) {
				r.finish("Claude Code option delivery is uncertain; chat stopped without replay.")
			}
			return err
		}
		r.mu.Lock()
		if setting.key == "model" {
			r.session.Options.Model = setting.value
		} else {
			r.session.Options.Permission = setting.value
		}
		r.mu.Unlock()
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	r.mu.Lock()
	if r.session.State != "idle" {
		r.mu.Unlock()
		return errors.New("chat is not ready for a message")
	}
	r.next++
	turn := fmt.Sprintf("claude-turn-%d", r.next)
	r.session.TurnID = turn
	r.submitted = turn + "-user"
	r.put(Item{ID: r.submitted, Kind: kind, Text: text})
	r.permission = r.session.Options.Permission
	r.session.State = "running"
	r.session.Error = ""
	c.spoke = false
	thread := r.session.ThreadID
	r.mu.Unlock()
	err := r.queue(map[string]any{"type": "user", "message": map[string]any{"role": "user", "content": []any{map[string]any{"type": "text", "text": text}}}, "parent_tool_use_id": nil, "session_id": thread})
	if err != nil {
		r.finish("Message delivery is uncertain; Claude Code chat stopped without replay.")
	}
	return err
}
func (c *claudeProvider) interrupt(ctx context.Context, r *running, _ Session) error {
	r.mu.Lock()
	r.session.Approvals = []Approval{}
	r.approvals = map[string]json.RawMessage{}
	r.cancelBrowser()
	r.cancelTools()
	if r.session.State != "exited" {
		r.session.State = "running"
	}
	r.mu.Unlock()
	err := c.control(ctx, r, map[string]any{"subtype": "interrupt"})
	if err != nil {
		r.finish("Interrupt could not be confirmed; Claude Code chat stopped without replay.")
	}
	return err
}

type claudePermissionRequest struct {
	Subtype        string            `json:"subtype"`
	Tool           string            `json:"tool_name"`
	Input          json.RawMessage   `json:"input"`
	Reason         string            `json:"reason"`
	DecisionReason string            `json:"decision_reason"`
	Suggestions    []json.RawMessage `json:"permission_suggestions"`
}

// Session grants use only rules the CLI explicitly proposed for this session.
// Persistent destinations and broad permission-mode changes are not offered.
func (p claudePermissionRequest) sessionRules() []json.RawMessage {
	out := []json.RawMessage{}
	for _, raw := range p.Suggestions {
		var update struct {
			Type        string `json:"type"`
			Destination string `json:"destination"`
			Behavior    string `json:"behavior"`
			Rules       []struct {
				Tool string `json:"toolName"`
			} `json:"rules"`
		}
		if json.Unmarshal(raw, &update) != nil || update.Type != "addRules" || update.Destination != "session" || update.Behavior != "allow" || len(update.Rules) == 0 {
			continue
		}
		valid := true
		for _, rule := range update.Rules {
			if rule.Tool != p.Tool {
				valid = false
			}
		}
		if valid {
			out = append(out, raw)
		}
	}
	return out
}
func (c *claudeProvider) decide(r *running, id, decision string) error {
	r.mu.Lock()
	raw, ok := r.approvals[id]
	if !ok || r.session.State == "exited" {
		r.mu.Unlock()
		return errors.New("approval is no longer pending")
	}
	var request claudePermissionRequest
	if json.Unmarshal(raw, &request) != nil {
		r.mu.Unlock()
		return errors.New("invalid Claude Code permission request")
	}
	answer := map[string]any{"behavior": "allow", "updatedInput": request.Input}
	switch decision {
	case "decline":
		answer = map[string]any{"behavior": "deny", "message": "The person declined this tool use. Do not run it."}
	case "acceptForSession":
		rules := request.sessionRules()
		if len(rules) == 0 {
			r.mu.Unlock()
			return errors.New("session approval is not supported for this request")
		}
		answer["updatedPermissions"] = rules
	case "acceptAlways":
		r.mu.Unlock()
		return errors.New("Claude Code did not offer a persistent approval")
	}
	delete(r.approvals, id)
	r.dropApproval(id)
	err := r.queue(map[string]any{"type": "control_response", "response": map[string]any{"subtype": "success", "request_id": id, "response": answer}})
	r.mu.Unlock()
	if err != nil {
		r.finish("Approval delivery could not be confirmed; Claude Code chat stopped without replay.")
	}
	return err
}

type claudeBlock struct {
	Type      string          `json:"type"`
	Text      string          `json:"text"`
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Input     json.RawMessage `json:"input"`
	ToolUseID string          `json:"tool_use_id"`
	Content   json.RawMessage `json:"content"`
	IsError   bool            `json:"is_error"`
}
type claudeLine struct {
	Type           string          `json:"type"`
	Subtype        string          `json:"subtype"`
	SessionID      string          `json:"session_id"`
	Model          string          `json:"model"`
	UUID           string          `json:"uuid"`
	Error          json.RawMessage `json:"error"`
	IsError        bool            `json:"is_error"`
	Result         string          `json:"result"`
	Errors         []string        `json:"errors"`
	TerminalReason string          `json:"terminal_reason"`
	Message        struct {
		ID      string        `json:"id"`
		Model   string        `json:"model"`
		Content []claudeBlock `json:"content"`
	} `json:"message"`
	RequestID string                  `json:"request_id"`
	Request   claudePermissionRequest `json:"request"`
	Response  struct {
		Subtype   string          `json:"subtype"`
		RequestID string          `json:"request_id"`
		Error     json.RawMessage `json:"error"`
		Response  json.RawMessage `json:"response"`
	} `json:"response"`
}

func claudeToolDetail(name string, input json.RawMessage) string {
	label := claudeToolLabel(name, input)
	if name == "Bash" || name == "PowerShell" {
		return label
	}
	return label + "\n" + string(input)
}

func claudeToolLabel(name string, input json.RawMessage) string {
	var fields map[string]any
	_ = json.Unmarshal(input, &fields)
	if name == "Bash" || name == "PowerShell" {
		if command, ok := fields["command"].(string); ok && command != "" {
			return command
		}
	}
	for _, key := range []string{"file_path", "path", "notebook_path", "url", "pattern", "query", "command"} {
		if target, ok := fields[key].(string); ok && target != "" {
			return name + " " + target
		}
	}
	return name
}
func claudeContent(raw json.RawMessage) string {
	var text string
	if json.Unmarshal(raw, &text) == nil {
		return text
	}
	var blocks []claudeBlock
	if json.Unmarshal(raw, &blocks) != nil {
		return ""
	}
	var parts []string
	for _, block := range blocks {
		if block.Type == "text" {
			parts = append(parts, block.Text)
		}
	}
	return strings.Join(parts, "\n")
}
func claudeItem(r *running, it Item) {
	it.Truncated = it.Truncated || len(it.Text) > maxText
	it.Text = clip(it.Text)
	if it.Truncated {
		r.session.Truncated = true
	}
	r.put(it)
}

func (c *claudeProvider) receive(r *running, data []byte) error {
	var envelope struct {
		Type    string `json:"type"`
		Subtype string `json:"subtype"`
	}
	if json.Unmarshal(data, &envelope) != nil {
		return errors.New("Claude Code sent invalid protocol data")
	}
	switch envelope.Type {
	case "system":
		if envelope.Subtype != "init" {
			return nil
		}
	case "assistant", "user", "result", "control_request", "control_response":
	default:
		return nil
	}
	var line claudeLine
	if json.Unmarshal(data, &line) != nil {
		return errors.New("Claude Code sent invalid protocol data")
	}
	if line.Type == "control_response" {
		r.mu.Lock()
		ch := r.pending["claude:"+line.Response.RequestID]
		r.mu.Unlock()
		if ch != nil {
			reply := packet{Result: line.Response.Response}
			if line.Response.Subtype == "error" {
				message := "Claude Code refused the control request"
				var detail string
				if json.Unmarshal(line.Response.Error, &detail) == nil && detail != "" {
					message = detail
				}
				reply.Error = &struct {
					Code    int    `json:"code"`
					Message string `json:"message"`
				}{Message: message}
			} else if line.Response.Subtype != "success" {
				return nil
			}
			select {
			case ch <- reply:
			default:
			}
		}
		return nil
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.session.State == "exited" {
		return nil
	}
	if line.SessionID != "" && r.session.ThreadID != "" && line.SessionID != r.session.ThreadID {
		return nil
	}
	if line.Type == "system" {
		if line.Subtype != "init" {
			return nil
		}
		if line.SessionID == "" {
			return errors.New("Claude Code returned no session identity")
		}
		if r.session.ThreadID == "" {
			r.session.ThreadID = line.SessionID
			r.session.Options.Model = line.Model
			r.session.State = "idle"
			c.initOnce.Do(func() { close(c.initialized) })
		}
		return nil
	}
	var errorName string
	_ = json.Unmarshal(line.Error, &errorName)
	if errorName == "authentication_failed" {
		reason := "Claude Code is not signed in on this computer. Run `claude` there and sign in."
		r.invalidate(reason)
		return errors.New(reason)
	}
	if r.session.TurnID == "" {
		return nil
	}
	switch line.Type {
	case "assistant":
		// Synthetic error messages describe the provider, not an agent reply.
		if errorName != "" || line.Message.Model == "<synthetic>" {
			parts := []string{}
			for _, block := range line.Message.Content {
				if block.Type == "text" {
					parts = append(parts, block.Text)
				}
			}
			reason := strings.Join(parts, "\n")
			if reason == "" {
				reason = errorName
			}
			if reason == "" {
				reason = "Claude Code could not answer this message"
			}
			r.session.Error = clip(reason)
			return nil
		}
		c.sequence++
		identity := line.Message.ID
		if identity == "" {
			identity = line.UUID
		}
		if identity == "" {
			identity = fmt.Sprint(c.sequence)
		}
		for i, block := range line.Message.Content {
			switch block.Type {
			case "text":
				if block.Text != "" {
					c.spoke = true
					claudeItem(r, Item{ID: r.session.TurnID + "/" + identity + fmt.Sprintf("/%d", i), Kind: "assistant", Text: block.Text})
				}
			case "tool_use":
				if block.ID == "" || block.Name == "" {
					continue
				}
				claudeItem(r, Item{ID: r.session.TurnID + "/tool/" + block.ID, Kind: "tool", Text: claudeToolLabel(block.Name, block.Input), Status: "inProgress"})
			}
		}
	case "user":
		for _, block := range line.Message.Content {
			if block.Type != "tool_result" {
				continue
			}
			for _, old := range r.session.Items {
				if old.ID == r.session.TurnID+"/tool/"+block.ToolUseID && old.Kind == "tool" {
					old.Text += "\n" + claudeContent(block.Content)
					old.Status = "completed"
					if block.IsError {
						old.Status = "failed"
					}
					claudeItem(r, old)
					break
				}
			}
		}
	case "result":
		if line.IsError || strings.HasPrefix(line.Subtype, "error") || line.TerminalReason == "api_error" {
			reason := strings.Join(line.Errors, "\n")
			if reason == "" {
				reason = line.Result
			}
			if reason == "" && r.session.Error == "" {
				reason = "Claude Code could not finish this turn (" + line.Subtype + ")"
			}
			if reason != "" {
				r.session.Error = clip(reason)
			}
		} else if !c.spoke && line.Result != "" && r.session.Error == "" {
			claudeItem(r, Item{ID: r.session.TurnID + "/result", Kind: "assistant", Text: line.Result})
		}
		for i, it := range r.session.Items {
			if it.Kind == "tool" && it.Status == "inProgress" {
				r.session.Items[i].Status = "interrupted"
			}
		}
		r.session.State = "idle"
		r.session.TurnID = ""
		r.submitted = ""
		r.session.Approvals = []Approval{}
		r.approvals = map[string]json.RawMessage{}
		r.cancelBrowser()
		r.cancelTools()
		if r.idle != nil {
			go r.idle()
		}
	case "control_request":
		if line.Request.Subtype != "can_use_tool" {
			return nil
		}
		req := line.Request
		detail := claudeToolDetail(req.Tool, req.Input)
		if line.RequestID == "" || len(line.RequestID) > 200 || req.Tool == "" || len(req.Input) == 0 || req.Input[0] != '{' || len(data) > maxText || len(detail) > maxText || len(r.approvals) >= 8 || r.approvals[line.RequestID] != nil {
			reason := "Claude Code requested an invalid or oversized permission; chat stopped without granting permission"
			r.invalidate(reason)
			return errors.New(reason)
		}
		raw, _ := json.Marshal(req)
		kind := "tool"
		if req.Tool == "Bash" || req.Tool == "PowerShell" {
			kind = "command"
		}
		if req.Tool == "Edit" || req.Tool == "Write" || req.Tool == "MultiEdit" || req.Tool == "NotebookEdit" {
			kind = "files"
		}
		reason := req.Reason
		if reason == "" {
			reason = req.DecisionReason
		}
		r.approvals[line.RequestID] = raw
		r.session.Approvals = append(r.session.Approvals, Approval{ID: line.RequestID, Kind: kind, Detail: detail, Reason: reason, SessionAllowed: len(req.sessionRules()) > 0})
		r.session.State = "waiting"
	}
	return nil
}

func (c *claudeProvider) models(ctx context.Context, r *running) ([]Model, error) {
	if r.snapshot().State == "exited" {
		return nil, errors.New("Claude Code chat has stopped")
	}
	return ClaudeModels(ctx, r.launchOptions.Program, r.launchOptions.Env)
}

// ClaudeHelpSupportsChat includes the hidden permission flag's reference in
// help. Its stdio value was checked with CLI 2.1.293 by the integrator.
func ClaudeHelpSupportsChat(help string) bool {
	for _, required := range []string{"--print", "--input-format", "--output-format", "stream-json", "--verbose", "--permission-prompt-tool", "--permission-mode", "manual", "acceptEdits", "bypassPermissions", "plan", "--allow-dangerously-skip-permissions", "--model", "--resume", "--mcp-config"} {
		if !strings.Contains(help, required) {
			return false
		}
	}
	return true
}
func claudeHelp(ctx context.Context, program string, env []string) (string, error) {
	if program == "" {
		return "", errors.New("Claude Code is not installed")
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	cmd := backgroundcmd.CommandContext(ctx, program, "--help")
	cmd.Env = env
	pipe, err := cmd.StdoutPipe()
	if err != nil {
		return "", err
	}
	if err = cmd.Start(); err != nil {
		return "", err
	}
	out, readErr := io.ReadAll(io.LimitReader(pipe, (256<<10)+1))
	if len(out) > 256<<10 {
		_ = cmd.Process.Kill()
	}
	err = cmd.Wait()
	if readErr != nil {
		return "", readErr
	}
	if err != nil {
		return "", err
	}
	if len(out) > 256<<10 {
		return "", errors.New("Claude Code help exceeded limit")
	}
	return string(out), nil
}
func ClaudeSupportsChat(ctx context.Context, program string, env []string) bool {
	help, err := claudeHelp(ctx, program, env)
	return err == nil && ClaudeHelpSupportsChat(help)
}
func ClaudeModels(ctx context.Context, program string, env []string) ([]Model, error) {
	help, err := claudeHelp(ctx, program, env)
	if err != nil {
		return nil, err
	}
	out := []Model{{Model: "default", DisplayName: "Default", SupportedReasoningEfforts: []struct {
		Effort string `json:"reasoningEffort"`
	}{}}}
	// Offer only aliases explicitly quoted in this CLI's model help paragraph.
	start := strings.Index(help, "--model <model>")
	if start < 0 {
		return out, nil
	}
	section := help[start:]
	if end := strings.Index(section, "\n  -"); end >= 0 {
		section = section[:end]
	}
	if !strings.Contains(section, "alias") {
		return out, nil
	}
	seen := map[string]bool{"default": true}
	aliases := regexp.MustCompile(`['"]([a-z][a-z0-9_-]{0,63})['"]`)
	for _, match := range aliases.FindAllStringSubmatch(section, -1) {
		alias := match[1]
		if seen[alias] {
			continue
		}
		seen[alias] = true
		out = append(out, Model{Model: alias, DisplayName: alias, SupportedReasoningEfforts: []struct {
			Effort string `json:"reasoningEffort"`
		}{}})
	}
	return out, nil
}
