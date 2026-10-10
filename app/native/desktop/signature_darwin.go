//go:build darwin

package desktop

import (
	"context"
	"os/exec"
	"strings"
	"time"
)

func signatureTeam(description string) string {
	for _, line := range strings.Split(description, "\n") {
		if team, ok := strings.CutPrefix(line, "TeamIdentifier="); ok {
			team = strings.TrimSpace(team)
			if team != "not set" {
				return team
			}
		}
	}
	return ""
}

func signedLike(app, other string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	out, _ := exec.CommandContext(ctx, "/usr/bin/codesign", "-dv", "--verbose=2", app).CombinedOutput()
	team := signatureTeam(string(out))
	if team == "" {
		return true // Local unsigned/ad-hoc builds have no team to compare.
	}
	for _, c := range team {
		if !((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) {
			return false
		}
	}
	requirement := `=anchor apple generic and certificate leaf[subject.OU] = "` + team + `"`
	return exec.CommandContext(ctx, "/usr/bin/codesign", "--verify", "--strict", "-R", requirement, other).Run() == nil
}
