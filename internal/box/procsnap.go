package box

import (
	"sync"
	"time"
)

// procStat is one of the box user's processes as the processes list needs
// it: its place in the tree, what it runs, what it costs and the few
// environment variables that say who started it.
type procStat struct {
	PID, PPID int
	// Name is the kernel's short name for it (comm), Exe its program's
	// path when the system says, Args its argv.
	Name string
	Exe  string
	Args []string
	// Start is when it started; StartKey is the same as the system keeps
	// it, so a process id the system gave to something else is never taken
	// for this process.
	Start    time.Time
	StartKey uint64
	// CPU is the processor time it has used, in seconds; CPUPercent its
	// current use (100 is one core), when known.
	CPU        float64
	CPUPercent float64
	RSS        uint64
	// Env holds only the variables in procEnvKeys.
	Env map[string]string
	// Cgroup is its cgroup v2 path, on Linux.
	Cgroup string
}

// procEnvKeys are the environment variables a snapshot keeps: they say
// which berth session, agent-browser session or berth browser a process
// belongs to.
var procEnvKeys = map[string]bool{
	"BERTH_SESSION": true, "BERTH_BROWSER": true, "TMUX": true,
	"AGENT_BROWSER_DAEMON": true, "AGENT_BROWSER_SESSION": true, "AGENT_BROWSER_NAMESPACE": true,
}

// keepEnv is the procEnvKeys entries of a list of KEY=VALUE entries.
func keepEnv(entries []string) map[string]string {
	var env map[string]string
	for k, v := range parseEnv(entries) {
		if procEnvKeys[k] {
			if env == nil {
				env = map[string]string{}
			}
			env[k] = v
		}
	}
	return env
}

type procKey struct {
	pid   int
	start uint64
}

// cpuSampler turns processor time into current use: the change since the
// last look, or over a short second look when there was none lately.
type cpuSampler struct {
	mu   sync.Mutex
	at   time.Time
	prev map[procKey]float64
	// snap reads the processes; tests replace it.
	snap func() ([]procStat, error)
	now  func() time.Time
}

// sampleWindow is how far apart two looks must be to say how busy a
// process is now, and the second look's wait when there was no recent one.
const (
	sampleMin  = 500 * time.Millisecond
	sampleMax  = 30 * time.Second
	sampleWait = 400 * time.Millisecond
)

func (c *cpuSampler) clock() time.Time {
	if c.now != nil {
		return c.now()
	}
	return time.Now()
}

// Snapshot is every process with CPUPercent filled in.
func (c *cpuSampler) Snapshot() ([]procStat, error) {
	snap := c.snap
	if snap == nil {
		snap = snapshotProcs
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	ps, err := snap()
	if err != nil {
		return nil, err
	}
	if snapHasPercent {
		return ps, nil
	}
	now := c.clock()
	if c.prev == nil || now.Sub(c.at) < sampleMin || now.Sub(c.at) > sampleMax {
		// No look to compare with: look twice.
		c.remember(ps, now)
		time.Sleep(sampleWait)
		if ps, err = snap(); err != nil {
			return nil, err
		}
		now = c.clock()
	}
	elapsed := now.Sub(c.at).Seconds()
	for i := range ps {
		if before, ok := c.prev[procKey{ps[i].PID, ps[i].StartKey}]; ok && elapsed > 0 {
			ps[i].CPUPercent = max(0, (ps[i].CPU-before)/elapsed*100)
		}
	}
	c.remember(ps, now)
	return ps, nil
}

func (c *cpuSampler) remember(ps []procStat, now time.Time) {
	c.prev = make(map[procKey]float64, len(ps))
	for _, p := range ps {
		c.prev[procKey{p.PID, p.StartKey}] = p.CPU
	}
	c.at = now
}
