//go:build unix

package debugserver

import "syscall"

// cpuSeconds is the CPU time, user and system, of this process (self) or
// of the programs it ran and waited for (tmux, git: children).
func cpuSeconds(who int) float64 {
	var ru syscall.Rusage
	if err := syscall.Getrusage(who, &ru); err != nil {
		return 0
	}
	tv := func(t syscall.Timeval) float64 { return float64(t.Sec) + float64(t.Usec)/1e6 }
	return tv(ru.Utime) + tv(ru.Stime)
}

const (
	self     = syscall.RUSAGE_SELF
	children = syscall.RUSAGE_CHILDREN
)
