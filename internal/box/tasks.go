package box

import (
	"context"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/sean-brydon/berthd/internal/events"
	"github.com/sean-brydon/berthd/internal/wire"
)

// AgentPreset is a way to start a coding agent: what the app offers when it
// starts one, and what a task runs.
type AgentPreset struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Command string `json:"command"`
	// PromptFlag passes a first prompt; empty means it is the last argument.
	PromptFlag string `json:"prompt_flag,omitempty"`
}

// builtinAgents are the agent CLIs berth knows how to start, by binary.
var builtinAgents = []AgentPreset{
	{ID: "claude", Name: "Claude Code", Command: "claude"},
	{ID: "codex", Name: "Codex", Command: "codex"},
	{ID: "opencode", Name: "OpenCode", Command: "opencode", PromptFlag: "--prompt"},
	{ID: "gemini", Name: "Gemini CLI", Command: "gemini", PromptFlag: "-i"},
	{ID: "cursor", Name: "Cursor Agent", Command: "cursor-agent"},
}

// Presets are the built-in agents this box has, then the location's own from
// its repository's .berth/config.json, which may replace a built-in by ID.
func Presets(loc *Location) []AgentPreset {
	var out []AgentPreset
	for _, p := range builtinAgents {
		if _, err := toolPath(p.Command); err == nil {
			out = append(out, p)
		}
	}
	if loc == nil {
		return out
	}
	for _, own := range loc.Agents {
		replaced := false
		for i := range out {
			if out[i].ID == own.ID {
				out[i], replaced = own, true
			}
		}
		if !replaced {
			out = append(out, own)
		}
	}
	return out
}

// presetFor finds the preset with id, or a built-in even when it is not on
// PATH, so the error comes from the session rather than a guess.
func presetFor(loc *Location, id string) (AgentPreset, bool) {
	for _, p := range Presets(loc) {
		if p.ID == id {
			return p, true
		}
	}
	for _, p := range builtinAgents {
		if p.ID == id {
			return p, true
		}
	}
	return AgentPreset{}, false
}

// AgentCommand is the command line that starts p with a first prompt.
func AgentCommand(p AgentPreset, prompt string) string {
	if prompt == "" {
		return p.Command
	}
	if p.PromptFlag != "" {
		return p.Command + " " + p.PromptFlag + " " + shellQuote(prompt)
	}
	return p.Command + " " + shellQuote(prompt)
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

// agentOf names the agent a session's command runs, or "" for anything else.
// It looks past what commonly wraps an agent: env and its assignments,
// exec, nohup, npx and the like, `op run --`, and a package name such as
// @anthropic-ai/claude-code.
func agentOf(command string) string {
	fields := strings.Fields(command)
	for i, f := range fields {
		if i >= 8 {
			break
		}
		bin := filepath.Base(f)
		for _, p := range builtinAgents {
			if bin == p.Command {
				return p.ID
			}
		}
		pkg := f
		if i := strings.LastIndex(pkg, "@"); i > 0 {
			pkg = pkg[:i] // a version: @anthropic-ai/claude-code@latest
		}
		if id, ok := agentPackages[pkg]; ok {
			return id
		}
		if !wrapperWord(f) {
			return ""
		}
	}
	return ""
}

// agentPackages are agents' npm packages, as npx and friends run them.
var agentPackages = map[string]string{
	"@anthropic-ai/claude-code": "claude",
	"@openai/codex":             "codex",
	"@google/gemini-cli":        "gemini",
	"opencode-ai":               "opencode",
}

// wrapperWord is a word that runs the command after it.
func wrapperWord(f string) bool {
	switch filepath.Base(f) {
	case "env", "exec", "nohup", "command", "time", "npx", "bunx", "pnpx", "dlx", "pnpm", "yarn", "op", "run", "--", "caffeinate", "nice":
		return true
	}
	if strings.HasPrefix(f, "-") {
		return true
	}
	k, _, ok := strings.Cut(f, "=")
	return ok && k != "" && !strings.ContainsAny(k, "/ ")
}

// agentFor is the agent a session runs: its preset when berth started it
// with one, else what its command looks like.
func agentFor(s Session) string {
	if s.Preset != "" {
		for _, p := range builtinAgents {
			if p.ID == s.Preset {
				return p.ID
			}
		}
		if a := agentOf(s.Command); a != "" {
			return a
		}
		return s.Preset
	}
	return agentOf(s.Command)
}

// TaskRequest makes a worktree and starts an agent in it, in one step.
type TaskRequest struct {
	Location string `json:"location"`
	Name     string `json:"name"`
	Branch   string `json:"branch,omitempty"`
	Base     string `json:"base,omitempty"`
	PR       int    `json:"pr,omitempty"`
	Ref      string `json:"ref,omitempty"`
	// Agent is a preset ID; Command, when set, is run instead.
	Agent   string `json:"agent,omitempty"`
	Command string `json:"command,omitempty"`
	Prompt  string `json:"prompt,omitempty"`
	// FromSession names the session handing this work off, if any.
	FromSession string `json:"from_session,omitempty"`
	// Open asks the app to show the new session: "split" or "tab".
	Open string `json:"open,omitempty"`
}

type Task struct {
	Worktree Worktree `json:"worktree"`
	Session  Session  `json:"session"`
}

func (b *Box) addTask(w http.ResponseWriter, r *http.Request) error {
	var req TaskRequest
	if err := decode(r, &req); err != nil {
		return err
	}
	if req.Location == "" || req.Name == "" {
		return badRequest("a task needs a location and a name")
	}
	ctx := r.Context()
	loc, err := b.Locations.Get(ctx, req.Location)
	if err != nil {
		return err
	}
	command := req.Command
	if command == "" && req.Agent != "" {
		p, ok := presetFor(&loc, req.Agent)
		if !ok {
			return badRequest("unknown agent %q", req.Agent)
		}
		command = AgentCommand(p, req.Prompt)
	}
	data := map[string]any{"location": req.Location, "name": req.Name, "branch": req.Branch, "base": req.Base, "agent": req.Agent, "command": command}
	if err := b.before(r, "task.create", data); err != nil {
		return err
	}
	wt, err := b.createWorktree(r, loc, WorktreeRequest{Name: req.Name, Branch: req.Branch, Base: req.Base, PR: req.PR, Ref: req.Ref})
	if err != nil {
		return err
	}
	where := req.Location + "/" + wt.Name
	preset := ""
	if req.Command == "" {
		preset = req.Agent
	}
	sess, err := b.startSession(r, defaultSessionName(where, command), where, wt.Path, command, preset)
	if err != nil {
		// A task is a worktree with an agent in it: without the agent, the
		// worktree it made goes too, so a retry starts clean.
		if rmErr := b.Locations.RemoveWorktree(context.WithoutCancel(r.Context()), req.Location, wt.Name, true); rmErr != nil {
			return fmt.Errorf("created %s, but could not start its session (%w); removing the worktree failed too: %v", wt.Path, err, rmErr)
		}
		b.publish(r, "worktree.removed", map[string]any{"location": req.Location, "name": wt.Name, "path": wt.Path, "reason": "task failed"})
		return fmt.Errorf("could not start the task's session, so its worktree was removed: %w", err)
	}
	b.publish(r, "task.created", map[string]any{
		"location": req.Location, "name": wt.Name, "path": wt.Path, "branch": wt.Branch,
		"session": sess.Name, "agent": req.Agent, "from_session": req.FromSession,
	})
	b.announceOpen(r, sess, req.Open)
	writeJSON(w, Task{Worktree: wt, Session: sess})
	return nil
}

// startupPrompts are questions agents ask before their own hooks are
// running, so nothing else would say the agent is waiting.
var startupPrompts = []string{
	"Yes, I trust this folder",       // Claude Code, in a folder it has not seen
	"Do you trust the files in this", // older Claude Code
}

// watchStartup looks at a new agent session's screen while it starts and
// reports it waiting if it stops at a startup question.
func (b *Box) watchStartup(from string, sess Session) {
	for _, wait := range []time.Duration{2 * time.Second, 3 * time.Second, 5 * time.Second, 10 * time.Second} {
		time.Sleep(wait)
		screen, err := b.Sessions.Screen(context.Background(), sess.Name, 0)
		if err != nil {
			return
		}
		for _, p := range startupPrompts {
			if strings.Contains(screen, p) {
				b.Events.Publish(events.Event{Type: "agent.waiting", Box: b.Name, Origin: from, Data: map[string]any{
					"path": sess.Dir, "agent": sess.Agent, "session": sess.Name, "reason": "startup question",
				}})
				return
			}
		}
	}
}

// before asks the hooks gating typ, the box's and then the repository's,
// whether the request may go ahead.
func (b *Box) before(r *http.Request, typ string, data map[string]any) error {
	e := events.Event{Type: typ, Box: b.Name, Origin: gateOrigin(r), Data: data}
	if b.Hooks != nil {
		if err := b.Hooks.Before(r.Context(), e); err != nil {
			return httpError{http.StatusForbidden, err.Error()}
		}
	}
	return b.beforeRepo(r, e)
}

// gateOrigin is the origin a gate sees. A gate scoped to a tool lets that
// tool's own actions through, so the claim must be one the box can vouch for:
// only callers on its own socket (the box user's tools, which could edit the
// hooks anyway) may name a tool. A paired laptop or the phone is named by who
// it authenticated as, which no tool name can equal.
func gateOrigin(r *http.Request) string {
	if wire.IsLocal(r.Context()) {
		return origin(r)
	}
	if p := wire.PeerFrom(r.Context()); p.Name != "" {
		return "laptop:" + p.Name
	}
	return "remote"
}

// enrich adds what each session's agent is doing, from the turn ledger.
func (b *Box) enrich(ctx context.Context, all []Session) []Session {
	for i := range all {
		s := &all[i]
		s.Agent = agentFor(*s)
		if s.Agent == "" {
			continue
		}
		if s.Exited {
			if b.Turns != nil {
				b.Turns.Exited(s.Name)
			}
			continue
		}
		s.AgentState = "running"
		if b.Turns != nil {
			st := b.Turns.Track(*s)
			if st.State != "" && st.State != "exited" {
				s.AgentState, s.StateSince = st.State, st.Since
			}
			s.Turn, s.StateSeq, s.Fidelity = st.Turn, st.Seq, st.Fidelity
		}
	}
	return all
}
