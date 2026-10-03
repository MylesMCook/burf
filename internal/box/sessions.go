package box

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/sean-brydon/berthd/internal/statefile"
	"github.com/sean-brydon/berthd/internal/terminal"
)

// Session is a long-running program, usually a coding agent, started at a
// location on the box. It keeps running when no one is attached.
type Session struct {
	Name     string    `json:"name"`
	Location string    `json:"location,omitempty"`
	Dir      string    `json:"dir"`
	Command  string    `json:"command,omitempty"`
	Created  time.Time `json:"created"`
	Attached int       `json:"attached"`
	Exited   bool      `json:"exited"`
	// Agent is the coding agent the command runs, if any, and AgentState
	// what its hooks said last: idle, running, waiting, or finished.
	Agent      string    `json:"agent,omitempty"`
	AgentState string    `json:"agent_state,omitempty"`
	StateSince time.Time `json:"state_since,omitzero"`
}

var (
	ErrUnknownSession = errors.New("no session with that name")
	ErrSessionExists  = errors.New("a session with that name already exists")
	sessionName       = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$`)
)

// Sessions runs programs in berth's own tmux server, separate from any tmux
// the user runs. Finished programs stay visible until killed, so an agent's
// last output is never lost.
type Sessions struct {
	// Config is the tmux configuration file for berth's server.
	Config string
	// trace, in tests, sees every tmux command line.
	trace func(args []string)
}

const tmuxSocket = "berth"

// tmuxConfig is berth's own tmux server's. The status line is off because
// the app draws its own chrome around every terminal; focus events pass
// through so agents know when their pane is in front.
const tmuxConfig = `set -g remain-on-exit on
set -g history-limit 50000
set -g mouse on
set -g default-terminal "tmux-256color"
set -g status off
set -g focus-events on
`

func NewSessions(dir string) (*Sessions, error) {
	path := filepath.Join(dir, "tmux.conf")
	s := &Sessions{Config: path}
	if b, err := os.ReadFile(path); err != nil || string(b) != tmuxConfig {
		if err := statefile.Write(path, []byte(tmuxConfig)); err != nil {
			return nil, err
		}
		// A server still running from an older build reads the change now;
		// without one, this fails and the next server reads the file.
		s.tmux(context.Background(), "source-file", path)
	}
	return s, nil
}

func (s *Sessions) tmux(ctx context.Context, args ...string) ([]byte, error) {
	if s.trace != nil {
		s.trace(args)
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "tmux", append([]string{"-L", tmuxSocket, "-f", s.Config}, args...)...)
	return cmd.CombinedOutput()
}

// The command is also kept base64-encoded (@berth_command64): some tmux
// versions (3.4, say) escape "$" when a format reads an option back, so the
// plain @berth_command would come back changed. Sessions started before it
// existed only have the plain one.
const listFormat = "#{session_name}\t#{session_created}\t#{session_attached}\t#{@berth_location}\t#{@berth_command}\t#{pane_dead}\t#{pane_start_path}\t#{@berth_command64}"

func (s *Sessions) List(ctx context.Context) ([]Session, error) {
	if _, err := exec.LookPath("tmux"); err != nil {
		return nil, errors.New("tmux is not installed on this box")
	}
	out, err := s.tmux(ctx, "list-sessions", "-F", listFormat)
	if err != nil {
		// No server yet simply means no sessions.
		if strings.Contains(string(out), "no server running") || strings.Contains(string(out), "error connecting") {
			return []Session{}, nil
		}
		return nil, fmt.Errorf("tmux list-sessions: %s", strings.TrimSpace(string(out)))
	}
	return parseSessions(out), nil
}

func parseSessions(out []byte) []Session {
	sessions := []Session{}
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		f := strings.Split(line, "\t")
		if len(f) == 7 {
			f = append(f, "")
		}
		if len(f) != 8 {
			continue
		}
		command := f[4]
		if f[7] != "" {
			if raw, err := base64.StdEncoding.DecodeString(f[7]); err == nil {
				command = string(raw)
			}
		}
		created, _ := strconv.ParseInt(f[1], 10, 64)
		attached, _ := strconv.Atoi(f[2])
		sessions = append(sessions, Session{
			Name:     f[0],
			Created:  time.Unix(created, 0).UTC(),
			Attached: attached,
			Location: f[3],
			Command:  command,
			Exited:   f[5] == "1",
			Dir:      f[6],
		})
	}
	return sessions
}

// Create starts command in dir. An empty command starts the user's shell.
// Commands run through a login shell, so tools the user installed (claude,
// codex) are on PATH even when berthd runs under systemd.
func (s *Sessions) Create(ctx context.Context, name, location, dir, command string, env []string) (Session, error) {
	return s.create(ctx, name, location, dir, command, env, nil)
}

// create is Create with the pane's program run behind wrap, a command that
// replaces itself with it (`berthd secret exec … --`). The session's command,
// which says which agent runs in it, stays the one asked for.
func (s *Sessions) create(ctx context.Context, name, location, dir, command string, env, wrap []string) (Session, error) {
	if !sessionName.MatchString(name) {
		return Session{}, fmt.Errorf("invalid session name %q: use letters, digits, - and _", name)
	}
	if _, err := s.tmux(ctx, "has-session", "-t", "="+name); err == nil {
		return Session{}, ErrSessionExists
	}
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/sh"
	}
	argv := []string{shell, "-l"}
	if command != "" {
		argv = []string{shell, "-lc", command}
	}
	args := []string{"new-session", "-d", "-s", name, "-c", dir, "-x", "200", "-y", "50"}
	for _, kv := range env {
		args = append(args, "-e", kv)
	}
	args = append(append(append(args, "--"), wrap...), argv...)
	if out, err := s.tmux(ctx, args...); err != nil {
		return Session{}, fmt.Errorf("tmux new-session: %s", strings.TrimSpace(string(out)))
	}
	// set-option takes a pane target, whose exact-match form needs the colon.
	s.tmux(ctx, "set-option", "-t", "="+name+":", "@berth_location", location)
	s.tmux(ctx, "set-option", "-t", "="+name+":", "@berth_command", command)
	s.tmux(ctx, "set-option", "-t", "="+name+":", "@berth_command64", base64.StdEncoding.EncodeToString([]byte(command)))
	return s.Get(ctx, name)
}

func (s *Sessions) Get(ctx context.Context, name string) (Session, error) {
	all, err := s.List(ctx)
	if err != nil {
		return Session{}, err
	}
	for _, sess := range all {
		if sess.Name == name {
			return sess, nil
		}
	}
	return Session{}, ErrUnknownSession
}

func (s *Sessions) Kill(ctx context.Context, name string) error {
	if _, err := s.Get(ctx, name); err != nil {
		return err
	}
	if out, err := s.tmux(ctx, "kill-session", "-t", "="+name); err != nil {
		return fmt.Errorf("tmux kill-session: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

// Attach runs a tmux client for the session under a new pseudo-terminal. The
// caller relays the returned master to the laptop; closing it detaches.
func (s *Sessions) Attach(ctx context.Context, name string, cols, rows int) (*os.File, *exec.Cmd, error) {
	if _, err := s.Get(ctx, name); err != nil {
		return nil, nil, err
	}
	cmd := exec.CommandContext(ctx, "tmux", "-L", tmuxSocket, "-f", s.Config, "attach-session", "-t", "="+name)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	master, err := terminal.Start(cmd, cols, rows)
	if err != nil {
		return nil, nil, err
	}
	return master, cmd, nil
}

// Screen returns what the session shows, plus up to history earlier lines,
// so tools can read an agent's output without attaching.
func (s *Sessions) Screen(ctx context.Context, name string, history int) (string, error) {
	if _, err := s.Get(ctx, name); err != nil {
		return "", err
	}
	out, err := s.tmux(ctx, "capture-pane", "-p", "-J", "-t", "="+name+":", "-S", "-"+strconv.Itoa(max(history, 0)))
	if err != nil {
		return "", fmt.Errorf("tmux capture-pane: %s", strings.TrimSpace(string(out)))
	}
	return strings.TrimRight(string(out), "\n") + "\n", nil
}
