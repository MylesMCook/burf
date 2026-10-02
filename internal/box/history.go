package box

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/sean-brydon/berthd/internal/statefile"
)

// History keeps what every session showed, after the session is gone, so
// people can ask "what did my agents do, and where did one say X?". Two
// sources answer it: the terminal output berthd captures from each session's
// scrollback, and Claude Code's own transcripts, which have real turns and
// timestamps.
//
// A terminal log only ever grows by lines that scrolled into a session's
// history, which tmux no longer redraws; the visible screen, which agents
// repaint all the time, is kept separately and replaced on every look.

const (
	historyInterval = 15 * time.Second
	historyMaxLog   = 20 << 20
	historyTail     = 30
	historyKeep     = 30 * 24 * time.Hour
	// timeMark starts a line that records when the lines after it were
	// captured. It never survives control-character stripping, so it cannot
	// come from a terminal.
	timeMark = "\x1e"
)

// HistorySession describes one recorded session: a terminal capture or a
// Claude Code transcript.
type HistorySession struct {
	ID       string    `json:"id"`
	Source   string    `json:"source"` // "terminal" or "claude"
	Name     string    `json:"name,omitempty"`
	Agent    string    `json:"agent,omitempty"`
	Location string    `json:"location,omitempty"`
	Worktree string    `json:"worktree,omitempty"` // empty for the main checkout
	Path     string    `json:"path,omitempty"`
	Branch   string    `json:"branch,omitempty"`
	Command  string    `json:"command,omitempty"`
	Title    string    `json:"title,omitempty"`
	Started  time.Time `json:"started,omitzero"`
	Updated  time.Time `json:"updated,omitzero"`
	Ended    bool      `json:"ended"`
	State    string    `json:"state,omitempty"`
	Lines    int       `json:"lines"`
	// Running names the live tmux session, when there is one.
	Running string `json:"running,omitempty"`
	// Linked are the other source's records of the same work: a terminal
	// session's Claude transcripts, or a transcript's terminal session.
	Linked []string `json:"linked,omitempty"`

	// What the next capture compares against.
	historySize int
	tail        []string
}

type savedHistory struct {
	HistorySession
	HistorySize int      `json:"history_size"`
	Tail        []string `json:"tail"`
}

// History records sessions and searches what they said.
type History struct {
	// Dir holds one log per session, its last screen, and the index.
	Dir string
	// ClaudeDirs are Claude Code config folders whose projects/ hold
	// transcripts; nil means the usual ones.
	ClaudeDirs func() []string

	mu       sync.Mutex
	index    map[string]*HistorySession
	loaded   bool
	poke     chan struct{}
	claude   map[string]claudeFile // transcript path → what it holds
	claudeMu sync.Mutex
}

var historyID = regexp.MustCompile(`^(term|claude):[A-Za-z0-9_.-]{1,120}$`)

func (h *History) load() {
	if h.loaded {
		return
	}
	h.loaded = true
	h.index = map[string]*HistorySession{}
	b, err := os.ReadFile(filepath.Join(h.Dir, "index.json"))
	if err != nil {
		return
	}
	var saved []savedHistory
	if json.Unmarshal(b, &saved) != nil {
		return
	}
	for _, s := range saved {
		hs := s.HistorySession
		hs.historySize, hs.tail = s.HistorySize, s.Tail
		h.index[hs.ID] = &hs
	}
}

func (h *History) save() {
	out := make([]savedHistory, 0, len(h.index))
	for _, s := range h.index {
		out = append(out, savedHistory{HistorySession: *s, HistorySize: s.historySize, Tail: s.tail})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	if b, err := json.Marshal(out); err == nil {
		statefile.Write(filepath.Join(h.Dir, "index.json"), b)
	}
}

func terminalID(s Session) string {
	return "term:" + s.Name + "-" + strconv.FormatInt(s.Created.Unix(), 36)
}

func (h *History) logPath(id string) string {
	return filepath.Join(h.Dir, strings.TrimPrefix(id, "term:")+".log")
}

func (h *History) screenPath(id string) string {
	return filepath.Join(h.Dir, strings.TrimPrefix(id, "term:")+".screen")
}

// Run records every session until ctx ends: on a timer, and soon after an
// agent finishes or waits, which is when there is most to keep.
func (h *History) Run(ctx context.Context, b *Box) {
	h.mu.Lock()
	h.poke = make(chan struct{}, 1)
	h.load()
	h.prune()
	h.mu.Unlock()
	events, stop := b.Events.Subscribe()
	defer stop()
	t := time.NewTicker(historyInterval)
	defer t.Stop()
	for {
		h.CaptureAll(ctx, b)
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		case <-h.poke:
		case e := <-events:
			switch e.Type {
			case "agent.finished", "agent.waiting", "session.stopped":
				// Let the agent finish drawing first.
				time.Sleep(time.Second)
			default:
				continue
			}
		}
	}
}

// prune forgets sessions untouched for historyKeep, and their files. The
// caller holds h.mu.
func (h *History) prune() {
	for id, s := range h.index {
		if s.Ended && time.Since(s.Updated) > historyKeep {
			os.Remove(h.logPath(id))
			os.Remove(h.logPath(id) + ".1")
			os.Remove(h.screenPath(id))
			delete(h.index, id)
		}
	}
}

// CaptureAll records new output of every session, and marks gone ones ended.
func (h *History) CaptureAll(ctx context.Context, b *Box) {
	sessions, err := b.Sessions.List(ctx)
	if err != nil {
		return
	}
	sessions = b.enrich(ctx, sessions)
	h.mu.Lock()
	defer h.mu.Unlock()
	h.load()
	live := map[string]bool{}
	for _, s := range sessions {
		id := terminalID(s)
		live[id] = true
		h.capture(ctx, b, s, id)
	}
	for id, s := range h.index {
		if !live[id] && !s.Ended {
			s.Ended, s.Running = true, ""
			if s.State == "" || s.State == "running" {
				s.State = "ended"
			}
		}
	}
	h.save()
}

// CaptureSession records one session now, before it is killed.
func (h *History) CaptureSession(ctx context.Context, b *Box, name string) {
	if h == nil {
		return
	}
	sessions, err := b.Sessions.List(ctx)
	if err != nil {
		return
	}
	for _, s := range b.enrich(ctx, sessions) {
		if s.Name == name {
			h.mu.Lock()
			h.load()
			id := terminalID(s)
			h.capture(ctx, b, s, id)
			if hs := h.index[id]; hs != nil {
				hs.Ended, hs.Running, hs.State = true, "", "stopped"
			}
			h.save()
			h.mu.Unlock()
		}
	}
}

// capture appends what scrolled into s's history since the last look and
// replaces its last screen. The caller holds h.mu.
func (h *History) capture(ctx context.Context, b *Box, s Session, id string) {
	hs := h.index[id]
	if hs == nil {
		hs = &HistorySession{ID: id, Source: "terminal", Name: s.Name, Command: s.Command, Started: s.Created, Path: s.Dir}
		if b.Locations != nil {
			if loc, wt, ok := b.worktreeAt(ctx, s.Dir); ok {
				hs.Location, hs.Worktree, hs.Branch = loc.Name, worktreeName(wt), wt.Branch
			}
		}
		h.index[id] = hs
	}
	hs.Agent = s.Agent
	if s.AgentState != "" {
		hs.State = s.AgentState
	}
	if s.Exited {
		hs.State = "exited"
	}
	hs.Running, hs.Ended = s.Name, false
	target := "=" + s.Name + ":"

	if screen, err := b.Sessions.tmux(ctx, "capture-pane", "-p", "-J", "-t", target); err == nil {
		os.MkdirAll(h.Dir, 0o700)
		statefile.Write(h.screenPath(id), []byte(clean(string(screen))))
	}
	out, err := b.Sessions.tmux(ctx, "display-message", "-p", "-t", target, "#{history_size}")
	if err != nil {
		return
	}
	size, _ := strconv.Atoi(strings.TrimSpace(string(out)))
	if size == 0 || size == hs.historySize && size < 50000 {
		hs.historySize = size
		return
	}
	lines, err := h.historyLines(ctx, b, target, min(size, 5000))
	if err != nil {
		return
	}
	fresh, found := newLines(hs.tail, lines)
	if !found && size > 5000 {
		// More scrolled by than one look covers; read all of it.
		if all, err := h.historyLines(ctx, b, target, size); err == nil {
			lines = all
			fresh, found = newLines(hs.tail, lines)
		}
	}
	if !found && len(hs.tail) > 0 {
		fresh = append([]string{"[…the terminal's history was cleared or ran past what berth could keep…]"}, fresh...)
	}
	hs.historySize = size
	if len(fresh) == 0 {
		return
	}
	if err := h.appendLog(id, fresh); err != nil {
		return
	}
	hs.Lines += len(fresh)
	hs.Updated = time.Now().UTC()
	all := append(append([]string{}, hs.tail...), fresh...)
	hs.tail = all[max(0, len(all)-historyTail):]
}

func (h *History) historyLines(ctx context.Context, b *Box, target string, n int) ([]string, error) {
	out, err := b.Sessions.tmux(ctx, "capture-pane", "-p", "-J", "-t", target, "-S", "-"+strconv.Itoa(n), "-E", "-1")
	if err != nil {
		return nil, err
	}
	text := strings.TrimRight(clean(string(out)), "\n")
	if text == "" {
		return nil, nil
	}
	return strings.Split(text, "\n"), nil
}

// newLines is what lines adds after the last appearance of tail in it.
// found is false when tail is not there at all.
func newLines(tail, lines []string) (fresh []string, found bool) {
	if len(tail) == 0 {
		return lines, true
	}
	// The longest suffix of tail that lines contains, searching from the end
	// so a repeated block resolves to its latest copy.
	for n := len(tail); n > 0; n-- {
		suffix := tail[len(tail)-n:]
		for i := len(lines) - n; i >= 0; i-- {
			if equalLines(lines[i:i+n], suffix) {
				return lines[i+n:], true
			}
		}
		if n < 3 {
			break // a line or two in common is not evidence
		}
	}
	return lines, false
}

func equalLines(a, b []string) bool {
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func (h *History) appendLog(id string, lines []string) error {
	if err := os.MkdirAll(h.Dir, 0o700); err != nil {
		return err
	}
	path := h.logPath(id)
	if info, err := os.Stat(path); err == nil && info.Size() > historyMaxLog {
		os.Rename(path, path+".1")
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()
	w := bufio.NewWriter(f)
	fmt.Fprintf(w, "%s%s\n", timeMark, time.Now().UTC().Format(time.RFC3339))
	for _, l := range lines {
		w.WriteString(l)
		w.WriteByte('\n')
	}
	return w.Flush()
}

var (
	ansi     = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(\x07|\x1b\\)|\x1b[@-Z\\-_]`)
	controls = regexp.MustCompile(`[\x00-\x08\x0b-\x1f\x7f]`)
)

// clean strips escape sequences and control characters, keeping text,
// tabs and newlines.
func clean(s string) string {
	return controls.ReplaceAllString(ansi.ReplaceAllString(s, ""), "")
}

// Lines that look like credentials are never shown: env assignments with
// long values, and well-known token shapes.
var secretish = []*regexp.Regexp{
	regexp.MustCompile(`^\s*(export\s+)?[A-Z][A-Z0-9_]{2,}\s*[=:]\s*["']?[^\s"']{16,}`),
	regexp.MustCompile(`(ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|xox[abpr]-[A-Za-z0-9-]{10,}|GOCSPX-[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY`),
}

const hiddenLine = "[hidden: looks like a secret]"

func redact(line string) string {
	for _, re := range secretish {
		if re.MatchString(line) {
			return hiddenLine
		}
	}
	return line
}

// --- Claude Code transcripts -------------------------------------------------

type claudeFile struct {
	mod  time.Time
	size int64
	meta HistorySession
}

func (h *History) claudeDirs() []string {
	if h.ClaudeDirs != nil {
		return h.ClaudeDirs()
	}
	var dirs []string
	if home, err := os.UserHomeDir(); err == nil {
		dirs = append(dirs, filepath.Join(home, ".claude"))
	}
	if d := os.Getenv("CLAUDE_CONFIG_DIR"); d != "" {
		dirs = append(dirs, d)
	}
	if user, err := statefile.UserDir(); err == nil {
		more, _ := filepath.Glob(filepath.Join(user, "accounts", "claude", "*"))
		dirs = append(dirs, more...)
	}
	return dirs
}

// claudeTranscripts lists every transcript, newest first, refreshing what
// changed since the last look.
func (h *History) claudeTranscripts(ctx context.Context, b *Box) []HistorySession {
	h.claudeMu.Lock()
	defer h.claudeMu.Unlock()
	if h.claude == nil {
		h.claude = map[string]claudeFile{}
	}
	seen := map[string]bool{}
	var files []string
	for _, d := range h.claudeDirs() {
		matches, _ := filepath.Glob(filepath.Join(d, "projects", "*", "*.jsonl"))
		files = append(files, matches...)
	}
	var locs []Location
	listed := false
	var out []HistorySession
	for _, f := range files {
		if seen[f] {
			continue
		}
		seen[f] = true
		info, err := os.Stat(f)
		if err != nil {
			continue
		}
		c, ok := h.claude[f]
		if !ok || !c.mod.Equal(info.ModTime()) || c.size != info.Size() {
			meta, err := readClaudeMeta(f)
			if err != nil {
				continue
			}
			if b != nil && b.Locations != nil && meta.Path != "" {
				if !listed {
					locs, _ = b.Locations.List(ctx)
					listed = true
				}
				if loc, wt, ok := worktreeIn(locs, meta.Path); ok {
					meta.Location, meta.Worktree, meta.Branch = loc.Name, worktreeName(wt), wt.Branch
				}
			}
			c = claudeFile{mod: info.ModTime(), size: info.Size(), meta: meta}
			h.claude[f] = c
		}
		out = append(out, c.meta)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Updated.After(out[j].Updated) })
	return out
}

// worktreeName is a worktree's name in a "location/worktree" reference: none
// for the repository's own checkout.
func worktreeName(wt Worktree) string {
	if wt.Main {
		return ""
	}
	return wt.Name
}

// worktreeIn is worktreeAt over locations already listed.
func worktreeIn(locs []Location, dir string) (Location, Worktree, bool) {
	var best Worktree
	var bestLoc Location
	for _, l := range locs {
		for _, w := range l.Worktrees {
			if (dir == w.Path || strings.HasPrefix(dir, w.Path+string(filepath.Separator))) && len(w.Path) > len(best.Path) {
				best, bestLoc = w, l
			}
		}
	}
	return bestLoc, best, best.Path != ""
}

func (h *History) claudePath(id string) string {
	h.claudeMu.Lock()
	defer h.claudeMu.Unlock()
	for path, c := range h.claude {
		if c.meta.ID == id {
			return path
		}
	}
	return ""
}

type claudeLine struct {
	Type        string    `json:"type"`
	Timestamp   time.Time `json:"timestamp"`
	SessionID   string    `json:"sessionId"`
	Cwd         string    `json:"cwd"`
	IsSidechain bool      `json:"isSidechain"`
	IsMeta      bool      `json:"isMeta"`
	AiTitle     string    `json:"aiTitle"`
	Message     struct {
		ID      string          `json:"id"`
		Role    string          `json:"role"`
		Content json.RawMessage `json:"content"`
	} `json:"message"`
}

// Turn is one step of a Claude Code session: a prompt, a reply, a tool call
// or what the tool gave back.
type Turn struct {
	N    int       `json:"n"`
	Role string    `json:"role"` // user, assistant, tool, result
	Time time.Time `json:"time,omitzero"`
	Text string    `json:"text"`
	Tool string    `json:"tool,omitempty"`
}

func newClaudeScanner(r io.Reader) *bufio.Scanner {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 64<<10), 16<<20)
	return sc
}

func readClaudeMeta(path string) (HistorySession, error) {
	f, err := os.Open(path)
	if err != nil {
		return HistorySession{}, err
	}
	defer f.Close()
	id := strings.TrimSuffix(filepath.Base(path), ".jsonl")
	meta := HistorySession{ID: "claude:" + id, Source: "claude", Agent: "claude", Ended: true}
	firstPrompt := ""
	sc := newClaudeScanner(f)
	for sc.Scan() {
		var l claudeLine
		if json.Unmarshal(sc.Bytes(), &l) != nil {
			continue
		}
		if l.AiTitle != "" {
			meta.Title = l.AiTitle
		}
		if l.Type != "user" && l.Type != "assistant" || l.IsSidechain {
			continue
		}
		if meta.Path == "" && l.Cwd != "" {
			meta.Path = l.Cwd
		}
		if !l.Timestamp.IsZero() {
			if meta.Started.IsZero() {
				meta.Started = l.Timestamp
			}
			meta.Updated = l.Timestamp
		}
		for _, t := range turnsOf(l) {
			meta.Lines++
			if firstPrompt == "" && t.Role == "user" {
				firstPrompt = t.Text
			}
		}
	}
	if meta.Title == "" {
		meta.Title = firstLine(firstPrompt, 100)
	}
	return meta, nil
}

func firstLine(s string, n int) string {
	s = strings.TrimSpace(s)
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = s[:i]
	}
	if len(s) > n {
		s = s[:n] + "…"
	}
	return s
}

// turnsOf reads one transcript line's turns. Tool results are cut short and
// thinking is left out; nothing here is a full tool output.
func turnsOf(l claudeLine) []Turn {
	if l.IsMeta {
		return nil
	}
	var text string
	if json.Unmarshal(l.Message.Content, &text) == nil {
		if l.Type != "user" || strings.HasPrefix(strings.TrimSpace(text), "<") {
			// Local commands and system notes arrive as tags, not prompts.
			return nil
		}
		return []Turn{{Role: "user", Time: l.Timestamp, Text: text}}
	}
	var blocks []struct {
		Type    string          `json:"type"`
		Text    string          `json:"text"`
		Name    string          `json:"name"`
		Input   json.RawMessage `json:"input"`
		Content json.RawMessage `json:"content"`
	}
	if json.Unmarshal(l.Message.Content, &blocks) != nil {
		return nil
	}
	var out []Turn
	for _, bl := range blocks {
		switch bl.Type {
		case "text":
			role := "assistant"
			if l.Type == "user" {
				if strings.HasPrefix(strings.TrimSpace(bl.Text), "<") {
					continue
				}
				role = "user"
			}
			if strings.TrimSpace(bl.Text) != "" {
				out = append(out, Turn{Role: role, Time: l.Timestamp, Text: bl.Text})
			}
		case "tool_use":
			out = append(out, Turn{Role: "tool", Time: l.Timestamp, Tool: bl.Name, Text: toolSummary(bl.Name, bl.Input)})
		case "tool_result":
			out = append(out, Turn{Role: "result", Time: l.Timestamp, Text: firstLines(resultText(bl.Content), 12, 1200)})
		}
	}
	return out
}

// toolSummary is a tool call on one line: the command, file or pattern.
func toolSummary(name string, input json.RawMessage) string {
	var in map[string]any
	json.Unmarshal(input, &in)
	for _, k := range []string{"command", "file_path", "path", "pattern", "url", "query", "description", "prompt"} {
		if v, ok := in[k].(string); ok && v != "" {
			return firstLine(v, 160)
		}
	}
	return ""
}

func resultText(raw json.RawMessage) string {
	var s string
	if json.Unmarshal(raw, &s) == nil {
		return s
	}
	var parts []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	json.Unmarshal(raw, &parts)
	var b strings.Builder
	for _, p := range parts {
		if p.Type == "text" {
			b.WriteString(p.Text)
			b.WriteByte('\n')
		}
	}
	return b.String()
}

func firstLines(s string, lines, chars int) string {
	parts := strings.Split(strings.TrimRight(s, "\n"), "\n")
	cut := len(parts) > lines
	if cut {
		parts = parts[:lines]
	}
	out := strings.Join(parts, "\n")
	if len(out) > chars {
		out, cut = out[:chars], true
	}
	if cut {
		out += "\n…"
	}
	return out
}

// claudeTurns reads a transcript's turns from the from-th on.
func claudeTurns(path string, from, limit int) ([]Turn, int, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, 0, err
	}
	defer f.Close()
	var out []Turn
	n := 0
	sc := newClaudeScanner(f)
	for sc.Scan() {
		var l claudeLine
		if json.Unmarshal(sc.Bytes(), &l) != nil || l.Type != "user" && l.Type != "assistant" || l.IsSidechain {
			continue
		}
		for _, t := range turnsOf(l) {
			if n >= from && len(out) < limit {
				t.N = n
				t.Text = redactText(t.Text)
				out = append(out, t)
			}
			n++
		}
	}
	return out, n, sc.Err()
}

func redactText(s string) string {
	lines := strings.Split(s, "\n")
	for i, l := range lines {
		lines[i] = redact(l)
	}
	return strings.Join(lines, "\n")
}

// --- listing, reading and searching -----------------------------------------

// Sessions lists recorded sessions of both sources, newest first, linking a
// terminal session to the Claude transcripts made in it.
func (h *History) Sessions(ctx context.Context, b *Box, f HistoryFilter) []HistorySession {
	h.mu.Lock()
	h.load()
	var terms []HistorySession
	for _, s := range h.index {
		terms = append(terms, *s)
	}
	h.mu.Unlock()
	claude := h.claudeTranscripts(ctx, b)
	for i := range terms {
		t := &terms[i]
		for j := range claude {
			c := &claude[j]
			if t.Agent == "claude" && samePath(t.Path, c.Path) && !c.Started.Before(t.Started.Add(-time.Minute)) &&
				(t.Running != "" || c.Started.Before(t.Updated.Add(time.Minute))) {
				t.Linked = append(t.Linked, c.ID)
				c.Linked = append(c.Linked, t.ID)
				if t.Running != "" {
					c.Running = t.Running
					c.Ended = false
				}
			}
		}
	}
	all := append(terms, claude...)
	out := []HistorySession{}
	for _, s := range all {
		if f.match(s) {
			out = append(out, s)
		}
	}
	sort.Slice(out, func(i, j int) bool { return latest(out[i]).After(latest(out[j])) })
	if f.Limit > 0 && len(out) > f.Limit {
		out = out[:f.Limit]
	}
	return out
}

func latest(s HistorySession) time.Time {
	if s.Updated.After(s.Started) {
		return s.Updated
	}
	return s.Started
}

// HistoryFilter narrows listings and searches.
type HistoryFilter struct {
	ID       string // one session
	Agent    string
	Location string // "cal" or "cal/billing"
	Source   string
	Since    time.Time
	Limit    int
}

func (f HistoryFilter) match(s HistorySession) bool {
	if f.ID != "" && s.ID != f.ID {
		return false
	}
	if f.Agent != "" && s.Agent != f.Agent {
		return false
	}
	if f.Source != "" && s.Source != f.Source {
		return false
	}
	if f.Location != "" {
		loc, wt, _ := strings.Cut(f.Location, "/")
		if s.Location != loc || wt != "" && s.Worktree != wt {
			return false
		}
	}
	if !f.Since.IsZero() && latest(s).Before(f.Since) {
		return false
	}
	return true
}

// HistoryMatch is one line that matched a search, with its neighbours.
type HistoryMatch struct {
	Session HistorySession `json:"session"`
	// Position is the line (terminal) or turn (Claude) it is at.
	Position int       `json:"position"`
	Time     time.Time `json:"time,omitzero"`
	Role     string    `json:"role,omitempty"`
	Line     string    `json:"line"`
	// Screen is set when the line is on the terminal's last screen rather
	// than in its log.
	Screen bool     `json:"screen,omitempty"`
	Before []string `json:"before"`
	After  []string `json:"after"`
}

type matcher func(string) bool

func newMatcher(q string, isRegexp bool) (matcher, error) {
	if isRegexp {
		// Go's regexp runs in linear time, so no pattern can hang a search.
		re, err := regexp.Compile("(?i)" + q)
		if err != nil {
			return nil, err
		}
		return re.MatchString, nil
	}
	lq := strings.ToLower(q)
	return func(s string) bool { return strings.Contains(strings.ToLower(s), lq) }, nil
}

// Search finds lines matching q, newest sessions first, until limit matches
// or the deadline.
func (h *History) Search(ctx context.Context, b *Box, q string, isRegexp bool, f HistoryFilter) ([]HistoryMatch, error) {
	match, err := newMatcher(q, isRegexp)
	if err != nil {
		return nil, err
	}
	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	f.Limit = 0
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	out := []HistoryMatch{}
	for _, s := range h.Sessions(ctx, b, f) {
		if ctx.Err() != nil || len(out) >= limit {
			break
		}
		if s.Source == "claude" {
			out = append(out, h.searchClaude(ctx, s, match, limit-len(out))...)
		} else {
			out = append(out, h.searchTerminal(ctx, s, match, limit-len(out))...)
		}
	}
	return out, nil
}

func (h *History) searchTerminal(ctx context.Context, s HistorySession, match matcher, limit int) []HistoryMatch {
	var out []HistoryMatch
	pos := 0
	var when time.Time
	var prev []string
	var open []int // matches still collecting the lines after them
	onScreen := false
	consider := func(line string) {
		shown := redact(line)
		kept := open[:0]
		for _, i := range open {
			out[i].After = append(out[i].After, shown)
			if len(out[i].After) < 2 {
				kept = append(kept, i)
			}
		}
		open = kept
		if len(out) < limit && match(line) && shown != hiddenLine {
			out = append(out, HistoryMatch{Session: s, Position: pos, Time: when, Line: shown, Screen: onScreen, Before: append([]string{}, prev...), After: []string{}})
			open = append(open, len(out)-1)
		}
		prev = append(prev, shown)
		if len(prev) > 2 {
			prev = prev[1:]
		}
		pos++
	}
	for _, path := range []string{h.logPath(s.ID) + ".1", h.logPath(s.ID)} {
		if len(out) >= limit && len(open) == 0 {
			break
		}
		f, err := os.Open(path)
		if err != nil {
			continue
		}
		sc := newClaudeScanner(f)
		for sc.Scan() && ctx.Err() == nil {
			line := sc.Text()
			if strings.HasPrefix(line, timeMark) {
				when, _ = time.Parse(time.RFC3339, strings.TrimPrefix(line, timeMark))
				continue
			}
			consider(line)
			if len(out) >= limit && len(open) == 0 {
				break
			}
		}
		f.Close()
	}
	if len(out) < limit || len(open) > 0 {
		if b, err := os.ReadFile(h.screenPath(s.ID)); err == nil {
			when, onScreen, pos = s.Updated, true, 0
			for _, line := range strings.Split(strings.TrimRight(string(b), "\n"), "\n") {
				consider(line)
			}
		}
	}
	return out
}

func (h *History) searchClaude(ctx context.Context, s HistorySession, match matcher, limit int) []HistoryMatch {
	path := h.claudePath(s.ID)
	if path == "" {
		return nil
	}
	turns, _, err := claudeTurns(path, 0, 1<<30)
	if err != nil {
		return nil
	}
	var out []HistoryMatch
	for _, t := range turns {
		if ctx.Err() != nil || len(out) >= limit {
			break
		}
		if t.Role == "tool" && t.Tool != "" {
			t.Text = t.Tool + ": " + t.Text
		}
		lines := strings.Split(t.Text, "\n")
		for i, l := range lines {
			if !match(l) || l == hiddenLine {
				continue
			}
			m := HistoryMatch{Session: s, Position: t.N, Time: t.Time, Role: t.Role, Line: l, Before: lines[max(0, i-2):i], After: lines[i+1 : min(len(lines), i+3)]}
			out = append(out, m)
			if len(out) >= limit {
				break
			}
		}
	}
	return out
}

// Transcript is one recorded session's content, a page at a time.
type Transcript struct {
	Session HistorySession `json:"session"`
	From    int            `json:"from"`
	Total   int            `json:"total"`
	// Lines is a terminal capture's page, with when each was captured.
	Lines []TranscriptLine `json:"lines,omitempty"`
	// Screen is what the terminal showed last.
	Screen []string `json:"screen,omitempty"`
	// Turns is a Claude transcript's page.
	Turns []Turn `json:"turns,omitempty"`
}

type TranscriptLine struct {
	N    int       `json:"n"`
	Time time.Time `json:"time,omitzero"`
	Text string    `json:"text"`
}

var ErrUnknownHistory = errors.New("no recorded session with that id")

// Read returns a page of a recorded session.
func (h *History) Read(ctx context.Context, b *Box, id string, from, limit int) (Transcript, error) {
	if limit <= 0 || limit > 5000 {
		limit = 500
	}
	var s *HistorySession
	for _, hs := range h.Sessions(ctx, b, HistoryFilter{}) {
		if hs.ID == id {
			s = &hs
			break
		}
	}
	if s == nil {
		return Transcript{}, ErrUnknownHistory
	}
	t := Transcript{Session: *s, From: from}
	if s.Source == "claude" {
		turns, total, err := claudeTurns(h.claudePath(id), from, limit)
		if err != nil {
			return Transcript{}, err
		}
		t.Turns, t.Total = turns, total
		if t.Turns == nil {
			t.Turns = []Turn{}
		}
		return t, nil
	}
	n := 0
	var when time.Time
	t.Lines = []TranscriptLine{}
	for _, path := range []string{h.logPath(id) + ".1", h.logPath(id)} {
		f, err := os.Open(path)
		if err != nil {
			continue
		}
		sc := newClaudeScanner(f)
		for sc.Scan() {
			line := sc.Text()
			if strings.HasPrefix(line, timeMark) {
				when, _ = time.Parse(time.RFC3339, strings.TrimPrefix(line, timeMark))
				continue
			}
			if n >= from && len(t.Lines) < limit {
				t.Lines = append(t.Lines, TranscriptLine{N: n, Time: when, Text: redact(line)})
			}
			n++
		}
		f.Close()
	}
	t.Total = n
	if b, err := os.ReadFile(h.screenPath(id)); err == nil {
		for _, l := range strings.Split(strings.TrimRight(string(b), "\n"), "\n") {
			t.Screen = append(t.Screen, redact(l))
		}
	}
	return t, nil
}

func historyFilter(r *http.Request) (HistoryFilter, error) {
	q := r.URL.Query()
	f := HistoryFilter{ID: q.Get("session"), Agent: q.Get("agent"), Location: q.Get("location"), Source: q.Get("source")}
	f.Limit, _ = strconv.Atoi(q.Get("limit"))
	if since := q.Get("since"); since != "" {
		if t, err := time.Parse(time.RFC3339, since); err == nil {
			f.Since = t
		} else if d, err := parseAge(since); err == nil {
			f.Since = time.Now().Add(-d)
		} else {
			return f, badRequest("since %q is neither a time nor an age like 7d or 12h", since)
		}
	}
	return f, nil
}

// parseAge reads durations with days: 7d, 36h, 90m.
func parseAge(s string) (time.Duration, error) {
	if d, ok := strings.CutSuffix(s, "d"); ok {
		n, err := strconv.Atoi(d)
		if err != nil || n < 0 {
			return 0, fmt.Errorf("bad age %q", s)
		}
		return time.Duration(n) * 24 * time.Hour, nil
	}
	return time.ParseDuration(s)
}

func (b *Box) handleHistory(w http.ResponseWriter, r *http.Request) error {
	if b.History == nil {
		return httpError{http.StatusNotImplemented, "this box does not keep history"}
	}
	f, err := historyFilter(r)
	if err != nil {
		return err
	}
	q := r.URL.Query().Get("q")
	if q == "" {
		writeJSON(w, b.History.Sessions(r.Context(), b, f))
		return nil
	}
	matches, err := b.History.Search(r.Context(), b, q, r.URL.Query().Get("regexp") == "1", f)
	if err != nil {
		return badRequest("%v", err)
	}
	writeJSON(w, matches)
	return nil
}

func (b *Box) handleHistorySession(w http.ResponseWriter, r *http.Request) error {
	if b.History == nil {
		return httpError{http.StatusNotImplemented, "this box does not keep history"}
	}
	id := r.PathValue("id")
	if !historyID.MatchString(id) {
		return httpError{http.StatusNotFound, ErrUnknownHistory.Error()}
	}
	from, _ := strconv.Atoi(r.URL.Query().Get("from"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	t, err := b.History.Read(r.Context(), b, id, max(from, 0), limit)
	if errors.Is(err, ErrUnknownHistory) {
		return httpError{http.StatusNotFound, err.Error()}
	}
	if err != nil {
		return err
	}
	writeJSON(w, t)
	return nil
}
