package box

import (
	"context"
	"encoding/binary"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

// darwinStatsSource keeps native reads replaceable without changing global
// state. vm_stat uses Mach's host_statistics64; x/sys has no wrapper for it.
type darwinStatsSource struct {
	memsize func() (uint64, error)
	raw     func(string) ([]byte, error)
	boot    func() (time.Time, error)
	vm      func() ([]byte, error)
}

func nativeStats() (Stats, bool) {
	source := darwinStatsSource{
		memsize: func() (uint64, error) { return unix.SysctlUint64("hw.memsize") },
		raw:     func(name string) ([]byte, error) { return unix.SysctlRaw(name) },
		boot: func() (time.Time, error) {
			tv, err := unix.SysctlTimeval("kern.boottime")
			if err != nil {
				return time.Time{}, err
			}
			return time.Unix(int64(tv.Sec), int64(tv.Usec)*1000), nil
		},
		vm: func() ([]byte, error) {
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			cmd := exec.CommandContext(ctx, "/usr/bin/vm_stat")
			cmd.WaitDelay = 100 * time.Millisecond
			cmd.Env = append(os.Environ(), "LC_ALL=C")
			return cmd.Output()
		},
	}
	s := readDarwinStats(source, time.Now())
	s.Hostname, _ = os.Hostname()
	s.CPUs = runtime.NumCPU()
	s.Disks = disks()
	if s.Disks == nil {
		s.Disks = []Disk{}
	}
	// The /proc process list is unsupported here. Mac process monitoring
	// already uses snapshotProcs, rather than treating PIDs as chat sessions.
	available := false
	s.AgentsAvailable = &available
	s.Agents = []Agent{}
	return s, true
}

func readDarwinStats(source darwinStatsSource, now time.Time) Stats {
	var s Stats
	if total, err := source.memsize(); err == nil && total > 0 {
		if vm, err := source.vm(); err == nil {
			s.Memory = darwinMemory(total, string(vm))
		}
	}
	if raw, err := source.raw("vm.swapusage"); err == nil {
		s.Swap = darwinSwap(raw)
	}
	if raw, err := source.raw("vm.loadavg"); err == nil {
		s.Load = darwinLoad(raw)
	}
	if boot, err := source.boot(); err == nil && !boot.IsZero() && !boot.After(now) {
		s.Uptime = int64(now.Sub(boot).Seconds())
	}
	return s
}

// darwinMemory measures anonymous + wired + physical compressor pages less
// purgeable pages. File-backed cache is excluded. This is RAM use, not macOS
// memory pressure. The compressor's uncompressed page count is not RAM use.
// Missing/invalid readings return Total=0, the existing unavailable sentinel.
func darwinMemory(total uint64, output string) Usage {
	lines := strings.Split(output, "\n")
	if total == 0 || len(lines) == 0 {
		return Usage{}
	}
	_, header, ok := strings.Cut(lines[0], "(page size of ")
	if !ok {
		return Usage{}
	}
	size, _, ok := strings.Cut(header, " bytes)")
	pageSize, err := strconv.ParseUint(size, 10, 64)
	if !ok || err != nil || pageSize == 0 {
		return Usage{}
	}
	pages := map[string]uint64{}
	for _, line := range lines[1:] {
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		switch key {
		case "Anonymous pages", "Pages wired down", "Pages occupied by compressor", "Pages purgeable":
			if _, duplicate := pages[key]; duplicate {
				return Usage{}
			}
			value = strings.TrimSuffix(strings.TrimSpace(value), ".")
			n, err := strconv.ParseUint(value, 10, 64)
			if err != nil {
				return Usage{}
			}
			pages[key] = n
		}
	}
	if len(pages) != 4 || pages["Pages purgeable"] > pages["Anonymous pages"] {
		return Usage{}
	}
	usedPages := pages["Anonymous pages"] - pages["Pages purgeable"]
	maxPages := total / pageSize
	for _, count := range []uint64{pages["Pages wired down"], pages["Pages occupied by compressor"]} {
		if usedPages > maxPages || count > maxPages-usedPages {
			return Usage{}
		}
		usedPages += count
	}
	return Usage{Total: total, Used: usedPages * pageSize}
}

// vm.swapusage is Darwin's 32-byte xsw_usage: total, available and used
// uint64 byte counts, then page size and encryption flags.
func darwinSwap(raw []byte) Usage {
	if len(raw) != 32 {
		return Usage{}
	}
	total := binary.NativeEndian.Uint64(raw[:8])
	used := binary.NativeEndian.Uint64(raw[16:24])
	if used > total {
		return Usage{}
	}
	return Usage{Total: total, Used: used}
}

// Darwin's 64-bit loadavg has three uint32 fixed-point values, four bytes
// of alignment padding, then its long fscale. Loads are 1, 5 and 15 minutes.
func darwinLoad(raw []byte) []float64 {
	if len(raw) != 24 {
		return nil
	}
	scale := binary.NativeEndian.Uint64(raw[16:24])
	if scale == 0 || scale > 1<<63-1 {
		return nil
	}
	load := make([]float64, 3)
	for i := range load {
		load[i] = float64(binary.NativeEndian.Uint32(raw[i*4:i*4+4])) / float64(scale)
	}
	return load
}
