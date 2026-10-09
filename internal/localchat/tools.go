package localchat

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"
)

// ToolServer names Burf's own tools to the provider. A chat started with them
// gets one stdio MCP server under this name, on its own thread only. It is
// the name the account's own Burf server has, so on this thread it takes that
// one's place: the same tools, working for the chat instead of for no one.
const ToolServer = "berth"

// toolWait is how long a tool waits for the person's answer. It ends before
// the provider's own tool timeout so the reason is Burf's.
var toolWait = 290 * time.Second

const (
	maxToolName   = 64
	maxToolDetail = 8 << 10
)

// Tools gives one chat Burf's own tools. The provider's sandbox cannot reach
// the box, so they run in a process of their own; the chat's person is asked
// before one of them acts.
type Tools struct {
	// Server is the command the provider starts for this chat's tools.
	Server func(chat string) (command string, args []string)
}

// serverConfig is the provider's entry for the server. Its tools are approved
// at the provider because the chat itself asks first (ToolApproval).
func (t *Tools) serverConfig(chat string) map[string]any {
	command, args := t.Server(chat)
	return map[string]any{
		"command": command, "args": args,
		"default_tools_approval_mode": "approve",
		"tool_timeout_sec":            browserToolTimeout,
	}
}

// Caller holds mu. A turn that ended, or a chat that stopped, can no longer
// act: its unanswered questions are refused.
func (r *running) cancelTools() {
	for id, ch := range r.toolAsks {
		close(ch)
		delete(r.toolAsks, id)
	}
}

// Caller holds mu.
func (r *running) dropApproval(id string) {
	for i, a := range r.session.Approvals {
		if a.ID == id {
			r.session.Approvals = append(r.session.Approvals[:i], r.session.Approvals[i+1:]...)
			break
		}
	}
	if len(r.approvals)+len(r.toolAsks) == 0 && r.session.State == "waiting" {
		r.session.State = "running"
	}
}

// ToolApproval asks the chat's person before one of Burf's tools acts outside
// the provider's sandbox, and waits for the answer: nil is a yes. A chat in
// full access was told to act without asking. It never retries.
func (m *Manager) ToolApproval(ctx context.Context, id, tool, detail string) error {
	r, err := m.get(id)
	if err != nil {
		return err
	}
	if tool == "" || len(tool) > maxToolName || strings.ContainsAny(tool, "\x00\r\n") {
		return errors.New("name the tool that asks")
	}
	if len(detail) > maxToolDetail || strings.ContainsRune(detail, 0) {
		return errors.New("what the tool would do must fit 8 KiB")
	}
	var raw [8]byte
	if _, err = rand.Read(raw[:]); err != nil {
		return err
	}
	key := "tool-" + hex.EncodeToString(raw[:])
	ch := make(chan bool, 1)
	r.mu.Lock()
	switch {
	case !r.tools:
		err = errors.New("this chat has no Burf tools")
	// A turn the provider has opened: one that is only being asked for may
	// still be refused, and has no settings of its own yet.
	case (r.session.State != "running" && r.session.State != "waiting") || r.session.TurnID == "":
		err = errors.New("Burf tools act only during a turn")
	case r.permission == "full-access":
		r.mu.Unlock()
		return nil
	case len(r.session.Approvals) >= 8:
		err = errors.New("too many approvals are waiting")
	}
	if err != nil {
		r.mu.Unlock()
		return err
	}
	text := tool
	if detail != "" {
		text += "\n" + detail
	}
	r.toolAsks[key] = ch
	r.session.Approvals = append(r.session.Approvals, Approval{ID: key, Kind: "tool", Detail: text})
	r.session.State = "waiting"
	r.mu.Unlock()

	timer := time.NewTimer(toolWait)
	defer timer.Stop()
	select {
	case yes, ok := <-ch:
		switch {
		case !ok:
			return errors.New("the turn ended before the person answered")
		case !yes:
			return errors.New("the person declined")
		}
		return nil
	case <-ctx.Done():
		err = ctx.Err()
	case <-timer.C:
		err = errors.New("no one answered")
	}
	r.mu.Lock()
	if _, pending := r.toolAsks[key]; pending {
		delete(r.toolAsks, key)
		r.dropApproval(key)
	}
	r.mu.Unlock()
	// An answer given just as the wait ended still counts.
	select {
	case yes, ok := <-ch:
		if ok && yes {
			return nil
		}
	default:
	}
	return err
}

// Caller holds mu. decideTool answers one of the chat's own questions.
func (r *running) decideTool(approval, decision string) (bool, error) {
	ch, ok := r.toolAsks[approval]
	if !ok {
		return false, nil
	}
	if decision != "accept" && decision != "decline" {
		return true, errors.New("a Burf tool is allowed once or denied")
	}
	delete(r.toolAsks, approval)
	r.dropApproval(approval)
	ch <- decision == "accept"
	return true, nil
}

// Report hands the chat a message from Burf itself, not from its person: what
// became of work the chat started. Like any message it needs an idle chat.
func (m *Manager) Report(ctx context.Context, id, text string) error {
	return m.send(ctx, id, text, TurnOptions{}, "report")
}
