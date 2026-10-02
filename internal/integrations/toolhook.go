// Package integrations connects berth to the tools around it: it turns
// agent tools' hook payloads into berth events, installs those hooks, and
// ships the skill that teaches agents to drive berth.
package integrations

import (
	"encoding/json"
	"strings"

	"github.com/sean-brydon/berth/internal/events"
)

// Translate turns a tool's hook payload into a berth event. It keeps only
// identifiers and the working directory: prompts, messages, and transcripts
// never leave the tool, so they cannot leak into hooks or logs. ok is false
// for payloads that are not worth announcing.
func Translate(tool, hookEvent string, payload []byte) (events.Event, bool) {
	var in map[string]any
	json.Unmarshal(payload, &in)
	str := func(k string) string {
		s, _ := in[k].(string)
		return s
	}
	e := events.Event{Origin: tool, Data: map[string]any{}}
	switch tool {
	case "claude":
		switch hookEvent {
		case "Stop":
			e.Type = "agent.finished"
		case "Notification":
			e.Type = "agent.waiting"
		case "SessionStart":
			// A new session sits at its prompt until someone types.
			e.Type = "agent.ready"
		case "UserPromptSubmit":
			e.Type = "agent.started"
		default:
			return e, false
		}
		e.Data["path"] = str("cwd")
		e.Data["session_id"] = str("session_id")
	case "cursor":
		switch hookEvent {
		case "stop":
			e.Type = "agent.finished"
			e.Data["status"] = str("status")
		default:
			return e, false
		}
		if roots, ok := in["workspace_roots"].([]any); ok && len(roots) > 0 {
			e.Data["path"], _ = roots[0].(string)
		}
		e.Data["conversation_id"] = str("conversation_id")
	case "codex":
		// Codex passes its notification as an argument, not on stdin.
		if str("type") != "agent-turn-complete" {
			return e, false
		}
		e.Type = "agent.finished"
		e.Data["path"] = str("cwd")
		e.Data["turn_id"] = str("turn-id")
	default:
		// Any other tool names the berth event directly.
		if !strings.Contains(hookEvent, ".") {
			return e, false
		}
		e.Type = hookEvent
		if p := str("cwd"); p != "" {
			e.Data["path"] = p
		}
	}
	for k, v := range e.Data {
		if v == "" {
			delete(e.Data, k)
		}
	}
	e.Data["agent"] = tool
	return e, true
}

// Reply is what a tool expects its hook to print. Cursor reads JSON from
// every hook; the others ignore output.
func Reply(tool string) string {
	if tool == "cursor" {
		return "{}"
	}
	return ""
}
