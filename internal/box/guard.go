package box

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/MylesMCook/burf/internal/events"
	"github.com/MylesMCook/burf/internal/statefile"
)

// The resource guard keeps a box usable when memory runs short: once memory
// stays above a threshold, it stops the services of worktrees where no agent
// is working, idle longest first, and then pauses worktrees whose agents are
// all idle or finished. One step at a time, with a pause between, so it
// does no more than it must. It never touches an agent that is working or
// waiting for someone, or a plain shell.
//
// Pausing stops processes where they are: they use no CPU, and the kernel
// can swap them out, but their memory is only freed if it does. Stopping
// services frees memory at once, which is why that comes first.

// GuardConfig is ~/.berth/guard.json on the box.
type GuardConfig struct {
	Enabled bool `json:"enabled"`
	// MemoryPercent is the threshold; default 90.
	MemoryPercent int `json:"memory_percent,omitempty"`
	// Sustain is how long memory must stay above it; default 60s.
	Sustain string `json:"sustain,omitempty"`
	// StopServices and PauseAgents turn each step off when false.
	StopServices *bool `json:"stop_services,omitempty"`
	PauseAgents  *bool `json:"pause_agents,omitempty"`
}

func (c GuardConfig) threshold() float64 {
	if c.MemoryPercent > 0 {
		return float64(c.MemoryPercent)
	}
	return 90
}

func (c GuardConfig) sustain() time.Duration {
	if d, err := time.ParseDuration(c.Sustain); err == nil && d >= 0 {
		return d
	}
	return time.Minute
}

func (c GuardConfig) validate() error {
	if c.MemoryPercent != 0 && (c.MemoryPercent < 50 || c.MemoryPercent > 99) {
		return errors.New("the memory threshold must be between 50 and 99 percent")
	}
	if c.Sustain != "" {
		if d, err := time.ParseDuration(c.Sustain); err != nil || d < 0 || d > time.Hour {
			return fmt.Errorf("sustain %q must be a duration up to 1h", c.Sustain)
		}
	}
	return nil
}

// GuardAction is one thing the guard did.
type GuardAction struct {
	At       time.Time `json:"at"`
	Action   string    `json:"action"` // stop_services or pause_worktree
	Location string    `json:"location"`
	Worktree string    `json:"worktree"`
	Path     string    `json:"path"`
	Services []string  `json:"services,omitempty"`
	Sessions []string  `json:"sessions,omitempty"`
	Memory   float64   `json:"memory_percent"`
	Reason   string    `json:"reason"`
}

// Guard watches a box's memory.
type Guard struct {
	// Path is the config file.
	Path string
	// Memory reads memory use; tests replace it.
	Memory func() Usage
	Now    func() time.Time
	// Cooldown is the pause between steps; default 30s.
	Cooldown time.Duration

	mu         sync.Mutex
	overSince  time.Time
	lastAction time.Time
	actions    []GuardAction
}

func (g *Guard) config() GuardConfig {
	var c GuardConfig
	if b, err := os.ReadFile(g.Path); err == nil {
		json.Unmarshal(b, &c)
	}
	return c
}

func (g *Guard) now() time.Time {
	if g.Now != nil {
		return g.Now()
	}
	return time.Now()
}

func (g *Guard) memory() Usage {
	if g.Memory != nil {
		return g.Memory()
	}
	return collectStats("/proc").Memory
}

func percent(u Usage) float64 {
	if u.Total == 0 {
		return 0
	}
	return float64(u.Used) * 100 / float64(u.Total)
}

// Run checks every 10 seconds until ctx ends.
func (g *Guard) Run(ctx context.Context, b *Box) {
	t := time.NewTicker(10 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			b.guardTick(ctx)
		}
	}
}

// guardTick looks once, and takes at most one step.
func (b *Box) guardTick(ctx context.Context) *GuardAction {
	g := b.Guard
	cfg := g.config()
	mem := percent(g.memory())
	now := g.now()
	g.mu.Lock()
	if !cfg.Enabled || mem < cfg.threshold() {
		g.overSince = time.Time{}
		g.mu.Unlock()
		return nil
	}
	if g.overSince.IsZero() {
		g.overSince = now
	}
	cooldown := g.Cooldown
	if cooldown == 0 {
		cooldown = 30 * time.Second
	}
	ready := now.Sub(g.overSince) >= cfg.sustain() && now.Sub(g.lastAction) >= cooldown
	g.mu.Unlock()
	if !ready {
		return nil
	}
	a := b.guardStep(ctx, cfg, mem)
	if a == nil {
		return nil
	}
	a.At = now.UTC()
	g.mu.Lock()
	g.lastAction = now
	g.actions = append(g.actions, *a)
	if len(g.actions) > 20 {
		g.actions = g.actions[len(g.actions)-20:]
	}
	g.mu.Unlock()
	data := map[string]any{"action": a.Action, "location": a.Location, "name": a.Worktree, "path": a.Path,
		"services": a.Services, "sessions": a.Sessions, "memory_percent": a.Memory, "reason": a.Reason}
	b.Events.Publish(events.Event{Type: "guard.acted", Box: b.Name, Origin: "guard", Data: data})
	what := "Stopped " + strings.Join(a.Services, ", ") + " in " + a.Location + "/" + a.Worktree
	if a.Action == "close_browser" {
		what = "Closed the agent browser of " + a.Location + "/" + a.Worktree
	}
	if a.Action == "pause_worktree" {
		what = "Paused " + a.Location + "/" + a.Worktree + " (its agents were " + a.Reason + ")"
	}
	b.Events.Publish(events.Event{Type: "notify", Box: b.Name, Origin: "guard", Data: map[string]any{
		"title": fmt.Sprintf("%s is low on memory (%.0f%%)", b.Name, mem), "body": what, "path": a.Path, "location": a.Location}})
	return a
}

type guardCandidate struct {
	loc      Location
	wt       Worktree
	services []string
	sessions []Session
	idle     time.Time // when its agents last did anything; zero = never
}

// guardStep picks the next thing to stop or pause. An agent's browser goes
// first: it is cheap to start again, and agents' work is not.
func (b *Box) guardStep(ctx context.Context, cfg GuardConfig, mem float64) *GuardAction {
	if b.Browsers != nil {
		if st, ok := b.Browsers.CloseLRU("the box is low on memory"); ok {
			return &GuardAction{Action: "close_browser", Location: st.Location, Worktree: st.Worktree, Path: st.Path, Memory: mem, Reason: "an agent's browser closes before agents pause"}
		}
	}
	locs, err := b.Locations.List(ctx)
	if err != nil {
		return nil
	}
	all, _ := b.Sessions.List(ctx)
	all = b.enrich(ctx, all)
	var cands []guardCandidate
	for _, l := range locs {
		for _, w := range l.Worktrees {
			if b.Paused != nil && b.Paused.has(w.Path) {
				continue
			}
			c := guardCandidate{loc: l, wt: w}
			for _, s := range all {
				if samePath(s.Dir, w.Path) && !s.Exited {
					c.sessions = append(c.sessions, s)
					if s.StateSince.After(c.idle) {
						c.idle = s.StateSince
					}
				}
			}
			if svcs, err := b.WorktreeServices(ctx, l.Name, w.Name); err == nil {
				for _, s := range svcs {
					if s.State != "stopped" {
						c.services = append(c.services, s.Name)
					}
				}
			}
			cands = append(cands, c)
		}
	}
	sort.SliceStable(cands, func(i, j int) bool { return cands[i].idle.Before(cands[j].idle) })
	busy := func(c guardCandidate) bool {
		for _, s := range c.sessions {
			if s.AgentState == "running" || s.AgentState == "waiting" {
				return true
			}
		}
		return false
	}
	if cfg.StopServices == nil || *cfg.StopServices {
		for _, c := range cands {
			if len(c.services) == 0 || busy(c) {
				continue
			}
			for _, s := range c.services {
				b.StopService(ctx, c.loc.Name, c.wt.Name, s)
			}
			return &GuardAction{Action: "stop_services", Location: c.loc.Name, Worktree: c.wt.Name, Path: c.wt.Path,
				Services: c.services, Memory: mem, Reason: "no agent is working there"}
		}
	}
	if (cfg.PauseAgents == nil || *cfg.PauseAgents) && b.Paused != nil {
		for _, c := range cands {
			if len(c.sessions) == 0 || busy(c) {
				continue
			}
			// Only worktrees whose every live session is an idle or finished
			// agent: pausing a shell would freeze someone's terminal.
			allIdle := true
			var names []string
			for _, s := range c.sessions {
				if s.Agent == "" || (s.AgentState != "idle" && s.AgentState != "finished") {
					allIdle = false
				}
				names = append(names, s.Name)
			}
			if !allIdle {
				continue
			}
			if _, err := b.PauseWorktree(ctx, c.loc.Name, c.wt.Name); err != nil {
				continue
			}
			return &GuardAction{Action: "pause_worktree", Location: c.loc.Name, Worktree: c.wt.Name, Path: c.wt.Path,
				Sessions: names, Memory: mem, Reason: "idle or finished"}
		}
	}
	return nil
}

// GuardStatus is the guard as the app shows it.
type GuardStatus struct {
	Config    GuardConfig   `json:"config"`
	Memory    Usage         `json:"memory"`
	Percent   float64       `json:"memory_percent"`
	OverSince time.Time     `json:"over_since,omitzero"`
	Actions   []GuardAction `json:"actions"`
}

func (b *Box) guardStatus() GuardStatus {
	g := b.Guard
	mem := g.memory()
	g.mu.Lock()
	defer g.mu.Unlock()
	acts := append([]GuardAction{}, g.actions...)
	return GuardStatus{Config: g.config(), Memory: mem, Percent: percent(mem), OverSince: g.overSince, Actions: acts}
}

func (b *Box) getGuard(w http.ResponseWriter, r *http.Request) error {
	if b.Guard == nil {
		return httpError{http.StatusNotImplemented, "this box has no resource guard"}
	}
	writeJSON(w, b.guardStatus())
	return nil
}

func (b *Box) putGuard(w http.ResponseWriter, r *http.Request) error {
	if b.Guard == nil {
		return httpError{http.StatusNotImplemented, "this box has no resource guard"}
	}
	var req struct {
		Config GuardConfig `json:"config"`
	}
	if err := decode(r, &req); err != nil {
		return err
	}
	if err := req.Config.validate(); err != nil {
		return badRequest("%v", err)
	}
	if err := b.before(r, "config.change", map[string]any{"guard": req.Config.Enabled}); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(req.Config, "", "  ")
	if err := statefile.Write(b.Guard.Path, append(data, '\n')); err != nil {
		return err
	}
	b.publish(r, "config.changed", map[string]any{"guard": req.Config.Enabled})
	writeJSON(w, b.guardStatus())
	return nil
}
