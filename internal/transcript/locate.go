package transcript

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
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

// ClaudePath finds Claude Code's transcript for a session in dir: by its
// conversation ID when the hooks gave one, otherwise the newest in that
// folder's project written since the session started.
func ClaudePath(dir, id string, started time.Time) string {
	proj := filepath.Join(home("CLAUDE_CONFIG_DIR", ".claude"), "projects", nonAlnum.ReplaceAllString(dir, "-"))
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
