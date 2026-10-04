package box

import (
	"encoding/json"
	"os"
)

// RunsConfig is ~/.berth/runs.json: how much the box's runs may do at once.
type RunsConfig struct {
	// MaxConcurrentRuns run at once (default 10); more wait queued.
	MaxConcurrentRuns int `json:"max_concurrent_runs,omitempty"`
	// MaxConcurrentAgents agents started by runs work at once (default
	// 6); a run that would start one more waits for a slot.
	MaxConcurrentAgents int `json:"max_concurrent_agents,omitempty"`
	// TriggersListen serves signed webhook triggers on this address alone
	// ("tailnet" for the box's tailnet address, port 7482). Off when empty.
	TriggersListen string `json:"triggers_listen,omitempty"`
	// MaxBrowsers caps agents' browsers at once (default: 1 under 2 GB of
	// memory, 2 to 4 GB, 3 to 8 GB, 4 above).
	MaxBrowsers int `json:"max_browsers,omitempty"`
}

// LoadRunsConfig reads path; a missing or broken file is the defaults.
func LoadRunsConfig(path string) RunsConfig {
	var c RunsConfig
	if b, err := os.ReadFile(path); err == nil {
		json.Unmarshal(b, &c)
	}
	if c.MaxConcurrentRuns <= 0 || c.MaxConcurrentRuns > 100 {
		c.MaxConcurrentRuns = 10
	}
	if c.MaxConcurrentAgents <= 0 || c.MaxConcurrentAgents > 64 {
		c.MaxConcurrentAgents = 6
	}
	return c
}
