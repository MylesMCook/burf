package box

import (
	"bytes"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

// scanProcs lists this user's processes whose environment holds every one
// of the marks (as "KEY=" prefixes), read from /proc. A process that ends
// while it is read is left out.
func scanProcs(marks ...string) ([]proc, error) {
	ents, err := os.ReadDir("/proc")
	if err != nil {
		return nil, err
	}
	uid := uint32(os.Getuid())
	var out []proc
	for _, e := range ents {
		pid, err := strconv.Atoi(e.Name())
		if err != nil || pid <= 0 {
			continue
		}
		dir := filepath.Join("/proc", e.Name())
		if fi, err := os.Stat(dir); err != nil {
			continue
		} else if st, ok := fi.Sys().(*syscall.Stat_t); !ok || st.Uid != uid {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(dir, "environ"))
		if err != nil || !hasMarks(raw, marks) {
			continue
		}
		p := proc{PID: pid, Env: parseEnv(splitNul(raw))}
		if b, err := os.ReadFile(filepath.Join(dir, "cmdline")); err == nil {
			p.Args = splitNul(b)
		}
		p.Exe, _ = os.Readlink(filepath.Join(dir, "exe"))
		p.Exe = strings.TrimSuffix(p.Exe, " (deleted)")
		if b, err := os.ReadFile(filepath.Join(dir, "stat")); err == nil {
			// pid (comm) state ppid …; comm may hold spaces and parentheses.
			if i := bytes.LastIndexByte(b, ')'); i > 0 {
				if f := strings.Fields(string(b[i+1:])); len(f) > 1 {
					p.PPID, _ = strconv.Atoi(f[1])
				}
			}
		}
		out = append(out, p)
	}
	return out, nil
}
