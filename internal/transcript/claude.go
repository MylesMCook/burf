package transcript

import (
	"encoding/json"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// claudeParser reads Claude Code's transcript: one JSON object per line,
// user and assistant messages whose content is text, thinking, tool_use
// and tool_result blocks. Everything else (snapshots, titles, modes) is
// skipped.
type claudeParser struct{}

type claudeLine struct {
	Type      string          `json:"type"`
	IsMeta    bool            `json:"isMeta"`
	Sidechain bool            `json:"isSidechain"`
	Timestamp string          `json:"timestamp"`
	Message   json.RawMessage `json:"message"`
	// Operation and Content are a queue-operation line's: what Claude Code
	// queued for itself, such as a helper's "finished" notification.
	Operation string `json:"operation"`
	Content   string `json:"content"`
}

type claudeMessage struct {
	Content json.RawMessage `json:"content"`
}

type claudeBlock struct {
	Type      string          `json:"type"`
	Text      string          `json:"text"`
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Input     json.RawMessage `json:"input"`
	ToolUseID string          `json:"tool_use_id"`
	Content   json.RawMessage `json:"content"`
}

func (claudeParser) line(c *conv, b []byte) {
	var l claudeLine
	if json.Unmarshal(b, &l) != nil || l.IsMeta || l.Sidechain {
		return
	}
	at := parseTime(l.Timestamp)
	if l.Type == "queue-operation" && l.Operation == "enqueue" {
		helperDone(c, l.Content, at)
		return
	}
	if l.Type != "user" && l.Type != "assistant" {
		return
	}
	var m claudeMessage
	if json.Unmarshal(l.Message, &m) != nil || len(m.Content) == 0 {
		return
	}
	// A prompt can be a plain string.
	var s string
	if json.Unmarshal(m.Content, &s) == nil {
		if l.Type == "user" {
			helperDone(c, s, at)
			userText(c, s)
		}
		return
	}
	var blocks []claudeBlock
	if json.Unmarshal(m.Content, &blocks) != nil {
		return
	}
	var typed []string
	for _, bl := range blocks {
		switch {
		case l.Type == "user" && bl.Type == "text":
			helperDone(c, bl.Text, at)
			typed = append(typed, bl.Text)
		case l.Type == "user" && bl.Type == "image":
			typed = append(typed, "[image]")
		case l.Type == "user" && bl.Type == "tool_result":
			// A helper started in the background answers at once; it is
			// back when its notification says so, not now.
			text := resultText(bl.Content)
			if strings.HasPrefix(text, "Async agent launched") {
				c.launched(bl.ToolUseID)
			}
			c.result(bl.ToolUseID, at)
			// A rejected call with words for the agent (a plan sent back
			// with "Tell Claude what to change") reads as what the person
			// said.
			if _, said, ok := strings.Cut(text, "To tell you how to proceed, the user said:\n"); ok {
				userText(c, said)
			}
		case l.Type == "assistant" && bl.Type == "text":
			if t := strings.TrimSpace(bl.Text); t != "" {
				c.add(Item{Kind: "text", ID: c.id(), Text: clip(t, maxText)})
			}
		case l.Type == "assistant" && bl.Type == "tool_use":
			claudeTool(c, bl, at)
		}
	}
	if len(typed) > 0 {
		userText(c, strings.Join(typed, "\n"))
	}
}

// userText adds what a person typed. Lines Claude Code writes for itself
// (command output, reminders) start with a tag and are skipped.
func userText(c *conv, s string) {
	s = strings.TrimSpace(s)
	if s == "" || strings.HasPrefix(s, "<") || strings.HasPrefix(s, "Caveat:") {
		return
	}
	c.add(Item{Kind: "user", ID: c.id(), Text: clip(s, 4000)})
}

func claudeTool(c *conv, bl claudeBlock, at int64) {
	var in map[string]any
	_ = json.Unmarshal(bl.Input, &in)
	str := func(k string) string { v, _ := in[k].(string); return v }
	switch bl.Name {
	case "Read", "NotebookRead":
		c.call(bl.ID, ToolCall{Verb: "Read", Target: filepath.Base(str("file_path")), File: true})
	case "Glob", "Grep", "LS", "WebSearch", "WebFetch":
		target := firstNonEmpty(str("pattern"), str("query"), str("url"), str("path"))
		c.call(bl.ID, ToolCall{Verb: "Search", Target: clip(target, 80)})
	case "Bash", "BashOutput":
		c.call(bl.ID, ToolCall{Verb: "Run", Target: clip(firstLine(str("command")), 80)})
	case "Edit", "MultiEdit", "Write", "NotebookEdit":
		// Plan mode's plan file is outside the work: its plan shows when
		// the agent presents it (ExitPlanMode).
		if strings.Contains(firstNonEmpty(str("file_path"), str("notebook_path")), "/.claude/plans/") {
			c.byTool[bl.ID] = -1
			return
		}
		added, removed := 0, 0
		switch bl.Name {
		case "Write":
			added = lines(str("content"))
		case "MultiEdit":
			if edits, ok := in["edits"].([]any); ok {
				for _, e := range edits {
					if m, ok := e.(map[string]any); ok {
						ns, _ := m["new_string"].(string)
						os, _ := m["old_string"].(string)
						added += lines(ns)
						removed += lines(os)
					}
				}
			}
		default:
			added, removed = lines(str("new_string")), lines(str("old_string"))
		}
		c.add(Item{Kind: "edit", ID: c.id(), File: rel(c.dir, firstNonEmpty(str("file_path"), str("notebook_path"))), Added: added, Removed: removed})
		c.byTool[bl.ID] = -1
	case "Agent", "Task":
		name := firstNonEmpty(str("description"), str("subagent_type"), "Helper")
		c.add(Item{Kind: "crew", ID: c.id(), Names: []string{name}})
		c.helper(CrewMember{ID: bl.ID, Name: clip(name, 60), Kind: "subagent", Agent: "claude", State: "running", Doing: clip(firstNonEmpty(str("subagent_type"), "Working"), 60), Since: at})
	case "ExitPlanMode":
		// The plan the agent presents for approval is its answer.
		if plan := strings.TrimSpace(str("plan")); plan != "" {
			c.add(Item{Kind: "text", ID: c.id(), Text: clip(plan, maxText)})
		}
	case "TodoWrite", "ToolSearch":
		// Bookkeeping, not work worth a line.
	default:
		name := bl.Name
		if i := strings.LastIndex(name, "__"); i >= 0 {
			name = name[i+2:]
		}
		c.call(bl.ID, ToolCall{Verb: "Run", Target: clip(name, 80)})
	}
}

// resultText is a tool result's text: a string, or its first text block.
func resultText(raw json.RawMessage) string {
	var s string
	if json.Unmarshal(raw, &s) == nil {
		return s
	}
	var blocks []claudeBlock
	if json.Unmarshal(raw, &blocks) == nil {
		for _, b := range blocks {
			if b.Type == "text" {
				return b.Text
			}
		}
	}
	return ""
}

var taskNote = regexp.MustCompile(`(?s)<task-notification>.*?<tool-use-id>([^<]+)</tool-use-id>.*?<status>([^<]+)</status>`)

// helperDone reads a background helper's notification, "<task-notification>
// … <tool-use-id>X</tool-use-id> <status>completed</status>", and marks
// that helper back.
func helperDone(c *conv, s string, at int64) {
	if !strings.Contains(s, "<task-notification>") {
		return
	}
	for _, m := range taskNote.FindAllStringSubmatch(s, -1) {
		if strings.TrimSpace(m[2]) != "running" {
			c.back(strings.TrimSpace(m[1]), at)
		}
	}
}

func parseTime(s string) int64 {
	t, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		return time.Now().UnixMilli()
	}
	return t.UnixMilli()
}

func clip(s string, n int) string {
	if len(s) <= n {
		return s
	}
	cut := n
	for cut > 0 && cut < len(s) && s[cut]&0xC0 == 0x80 { // keep runes whole
		cut--
	}
	return s[:cut] + "…"
}

func firstLine(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i] + " …"
	}
	return s
}

func lines(s string) int {
	if s == "" {
		return 0
	}
	return strings.Count(strings.TrimSuffix(s, "\n"), "\n") + 1
}

func rel(dir, p string) string {
	if !filepath.IsAbs(p) {
		return filepath.Clean(p)
	}
	if dir != "" {
		if r, err := filepath.Rel(dir, p); err == nil && !strings.HasPrefix(r, "..") {
			return r
		}
	}
	return filepath.Base(p)
}

func firstNonEmpty(ss ...string) string {
	for _, s := range ss {
		if s != "" {
			return s
		}
	}
	return ""
}
