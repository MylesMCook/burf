package integrations

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestBerthShipsItsSkillsWithFrontmatter(t *testing.T) {
	skills := Skills()
	names := []string{}
	for _, s := range skills {
		names = append(names, s.Name)
		b, _ := SkillContent(s.Name)
		if frontmatter(b, "name") != s.Name || s.Description == "" || len(s.Version) != 12 {
			t.Errorf("%s: name %q, description %q, version %q", s.Name, frontmatter(b, "name"), s.Description, s.Version)
		}
	}
	if strings.Join(names, ",") != "berth,berth-hooks,berth-orchestrate,berth-preview" {
		t.Fatalf("skills = %v", names)
	}
}

func TestSkillsInstallReportAndUninstall(t *testing.T) {
	home := t.TempDir()
	names, _ := SkillNames([]string{"all"})
	for _, agent := range SkillAgents() {
		if st, _ := SkillStatus(home, agent, "berth"); st != SkillMissing {
			t.Fatalf("%s before install: %s", agent, st)
		}
		paths, err := InstallSkills(home, agent, names)
		if err != nil || len(paths) != len(names) {
			t.Fatalf("%s install: %v %v", agent, paths, err)
		}
		if st, _ := SkillStatus(home, agent, "berth-preview"); st != SkillInstalled {
			t.Fatalf("%s after install: %s", agent, st)
		}
	}
	if _, err := os.Stat(filepath.Join(home, ".agents", "skills", "berth", "SKILL.md")); err != nil {
		t.Fatalf("codex skills are not where Codex reads them: %v", err)
	}
	// An older copy is outdated until installed again.
	path := filepath.Join(home, ".claude", "skills", "berth", "SKILL.md")
	os.WriteFile(path, []byte("---\nname: berth\ndescription: old\n---\n"), 0o644)
	if st, _ := SkillStatus(home, "claude", "berth"); st != SkillOutdated {
		t.Fatalf("an old copy is %s", st)
	}
	// Someone else's skill in the same folder is never removed.
	other := filepath.Join(home, ".claude", "skills", "berth-hooks", "SKILL.md")
	os.WriteFile(other, []byte("---\nname: my-hooks\n---\n"), 0o644)
	if _, err := UninstallSkills(home, "claude", []string{"berth-hooks"}); err == nil {
		t.Fatal("removed a skill berth did not write")
	}
	removed, err := UninstallSkills(home, "claude", []string{"berth", "berth-preview"})
	if err != nil || len(removed) != 2 {
		t.Fatalf("uninstall: %v %v", removed, err)
	}
	if st, _ := SkillStatus(home, "claude", "berth"); st != SkillMissing {
		t.Fatalf("after uninstall: %s", st)
	}
	if _, err := SkillNames([]string{"nope"}); err == nil {
		t.Fatal("an unknown skill was accepted")
	}
}

func TestInstallingForCodexRemovesTheOldCopyCodexNoLongerReads(t *testing.T) {
	home := t.TempDir()
	legacy := filepath.Join(home, ".codex", "skills", "berth")
	os.MkdirAll(legacy, 0o755)
	os.WriteFile(filepath.Join(legacy, "SKILL.md"), []byte("---\nname: berth\n---\nold"), 0o644)
	mine := filepath.Join(home, ".codex", "skills", "mine")
	os.MkdirAll(mine, 0o755)
	os.WriteFile(filepath.Join(mine, "SKILL.md"), []byte("---\nname: mine\n---\n"), 0o644)
	if _, err := InstallSkills(home, "codex", []string{"berth"}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(legacy); !os.IsNotExist(err) {
		t.Fatal("the legacy copy is still there")
	}
	if _, err := os.Stat(mine); err != nil {
		t.Fatal("a user's own Codex skill was removed")
	}
}

func TestProjectSkillsStayOutOfGitUntilCommitted(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	repo := t.TempDir()
	git := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = repo
		cmd.Env = append(os.Environ(), "GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@example.com", "GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@example.com")
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %s", args, out)
		}
	}
	git("init", "-q", "-b", "main")
	exclude := filepath.Join(repo, ".git", "info", "exclude")
	os.MkdirAll(filepath.Dir(exclude), 0o755)
	os.WriteFile(exclude, []byte("# mine\n*.log\n"), 0o644)
	git("commit", "-q", "--allow-empty", "-m", "init")

	names := []string{"berth", "berth-preview"}
	InstallSkills(repo, "claude", names)
	if err := ExcludeSkills(repo, "claude", names, true); err != nil {
		t.Fatal(err)
	}
	ExcludeSkills(repo, "claude", names, true) // twice is the same as once
	out, _ := exec.Command("git", "-C", repo, "status", "--porcelain").Output()
	if strings.TrimSpace(string(out)) != "" {
		t.Fatalf("installed skills show in git status: %s", out)
	}
	if !Excluded(repo, "claude", "berth") {
		t.Fatal("Excluded does not see the skill")
	}
	b, _ := os.ReadFile(exclude)
	if strings.Count(string(b), "/.claude/skills/berth/") != 1 || !strings.Contains(string(b), "*.log") {
		t.Fatalf("exclude = %q", b)
	}
	// From a worktree, the shared exclude file is the one edited.
	wt := filepath.Join(t.TempDir(), "wt")
	git("worktree", "add", "-q", wt)
	if err := ExcludeSkills(wt, "codex", []string{"berth"}, true); err != nil {
		t.Fatal(err)
	}
	ExcludeSkills(repo, "claude", names, false)
	ExcludeSkills(wt, "codex", []string{"berth"}, false)
	b, _ = os.ReadFile(exclude)
	if string(b) != "# mine\n*.log\n" {
		t.Fatalf("exclude after removing = %q", b)
	}
}
