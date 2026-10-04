// Package transcript reads a coding agent's own record of its conversation
// (Claude Code's transcript, Codex's session file) and turns it into the
// short items the app's Conversation view draws: what was asked, what the
// agent said, its tool calls in groups, its edits, and the helpers it
// started. Tool output and the agent's thinking are never read out: only
// that a call finished. Nothing is stored; a file is read as it grows, and
// only the last items are kept.
package transcript

import (
	"bufio"
	"bytes"
	"io"
	"os"
	"sync"
	"time"
)

// Item is one entry in the conversation. Kind is user, text, tools, edit
// or crew; the fields each kind uses are as in app/src/lib/transcript.ts.
type Item struct {
	Kind    string     `json:"kind"`
	ID      string     `json:"id"`
	Text    string     `json:"text,omitempty"`
	Verb    string     `json:"verb,omitempty"`
	Items   []ToolCall `json:"items,omitempty"`
	Done    bool       `json:"done,omitempty"`
	File    string     `json:"file,omitempty"`
	Added   int        `json:"added,omitempty"`
	Removed int        `json:"removed,omitempty"`
	Names   []string   `json:"names,omitempty"`
	// Tool is the call behind an edit, for its exact change.
	Tool string `json:"tool,omitempty"`

	// pending are the tool calls in a group still waiting for a result.
	pending map[string]bool
}

// ToolCall is one call in a group: "Read webhook.ts", "Run pnpm test".
type ToolCall struct {
	Verb   string `json:"verb"`
	Target string `json:"target"`
	File   bool   `json:"file,omitempty"`
	// ID names the call for its details (GET …/transcript/tool/{id}).
	ID string `json:"id,omitempty"`
}

// CrewMember is a helper the agent started: a subagent.
type CrewMember struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Kind  string `json:"kind"`
	Agent string `json:"agent"`
	State string `json:"state"`
	Doing string `json:"doing"`
	Since int64  `json:"since"`
	Until int64  `json:"until,omitempty"`
}

// Result answers GET /v1/sessions/{name}/transcript?since=N: the items at
// index N and after (an open tool group is sent again until it is done, so
// the app replaces items by ID), the index to ask from next, and the crew.
type Result struct {
	Source    string       `json:"source"`
	Items     []Item       `json:"items"`
	Next      int          `json:"next"`
	Crew      []CrewMember `json:"crew"`
	Truncated bool         `json:"truncated,omitempty"`
	// Reason says why there is nothing to show, when Source is "none".
	Reason string `json:"reason,omitempty"`
}

const (
	// keep is how many items a conversation holds; older ones drop off.
	keep = 300
	// maxStart is how much of a long file is read when it is first opened:
	// its end, where the recent conversation is.
	maxStart = 4 << 20
	// maxText is the most of one reply kept: a long answer, its tables and
	// code included, reads whole.
	maxText = 32 << 10
	// maxLine skips absurd lines (a pasted image's data) without reading
	// them into memory.
	maxLine = 1 << 20
	// idle is how long an unread conversation stays cached.
	idle    = 10 * time.Minute
	maxOpen = 32
)

// parser turns one line of a file into changes to the conversation.
type parser interface {
	line(c *conv, b []byte)
}

// conv is one file being followed.
type conv struct {
	source   string
	dir      string
	items    []Item
	base     int            // index of items[0]
	byTool   map[string]int // tool call ID → absolute index of its group
	crew     []CrewMember
	crewByID map[string]int
	// background are helpers started in the background, still out.
	background map[string]bool
	offset     int64
	partial    []byte
	truncated  bool
	used       time.Time
	p          parser
	seq        int
}

func (c *conv) id() string {
	c.seq++
	return c.source[:2] + itoa(c.seq)
}

func (c *conv) add(it Item) int {
	// A new item closes the tool group before it.
	if n := len(c.items); n > 0 && c.items[n-1].Kind == "tools" {
		c.items[n-1].Done = true
		c.items[n-1].pending = nil
	}
	c.items = append(c.items, it)
	if over := len(c.items) - keep; over > 0 {
		c.items = append(c.items[:0:0], c.items[over:]...)
		c.base += over
	}
	return c.base + len(c.items) - 1
}

// at returns the item at an absolute index, if it is still kept.
func (c *conv) at(i int) *Item {
	if i < c.base || i >= c.base+len(c.items) {
		return nil
	}
	return &c.items[i-c.base]
}

// call adds a tool call to the open group of the same verb, or starts one.
func (c *conv) call(toolID string, tc ToolCall) {
	tc.ID = toolID
	if n := len(c.items); n > 0 {
		last := &c.items[n-1]
		// The last group takes more calls of its kind, even once its earlier
		// ones have finished.
		if last.Kind == "tools" && last.Verb == tc.Verb && last.pending != nil {
			last.Done = false
			last.Items = append(last.Items, tc)
			if toolID != "" {
				last.pending[toolID] = true
				c.byTool[toolID] = c.base + n - 1
			}
			return
		}
	}
	it := Item{Kind: "tools", ID: c.id(), Verb: tc.Verb, Items: []ToolCall{tc}, pending: map[string]bool{}}
	if toolID != "" {
		it.pending[toolID] = true
	}
	i := c.add(it)
	if toolID != "" {
		c.byTool[toolID] = i
	}
}

// launched marks a helper as running in the background: its tool call
// answers at once, and it is back only when its notification says so.
func (c *conv) launched(toolID string) {
	if c.background == nil {
		c.background = map[string]bool{}
	}
	c.background[toolID] = true
}

// back marks a helper finished.
func (c *conv) back(toolID string, at int64) {
	if i, ok := c.crewByID[toolID]; ok && c.crew[i].State != "finished" {
		c.crew[i].State = "finished"
		c.crew[i].Until = at
	}
	delete(c.background, toolID)
}

// result marks a tool call finished; a group is done when all its calls are.
func (c *conv) result(toolID string, at int64) {
	if !c.background[toolID] {
		c.back(toolID, at)
	}
	i, ok := c.byTool[toolID]
	if !ok {
		return
	}
	delete(c.byTool, toolID)
	if it := c.at(i); it != nil && it.pending != nil {
		delete(it.pending, toolID)
		if len(it.pending) == 0 {
			it.Done = true
		}
	}
}

func (c *conv) helper(m CrewMember) {
	if _, ok := c.crewByID[m.ID]; ok {
		return
	}
	c.crewByID[m.ID] = len(c.crew)
	c.crew = append(c.crew, m)
	// Only the latest helpers matter.
	if len(c.crew) > 20 {
		c.crew = c.crew[len(c.crew)-20:]
		c.crewByID = map[string]int{}
		for i, h := range c.crew {
			c.crewByID[h.ID] = i
		}
	}
}

// read follows the file from where it left off.
func (c *conv) read(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return err
	}
	if st.Size() < c.offset { // replaced or truncated: start again
		*c = conv{source: c.source, dir: c.dir, p: c.p, byTool: map[string]int{}, crewByID: map[string]int{}}
	}
	if c.offset == 0 && st.Size() > maxStart {
		c.offset = st.Size() - maxStart
		c.truncated = true
	}
	if _, err := f.Seek(c.offset, io.SeekStart); err != nil {
		return err
	}
	r := bufio.NewReaderSize(f, 64<<10)
	skipFirst := c.truncated && c.offset > 0 && len(c.items) == 0 && c.partial == nil
	for {
		chunk, err := r.ReadSlice('\n')
		c.offset += int64(len(chunk))
		if len(c.partial)+len(chunk) <= maxLine {
			c.partial = append(c.partial, chunk...)
		} else {
			c.partial = c.partial[:0]
			c.partial = append(c.partial, '!') // too long: dropped at its newline
		}
		if err == bufio.ErrBufferFull {
			continue
		}
		if err != nil { // EOF: keep the incomplete line for next time
			if err == io.EOF {
				return nil
			}
			return err
		}
		line := bytes.TrimSpace(c.partial)
		c.partial = c.partial[:0]
		if skipFirst {
			skipFirst = false // the middle of a line
			continue
		}
		if len(line) > 0 && line[0] == '{' {
			c.p.line(c, line)
		}
	}
}

// Reader keeps the conversations being looked at.
type Reader struct {
	mu    sync.Mutex
	convs map[string]*conv
}

func NewReader() *Reader { return &Reader{convs: map[string]*conv{}} }

// Read returns the conversation in path from index since.
func (r *Reader) Read(source, path, dir string, since int) (Result, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	for k, c := range r.convs {
		if now.Sub(c.used) > idle {
			delete(r.convs, k)
		}
	}
	c := r.convs[path]
	if c == nil {
		if len(r.convs) >= maxOpen {
			r.evictOldest()
		}
		c = &conv{source: source, dir: dir, byTool: map[string]int{}, crewByID: map[string]int{}}
		switch source {
		case "codex":
			c.p = &codexParser{}
		default:
			c.p = &claudeParser{}
		}
		r.convs[path] = c
	}
	c.used = now
	if err := c.read(path); err != nil {
		return Result{}, err
	}
	from := max(since, c.base)
	// A tool group can change after it was sent (more calls, or done), so
	// the one just before `since` comes again, as does an open one at the
	// end; the app replaces items by ID.
	if it := c.at(from - 1); it != nil && it.Kind == "tools" {
		from--
	}
	if n := len(c.items); n > 0 && c.items[n-1].Kind == "tools" && !c.items[n-1].Done {
		from = min(from, c.base+n-1)
	}
	from = min(from, c.base+len(c.items))
	out := Result{Source: source, Next: c.base + len(c.items), Truncated: c.truncated || c.base > 0}
	out.Items = append([]Item{}, c.items[from-c.base:]...)
	out.Crew = append([]CrewMember{}, c.crew...)
	return out, nil
}

func (r *Reader) evictOldest() {
	var oldest string
	var at time.Time
	for k, c := range r.convs {
		if oldest == "" || c.used.Before(at) {
			oldest, at = k, c.used
		}
	}
	delete(r.convs, oldest)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
