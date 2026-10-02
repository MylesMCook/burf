package box

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/sean-brydon/berth/internal/hooks"
)

// The pieces agents, hooks and the app orchestrate with: type into a session,
// wait for its agent, and run a check in a worktree.

// Send types text into a session as one paste, then presses Enter if asked.
// A paste keeps a multi-line prompt from being submitted line by line.
func (s *Sessions) Send(ctx context.Context, name, text string, enter bool) error {
	if _, err := s.Get(ctx, name); err != nil {
		return err
	}
	if text != "" {
		buf := "berth-send-" + name
		load := exec.CommandContext(ctx, "tmux", "-L", tmuxSocket, "-f", s.Config, "load-buffer", "-b", buf, "-")
		load.Stdin = strings.NewReader(text)
		if out, err := load.CombinedOutput(); err != nil {
			return fmt.Errorf("tmux load-buffer: %s", strings.TrimSpace(string(out)))
		}
		if out, err := s.tmux(ctx, "paste-buffer", "-p", "-d", "-b", buf, "-t", "="+name+":"); err != nil {
			return fmt.Errorf("tmux paste-buffer: %s", strings.TrimSpace(string(out)))
		}
	}
	if enter {
		// Agents' input boxes need a moment to take a paste before Enter
		// submits it rather than adding a newline.
		time.Sleep(150 * time.Millisecond)
		if out, err := s.tmux(ctx, "send-keys", "-t", "="+name+":", "Enter"); err != nil {
			return fmt.Errorf("tmux send-keys: %s", strings.TrimSpace(string(out)))
		}
	}
	return nil
}

func (b *Box) sendToSession(w http.ResponseWriter, r *http.Request) error {
	var req struct {
		Text  string `json:"text"`
		Enter *bool  `json:"enter"`
	}
	if err := decode(r, &req); err != nil {
		return err
	}
	name := r.PathValue("name")
	enter := req.Enter == nil || *req.Enter
	if err := b.before(r, "session.send", map[string]any{"name": name}); err != nil {
		return err
	}
	if err := b.Sessions.Send(r.Context(), name, req.Text, enter); err != nil {
		return err
	}
	// Only that something was sent: prompts never go into events.
	b.publish(r, "session.sent", map[string]any{"name": name})
	writeJSON(w, map[string]any{"sent": true, "at": time.Now().UTC()})
	return nil
}

// WaitResult is what an agent was doing when a wait ended.
type WaitResult struct {
	State    string `json:"state"`
	TimedOut bool   `json:"timed_out"`
}

// waitForSession long-polls until the session's agent reports one of the
// wanted states after a given time, its program exits, or the timeout ends.
func (b *Box) waitForSession(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	q := r.URL.Query()
	want := map[string]bool{}
	for _, s := range strings.Split(q.Get("for"), ",") {
		if s = strings.TrimSpace(s); s != "" {
			want[s] = true
		}
	}
	if len(want) == 0 {
		want = map[string]bool{"finished": true, "waiting": true}
	}
	timeout := 10 * time.Minute
	if v := q.Get("timeout"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			secs, err2 := strconv.Atoi(v)
			if err2 != nil {
				return badRequest("timeout %q is not a duration", v)
			}
			d = time.Duration(secs) * time.Second
		}
		timeout = min(max(d, time.Second), time.Hour)
	}
	var after time.Time
	if v := q.Get("after"); v != "" {
		t, err := time.Parse(time.RFC3339Nano, v)
		if err != nil {
			return badRequest("after %q is not an RFC 3339 time", v)
		}
		after = t
	}
	ctx, cancel := context.WithTimeout(r.Context(), timeout)
	defer cancel()
	events, stop := b.Events.Subscribe()
	defer stop()
	tick := time.NewTicker(2 * time.Second)
	defer tick.Stop()
	for {
		all, err := b.Sessions.List(ctx)
		if err != nil && ctx.Err() == nil {
			return err
		}
		found := false
		for _, s := range b.enrich(ctx, all) {
			if s.Name != name {
				continue
			}
			found = true
			if s.Exited {
				writeJSON(w, WaitResult{State: "exited"})
				return nil
			}
			if want[s.AgentState] && s.StateSince.After(after) {
				writeJSON(w, WaitResult{State: s.AgentState})
				return nil
			}
		}
		if !found && ctx.Err() == nil {
			return ErrUnknownSession
		}
		select {
		case <-ctx.Done():
			if r.Context().Err() != nil {
				return nil // the caller went away
			}
			state := ""
			for _, s := range b.enrich(context.Background(), all) {
				if s.Name == name {
					state = s.AgentState
				}
			}
			writeJSON(w, WaitResult{State: state, TimedOut: true})
			return nil
		case <-events:
		case <-tick.C:
		}
	}
}

// ExecRequest runs a command to completion in a location or worktree, such
// as the check a loop runs after each of an agent's turns.
type ExecRequest struct {
	Location string `json:"location"`
	Command  string `json:"command"`
	Timeout  string `json:"timeout,omitempty"`
}

type ExecResult struct {
	ExitCode int    `json:"exit_code"`
	Output   string `json:"output"`
	// Truncated is true when only the end of the output is kept.
	Truncated bool `json:"truncated,omitempty"`
}

const execOutputLimit = 64 << 10

func (b *Box) handleExec(w http.ResponseWriter, r *http.Request) error {
	var req ExecRequest
	if err := decode(r, &req); err != nil {
		return err
	}
	if strings.TrimSpace(req.Command) == "" {
		return badRequest("nothing to run")
	}
	timeout := 10 * time.Minute
	if req.Timeout != "" {
		d, err := time.ParseDuration(req.Timeout)
		if err != nil || d <= 0 {
			return badRequest("timeout %q is not a duration", req.Timeout)
		}
		timeout = min(d, time.Hour)
	}
	dir, err := b.Locations.Dir(r.Context(), req.Location)
	if err != nil {
		return err
	}
	data := map[string]any{"location": req.Location, "path": dir, "command": req.Command}
	if err := b.before(r, "exec", data); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(r.Context(), timeout)
	defer cancel()
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/sh"
	}
	cmd := exec.CommandContext(ctx, shell, "-lc", req.Command)
	cmd.Dir = dir
	var out tailBuffer
	cmd.Stdout, cmd.Stderr = &out, &out
	res := ExecResult{}
	if err := cmd.Run(); err != nil {
		var ee *exec.ExitError
		switch {
		case ctx.Err() != nil:
			res.ExitCode = -1
			out.Write([]byte(fmt.Sprintf("\n[berth: stopped after %v]\n", timeout)))
		case errors.As(err, &ee):
			res.ExitCode = ee.ExitCode()
		default:
			return err
		}
	}
	res.Output, res.Truncated = out.String(), out.dropped
	data["exit_code"] = res.ExitCode
	b.publish(r, "exec.finished", data)
	writeJSON(w, res)
	return nil
}

// tailBuffer keeps the last execOutputLimit bytes written to it.
type tailBuffer struct {
	bytes.Buffer
	dropped bool
}

func (t *tailBuffer) Write(p []byte) (int, error) {
	n, _ := t.Buffer.Write(p)
	if over := t.Len() - execOutputLimit; over > 0 {
		t.Next(over)
		t.dropped = true
	}
	return n, nil
}

// HooksDoc is a machine's hooks as the app edits them.
type HooksDoc struct {
	Path  string       `json:"path"`
	Hooks []hooks.Hook `json:"hooks"`
}

func (b *Box) getHooks(w http.ResponseWriter, r *http.Request) error {
	if b.Hooks == nil {
		return httpError{http.StatusNotImplemented, "this box has no hooks file"}
	}
	cfg, err := b.Hooks.Load()
	if err != nil {
		return err
	}
	if cfg.Hooks == nil {
		cfg.Hooks = []hooks.Hook{}
	}
	writeJSON(w, HooksDoc{Path: b.Hooks.Path, Hooks: cfg.Hooks})
	return nil
}

func (b *Box) putHooks(w http.ResponseWriter, r *http.Request) error {
	if b.Hooks == nil {
		return httpError{http.StatusNotImplemented, "this box has no hooks file"}
	}
	var doc HooksDoc
	if err := decode(r, &doc); err != nil {
		return err
	}
	if err := b.Hooks.Save(doc.Hooks); err != nil {
		return badRequest("%v", err)
	}
	b.publish(r, "hooks.changed", nil)
	return b.getHooks(w, r)
}
