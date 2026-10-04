// Package mcpserver is `berthd mcp`: a stdio MCP server that gives agents
// on a box typed tools for berth, backed by the box's own socket (so it adds
// no network surface). Every tool is short and non-blocking: waits take at
// most 90 seconds and return a cursor to continue from, long commands run
// detached as runs, and results are minimal JSON, since each byte of a
// tool's answer is an agent's token.
package mcpserver

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/sean-brydon/berthd/internal/box"
	"github.com/sean-brydon/berthd/internal/box/runs"
	"github.com/sean-brydon/berthd/internal/version"
)

type request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// Tool is one MCP tool.
type Tool struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
	call        func(ctx context.Context, s *Server, args map[string]any) (any, error)
}

// Server answers MCP requests with a box client.
type Server struct {
	Box *box.Client
}

func obj(props map[string]any, required ...string) map[string]any {
	s := map[string]any{"type": "object", "properties": props}
	if len(required) > 0 {
		s["required"] = required
	}
	return s
}

func str(desc string) map[string]any { return map[string]any{"type": "string", "description": desc} }
func num(desc string) map[string]any { return map[string]any{"type": "number", "description": desc} }

// Tools are berth's MCP tools.
var Tools = []Tool{
	{Name: "berth_sessions", Description: "List agent sessions on this box: name, agent, state, current turn.", InputSchema: obj(map[string]any{}), call: sessions},
	{Name: "berth_screen", Description: "Read the last lines of a session's screen. Use only when an agent waits for someone.", InputSchema: obj(map[string]any{"session": str("session name"), "lines": num("lines of history, at most 60 (default 20)")}, "session"), call: screen},
	{Name: "berth_task_new", Description: "Make a worktree with an agent in it. Returns the session and worktree path.", InputSchema: obj(map[string]any{"location": str("repository (location) name"), "name": str("new worktree name"), "agent": str("agent preset, e.g. claude or codex"), "prompt": str("its first prompt"), "base": str("base branch (optional)")}, "location", "name", "agent"), call: taskNew},
	{Name: "berth_send", Description: "Send a prompt to a session (held until it is idle by default). Returns the turn to wait on.", InputSchema: obj(map[string]any{"session": str("session name"), "text": str("the prompt"), "when": str("idle (default) or now"), "idem": str("a key that makes a retry return the same turn")}, "session", "text"), call: send},
	{Name: "berth_wait_turn", Description: "Wait up to timeout seconds (at most 90) for a turn to end. If ended is false, call again with the cursor.", InputSchema: obj(map[string]any{"turn": str("turn ID, or the cursor from a previous call"), "timeout": num("seconds, at most 90 (default 60)")}, "turn"), call: waitTurn},
	{Name: "berth_exec", Description: "Run a command in a worktree as a detached run; with wait (at most 90 s) return its result if done, else the run to poll.", InputSchema: obj(map[string]any{"location": str("location or location/worktree"), "command": str("shell command"), "wait": num("seconds to wait, at most 90 (default 0)")}, "location", "command"), call: execTool},
	{Name: "berth_run_start", Description: "Start a durable run from a template (loop, review, handoff, broadcast, attempts, fix-ci, address-review). Returns the run ID.", InputSchema: obj(map[string]any{"template": str("template name"), "params": map[string]any{"type": "object", "description": "template parameters"}, "idem": str("idempotency key")}, "template", "params"), call: runStart},
	{Name: "berth_run_get", Description: "A run's status, its open gate, current step and attempts, in brief.", InputSchema: obj(map[string]any{"run": str("run ID")}, "run"), call: runGet},
	{Name: "berth_run_cancel", Description: "Cancel a run.", InputSchema: obj(map[string]any{"run": str("run ID")}, "run"), call: runCancel},
	{Name: "berth_attempts", Description: "Try one task N ways: each agent in its own worktree, verified by check, judged, then a person picks. Returns the run ID.", InputSchema: obj(map[string]any{"location": str("location"), "name": str("worktree name prefix"), "prompt": str("the task"), "agents": map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "agent per attempt, e.g. [\"claude\",\"codex\"]"}, "check": str("command that must pass")}, "location", "name", "prompt", "agents"), call: attempts},
}

// Serve reads requests from in and writes answers to out until in ends.
func Serve(ctx context.Context, socket string, in io.Reader, out io.Writer) error {
	c := box.NewClient(box.NewLocal(socket))
	c.Origin = "mcp"
	return (&Server{Box: c}).Serve(ctx, in, out)
}

// Serve is the stdio loop.
func (s *Server) Serve(ctx context.Context, in io.Reader, out io.Writer) error {
	sc := bufio.NewScanner(in)
	sc.Buffer(make([]byte, 0, 64<<10), 4<<20)
	enc := json.NewEncoder(out)
	for sc.Scan() {
		var req request
		if err := json.Unmarshal(sc.Bytes(), &req); err != nil {
			enc.Encode(response{JSONRPC: "2.0", ID: json.RawMessage("null"), Error: &rpcError{-32700, "parse error"}})
			continue
		}
		if len(req.ID) == 0 {
			continue // a notification
		}
		res, err := s.handle(ctx, req)
		r := response{JSONRPC: "2.0", ID: req.ID, Result: res}
		if err != nil {
			r.Result, r.Error = nil, err
		}
		if err := enc.Encode(r); err != nil {
			return err
		}
	}
	return sc.Err()
}

func (s *Server) handle(ctx context.Context, req request) (any, *rpcError) {
	switch req.Method {
	case "initialize":
		var p struct {
			ProtocolVersion string `json:"protocolVersion"`
		}
		json.Unmarshal(req.Params, &p)
		v := p.ProtocolVersion
		if v == "" {
			v = "2025-06-18"
		}
		return map[string]any{
			"protocolVersion": v,
			"capabilities":    map[string]any{"tools": map[string]any{}},
			"serverInfo":      map[string]any{"name": "berth", "version": version.Version},
			"instructions":    "Tools for this box's agents, worktrees and durable runs. Never block: wait_turn takes at most 90 s and returns a cursor.",
		}, nil
	case "ping":
		return map[string]any{}, nil
	case "tools/list":
		return map[string]any{"tools": Tools}, nil
	case "tools/call":
		var p struct {
			Name      string         `json:"name"`
			Arguments map[string]any `json:"arguments"`
		}
		if err := json.Unmarshal(req.Params, &p); err != nil {
			return nil, &rpcError{-32602, "invalid params"}
		}
		for _, t := range Tools {
			if t.Name == p.Name {
				cctx, cancel := context.WithTimeout(ctx, 100*time.Second)
				defer cancel()
				out, err := t.call(cctx, s, p.Arguments)
				if err != nil {
					return map[string]any{"content": []any{map[string]any{"type": "text", "text": err.Error()}}, "isError": true}, nil
				}
				b, _ := json.Marshal(out)
				return map[string]any{"content": []any{map[string]any{"type": "text", "text": string(b)}}}, nil
			}
		}
		return nil, &rpcError{-32602, "unknown tool " + p.Name}
	}
	return nil, &rpcError{-32601, "method not found"}
}

func arg(a map[string]any, k string) string {
	switch v := a[k].(type) {
	case string:
		return v
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	}
	return ""
}

func seconds(a map[string]any, k string, def, max float64) time.Duration {
	v, ok := a[k].(float64)
	if !ok || v <= 0 {
		v = def
	}
	if v > max {
		v = max
	}
	return time.Duration(v * float64(time.Second))
}

func need(a map[string]any, keys ...string) error {
	for _, k := range keys {
		if strings.TrimSpace(arg(a, k)) == "" {
			return fmt.Errorf("%s is required", k)
		}
	}
	return nil
}

func sessions(ctx context.Context, s *Server, a map[string]any) (any, error) {
	all, err := s.Box.Sessions(ctx)
	if err != nil {
		return nil, err
	}
	type row struct {
		Name  string `json:"name"`
		Agent string `json:"agent,omitempty"`
		State string `json:"state,omitempty"`
		Turn  string `json:"turn,omitempty"`
		Where string `json:"where,omitempty"`
	}
	out := []row{}
	for _, x := range all {
		if x.Exited {
			continue
		}
		out = append(out, row{x.Name, x.Agent, x.AgentState, x.Turn, x.Location})
	}
	return out, nil
}

func screen(ctx context.Context, s *Server, a map[string]any) (any, error) {
	if err := need(a, "session"); err != nil {
		return nil, err
	}
	n, _ := a["lines"].(float64)
	if n <= 0 {
		n = 20
	}
	text, err := s.Box.Screen(ctx, arg(a, "session"), min(int(n), 60))
	if err != nil {
		return nil, err
	}
	lines := strings.Split(strings.TrimRight(text, "\n "), "\n")
	if len(lines) > int(n) {
		lines = lines[len(lines)-int(n):]
	}
	t := strings.Join(lines, "\n")
	if len(t) > 4000 {
		t = t[len(t)-4000:]
	}
	return map[string]string{"screen": t}, nil
}

func taskNew(ctx context.Context, s *Server, a map[string]any) (any, error) {
	if err := need(a, "location", "name", "agent"); err != nil {
		return nil, err
	}
	t, err := s.Box.AddTask(ctx, box.TaskRequest{Location: arg(a, "location"), Name: arg(a, "name"), Agent: arg(a, "agent"), Prompt: arg(a, "prompt"), Base: arg(a, "base")})
	if err != nil {
		return nil, err
	}
	return map[string]string{"session": t.Session.Name, "path": t.Worktree.Path, "branch": t.Worktree.Branch}, nil
}

func send(ctx context.Context, s *Server, a map[string]any) (any, error) {
	if err := need(a, "session", "text"); err != nil {
		return nil, err
	}
	when := arg(a, "when")
	if when == "" {
		when = "idle"
	}
	r, err := s.Box.Send(ctx, arg(a, "session"), box.SendRequest{Text: arg(a, "text"), When: when, IdemKey: arg(a, "idem")})
	if err != nil {
		return nil, err
	}
	return map[string]any{"turn": r.Turn, "queued": r.Queued}, nil
}

func waitTurn(ctx context.Context, s *Server, a map[string]any) (any, error) {
	if err := need(a, "turn"); err != nil {
		return nil, err
	}
	id := arg(a, "turn")
	w, err := s.Box.WaitTurn(ctx, id, true, seconds(a, "timeout", 60, 90))
	if err != nil {
		return nil, err
	}
	ended := !w.TimedOut && w.State != "waiting"
	out := map[string]any{"state": w.State, "ended": ended}
	if !ended {
		out["cursor"] = id
	}
	return out, nil
}

func execTool(ctx context.Context, s *Server, a map[string]any) (any, error) {
	if err := need(a, "location", "command"); err != nil {
		return nil, err
	}
	var started struct {
		Run string `json:"run"`
	}
	if err := s.Box.Call(ctx, http.MethodPost, "/v1/exec", box.ExecRequest{Location: arg(a, "location"), Command: arg(a, "command"), Detach: true}, &started); err != nil {
		return nil, err
	}
	wait := seconds(a, "wait", 0, 90)
	deadline := time.Now().Add(wait)
	for {
		r, err := s.Box.Run(ctx, started.Run)
		if err == nil && runs.Terminal(r.Status) && len(r.Steps) > 0 {
			st := r.Steps[0]
			out := st.Output
			if st.Status != runs.Succeeded {
				out = box.CheckFeedback(out, 2000)
			} else if len(out) > 1000 {
				out = "…" + out[len(out)-1000:]
			}
			return map[string]any{"run": r.ID, "exit_code": st.ExitCode, "output": out}, nil
		}
		if time.Now().After(deadline) {
			return map[string]any{"run": started.Run, "done": false}, nil
		}
		select {
		case <-ctx.Done():
			return map[string]any{"run": started.Run, "done": false}, nil
		case <-time.After(500 * time.Millisecond):
		}
	}
}

func runStart(ctx context.Context, s *Server, a map[string]any) (any, error) {
	if err := need(a, "template"); err != nil {
		return nil, err
	}
	params, _ := a["params"].(map[string]any)
	r, err := s.Box.StartRun(ctx, box.RunRequest{Template: arg(a, "template"), Params: params}, arg(a, "idem"))
	if err != nil {
		return nil, err
	}
	return map[string]string{"run": r.ID, "status": r.Status}, nil
}

func runGet(ctx context.Context, s *Server, a map[string]any) (any, error) {
	if err := need(a, "run"); err != nil {
		return nil, err
	}
	r, err := s.Box.Run(ctx, arg(a, "run"))
	if err != nil {
		return nil, err
	}
	out := map[string]any{"status": r.Status, "step": r.Cursor}
	if r.Error != "" {
		out["error"] = r.Error
	}
	if r.Gate != nil {
		out["gate"] = r.Gate.Title
	}
	if r.Usage != nil {
		out["tokens"], out["usd"] = r.Usage.Tokens(), r.Usage.USD
	}
	if len(r.Candidates) > 0 {
		var cs []map[string]any
		for _, c := range r.Candidates {
			cs = append(cs, map[string]any{"n": c.Index + 1, "agent": c.Agent, "passed": c.Verify.Passed, "diff": fmt.Sprintf("+%d -%d", c.Diff.Added, c.Diff.Removed), "rank": c.Judge.Rank, "picked": c.Picked})
		}
		out["attempts"] = cs
	}
	return out, nil
}

func runCancel(ctx context.Context, s *Server, a map[string]any) (any, error) {
	if err := need(a, "run"); err != nil {
		return nil, err
	}
	if err := s.Box.CancelRun(ctx, arg(a, "run")); err != nil {
		return nil, err
	}
	return map[string]bool{"cancelled": true}, nil
}

func attempts(ctx context.Context, s *Server, a map[string]any) (any, error) {
	if err := need(a, "location", "name", "prompt"); err != nil {
		return nil, err
	}
	agents, _ := a["agents"].([]any)
	if len(agents) == 0 {
		return nil, errors.New("agents is required")
	}
	params := map[string]any{"location": arg(a, "location"), "name": arg(a, "name"), "prompt": arg(a, "prompt"), "attempts": agents}
	if c := arg(a, "check"); c != "" {
		params["verify"] = map[string]any{"check": c, "max_rounds": 2}
	}
	r, err := s.Box.StartRun(ctx, box.RunRequest{Template: "attempts", Params: params}, "")
	if err != nil {
		return nil, err
	}
	return map[string]string{"run": r.ID, "status": r.Status}, nil
}
