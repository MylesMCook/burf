//go:build integration && darwin

package box

import (
	"testing"

	"golang.org/x/sys/unix"
)

// This reads this Mac's kernel counters only; it changes no live state.
func TestNativeStatsReadMacMemory(t *testing.T) {
	total, err := unix.SysctlUint64("hw.memsize")
	if err != nil {
		t.Fatal(err)
	}
	s := collectStats("/proc")
	if s.Memory.Total != total || s.Memory.Used == 0 || s.Memory.Used > total {
		t.Fatalf("memory = %+v, want %d physical bytes and nonzero bounded use", s.Memory, total)
	}
	if len(s.Load) != 3 || s.Uptime <= 0 {
		t.Fatalf("load/uptime = %v/%d; want 1/5/15-minute load and measured uptime", s.Load, s.Uptime)
	}
	if s.Agents == nil || s.AgentsAvailable == nil || *s.AgentsAvailable {
		t.Fatalf("unsupported process detection = %+v / %v; want an empty list and explicit unavailable status", s.Agents, s.AgentsAvailable)
	}
	t.Logf("RAM total=%d used=%d load=%v uptime=%d", s.Memory.Total, s.Memory.Used, s.Load, s.Uptime)
}
