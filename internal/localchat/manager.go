// Package localchat owns structured provider chats, never externally started chats.
package localchat

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

var ErrNotFound = errors.New("local chat not found")

const maxText = 64 << 10
const maxItems = 200
const maxSnapshot = 4 << 20

type Process interface{ io.ReadWriteCloser }
type LaunchOptions struct {
	// Agent defaults to codex for callers predating structured Claude chat.
	Agent   string
	chatID  string
	Program string
	CWD     string
	// Env replaces the provider environment; nil inherits the current environment.
	Env []string
	// Browser, when set, offers one client's browser tools to this chat only.
	Browser *Browser
	// Tools, when set, gives this chat Burf's own tools.
	Tools *Tools
}
type Launch func(LaunchOptions) (Process, error)

// ErrRejected marks a request the provider answered with an error. Nothing
// started, so the chat stays usable; a lost reply is the uncertain case.
var ErrRejected = errors.New("Codex rejected the request")

type rejection string

func (e rejection) Error() string   { return string(e) }
func (e rejection) Is(t error) bool { return t == ErrRejected }

type Item struct {
	ID         string `json:"id"`
	Kind       string `json:"kind"`
	Text       string `json:"text"`
	Status     string `json:"status,omitempty"`
	Truncated  bool   `json:"truncated,omitempty"`
	sourceType string
}
type Approval struct {
	ID             string   `json:"id"`
	Kind           string   `json:"kind"`
	Detail         string   `json:"detail"`
	Reason         string   `json:"reason,omitempty"`
	SessionAllowed bool     `json:"session_allowed,omitempty"`
	Execpolicy     []string `json:"execpolicy,omitempty"`
	itemID         string
	// elicitation marks a request answered with an action, not a decision.
	elicitation bool
}

type fileChange struct {
	Path string `json:"path"`
	Diff string `json:"diff"`
	Kind struct {
		Type     string `json:"type"`
		MovePath string `json:"move_path"`
	} `json:"kind"`
}

func patchDetail(changes []fileChange) (string, bool) {
	var b strings.Builder
	valid := len(changes) > 0
	for _, c := range changes {
		if c.Path == "" || (c.Kind.Type != "add" && c.Kind.Type != "delete" && c.Kind.Type != "update") {
			valid = false
		}
		fmt.Fprintf(&b, "%s: %s\n", c.Kind.Type, c.Path)
		if c.Kind.MovePath != "" {
			fmt.Fprintf(&b, "Move to: %s\n", c.Kind.MovePath)
		}
		b.WriteString(c.Diff)
		b.WriteByte('\n')
	}
	return b.String(), valid
}

type Session struct {
	ID        string      `json:"id"`
	Agent     string      `json:"agent"`
	Mode      string      `json:"mode"`
	CWD       string      `json:"cwd"`
	State     string      `json:"state"`
	StartedAt time.Time   `json:"started_at"`
	ThreadID  string      `json:"thread_id"`
	TurnID    string      `json:"turn_id,omitempty"`
	Items     []Item      `json:"items"`
	Approvals []Approval  `json:"approvals"`
	Error     string      `json:"error,omitempty"`
	Truncated bool        `json:"truncated,omitempty"`
	Options   TurnOptions `json:"options"`
	Composer  bool        `json:"composer"`
	// Permission modes the composer may offer for the next message.
	Permissions []string `json:"permissions,omitempty"`
	// Browser is set only for a chat started with browser tools.
	Browser *BrowserState `json:"browser,omitempty"`
}
type packet struct {
	ID     json.RawMessage `json:"id,omitempty"`
	Method string          `json:"method,omitempty"`
	Params json.RawMessage `json:"params,omitempty"`
	Result json.RawMessage `json:"result,omitempty"`
	Error  *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}
type running struct {
	provider      provider
	launchOptions LaunchOptions
	mu            sync.Mutex
	op            sync.Mutex
	session       Session
	process       Process
	writes        chan []byte
	done          chan struct{}
	once          sync.Once
	next          uint64
	pending       map[string]chan packet
	approvals     map[string]json.RawMessage
	submitted     string
	// browser holds the provider calls waiting for the chat's browser.
	browser     map[string]chan BrowserResult
	browserWake chan struct{}
	// tools says the chat was given Burf's tools; toolAsks holds the ones
	// waiting for the person's answer.
	tools    bool
	toolAsks map[string]chan bool
	// permission is what the running turn was started with. The session's
	// own is only the last one the provider accepted, which a turn that is
	// starting has not replaced yet.
	permission string
	// idle runs, off the lock, each time a turn ends.
	idle func()
}
type Manager struct {
	mu       sync.Mutex
	program  string
	launch   Launch
	sessions map[string]*running
	closed   bool
	probe    sync.Mutex
	listed   map[string]listedModels
	// Idle, when set before any chat starts, is called each time a chat's
	// turn ends: whoever holds messages for an idle chat looks again.
	Idle func()
}

func New(program string, launch Launch) *Manager {
	return &Manager{program: program, launch: launch, sessions: make(map[string]*running)}
}

func (m *Manager) Start(ctx context.Context, cwd string) (Session, error) {
	return m.StartWith(ctx, LaunchOptions{Program: m.program, CWD: cwd, Env: os.Environ()})
}

// StartWith binds one chat to its resolved project executable and account
// environment without changing the defaults used by other concurrent chats.
func (m *Manager) StartWith(ctx context.Context, options LaunchOptions) (Session, error) {
	r, err := m.startProcess(ctx, options)
	if err != nil {
		return Session{}, err
	}
	go r.read()
	go r.write()
	if err = r.provider.start(ctx, r, options); err != nil {
		r.finish(err.Error())
		return r.snapshot(), err
	}
	return r.snapshot(), nil
}

func (codexProvider) start(ctx context.Context, r *running, options LaunchOptions) error {
	var err error
	initCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	_, err = r.call(initCtx, "initialize", map[string]any{"clientInfo": map[string]string{"name": "burf", "title": "Burf", "version": "1"}})
	if err == nil {
		err = r.queue(map[string]any{"method": "initialized"})
	}
	var result json.RawMessage
	if err == nil {
		params := map[string]any{"cwd": r.session.CWD, "approvalPolicy": "untrusted", "sandbox": "read-only", "approvalsReviewer": "user"}
		servers := map[string]any{}
		if options.Browser != nil {
			servers[BrowserServer] = options.Browser.serverConfig(r.session.ID)
		}
		if options.Tools != nil {
			servers[ToolServer] = options.Tools.serverConfig(r.session.ID)
		}
		if len(servers) > 0 {
			params["config"] = map[string]any{"mcp_servers": servers}
		}
		result, err = r.call(initCtx, "thread/start", params)
	}
	var reply struct {
		Thread struct {
			ID string `json:"id"`
		} `json:"thread"`
	}
	if err == nil {
		err = json.Unmarshal(result, &reply)
		if err == nil && reply.Thread.ID == "" {
			err = errors.New("Codex returned no thread identity")
		}
	}
	if err != nil {
		r.finish("Codex chat could not start: " + err.Error())
		return err
	}
	r.mu.Lock()
	r.session.ThreadID = reply.Thread.ID
	if r.session.State != "exited" {
		r.session.State = "idle"
	}
	r.mu.Unlock()
	return nil
}

// Publish a starting process before its handshake. Slow provider startup must
// not hold the registry lock needed to inspect or stop another owned chat.
func (m *Manager) startProcess(ctx context.Context, options LaunchOptions) (*running, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if m.closed {
		return nil, errors.New("local chats are shutting down")
	}
	if options.Agent == "" {
		options.Agent = "codex"
	}
	var backend provider
	switch options.Agent {
	case "codex":
		backend = codexProvider{}
	case "claude":
		backend = newClaudeProvider()
	default:
		return nil, errors.New("unsupported chat agent")
	}
	if options.Program == "" {
		if options.Agent == "claude" {
			return nil, errors.New("Claude Code is not installed with support for structured chat")
		}
		return nil, errors.New("installed Codex CLI does not support app-server chat")
	}
	if !filepath.IsAbs(options.CWD) {
		return nil, errors.New("project directory must be absolute")
	}
	cwd := filepath.Clean(options.CWD)
	options.CWD = cwd
	if options.Env != nil {
		options.Env = append([]string{}, options.Env...)
	}
	st, err := os.Stat(cwd)
	if err != nil || !st.IsDir() {
		return nil, errors.New("project directory does not exist")
	}
	if options.Browser != nil {
		if err = options.Browser.validate(); err != nil {
			return nil, err
		}
	}
	if options.Tools != nil && options.Tools.Server == nil {
		return nil, errors.New("Burf tools are unavailable")
	}
	active := 0
	for _, r := range m.sessions {
		r.mu.Lock()
		if r.session.State != "exited" {
			active++
		}
		r.mu.Unlock()
	}
	if active >= 8 {
		return nil, errors.New("stop a local chat before starting another (limit 8)")
	}
	var bytes [16]byte
	if _, err = rand.Read(bytes[:]); err != nil {
		return nil, err
	}
	options.chatID = hex.EncodeToString(bytes[:])
	p, err := m.launch(options)
	if err != nil {
		return nil, err
	}
	r := &running{provider: backend, launchOptions: options, process: p, writes: make(chan []byte, 16), done: make(chan struct{}), pending: make(map[string]chan packet), approvals: make(map[string]json.RawMessage), browser: make(map[string]chan BrowserResult), browserWake: make(chan struct{}), tools: options.Tools != nil, toolAsks: make(map[string]chan bool), idle: m.Idle}
	r.session = Session{ID: hex.EncodeToString(bytes[:]), Agent: options.Agent, Mode: "chat", CWD: cwd, State: "starting", StartedAt: time.Now().UTC(), Items: []Item{}, Approvals: []Approval{}, Options: TurnOptions{Permission: "strict"}, Composer: true, Permissions: Permissions}
	if options.Browser != nil {
		r.session.Browser = &BrowserState{Tools: append([]BrowserTool{}, options.Browser.Tools...), Calls: []BrowserCall{}}
	}
	if len(m.sessions) >= 32 {
		var oldest string
		var at time.Time
		for id, old := range m.sessions {
			old.mu.Lock()
			if old.session.State == "exited" && (oldest == "" || old.session.StartedAt.Before(at)) {
				oldest = id
				at = old.session.StartedAt
			}
			old.mu.Unlock()
		}
		if oldest != "" {
			delete(m.sessions, oldest)
		}
	}
	m.sessions[r.session.ID] = r
	return r, nil
}
func (m *Manager) get(id string) (*running, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r := m.sessions[id]
	if r == nil {
		return nil, ErrNotFound
	}
	return r, nil
}
func (r *running) snapshot() Session {
	r.mu.Lock()
	defer r.mu.Unlock()
	s := r.session
	s.Items = append([]Item{}, s.Items...)
	s.Approvals = append([]Approval{}, s.Approvals...)
	s.Permissions = append([]string(nil), s.Permissions...)
	for i := range s.Approvals {
		s.Approvals[i].Execpolicy = append([]string(nil), s.Approvals[i].Execpolicy...)
	}
	if s.Browser != nil {
		s.Browser = &BrowserState{Tools: append([]BrowserTool{}, s.Browser.Tools...), Calls: append([]BrowserCall{}, s.Browser.Calls...)}
	}
	return s
}
func (m *Manager) Get(id string) (Session, error) {
	r, e := m.get(id)
	if e != nil {
		return Session{}, e
	}
	return r.snapshot(), nil
}
func (m *Manager) List() []Session {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Session, 0, len(m.sessions))
	for _, r := range m.sessions {
		s := r.snapshot()
		s.Items = nil
		s.Approvals = nil
		if s.Browser != nil {
			s.Browser.Tools = nil
		}
		out = append(out, s)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].StartedAt.After(out[j].StartedAt) })
	return out
}
func (m *Manager) Send(ctx context.Context, id, text string) error {
	return m.SendWith(ctx, id, text, TurnOptions{})
}
func (m *Manager) SendWith(ctx context.Context, id, text string, options TurnOptions) error {
	return m.send(ctx, id, text, options, "user")
}

// send starts a turn with a message of the given kind: the person's ("user")
// or Burf's own ("report").
func (m *Manager) send(ctx context.Context, id, text string, options TurnOptions, kind string) error {
	if err := options.validate(); err != nil {
		return err
	}
	if strings.TrimSpace(text) == "" || len(text) > 64<<10 {
		return errors.New("message must contain 1 to 65536 bytes")
	}
	r, e := m.get(id)
	if e != nil {
		return e
	}
	r.op.Lock()
	defer r.op.Unlock()
	if e = ctx.Err(); e != nil {
		return e
	}
	return r.provider.send(ctx, r, text, options, kind)
}

func (codexProvider) send(ctx context.Context, r *running, text string, options TurnOptions, kind string) error {
	var e error
	r.mu.Lock()
	if r.session.State != "idle" {
		r.mu.Unlock()
		return errors.New("chat is not ready for a message")
	}
	thread := r.session.ThreadID
	params := map[string]any{"threadId": thread, "input": []any{map[string]any{"type": "text", "text": text}}}
	options.apply(params, r.session.CWD)
	submitted := fmt.Sprintf("submitted-%d", r.next+1)
	r.submitted = submitted
	params["clientUserMessageId"] = submitted
	r.put(Item{ID: submitted, Kind: kind, Text: text})
	r.permission = options.Permission
	if r.permission == "" {
		r.permission = r.session.Options.Permission
	}
	r.session.State = "running"
	r.session.Error = ""
	r.mu.Unlock()
	result, e := r.call(ctx, "turn/start", params)
	if errors.Is(e, ErrRejected) {
		// A refused model, effort or permission must not cost the conversation.
		reason := "Codex did not start this turn: " + clip(e.Error())
		r.mu.Lock()
		for i, it := range r.session.Items {
			if it.ID == submitted {
				r.session.Items = append(r.session.Items[:i], r.session.Items[i+1:]...)
				break
			}
		}
		if r.submitted == submitted {
			r.submitted = ""
		}
		if r.session.State == "running" && r.session.TurnID == "" {
			r.session.State = "idle"
			r.session.Error = reason
		}
		r.mu.Unlock()
		return errors.New(reason)
	}
	if e != nil {
		r.finish("Message delivery is uncertain; this chat was stopped and will not replay the message. " + e.Error())
		return errors.New("message may have arrived; chat stopped without replay")
	}
	var reply struct {
		Turn struct {
			ID string `json:"id"`
		} `json:"turn"`
	}
	if json.Unmarshal(result, &reply) != nil || reply.Turn.ID == "" {
		r.finish("Codex returned no turn identity")
		return errors.New("message may have arrived; Codex returned no turn identity")
	}
	r.mu.Lock()
	if options.Model != "" {
		r.session.Options.Model = options.Model
	}
	if options.Effort != "" {
		r.session.Options.Effort = options.Effort
	}
	if options.Permission != "" {
		r.session.Options.Permission = options.Permission
	}
	if r.session.State == "running" && r.session.TurnID == "" {
		r.session.TurnID = reply.Turn.ID
	}
	r.mu.Unlock()
	return nil
}
func (m *Manager) Interrupt(ctx context.Context, id string) error {
	r, e := m.get(id)
	if e != nil {
		return e
	}
	r.op.Lock()
	defer r.op.Unlock()
	s := r.snapshot()
	if s.TurnID == "" || s.State == "idle" || s.State == "exited" {
		return errors.New("no active turn to interrupt")
	}
	return r.provider.interrupt(ctx, r, s)
}

func (codexProvider) interrupt(ctx context.Context, r *running, s Session) error {
	_, e := r.call(ctx, "turn/interrupt", map[string]string{"threadId": s.ThreadID, "turnId": s.TurnID})
	if e != nil {
		r.finish("Interrupt could not be confirmed; chat stopped.")
	}
	return e
}
func (m *Manager) Decide(id, approval, decision string) error {
	if decision != "accept" && decision != "decline" && decision != "acceptForSession" && decision != "acceptAlways" {
		return errors.New("unsupported approval decision")
	}
	r, e := m.get(id)
	if e != nil {
		return e
	}
	r.op.Lock()
	defer r.op.Unlock()
	r.mu.Lock()
	if own, err := r.decideTool(approval, decision); own {
		r.mu.Unlock()
		return err
	}
	r.mu.Unlock()
	return r.provider.decide(r, approval, decision)
}

func (codexProvider) decide(r *running, approval, decision string) error {
	r.mu.Lock()
	raw, ok := r.approvals[approval]
	if !ok || r.session.State == "exited" {
		r.mu.Unlock()
		return errors.New("approval is no longer pending")
	}
	var value any = decision
	elicitation := false
	for _, a := range r.session.Approvals {
		if a.ID != approval {
			continue
		}
		elicitation = a.elicitation
		if decision == "acceptForSession" && !a.SessionAllowed {
			r.mu.Unlock()
			return errors.New("session approval is not supported for this request")
		}
		if decision == "acceptAlways" {
			if len(a.Execpolicy) == 0 {
				r.mu.Unlock()
				return errors.New("Codex did not propose a persistent command rule")
			}
			value = map[string]any{"acceptWithExecpolicyAmendment": map[string]any{"execpolicy_amendment": a.Execpolicy}}
		}
	}
	delete(r.approvals, approval)
	for i, a := range r.session.Approvals {
		if a.ID == approval {
			r.session.Approvals = append(r.session.Approvals[:i], r.session.Approvals[i+1:]...)
			break
		}
	}
	if len(r.approvals)+len(r.toolAsks) == 0 {
		r.session.State = "running"
	}
	result := map[string]any{"decision": value}
	if elicitation {
		result = map[string]any{"action": "decline"}
		if decision == "accept" {
			result = map[string]any{"action": "accept", "content": map[string]any{}}
		}
	}
	e := r.queue(map[string]any{"id": raw, "result": result})
	r.mu.Unlock()
	if e != nil {
		r.finish("Approval delivery could not be confirmed; chat stopped without replay.")
	}
	return e
}
func (m *Manager) Stop(id string) error {
	r, e := m.get(id)
	if e == nil {
		r.finish("")
	}
	return e
}
func (m *Manager) Close() {
	m.mu.Lock()
	m.closed = true
	all := make([]*running, 0, len(m.sessions))
	for _, r := range m.sessions {
		all = append(all, r)
	}
	m.mu.Unlock()
	for _, r := range all {
		r.finish("")
	}
}
func (m *Manager) PrepareRestart() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, r := range m.sessions {
		s := r.snapshot()
		if s.State != "exited" {
			if s.Agent == "codex" {
				return errors.New("stop local Codex chats before restarting Burf")
			}
			return errors.New("stop local Claude Code chats before restarting Burf")
		}
	}
	m.closed = true
	return nil
}
func (r *running) finish(reason string) {
	r.once.Do(func() {
		r.mu.Lock()
		r.invalidate(reason)
		r.mu.Unlock()
		close(r.done)
		_ = r.process.Close()
	})
}

// Caller holds mu: revoke approval tokens before releasing the state lock.
// Process teardown can then happen outside the lock without allowing a stale
// concurrent Allow click to reach the protocol writer.
func (r *running) invalidate(reason string) {
	r.session.State = "exited"
	r.session.TurnID = ""
	r.session.Approvals = []Approval{}
	r.approvals = map[string]json.RawMessage{}
	r.cancelBrowser()
	r.cancelTools()
	if reason != "" {
		r.session.Error = reason
	}
}
func (r *running) queue(v any) error {
	b, e := json.Marshal(v)
	if e != nil {
		return e
	}
	select {
	case <-r.done:
		if r.session.Agent == "claude" {
			return errors.New("Claude Code chat has stopped")
		}
		return errors.New("Codex chat has stopped")
	case r.writes <- append(b, '\n'):
		return nil
	default:
		if r.session.Agent == "claude" {
			return errors.New("Claude Code protocol input is busy")
		}
		return errors.New("Codex protocol input is busy")
	}
}
func (r *running) call(ctx context.Context, method string, params any) (json.RawMessage, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	r.mu.Lock()
	r.next++
	id := fmt.Sprintf("burf-%d", r.next)
	ch := make(chan packet, 1)
	key := fmt.Sprintf("%q", id)
	r.pending[key] = ch
	r.mu.Unlock()
	defer func() { r.mu.Lock(); delete(r.pending, key); r.mu.Unlock() }()
	if e := ctx.Err(); e != nil {
		return nil, e
	}
	if e := r.queue(map[string]any{"id": id, "method": method, "params": params}); e != nil {
		return nil, e
	}
	select {
	case p := <-ch:
		if p.Error != nil {
			return nil, rejection(p.Error.Message)
		}
		return p.Result, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-r.done:
		return nil, errors.New("Codex app-server disconnected")
	}
}
func (r *running) write() {
	for {
		select {
		case <-r.done:
			return
		case b := <-r.writes:
			if _, e := r.process.Write(b); e != nil {
				reason := "Codex app-server input disconnected"
				if r.session.Agent == "claude" {
					reason = "Claude Code input disconnected; messages are not replayed"
				}
				r.finish(reason)
				return
			}
		}
	}
}
func (r *running) read() {
	scanner := bufio.NewScanner(r.process)
	scanner.Buffer(make([]byte, 4096), 2<<20)
	for scanner.Scan() {
		if err := r.provider.receive(r, scanner.Bytes()); err != nil {
			r.finish(err.Error())
			return
		}
	}
	s := r.snapshot()
	reason := "Codex app-server disconnected; messages are not replayed"
	if s.Agent == "claude" {
		reason = "Claude Code process exited; messages are not replayed"
		if s.Error != "" {
			reason = s.Error + "\n" + reason
		}
		if scanner.Err() != nil {
			reason += ": " + scanner.Err().Error()
		}
	}
	r.finish(reason)
}

func (codexProvider) receive(r *running, data []byte) error {
	var p packet
	if json.Unmarshal(data, &p) != nil {
		return errors.New("Codex sent invalid protocol data")
	}
	if p.Method == "" {
		r.mu.Lock()
		ch := r.pending[string(p.ID)]
		r.mu.Unlock()
		if ch != nil {
			select {
			case ch <- p:
			default:
			}
		}
		return nil
	}
	if len(p.ID) > 0 {
		r.approval(p)
	} else {
		r.event(p)
	}
	return nil
}

func clip(s string) string {
	if len(s) > maxText {
		return s[:maxText] + "\n[output truncated]"
	}
	return s
}
func (r *running) put(it Item) {
	for i, old := range r.session.Items {
		if old.ID == it.ID {
			r.session.Items[i] = it
			r.trim()
			return
		}
	}
	if len(r.session.Items) >= maxItems {
		r.session.Items = r.session.Items[1:]
		r.session.Truncated = true
	}
	r.session.Items = append(r.session.Items, it)
	r.trim()
}

func (r *running) trim() {
	bytes := 0
	for _, it := range r.session.Items {
		bytes += len(it.Text)
	}
	for bytes > maxSnapshot && len(r.session.Items) > 1 {
		bytes -= len(r.session.Items[0].Text)
		r.session.Items = r.session.Items[1:]
		r.session.Truncated = true
	}
}
func (r *running) approval(p packet) {
	var v struct {
		ThreadID   string   `json:"threadId"`
		TurnID     string   `json:"turnId"`
		ItemID     string   `json:"itemId"`
		Command    string   `json:"command"`
		CWD        string   `json:"cwd"`
		Reason     string   `json:"reason"`
		GrantRoot  string   `json:"grantRoot"`
		Kind       string   `json:"kind"`
		Execpolicy []string `json:"proposedExecpolicyAmendment"`
	}
	_ = json.Unmarshal(p.Params, &v)
	if p.Method == "mcpServer/elicitation/request" {
		r.browserApproval(p)
		return
	}
	r.mu.Lock()
	supported := v.ThreadID == r.session.ThreadID && v.TurnID != "" && v.TurnID == r.session.TurnID && (p.Method == "item/commandExecution/requestApproval" || p.Method == "item/fileChange/requestApproval")
	if p.Method == "item/commandExecution/requestApproval" && (v.Command == "" || (v.Kind != "" && v.Kind != "command")) {
		supported = false
	}
	detail := v.Command
	if v.CWD != "" {
		detail += "\nDirectory: " + v.CWD
	}
	kind := "command"
	if p.Method == "item/fileChange/requestApproval" {
		kind = "files"
		detail = ""
		for _, it := range r.session.Items {
			if it.ID == v.ItemID && it.sourceType == "fileChange" && !it.Truncated {
				detail = it.Text
			}
		}
		if detail == "" || v.GrantRoot != "" {
			supported = false
		}
	}
	key := string(p.ID)
	if len(detail) > maxText || len(v.Reason) > maxText {
		supported = false
	}
	if len(r.approvals) >= 8 || r.approvals[key] != nil {
		supported = false
	}
	if supported {
		var rule []string
		if kind == "command" && len(v.Execpolicy) > 0 && len(v.Execpolicy) <= 64 {
			valid := true
			for _, arg := range v.Execpolicy {
				if arg == "" || len(arg) > 4096 || strings.ContainsAny(arg, "\x00\r\n") {
					valid = false
				}
			}
			if valid {
				rule = append([]string(nil), v.Execpolicy...)
			}
		}
		r.approvals[key] = append(json.RawMessage(nil), p.ID...)
		r.session.Approvals = append(r.session.Approvals, Approval{ID: key, Kind: kind, Detail: clip(detail), Reason: clip(v.Reason), itemID: v.ItemID, SessionAllowed: true, Execpolicy: rule})
		r.session.State = "waiting"
		r.mu.Unlock()
		return
	}
	// Unknown requests cannot be approved blindly or left holding a turn forever.
	reason := "Codex requested an unsupported interaction (" + clip(p.Method) + "). Chat stopped without granting permission."
	r.invalidate(reason)
	r.mu.Unlock()
	r.finish(reason)
}
func (r *running) event(p packet) {
	var v struct {
		ThreadID string       `json:"threadId"`
		TurnID   string       `json:"turnId"`
		ItemID   string       `json:"itemId"`
		Delta    string       `json:"delta"`
		Changes  []fileChange `json:"changes"`
		Turn     struct {
			ID     string `json:"id"`
			Status string `json:"status"`
			Error  *struct {
				Message string `json:"message"`
			} `json:"error"`
		} `json:"turn"`
		Item struct {
			ID       string `json:"id"`
			ClientID string `json:"clientId"`
			Type     string `json:"type"`
			Text     string `json:"text"`
			Command  string `json:"command"`
			Status   string `json:"status"`
			Output   string `json:"aggregatedOutput"`
			Tool     string `json:"tool"`
			Server   string `json:"server"`
			Content  []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
			Result *struct {
				Content []struct {
					Type string `json:"type"`
					Text string `json:"text"`
				} `json:"content"`
			} `json:"result"`
			Error *struct {
				Message string `json:"message"`
			} `json:"error"`
			Changes []fileChange `json:"changes"`
		} `json:"item"`
	}
	if json.Unmarshal(p.Params, &v) != nil {
		return
	}
	r.mu.Lock()
	stopReason := ""
	defer func() {
		if stopReason != "" {
			r.invalidate(stopReason)
		}
		r.mu.Unlock()
		if stopReason != "" {
			r.finish(stopReason)
		}
	}()
	if r.session.State == "exited" || v.ThreadID == "" || v.ThreadID != r.session.ThreadID {
		return
	}
	switch p.Method {
	case "item/fileChange/patchUpdated":
		if v.TurnID != r.session.TurnID || v.ItemID == "" {
			return
		}
		for _, a := range r.session.Approvals {
			if a.itemID == v.ItemID {
				stopReason = "File changes changed while approval was pending. Chat stopped without approving stale details."
				return
			}
		}
		detail, valid := patchDetail(v.Changes)
		r.put(Item{ID: v.ItemID, Kind: "tool", Text: clip(detail), sourceType: "fileChange", Truncated: !valid || len(detail) > maxText})
	case "turn/started":
		r.session.TurnID = v.Turn.ID
		r.session.State = "running"
	case "turn/completed":
		if v.Turn.ID != r.session.TurnID {
			return
		}
		r.session.TurnID = ""
		r.submitted = ""
		r.session.State = "idle"
		r.session.Approvals = []Approval{}
		r.approvals = map[string]json.RawMessage{}
		r.cancelBrowser()
		r.cancelTools()
		if r.idle != nil {
			go r.idle()
		}
		if v.Turn.Error != nil {
			r.session.Error = clip(v.Turn.Error.Message)
		}
	case "item/started", "item/completed":
		if v.TurnID != r.session.TurnID || v.Item.ID == "" {
			return
		}
		it := Item{ID: v.Item.ID, Status: v.Item.Status, sourceType: v.Item.Type}
		switch v.Item.Type {
		case "userMessage":
			it.Kind = "user"
			for _, c := range v.Item.Content {
				if c.Type == "text" {
					it.Text += c.Text
				}
			}
			// Replace only the provisional message from this owned turn. Provider
			// echoes can be delayed or absent; submitted text stays visible either way.
			// A turn carries one message, so an echo without a client identity is
			// this one even when the provider normalized its text.
			// The provider says a message twice, started and completed: the
			// second finds the first already in place, and stays Burf's too.
			for _, old := range r.session.Items {
				if old.ID == it.ID && old.Kind == "report" {
					it.Kind = "report"
				}
			}
			if r.submitted != "" {
				for i, old := range r.session.Items {
					if old.ID == r.submitted && (v.Item.ClientID == r.submitted || v.Item.ClientID == "") {
						// Burf's own message stays marked as Burf's.
						it.Kind = old.Kind
						r.session.Items[i] = it
						r.submitted = ""
						return
					}
				}
			}
		case "agentMessage":
			it.Kind = "assistant"
			it.Text = v.Item.Text
		case "reasoning":
			return
		case "commandExecution":
			it.Kind = "tool"
			it.Text = v.Item.Command
			if v.Item.Output != "" {
				it.Text += "\n" + v.Item.Output
			}
		case "fileChange":
			it.Kind = "tool"
			var valid bool
			it.Text, valid = patchDetail(v.Item.Changes)
			it.Truncated = !valid
		default:
			it.Kind = "tool"
			it.Text = v.Item.Type
			if v.Item.Tool != "" {
				it.Text += " · " + v.Item.Tool
			}
			// What Burf's own tool answered is part of the conversation: an
			// added artifact is recognised by its line, as from a command.
			if v.Item.Type == "mcpToolCall" && v.Item.Server == ToolServer && r.tools {
				if v.Item.Result != nil {
					for _, c := range v.Item.Result.Content {
						if c.Type == "text" && c.Text != "" {
							it.Text += "\n" + c.Text
						}
					}
				}
				if v.Item.Error != nil && v.Item.Error.Message != "" {
					it.Text += "\n" + v.Item.Error.Message
				}
			}
		}
		it.Truncated = it.Truncated || len(it.Text) > maxText
		it.Text = clip(it.Text)
		if it.sourceType == "fileChange" {
			for _, a := range r.session.Approvals {
				if a.itemID == it.ID && (it.Truncated || a.Detail != it.Text) {
					stopReason = "File changes changed while approval was pending. Chat stopped without approving stale details."
					return
				}
			}
		}
		r.put(it)
	case "item/agentMessage/delta":
		if v.TurnID != r.session.TurnID {
			return
		}
		for i, it := range r.session.Items {
			if it.ID == v.ItemID && it.Kind == "assistant" {
				r.session.Items[i].Text = clip(it.Text + v.Delta)
				r.trim()
				return
			}
		}
		r.put(Item{ID: v.ItemID, Kind: "assistant", Text: clip(v.Delta)})
	}
}
