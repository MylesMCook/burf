package localchat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/MylesMCook/burf/internal/acp"
)

// acpProvider speaks Agent Client Protocol for Claude (claude-agent-acp) and
// Cursor (agent acp). The manager still owns the process and stdio lines.
type acpProvider struct {
	agent      string
	authMethod string
	mu         sync.Mutex
	promptKey  string
	assistant  string
	tools      map[string]string
}

func newClaudeACP() *acpProvider {
	return &acpProvider{agent: "claude", tools: map[string]string{}}
}

func newCursorACP() *acpProvider {
	return &acpProvider{agent: "cursor", authMethod: "cursor_login", tools: map[string]string{}}
}

func (p *acpProvider) label() string {
	if p.agent == "cursor" {
		return "Cursor"
	}
	return "Claude Code"
}

func (p *acpProvider) call(ctx context.Context, r *running, method string, params any) (json.RawMessage, error) {
	return p.callFor(ctx, r, method, params, 20*time.Second)
}

func (p *acpProvider) callFor(ctx context.Context, r *running, method string, params any, timeout time.Duration) (json.RawMessage, error) {
	if timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}
	r.mu.Lock()
	r.next++
	id := fmt.Sprintf("burf-%d", r.next)
	ch := make(chan packet, 1)
	key := fmt.Sprintf("%q", id)
	r.pending[key] = ch
	r.mu.Unlock()
	defer func() { r.mu.Lock(); delete(r.pending, key); r.mu.Unlock() }()
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if err := r.queue(acp.Request(id, method, params)); err != nil {
		return nil, err
	}
	select {
	case reply := <-ch:
		if reply.Error != nil {
			return nil, rejection(reply.Error.Message)
		}
		return reply.Result, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-r.done:
		return nil, errors.New(p.label() + " disconnected")
	}
}

func (p *acpProvider) reply(r *running, id json.RawMessage, result any) error {
	return r.queue(acp.Result(id, result))
}

func (p *acpProvider) mcpServers(options LaunchOptions) []any {
	servers := []any{}
	if options.Tools != nil {
		command, arguments := options.Tools.Server(options.chatID)
		servers = append(servers, map[string]any{
			"type": "stdio", "name": ToolServer, "command": command, "args": arguments, "env": []any{},
		})
	}
	if options.Browser != nil {
		command, arguments := options.Browser.Server(options.chatID)
		servers = append(servers, map[string]any{
			"type": "stdio", "name": BrowserServer, "command": command, "args": arguments, "env": []any{},
		})
	}
	return servers
}

func (p *acpProvider) start(ctx context.Context, r *running, options LaunchOptions) error {
	initCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	_, err := p.call(initCtx, r, "initialize", map[string]any{
		"protocolVersion":    acp.ProtocolVersion,
		"clientCapabilities": acp.ClientCapabilities(),
		"clientInfo":         acp.ClientInfo(),
	})
	if err != nil {
		r.finish(p.label() + " chat could not start: " + err.Error())
		return err
	}
	if p.authMethod != "" {
		if _, err = p.call(initCtx, r, "authenticate", map[string]any{"methodId": p.authMethod}); err != nil {
			// Pre-auth via agent login / CURSOR_API_KEY is enough when authenticate refuses.
			if !strings.Contains(strings.ToLower(err.Error()), "already") {
				r.finish(p.label() + " chat could not authenticate: " + err.Error())
				return err
			}
		}
	}
	params := map[string]any{"cwd": r.session.CWD, "mcpServers": p.mcpServers(options)}
	method := "session/new"
	if options.Fork != "" {
		method = "session/load"
		params["sessionId"] = options.Fork
	}
	result, err := p.call(initCtx, r, method, params)
	if err != nil {
		r.finish(p.label() + " chat could not start: " + err.Error())
		return err
	}
	var reply struct {
		SessionID string `json:"sessionId"`
	}
	if json.Unmarshal(result, &reply) != nil || reply.SessionID == "" {
		// session/load may return the same id without echoing it.
		if options.Fork != "" {
			reply.SessionID = options.Fork
		}
	}
	if reply.SessionID == "" {
		err = errors.New(p.label() + " returned no session identity")
		r.finish(err.Error())
		return err
	}
	r.mu.Lock()
	r.session.ThreadID = reply.SessionID
	if r.session.State != "exited" {
		r.session.State = "idle"
	}
	r.mu.Unlock()
	return nil
}

func acpMode(permission string) string {
	switch permission {
	case "read-only":
		return "ask"
	case "workspace", "full-access":
		return "agent"
	default:
		return "ask"
	}
}

func (p *acpProvider) send(ctx context.Context, r *running, text string, options TurnOptions, kind string) error {
	if options.Effort != "" {
		return errors.New(p.label() + " chat does not support per-message reasoning effort")
	}
	r.mu.Lock()
	if r.session.State != "idle" {
		r.mu.Unlock()
		return errors.New("chat is not ready for a message")
	}
	if options.Permission != "" {
		r.session.Options.Permission = options.Permission
	}
	if options.Model != "" {
		r.session.Options.Model = options.Model
	}
	r.next++
	turn := fmt.Sprintf("acp-turn-%d", r.next)
	r.session.TurnID = turn
	r.submitted = turn + "-user"
	r.put(Item{ID: r.submitted, Kind: kind, Text: text})
	r.permission = r.session.Options.Permission
	r.session.State = "running"
	r.session.Error = ""
	sessionID := r.session.ThreadID
	r.next++
	id := fmt.Sprintf("burf-%d", r.next)
	key := fmt.Sprintf("%q", id)
	r.pending[key] = make(chan packet, 1)
	p.mu.Lock()
	p.promptKey = key
	p.assistant = turn + "-assistant"
	p.tools = map[string]string{}
	p.mu.Unlock()
	r.mu.Unlock()

	params := map[string]any{
		"sessionId": sessionID,
		"prompt":    acp.TextPrompt(text),
	}
	if mode := acpMode(options.Permission); mode != "" && options.Permission != "" {
		// Cursor accepts mode on the prompt; unknown fields are ignored by others.
		params["_meta"] = map[string]any{"burf.permission": options.Permission, "cursor.mode": mode}
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := r.queue(acp.Request(id, "session/prompt", params)); err != nil {
		r.finish("Message delivery is uncertain; " + p.label() + " chat stopped without replay.")
		return err
	}
	return nil
}

func (p *acpProvider) interrupt(ctx context.Context, r *running, s Session) error {
	r.mu.Lock()
	pending := make([]json.RawMessage, 0, len(r.approvals))
	for id, raw := range r.approvals {
		var stored struct {
			RPCID json.RawMessage `json:"rpcId"`
		}
		_ = json.Unmarshal(raw, &stored)
		if len(stored.RPCID) > 0 {
			pending = append(pending, stored.RPCID)
		}
		delete(r.approvals, id)
	}
	r.session.Approvals = []Approval{}
	r.approvals = map[string]json.RawMessage{}
	r.cancelBrowser()
	r.cancelTools()
	if r.session.State != "exited" {
		r.session.State = "running"
	}
	sessionID := s.ThreadID
	r.mu.Unlock()
	for _, rpcID := range pending {
		_ = p.reply(r, rpcID, acp.PermissionCancelled())
	}
	if err := r.queue(acp.Notification("session/cancel", map[string]any{"sessionId": sessionID})); err != nil {
		r.finish("Interrupt could not be confirmed; " + p.label() + " chat stopped without replay.")
		return err
	}
	return ctx.Err()
}

func (p *acpProvider) decide(r *running, id, decision string) error {
	r.mu.Lock()
	raw, ok := r.approvals[id]
	if !ok || r.session.State == "exited" {
		r.mu.Unlock()
		return errors.New("approval is no longer pending")
	}
	var stored struct {
		Options []struct {
			OptionID string `json:"optionId"`
			Kind     string `json:"kind"`
		} `json:"options"`
		CursorMethod string          `json:"cursorMethod,omitempty"`
		RPCID        json.RawMessage `json:"rpcId"`
	}
	_ = json.Unmarshal(raw, &stored)
	optionID := ""
	pick := func(kinds ...string) string {
		for _, want := range kinds {
			for _, opt := range stored.Options {
				if opt.Kind == want {
					return opt.OptionID
				}
			}
		}
		return ""
	}
	switch decision {
	case "decline":
		optionID = pick("reject_once", "reject_always")
		if optionID == "" {
			optionID = "reject-once"
		}
	case "acceptForSession", "acceptAlways":
		optionID = pick("allow_always")
		if optionID == "" {
			optionID = pick("allow_once")
		}
		if optionID == "" {
			optionID = "allow-always"
		}
	default:
		optionID = pick("allow_once", "allow_always")
		if optionID == "" {
			optionID = "allow-once"
		}
	}
	delete(r.approvals, id)
	r.dropApproval(id)
	rpcID := stored.RPCID
	cursorMethod := stored.CursorMethod
	r.mu.Unlock()
	var result any = acp.PermissionSelected(optionID)
	switch cursorMethod {
	case "cursor/create_plan":
		outcome := "accepted"
		if decision == "decline" {
			outcome = "rejected"
		}
		result = map[string]any{"outcome": map[string]any{"outcome": outcome}}
	case "cursor/ask_question":
		if decision == "decline" {
			result = map[string]any{"outcome": map[string]any{"outcome": "skipped"}}
		} else {
			result = map[string]any{"outcome": map[string]any{"outcome": "cancelled"}}
		}
	}
	if len(rpcID) == 0 {
		rpcID, _ = json.Marshal(id)
	}
	if err := p.reply(r, rpcID, result); err != nil {
		r.finish("Approval delivery could not be confirmed; " + p.label() + " chat stopped without replay.")
		return err
	}
	return nil
}

func (p *acpProvider) models(ctx context.Context, r *running) ([]Model, error) {
	if r.snapshot().State == "exited" {
		return nil, errors.New(p.label() + " chat has stopped")
	}
	if p.agent == "claude" {
		return ClaudeModels(ctx, r.launchOptions.Program, r.launchOptions.Env)
	}
	return []Model{{Model: "default", DisplayName: "Default", SupportedReasoningEfforts: []struct {
		Effort string `json:"reasoningEffort"`
	}{}}}, nil
}

func (p *acpProvider) receive(r *running, data []byte) error {
	var msg packet
	if json.Unmarshal(data, &msg) != nil {
		return errors.New(p.label() + " sent invalid protocol data")
	}
	if msg.Method == "" {
		r.mu.Lock()
		ch := r.pending[string(msg.ID)]
		promptKey := ""
		p.mu.Lock()
		promptKey = p.promptKey
		p.mu.Unlock()
		isPrompt := string(msg.ID) == promptKey || (promptKey != "" && string(msg.ID) == promptKey)
		if ch != nil && !isPrompt {
			r.mu.Unlock()
			select {
			case ch <- msg:
			default:
			}
			return nil
		}
		if promptKey != "" && (string(msg.ID) == promptKey || ch != nil && string(msg.ID) == promptKey) {
			delete(r.pending, promptKey)
			p.mu.Lock()
			p.promptKey = ""
			p.mu.Unlock()
			if msg.Error != nil {
				r.session.Error = msg.Error.Message
			}
			if r.session.State != "exited" {
				r.session.State = "idle"
				r.session.TurnID = ""
			}
			r.mu.Unlock()
			if r.idle != nil {
				r.idle()
			}
			return nil
		}
		r.mu.Unlock()
		if ch != nil {
			select {
			case ch <- msg:
			default:
			}
		}
		return nil
	}

	switch msg.Method {
	case "session/update":
		return p.onUpdate(r, msg.Params)
	case "session/request_permission":
		return p.onPermission(r, msg.ID, msg.Params)
	case "cursor/ask_question":
		return p.onCursorAsk(r, msg.ID, msg.Params)
	case "cursor/create_plan":
		return p.onCursorPlan(r, msg.ID, msg.Params)
	case "cursor/update_todos", "cursor/task", "cursor/generate_image":
		return nil
	default:
		// Unknown agent→client requests get a method-not-found error when they expect a reply.
		if len(msg.ID) > 0 {
			_ = r.queue(acp.Error(msg.ID, -32601, "method not supported"))
		}
		return nil
	}
}

func (p *acpProvider) onUpdate(r *running, params json.RawMessage) error {
	var note struct {
		SessionID string `json:"sessionId"`
		Update    struct {
			SessionUpdate string `json:"sessionUpdate"`
			MessageID     string `json:"messageId"`
			Content       struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
			ToolCallID string          `json:"toolCallId"`
			Title      string          `json:"title"`
			Kind       string          `json:"kind"`
			Status     string          `json:"status"`
			RawInput   json.RawMessage `json:"rawInput"`
		} `json:"update"`
	}
	if json.Unmarshal(params, &note) != nil {
		return nil
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.session.State == "exited" {
		return nil
	}
	if note.SessionID != "" && r.session.ThreadID != "" && note.SessionID != r.session.ThreadID {
		return nil
	}
	switch note.Update.SessionUpdate {
	case "agent_message_chunk", "agent_thought_chunk":
		if note.Update.SessionUpdate == "agent_thought_chunk" {
			return nil
		}
		text := note.Update.Content.Text
		if text == "" {
			return nil
		}
		p.mu.Lock()
		id := p.assistant
		if note.Update.MessageID != "" {
			id = note.Update.MessageID
			p.assistant = id
		}
		p.mu.Unlock()
		if id == "" {
			id = "acp-assistant"
		}
		existing := ""
		for _, it := range r.session.Items {
			if it.ID == id {
				existing = it.Text
				break
			}
		}
		r.put(Item{ID: id, Kind: "assistant", Text: existing + text})
	case "tool_call", "tool_call_update":
		id := note.Update.ToolCallID
		if id == "" {
			return nil
		}
		title := note.Update.Title
		if title == "" {
			title = note.Update.Kind
		}
		if title == "" {
			title = "tool"
		}
		status := note.Update.Status
		if status == "" {
			status = "running"
		}
		if status == "completed" || status == "failed" {
			// keep
		} else if status == "in_progress" || status == "pending" {
			status = "running"
		}
		detail := title
		if len(note.Update.RawInput) > 0 && note.Update.RawInput[0] == '{' {
			detail = title + "\n" + string(note.Update.RawInput)
		}
		r.put(Item{ID: id, Kind: "tool", Text: clip(detail), Status: status})
	case "user_message_chunk", "plan", "available_commands_update", "current_mode_update", "config_option_update", "session_info_update", "usage_update":
		if note.Update.SessionUpdate == "session_info_update" {
			var info struct {
				Update struct {
					Title string `json:"title"`
				} `json:"update"`
			}
			_ = json.Unmarshal(params, &info)
			if info.Update.Title != "" && r.session.Title == "" {
				r.session.Title = info.Update.Title
			}
		}
	}
	return nil
}

func (p *acpProvider) onPermission(r *running, id json.RawMessage, params json.RawMessage) error {
	var req struct {
		SessionID string `json:"sessionId"`
		Options   []struct {
			OptionID string `json:"optionId"`
			Name     string `json:"name"`
			Kind     string `json:"kind"`
		} `json:"options"`
		ToolCall struct {
			ToolCallID string          `json:"toolCallId"`
			Title      string          `json:"title"`
			Kind       string          `json:"kind"`
			RawInput   json.RawMessage `json:"rawInput"`
		} `json:"toolCall"`
	}
	if json.Unmarshal(params, &req) != nil {
		return p.reply(r, id, acp.PermissionCancelled())
	}
	detail := req.ToolCall.Title
	if detail == "" {
		detail = req.ToolCall.Kind
	}
	if len(req.ToolCall.RawInput) > 0 {
		detail = strings.TrimSpace(detail + "\n" + string(req.ToolCall.RawInput))
	}
	kind := "command"
	if strings.Contains(strings.ToLower(req.ToolCall.Kind), "edit") || strings.Contains(strings.ToLower(detail), "diff") {
		kind = "files"
	}
	approvalID := req.ToolCall.ToolCallID
	if approvalID == "" {
		approvalID = string(id)
	}
	stored, _ := json.Marshal(struct {
		Options []struct {
			OptionID string `json:"optionId"`
			Name     string `json:"name"`
			Kind     string `json:"kind"`
		} `json:"options"`
		RPCID json.RawMessage `json:"rpcId"`
	}{Options: req.Options, RPCID: id})
	sessionAllowed := false
	for _, opt := range req.Options {
		if opt.Kind == "allow_always" {
			sessionAllowed = true
		}
	}
	r.mu.Lock()
	r.approvals[approvalID] = stored
	r.session.Approvals = append(r.session.Approvals, Approval{
		ID: approvalID, Kind: kind, Detail: clip(detail), SessionAllowed: sessionAllowed,
	})
	if r.session.State != "exited" {
		r.session.State = "waiting"
	}
	r.mu.Unlock()
	return nil
}

func (p *acpProvider) onCursorAsk(r *running, id json.RawMessage, params json.RawMessage) error {
	var req struct {
		ToolCallID string `json:"toolCallId"`
		Title      string `json:"title"`
		Questions  []struct {
			Prompt string `json:"prompt"`
		} `json:"questions"`
	}
	_ = json.Unmarshal(params, &req)
	detail := req.Title
	for _, q := range req.Questions {
		if q.Prompt != "" {
			detail = strings.TrimSpace(detail + "\n" + q.Prompt)
		}
	}
	approvalID := req.ToolCallID
	if approvalID == "" {
		approvalID = string(id)
	}
	stored, _ := json.Marshal(struct {
		CursorMethod string          `json:"cursorMethod"`
		RPCID        json.RawMessage `json:"rpcId"`
	}{CursorMethod: "cursor/ask_question", RPCID: id})
	r.mu.Lock()
	r.approvals[approvalID] = stored
	r.session.Approvals = append(r.session.Approvals, Approval{ID: approvalID, Kind: "command", Detail: clip(detail), Reason: "Cursor question"})
	if r.session.State != "exited" {
		r.session.State = "waiting"
	}
	r.mu.Unlock()
	return nil
}

func (p *acpProvider) onCursorPlan(r *running, id json.RawMessage, params json.RawMessage) error {
	var req struct {
		ToolCallID string `json:"toolCallId"`
		Name       string `json:"name"`
		Overview   string `json:"overview"`
		Plan       string `json:"plan"`
	}
	_ = json.Unmarshal(params, &req)
	detail := strings.TrimSpace(req.Name + "\n" + req.Overview + "\n" + req.Plan)
	approvalID := req.ToolCallID
	if approvalID == "" {
		approvalID = string(id)
	}
	stored, _ := json.Marshal(struct {
		CursorMethod string          `json:"cursorMethod"`
		RPCID        json.RawMessage `json:"rpcId"`
	}{CursorMethod: "cursor/create_plan", RPCID: id})
	r.mu.Lock()
	r.approvals[approvalID] = stored
	r.session.Approvals = append(r.session.Approvals, Approval{ID: approvalID, Kind: "files", Detail: clip(detail), Reason: "Approve plan"})
	if r.session.State != "exited" {
		r.session.State = "waiting"
	}
	r.mu.Unlock()
	return nil
}
