package box

import (
	"context"
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
			}
			checks = append(checks, c)
		}
	}
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
	return checks
}

func (b *Box) handleDoctor(w http.ResponseWriter, r *http.Request) error {
	writeJSON(w, b.Doctor(r.Context()))
	return nil
}
