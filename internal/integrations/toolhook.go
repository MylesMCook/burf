// Package integrations connects berth to the tools around it: it turns
// agent tools' hook payloads into berth events, installs those hooks, and
// ships the skill that teaches agents to drive berth.
package integrations

import (
	"encoding/json"
	"strings"

	"github.com/sean-brydon/berthd/internal/events"
	"github.com/sean-brydon/berthd/internal/integrations/adapters"
)

// Translate turns a tool's hook payload into a berth event, through the
// tool's adapter. It keeps only identifiers and the working directory:
// prompts, messages, and transcripts never leave the tool, so they cannot
// leak into hooks or logs. ok is false for payloads that are not worth
// announcing.
func Translate(tool, hookEvent string, payload []byte) (events.Event, bool) {
	var in map[string]any
	json.Unmarshal(payload, &in)
	e := events.Event{Origin: tool, Data: map[string]any{}}
	if a, ok := adapters.For(tool); ok {
		typ, data, ok := a.Translate(hookEvent, adapters.Payload(in))
		if !ok {
			return e, false
		}
		e.Type, e.Data = typ, data
	} else {
		// Any other tool names the berth event directly.
		if !strings.Contains(hookEvent, ".") {
			return e, false
		}
		e.Type = hookEvent
		if p, _ := in["cwd"].(string); p != "" {
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
