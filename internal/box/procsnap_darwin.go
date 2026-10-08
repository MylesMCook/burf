package box

import (
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

// snapHasPercent: macOS's ps says how busy each process is now.
const snapHasPercent = true

// snapshotProcs reads this user's processes: their tree from sysctl, their
// memory and CPU from ps, their arguments and environment from
// kern.procargs2 (as ps -E reads them).
func snapshotProcs() ([]procStat, error) {
	all, err := unix.SysctlKinfoProcSlice("kern.proc.uid", os.Getuid())
	if err != nil {
		return nil, err
	}
	usage := psUsage()
	out := make([]procStat, 0, len(all))
	for _, k := range all {
		pid := int(k.Proc.P_pid)
		if pid <= 0 {
			continue
		}
		tv := k.Proc.P_starttime
		start := time.Unix(int64(tv.Sec), int64(tv.Usec)*1000)
		p := procStat{PID: pid, PPID: int(k.Eproc.Ppid), Name: unix.ByteSliceToString(k.Proc.P_comm[:]),
			Start: start, StartKey: uint64(tv.Sec)*1_000_000 + uint64(tv.Usec)}
		if u, ok := usage[pid]; ok {
			p.RSS, p.CPUPercent, p.CPU = u.rss, u.pct, u.cpu
		}
		if raw, err := unix.SysctlRaw("kern.procargs2", pid); err == nil && len(raw) >= 4 {
			exe, args, env := parseProcargs2(raw)
			p.Exe, p.Args, p.Env = exe, args, keepEnv(env)
		}
		out = append(out, p)
	}
	return out, nil
}

type psRow struct {
	rss      uint64
	pct, cpu float64
}

// psUsage is every process's resident memory and CPU use, from ps.
func psUsage() map[int]psRow {
	out, err := exec.Command("ps", "-axo", "pid=,rss=,%cpu=,time=").Output()
	m := map[int]psRow{}
	if err != nil {
		return m
	}
	for _, l := range strings.Split(string(out), "\n") {
		f := strings.Fields(l)
		if len(f) != 4 {
			continue
		}
		pid, _ := strconv.Atoi(f[0])
		rss, _ := strconv.ParseUint(f[1], 10, 64)
		pct, _ := strconv.ParseFloat(f[2], 64)
		m[pid] = psRow{rss: rss * 1024, pct: pct, cpu: psTime(f[3])}
	}
	return m
}

// psTime reads ps's [[dd-]hh:]mm:ss.ss as seconds.
func psTime(s string) float64 {
	days := 0.0
	if d, rest, ok := strings.Cut(s, "-"); ok {
		n, _ := strconv.ParseFloat(d, 64)
		days, s = n, rest
	}
	total := 0.0
	for _, part := range strings.Split(s, ":") {
		n, _ := strconv.ParseFloat(part, 64)
		total = total*60 + n
	}
	return days*86400 + total
}
