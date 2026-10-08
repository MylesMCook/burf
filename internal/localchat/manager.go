// Package localchat owns new Codex app-server threads, never externally started chats.
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
	Program string
	CWD     string
	// Env replaces the provider environment; nil inherits the current environment.
	Env []string
}
type Launch func(LaunchOptions) (Process, error)
type Item struct {
	ID         string `json:"id"`
	Kind       string `json:"kind"`
	Text       string `json:"text"`
	Status     string `json:"status,omitempty"`
	Truncated  bool   `json:"truncated,omitempty"`
	sourceType string
}
type Approval struct {
	ID     string `json:"id"`
	Kind   string `json:"kind"`
	Detail string `json:"detail"`
	Reason string `json:"reason,omitempty"`
	itemID string
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
	ID        string     `json:"id"`
	Agent     string     `json:"agent"`
	Mode      string     `json:"mode"`
	CWD       string     `json:"cwd"`
	State     string     `json:"state"`
	StartedAt time.Time  `json:"started_at"`
	ThreadID  string     `json:"thread_id"`
	TurnID    string     `json:"turn_id,omitempty"`
	Items     []Item     `json:"items"`
	Approvals []Approval `json:"approvals"`
	Error     string     `json:"error,omitempty"`
	Truncated bool       `json:"truncated,omitempty"`
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
	mu        sync.Mutex
	op        sync.Mutex
	session   Session
	process   Process
	writes    chan []byte
	done      chan struct{}
	once      sync.Once
	next      uint64
	pending   map[string]chan packet
	approvals map[string]json.RawMessage
}
type Manager struct {
	mu       sync.Mutex
	program  string
	launch   Launch
	sessions map[string]*running
	closed   bool
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
	initCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	_, err = r.call(initCtx, "initialize", map[string]any{"clientInfo": map[string]string{"name": "burf", "title": "Burf", "version": "1"}})
	if err == nil {
		err = r.queue(map[string]any{"method": "initialized"})
	}
	var result json.RawMessage
	if err == nil {
		result, err = r.call(initCtx, "thread/start", map[string]any{"cwd": r.session.CWD, "approvalPolicy": "untrusted", "sandbox": "read-only", "approvalsReviewer": "user"})
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
		return r.snapshot(), err
	}
	r.mu.Lock()
	r.session.ThreadID = reply.Thread.ID
	if r.session.State != "exited" {
		r.session.State = "idle"
	}
	r.mu.Unlock()
	return r.snapshot(), nil
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
	if options.Program == "" {
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
	p, err := m.launch(options)
	if err != nil {
		return nil, err
	}
	r := &running{process: p, writes: make(chan []byte, 16), done: make(chan struct{}), pending: make(map[string]chan packet), approvals: make(map[string]json.RawMessage)}
	r.session = Session{ID: hex.EncodeToString(bytes[:]), Agent: "codex", Mode: "chat", CWD: cwd, State: "starting", StartedAt: time.Now().UTC(), Items: []Item{}, Approvals: []Approval{}}
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
		out = append(out, s)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].StartedAt.After(out[j].StartedAt) })
	return out
}
func (m *Manager) Send(ctx context.Context, id, text string) error {
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
	r.mu.Lock()
	if r.session.State != "idle" {
		r.mu.Unlock()
		return errors.New("chat is not ready for a message")
	}
	thread := r.session.ThreadID
	r.session.State = "running"
	r.session.Error = ""
	r.mu.Unlock()
	result, e := r.call(ctx, "turn/start", map[string]any{"threadId": thread, "input": []any{map[string]any{"type": "text", "text": text}}})
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
	_, e = r.call(ctx, "turn/interrupt", map[string]string{"threadId": s.ThreadID, "turnId": s.TurnID})
	if e != nil {
		r.finish("Interrupt could not be confirmed; chat stopped.")
	}
	return e
}
func (m *Manager) Decide(id, approval, decision string) error {
	if decision != "accept" && decision != "decline" {
		return errors.New("approval must be allow once or deny")
	}
	r, e := m.get(id)
	if e != nil {
		return e
	}
	r.op.Lock()
	defer r.op.Unlock()
	r.mu.Lock()
	raw, ok := r.approvals[approval]
	if !ok || r.session.State == "exited" {
		r.mu.Unlock()
		return errors.New("approval is no longer pending")
	}
	delete(r.approvals, approval)
	for i, a := range r.session.Approvals {
		if a.ID == approval {
			r.session.Approvals = append(r.session.Approvals[:i], r.session.Approvals[i+1:]...)
			break
		}
	}
	if len(r.approvals) == 0 {
		r.session.State = "running"
	}
	e = r.queue(map[string]any{"id": raw, "result": map[string]string{"decision": decision}})
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
		if r.snapshot().State != "exited" {
			return errors.New("stop local Codex chats before restarting Burf")
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
		return errors.New("Codex chat has stopped")
	case r.writes <- append(b, '\n'):
		return nil
	default:
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
			return nil, errors.New(p.Error.Message)
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
				r.finish("Codex app-server input disconnected")
				return
			}
		}
	}
}
func (r *running) read() {
	scanner := bufio.NewScanner(r.process)
	scanner.Buffer(make([]byte, 4096), 2<<20)
	for scanner.Scan() {
		var p packet
		if json.Unmarshal(scanner.Bytes(), &p) != nil {
			r.finish("Codex sent invalid protocol data")
			return
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
			continue
		}
		if len(p.ID) > 0 {
			r.approval(p)
		} else {
			r.event(p)
		}
	}
	r.finish("Codex app-server disconnected; messages are not replayed")
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
		ThreadID  string `json:"threadId"`
		TurnID    string `json:"turnId"`
		ItemID    string `json:"itemId"`
		Command   string `json:"command"`
		CWD       string `json:"cwd"`
		Reason    string `json:"reason"`
		GrantRoot string `json:"grantRoot"`
		Kind      string `json:"kind"`
	}
	_ = json.Unmarshal(p.Params, &v)
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
		r.approvals[key] = append(json.RawMessage(nil), p.ID...)
		r.session.Approvals = append(r.session.Approvals, Approval{ID: key, Kind: kind, Detail: clip(detail), Reason: clip(v.Reason), itemID: v.ItemID})
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
			ID      string `json:"id"`
			Type    string `json:"type"`
			Text    string `json:"text"`
			Command string `json:"command"`
			Status  string `json:"status"`
			Output  string `json:"aggregatedOutput"`
			Tool    string `json:"tool"`
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
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
		r.session.State = "idle"
		r.session.Approvals = []Approval{}
		r.approvals = map[string]json.RawMessage{}
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
