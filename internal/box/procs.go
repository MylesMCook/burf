package box

import (
	"bytes"
	"errors"
	"strings"
)

// proc is one of the user's processes, as reaping agent-browser sessions
// needs it: who its parent is, what it runs and its environment.
type proc struct {
	PID, PPID int
	// Exe is the program's path, when the system says; Args its argv.
	Exe  string
	Args []string
	Env  map[string]string
}

var errNoProcs = errors.New("reading other processes' environment is not supported on this system")

// parseEnv turns NUL- or list-separated KEY=VALUE entries into a map.
func parseEnv(entries []string) map[string]string {
	env := make(map[string]string, len(entries))
	for _, kv := range entries {
		if k, v, ok := strings.Cut(kv, "="); ok && k != "" {
			if _, dup := env[k]; !dup {
				env[k] = v
			}
		}
	}
	return env
}

// splitNul splits a NUL-separated block, dropping empty entries.
func splitNul(b []byte) []string {
	var out []string
	for _, s := range strings.Split(string(b), "\x00") {
		if s != "" {
			out = append(out, s)
		}
	}
	return out
}

// hasMarks says whether a NUL-separated environment holds every mark at
// the start of an entry.
func hasMarks(env []byte, marks []string) bool {
	for _, m := range marks {
		if !bytes.HasPrefix(env, []byte(m)) && !bytes.Contains(env, []byte("\x00"+m)) {
			return false
		}
	}
	return true
}
