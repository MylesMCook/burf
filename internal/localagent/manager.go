// Package localagent manages only interactive processes started by this client.
package localagent

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"sync"
	"time"
)

const outputLimit = 1 << 20

var ErrNotFound = errors.New("local session not found")
var conversationID = regexp.MustCompile(`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$`)

type Process interface {
	io.ReadWriteCloser
	Resize(int, int) error
	Wait() error
}

type Launch func(program string, args []string, dir string, env []string, cols, rows int) (Process, error)

type Command struct {
	Program string
	Args    []string
	CanFork bool
	CanChat bool
}

type Session struct {
	ID        string    `json:"id"`
	Agent     string    `json:"agent"`
	CWD       string    `json:"cwd"`
	State     string    `json:"state"`
	StartedAt time.Time `json:"started_at"`
	ExitError string    `json:"exit_error,omitempty"`
}

type Output struct {
	Data      string `json:"data"`
	Next      int64  `json:"next"`
	Reset     bool   `json:"reset"`
	State     string `json:"state"`
	ExitError string `json:"exit_error,omitempty"`
}

type running struct {
	mu        sync.Mutex
	input     chan string
	done      chan struct{}
	session   Session
	process   Process
	output    []byte
	end       int64
	closeOnce sync.Once
	originID  string
}

func (r *running) close() { r.closeOnce.Do(func() { close(r.done); _ = r.process.Close() }) }

type Manager struct {
	mu       sync.Mutex
	commands map[string]Command
	launch   Launch
	sessions map[string]*running
	closed   bool
}

func New(commands map[string]Command, launch Launch) *Manager {
	return &Manager{commands: commands, launch: launch, sessions: make(map[string]*running)}
}

func (m *Manager) Start(agent, cwd string) (Session, error) {
	return m.StartContext(context.Background(), agent, cwd)
}

func (m *Manager) StartContext(ctx context.Context, agent, cwd string) (Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return Session{}, err
	}
	return m.startLocked(agent, cwd, "")
}

// Fork continues saved history under a new CLI session ID. Never resume an
// externally owned session in place: another application may still write it.
func (m *Manager) Fork(agent, cwd, sourceID string) (Session, error) {
	return m.ForkFrom(context.Background(), func() (string, string, string, error) {
		return agent, cwd, sourceID, nil
	})
}

// ForkFrom resolves and revalidates saved history under the launch lock. A
// request waiting behind another launch must not use an earlier source check,
// and a cancelled request must not create a process when the lock is released.
func (m *Manager) ForkFrom(ctx context.Context, source func() (agent, cwd, sourceID string, err error)) (Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return Session{}, err
	}
	agent, cwd, sourceID, err := source()
	if err != nil {
		return Session{}, err
	}
	if !conversationID.MatchString(sourceID) {
		return Session{}, errors.New("this conversation has no supported session ID")
	}
	if err := ctx.Err(); err != nil {
		return Session{}, err
	}
	return m.startLocked(agent, cwd, sourceID)
}

func (m *Manager) startLocked(agent, cwd, sourceID string) (Session, error) {
	if m.closed {
		return Session{}, errors.New("local agent is shutting down")
	}
	command, ok := m.commands[agent]
	if !ok || command.Program == "" {
		return Session{}, errors.New("agent CLI is not installed")
	}
	if sourceID != "" {
		if !command.CanFork {
			return Session{}, errors.New("installed agent CLI does not support continuing a copy")
		}
		command.Args = append([]string(nil), command.Args...)
		switch agent {
		case "codex":
			command.Args = append(command.Args, "fork", sourceID)
		case "claude":
			command.Args = append(command.Args, "--resume", sourceID, "--fork-session")
		default:
			return Session{}, errors.New("agent does not support conversation continuation")
		}
	}
	if !filepath.IsAbs(cwd) {
		return Session{}, errors.New("project directory must be an absolute path")
	}
	cwd = filepath.Clean(cwd)
	st, err := os.Stat(cwd)
	if err != nil || !st.IsDir() {
		return Session{}, errors.New("project directory does not exist")
	}
	active := 0
	for _, r := range m.sessions {
		r.mu.Lock()
		if r.session.State == "running" {
			if sourceID != "" && r.originID == sourceID && r.session.Agent == agent {
				s := r.session
				r.mu.Unlock()
				return s, nil
			}
			active++
		}
		r.mu.Unlock()
	}
	if active >= 8 {
		return Session{}, errors.New("stop a local agent before starting another (limit 8)")
	}
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		return Session{}, err
	}
	p, err := m.launch(command.Program, command.Args, cwd, os.Environ(), 100, 30)
	if err != nil {
		return Session{}, err
	}
	s := Session{ID: hex.EncodeToString(id[:]), Agent: agent, CWD: cwd, State: "running", StartedAt: time.Now().UTC()}
	r := &running{session: s, process: p, input: make(chan string, 8), done: make(chan struct{}), originID: sourceID}
	// Keep exited terminals available for reconnect, but never grow without bound.
	if len(m.sessions) >= 32 {
		var oldest string
		var at time.Time
		for k, old := range m.sessions {
			old.mu.Lock()
			if old.session.State == "exited" && (oldest == "" || old.session.StartedAt.Before(at)) {
				oldest, at = k, old.session.StartedAt
			}
			old.mu.Unlock()
		}
		if oldest != "" {
			delete(m.sessions, oldest)
		}
	}
	m.sessions[s.ID] = r
	go r.read()
	go r.write()
	return s, nil
}

// HTTP input accepts only a bounded queue; a child that stops reading cannot
// leave request handlers parked in a Windows pipe write.
func (r *running) write() {
	for {
		select {
		case <-r.done:
			return
		case data := <-r.input:
			if _, err := io.WriteString(r.process, data); err != nil {
				r.close()
				return
			}
		}
	}
}

func (r *running) read() {
	buf := make([]byte, 32<<10)
	for {
		n, err := r.process.Read(buf)
		if n > 0 {
			r.mu.Lock()
			r.output = append(r.output, buf[:n]...)
			r.end += int64(n)
			if len(r.output) > outputLimit {
				r.output = append([]byte(nil), r.output[len(r.output)-outputLimit:]...)
			}
			r.mu.Unlock()
		}
		if err != nil {
			if !errors.Is(err, io.EOF) {
				r.close()
			}
			waitErr := r.process.Wait()
			r.close()
			r.mu.Lock()
			r.session.State = "exited"
			if waitErr != nil {
				r.session.ExitError = waitErr.Error()
			} else if !errors.Is(err, io.EOF) {
				r.session.ExitError = err.Error()
			}
			r.mu.Unlock()
			return
		}
	}
}

func (m *Manager) List() []Session {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Session, 0, len(m.sessions))
	for _, r := range m.sessions {
		r.mu.Lock()
		out = append(out, r.session)
		r.mu.Unlock()
	}
	sort.Slice(out, func(i, j int) bool { return out[i].StartedAt.After(out[j].StartedAt) })
	return out
}

func (m *Manager) get(id string) (*running, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r, ok := m.sessions[id]
	if !ok {
		return nil, ErrNotFound
	}
	return r, nil
}

func (m *Manager) Output(id string, after int64) (Output, error) {
	r, err := m.get(id)
	if err != nil {
		return Output{}, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	start := r.end - int64(len(r.output))
	reset := after < start || after > r.end || after < 0
	if reset {
		after = start
	}
	return Output{Data: base64.StdEncoding.EncodeToString(r.output[after-start:]), Next: r.end, Reset: reset, State: r.session.State, ExitError: r.session.ExitError}, nil
}

func (m *Manager) Input(id, data string) error {
	if len(data) > 64<<10 {
		return errors.New("terminal input is too large")
	}
	r, err := m.get(id)
	if err != nil {
		return err
	}
	r.mu.Lock()
	running := r.session.State == "running"
	r.mu.Unlock()
	if !running {
		return errors.New("local session has exited")
	}
	select {
	case <-r.done:
		return errors.New("local session has exited")
	case r.input <- data:
		return nil
	default:
		return errors.New("terminal input is busy; wait before sending more")
	}
}

func (m *Manager) Resize(id string, cols, rows int) error {
	if cols < 1 || cols > 500 || rows < 1 || rows > 300 {
		return errors.New("invalid terminal dimensions")
	}
	r, err := m.get(id)
	if err != nil {
		return err
	}
	return r.process.Resize(cols, rows)
}

func (m *Manager) Stop(id string) error {
	r, err := m.get(id)
	if err != nil {
		return err
	}
	r.close()
	return nil
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
		r.close()
	}
}

// PrepareRestart atomically refuses live-session loss and prevents a new
// session racing a successful restart check.
func (m *Manager) PrepareRestart() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, r := range m.sessions {
		r.mu.Lock()
		active := r.session.State == "running"
		r.mu.Unlock()
		if active {
			return errors.New("stop local Windows agents before restarting Burf")
		}
	}
	m.closed = true
	return nil
}
