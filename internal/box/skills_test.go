package box

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/sean-brydon/berthd/internal/integrations"
)

func TestSkillsInstallForTheUserAndForOneProject(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	c, _ := servedBox(t)
	repo := gitRepo(t)
	call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "cal", "path": repo}, nil)

	var rep SkillsReport
	call(t, c, "GET", "/v1/skills", "", nil, &rep)
	if len(rep.Skills) != 6 || rep.Skills[0].User["claude"] != integrations.SkillMissing || rep.Skills[0].Project != nil {
		t.Fatalf("report = %+v", rep)
	}

	// Everything for the user, as one request with "all".
	if status := call(t, c, "POST", "/v1/skills/install", "", map[string]any{"skills": "all", "agent": "all", "target": "user"}, &rep); status != 200 {
		t.Fatalf("install: %d", status)
	}
	for _, s := range rep.Skills {
		if s.User["claude"] != integrations.SkillInstalled || s.User["codex"] != integrations.SkillInstalled {
			t.Fatalf("%s after install: %+v", s.Name, s.User)
		}
	}
	if _, err := os.Stat(filepath.Join(home, ".agents", "skills", "berth-orchestrate", "SKILL.md")); err != nil {
		t.Fatal(err)
	}

	// One skill for Claude in the project, kept out of git.
	if status := call(t, c, "POST", "/v1/skills/install", "", map[string]any{"skills": []string{"berth-preview"}, "agent": "claude", "target": "project", "location": "cal"}, &rep); status != 200 {
		t.Fatalf("project install: %d", status)
	}
	var preview SkillRow
	for _, s := range rep.Skills {
		if s.Name == "berth-preview" {
			preview = s
		}
	}
	if preview.Project["claude"] != integrations.SkillInstalled || preview.Project["codex"] != integrations.SkillMissing || !preview.Excluded["claude"] {
		t.Fatalf("project row = %+v", preview)
	}
	out, _ := exec.Command("git", "-C", repo, "status", "--porcelain").Output()
	if strings.Contains(string(out), ".claude") {
		t.Fatalf("the project skill shows in git: %s", out)
	}

	// Committed ones are visible to git.
	call(t, c, "POST", "/v1/skills/install", "", map[string]any{"skills": []string{"berth"}, "agent": "codex", "target": "project", "location": "cal", "commit": true}, nil)
	out, _ = exec.Command("git", "-C", repo, "status", "--porcelain").Output()
	if !strings.Contains(string(out), ".agents/") {
		t.Fatalf("a committed skill is hidden from git: %q", out)
	}

	call(t, c, "POST", "/v1/skills/uninstall", "", map[string]any{"skills": []string{"berth-preview"}, "agent": "claude", "target": "project", "location": "cal"}, &rep)
	for _, s := range rep.Skills {
		if s.Name == "berth-preview" && (s.Project["claude"] != integrations.SkillMissing || s.Excluded["claude"]) {
			t.Fatalf("after uninstall: %+v", s)
		}
	}
	if status := call(t, c, "POST", "/v1/skills/install", "", map[string]any{"skills": []string{"nope"}, "target": "user"}, nil); status != 400 {
		t.Fatalf("an unknown skill gave %d", status)
	}
	if status := call(t, c, "POST", "/v1/skills/install", "", map[string]any{"skills": "all", "target": "project"}, nil); status != 400 {
		t.Fatalf("a project install without a location gave %d", status)
	}
}
