package box

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/sean-brydon/berth/internal/hooks"
)

// Scripts are a location's worktree lifecycle commands. They get
// BERTH_ROOT_PATH, BERTH_WORKTREE_PATH and BERTH_WORKTREE_NAME, and Orca's
// ORCA_* names for the same values, so a script written for Orca runs
// unchanged.
type Scripts struct {
	Setup   string `json:"setup,omitempty"`
	Archive string `json:"archive,omitempty"`
	// From says where the scripts came from: "berth" when set on the
	// location, "repo" when read from the repository's .berth/config.json.
	From string `json:"from,omitempty"`
}

// RepoConfigFile is where a repository describes how berth sets up its
// worktrees, committed alongside the code so every box does the same.
const RepoConfigFile = ".berth/config.json"

// RepoConfig is a repository's .berth/config.json.
type RepoConfig struct {
	Setup   string `json:"setup,omitempty"`
	Archive string `json:"archive,omitempty"`
	// Agents adds ways to start agents here, or replaces built-ins by ID,
	// e.g. {"id": "claude", "command": "claude --model opus"}.
	Agents []AgentPreset `json:"agents,omitempty"`
	// Ports is how many ports each worktree needs ($BERTH_PORT,
	// $BERTH_PORT_1, …). Every worktree has at least one.
	Ports int `json:"ports,omitempty"`
	// Env is added to everything run in a worktree, with $BERTH_* expanded:
	// {"DATABASE_URL": "postgres://localhost/$BERTH_WORKTREE_SLUG"}.
	Env map[string]string `json:"env,omitempty"`
	// Services run in every worktree, such as its dev server.
	Services []WorktreeService `json:"services,omitempty"`
	// Hooks run for this repository's events only, in the worktree.
	Hooks []hooks.Hook `json:"hooks,omitempty"`
}

// ReadRepoConfig reads repo's .berth/config.json; ok is false without one.
func ReadRepoConfig(repo string) (c RepoConfig, ok bool, err error) {
	b, err := os.ReadFile(filepath.Join(repo, RepoConfigFile))
	if os.IsNotExist(err) {
		return c, false, nil
	}
	if err != nil {
		return c, false, err
	}
	if err := json.Unmarshal(b, &c); err != nil {
		return c, false, fmt.Errorf("%s: %w", RepoConfigFile, err)
	}
	return c, true, nil
}

// scriptsFor is the location's own scripts if set, otherwise the
// repository's.
func scriptsFor(saved savedLocation) Scripts {
	if saved.Config != nil && (saved.Config.Setup != "" || saved.Config.Archive != "") {
		rc, _, _ := ReadRepoConfig(saved.Path)
		c := merge(rc, *saved.Config)
		return Scripts{Setup: c.Setup, Archive: c.Archive, From: "berth"}
	}
	if saved.Setup != "" || saved.Archive != "" {
		return Scripts{Setup: saved.Setup, Archive: saved.Archive, From: "berth"}
	}
	if c, ok, _ := ReadRepoConfig(saved.Path); ok && (c.Setup != "" || c.Archive != "") {
		return Scripts{Setup: c.Setup, Archive: c.Archive, From: "repo"}
	}
	return Scripts{}
}

// runScript runs a lifecycle script in the worktree through a login shell, so
// tools the user installed are on PATH, logging to logPath.
func runScript(ctx context.Context, script, repo, dir, name, logPath string, timeout time.Duration, extra []string) error {
	if err := os.MkdirAll(filepath.Dir(logPath), 0o700); err != nil {
		return err
	}
	log, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	defer log.Close()
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/sh"
	}
	cmd := exec.CommandContext(ctx, shell, "-lc", script)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(),
		"BERTH_ROOT_PATH="+repo, "BERTH_WORKTREE_PATH="+dir, "BERTH_WORKTREE_NAME="+name,
		"ORCA_ROOT_PATH="+repo, "ORCA_WORKTREE_PATH="+dir, "ORCA_WORKSPACE_NAME="+name)
	cmd.Env = append(cmd.Env, extra...)
	cmd.Stdout, cmd.Stderr = log, log
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("%v (log: %s)", err, logPath)
	}
	return nil
}
