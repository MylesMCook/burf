package box

import (
	"bytes"
	"encoding/binary"
	"os"
	"strings"

	"golang.org/x/sys/unix"
)

// scanProcs lists this user's processes whose environment holds every one
// of the marks (as "KEY=" prefixes). macOS gives a process's arguments and
// environment to its own user through sysctl kern.procargs2, as ps -E reads
// them. A process that ends while it is read is left out.
func scanProcs(marks ...string) ([]proc, error) {
	all, err := unix.SysctlKinfoProcSlice("kern.proc.uid", os.Getuid())
	if err != nil {
		return nil, err
	}
	var out []proc
	for _, k := range all {
		pid := int(k.Proc.P_pid)
		if pid <= 0 {
			continue
		}
		raw, err := unix.SysctlRaw("kern.procargs2", pid)
		if err != nil || len(raw) < 4 {
			continue
		}
		exe, args, env := parseProcargs2(raw)
		if !hasMarks([]byte(strings.Join(env, "\x00")), marks) {
			continue
		}
		out = append(out, proc{PID: pid, PPID: int(k.Eproc.Ppid), Exe: exe, Args: args, Env: parseEnv(env)})
	}
	return out, nil
}

// parseProcargs2 reads kern.procargs2: argc, the executable's path, NUL
// padding, argc arguments, then the environment up to an empty string.
func parseProcargs2(raw []byte) (exe string, args, env []string) {
	argc := int(binary.LittleEndian.Uint32(raw[:4]))
	rest := raw[4:]
	next := func() (string, bool) {
		i := bytes.IndexByte(rest, 0)
		if i < 0 {
			s := string(rest)
			rest = nil
			return s, s != ""
		}
		s := string(rest[:i])
		rest = rest[i+1:]
		return s, true
	}
	exe, _ = next()
	for len(rest) > 0 && rest[0] == 0 {
		rest = rest[1:]
	}
	for i := 0; i < argc && len(rest) > 0; i++ {
		s, _ := next()
		args = append(args, s)
	}
	for len(rest) > 0 {
		s, ok := next()
		if !ok || s == "" {
			break
		}
		env = append(env, s)
	}
	return exe, args, env
}
