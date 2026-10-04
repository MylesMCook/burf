package box

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/sean-brydon/berthd/internal/doctor"
	"github.com/sean-brydon/berthd/internal/integrations"
)

// Doctor reports what this box can do and what is missing. Daemon-level
// checks (service, listen address, paired laptops) come from berthd through
// DaemonChecks; the rest are the same on every box.
func (b *Box) Doctor(ctx context.Context) []doctor.Check {
	var checks []doctor.Check
	if b.DaemonChecks != nil {
		checks = append(checks, b.DaemonChecks()...)
	}
	checks = append(checks,
		doctor.ToolCheck("Worktrees and sessions", "git", "locations and worktrees", "Install git with your package manager", true),
		doctor.ToolCheck("Worktrees and sessions", "tmux", "agent sessions", "sudo apt install tmux  (or your package manager)", true),
		doctor.ToolCheck("Worktrees and sessions", "cloudflared", "public shares", "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/", false),
		doctor.ToolCheck("Agents", "claude", "Claude Code sessions", "npm install -g @anthropic-ai/claude-code", false),
		doctor.ToolCheck("Agents", "codex", "Codex sessions", "npm install -g @openai/codex", false),
	)
	if home, err := os.UserHomeDir(); err == nil {
		for _, t := range integrations.Tools {
			if !t.Present(home) {
				continue
			}
			c := doctor.Check{Area: "Agents", Name: t.Name + " hooks", Status: doctor.OK, Detail: "installed"}
			if !t.Hooked(home) {
				c.Status, c.Detail, c.Fix = doctor.Warn, "not installed, so Berth cannot show when this agent is done or needs you", "berthd integrations install "+t.ID
			} else if !t.Current(home) {
				c.Status, c.Detail, c.Fix = doctor.Warn, "from an older berth: turns start and approvals clear late", "berthd integrations install "+t.ID
			}
			checks = append(checks, c)
		}
	}
	checks = append(checks, b.eventChecks()...)
	locs, err := b.Locations.List(ctx)
	if err != nil {
		checks = append(checks, doctor.Check{Area: "Locations", Name: "locations", Status: doctor.Fail, Detail: err.Error()})
		return checks
	}
	for _, l := range locs {
		if _, err := os.Stat(l.Path); err != nil {
			checks = append(checks, doctor.Check{Area: "Locations", Name: l.Name, Status: doctor.Fail, Detail: l.Path + " no longer exists", Fix: "berthd location rm " + l.Name})
			continue
		}
		kind := "folder"
		if l.Repo {
			kind = "git repository"
		}
		checks = append(checks, doctor.Check{Area: "Locations", Name: l.Name, Status: doctor.OK, Detail: kind + " at " + l.Path})
	}
	if len(locs) == 0 {
		checks = append(checks, doctor.Check{Area: "Locations", Name: "locations", Status: doctor.Info, Detail: "none yet", Fix: "berthd location add NAME ~/path/to/repo"})
	}
	if b.Browsers != nil {
		if p, err := FindChromium(); err != nil {
			checks = append(checks, doctor.Check{Area: "Agents", Name: "agent browser", Status: doctor.Info, Detail: "no Chromium for agents' browsers", Fix: "berthd browser install"})
		} else {
			checks = append(checks, doctor.Check{Area: "Agents", Name: "agent browser", Status: doctor.OK, Detail: fmt.Sprintf("Chromium at %s; at most %d at once", p, b.Browsers.limit())})
		}
	}
	return checks
}

// eventChecks report the journal and every subscriber that fell behind or
// lost events.
func (b *Box) eventChecks() []doctor.Check {
	var checks []doctor.Check
	if j := b.Events.Journal; j != nil {
		st := j.Stats()
		c := doctor.Check{Area: "Events", Name: "journal", Status: doctor.OK,
			Detail: fmt.Sprintf("%d events, %d segments, %.1f MB", st.Head, st.Segments, float64(st.Bytes)/(1<<20))}
		if st.Errors > 0 {
			c.Status, c.Detail = doctor.Warn, fmt.Sprintf("%d writes failed; check the disk under %s", st.Errors, j.Dir)
		}
		checks = append(checks, c)
	}
	for _, s := range b.Events.Stats() {
		c := doctor.Check{Area: "Events", Name: s.Name, Status: doctor.OK, Detail: "no events lost"}
		if s.Lags > 0 {
			c.Detail = fmt.Sprintf("fell behind %d times and caught up from the journal", s.Lags)
		}
		if s.Dropped > 0 {
			c.Status, c.Detail = doctor.Warn, fmt.Sprintf("lost %d events", s.Dropped)
		}
		checks = append(checks, c)
	}
	if b.Turns != nil && b.Turns.Ambiguous.Load() > 0 {
		checks = append(checks, doctor.Check{Area: "Events", Name: "agent hooks", Status: doctor.Info,
			Detail: fmt.Sprintf("%d hook events named only a folder shared by several agents, so they were not used", b.Turns.Ambiguous.Load()),
			Fix:    "Restart those agent sessions: sessions berth starts now tell hooks their name"})
	}
	return checks
}

func (b *Box) handleDoctor(w http.ResponseWriter, r *http.Request) error {
	writeJSON(w, b.Doctor(r.Context()))
	return nil
}
