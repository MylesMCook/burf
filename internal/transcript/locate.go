package transcript

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"sync"
	"time"
)

// Where each agent keeps its record of a conversation, on the box, for the
// user berthd runs as.

var nonAlnum = regexp.MustCompile(`[^A-Za-z0-9]`)

func home(env, dflt string) string {
	if v := os.Getenv(env); v != "" {
		return v
	}
	h, _ := os.UserHomeDir()
	return filepath.Join(h, dflt)
}

// ClaudeDir is the folder Claude Code keeps dir's transcripts in.
func ClaudeDir(dir string) string {
	return filepath.Join(home("CLAUDE_CONFIG_DIR", ".claude"), "projects", nonAlnum.ReplaceAllString(dir, "-"))
}

// ClaudePath finds Claude Code's transcript for a session in dir: by its
// conversation ID when the hooks gave one, otherwise the newest in that
// folder's project written since the session started.
func ClaudePath(dir, id string, started time.Time) string {
	proj := ClaudeDir(dir)
	if id != "" && validID(id) {
		if p := filepath.Join(proj, id+".jsonl"); exists(p) {
			return p
		}
	}
	return newest(filepath.Join(proj, "*.jsonl"), started, nil)
}

// CodexPath finds a Codex session file: by ID, else the newest one started
// in dir since the session began.
func CodexPath(dir, id string, started time.Time) string {
	sessions := filepath.Join(home("CODEX_HOME", ".codex"), "sessions")
	if id != "" && validID(id) {
		if m, _ := filepath.Glob(filepath.Join(sessions, "*", "*", "*", "rollout-*"+id+".jsonl")); len(m) > 0 {
			return m[len(m)-1]
		}
	}
	return newest(filepath.Join(sessions, "*", "*", "*", "rollout-*.jsonl"), started, func(p string) bool { return codexCwd(p) == dir })
}

var idPattern = regexp.MustCompile(`^[A-Za-z0-9-]{8,80}$`)

func validID(id string) bool { return idPattern.MatchString(id) }

func exists(p string) bool { _, err := os.Stat(p); return err == nil }

// newest is the most recently written file matching glob, changed after
// since (less a minute of slack) and accepted by ok.
func newest(glob string, since time.Time, ok func(string) bool) string {
	m, _ := filepath.Glob(glob)
	var best string
	var at time.Time
	for _, p := range m {
		st, err := os.Stat(p)
		if err != nil || st.ModTime().Before(since.Add(-time.Minute)) || st.ModTime().Before(at) {
			continue
		}
		if ok != nil && !ok(p) {
			continue
		}
		best, at = p, st.ModTime()
	}
	return best
}

// codexCwd reads the working directory from a session file's first line.
func codexCwd(p string) string {
	f, err := os.Open(p)
	if err != nil {
		return ""
	}
	defer f.Close()
	r := bufio.NewReaderSize(f, 16<<10)
	line, _ := r.ReadSlice('\n')
	var l struct {
		Payload struct {
			Cwd string `json:"cwd"`
		} `json:"payload"`
	}
	_ = json.Unmarshal(line, &l)
	return l.Payload.Cwd
}

// Claim is one agent session in a folder: its name, its conversation ID
// when its hooks gave one, and when it started.
type Claim struct {
	Name    string
	ID      string
	Started time.Time
}

// AssignClaude gives each Claude Code session in dir its own transcript.
// Sessions whose hooks named their conversation get that file; the rest
// take, oldest session first, the earliest unclaimed transcript that began
// after the session did. Several agents in one worktree so read their own
// conversations, never one shared file.
func AssignClaude(dir string, claims []Claim) map[string]string {
	proj := ClaudeDir(dir)
	out := map[string]string{}
	taken := map[string]bool{}
	for _, c := range claims {
		if c.ID != "" && validID(c.ID) {
			if p := filepath.Join(proj, c.ID+".jsonl"); exists(p) {
				out[c.Name] = p
				taken[p] = true
			}
		}
	}
	files, _ := filepath.Glob(filepath.Join(proj, "*.jsonl"))
	type file struct {
		path  string
		start time.Time
	}
	var fs []file
	for _, p := range files {
		if taken[p] {
			continue
		}
		if t, ok := startedAt(p); ok {
			fs = append(fs, file{p, t})
		}
	}
	sort.Slice(fs, func(i, j int) bool { return fs[i].start.Before(fs[j].start) })
	rest := make([]Claim, 0, len(claims))
	for _, c := range claims {
		if out[c.Name] == "" {
			rest = append(rest, c)
		}
	}
	sort.Slice(rest, func(i, j int) bool { return rest[i].Started.Before(rest[j].Started) })
	for _, c := range rest {
		for i, f := range fs {
			if f.path != "" && !f.start.Before(c.Started.Add(-time.Minute)) {
				out[c.Name] = f.path
				fs[i].path = ""
				break
			}
		}
	}
	// A session that started before any transcript it could own (one that
	// is older than its file's records, as a resumed conversation is) still
	// gets the newest left over that was written since it started. A new
	// session that hasn't written yet gets none, never an old conversation.
	for _, c := range rest {
		if out[c.Name] != "" {
			continue
		}
		for i := len(fs) - 1; i >= 0; i-- {
			if fs[i].path != "" && writtenSince(fs[i].path, c.Started.Add(-time.Minute)) {
				out[c.Name] = fs[i].path
				fs[i].path = ""
				break
			}
		}
	}
	return out
}

func writtenSince(p string, t time.Time) bool {
	st, err := os.Stat(p)
	return err == nil && !st.ModTime().Before(t)
}

// starts caches when each transcript began, which never changes; the
// folders of busy boxes hold hundreds.
var starts sync.Map // path → time.Time

// startedAt is when a transcript began: the first timestamp in its first
// lines, else its modification time.
func startedAt(p string) (time.Time, bool) {
	if t, ok := starts.Load(p); ok {
		return t.(time.Time), true
	}
	t, ok := readStart(p)
	if ok {
		starts.Store(p, t)
	}
	return t, ok
}

func readStart(p string) (time.Time, bool) {
	f, err := os.Open(p)
	if err != nil {
		return time.Time{}, false
	}
	defer f.Close()
	r := bufio.NewReaderSize(f, 32<<10)
	for i := 0; i < 20; i++ {
		line, err := r.ReadSlice('\n')
		var l struct {
			Timestamp string `json:"timestamp"`
		}
		if json.Unmarshal(line, &l) == nil && l.Timestamp != "" {
			if t, perr := time.Parse(time.RFC3339Nano, l.Timestamp); perr == nil {
				return t, true
			}
		}
		if err != nil && err != bufio.ErrBufferFull {
			break
		}
	}
	st, err := f.Stat()
	if err != nil {
		return time.Time{}, false
	}
	return st.ModTime(), true
}
