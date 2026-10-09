package box

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/MylesMCook/burf/internal/boxclient"
	"github.com/MylesMCook/burf/internal/groups"
)

// Scripts are a location's worktree lifecycle commands. They get
// BERTH_ROOT_PATH, BERTH_WORKTREE_PATH and BERTH_WORKTREE_NAME, and Orca's
// ORCA_* names for the same values, so a script written for Orca runs
// unchanged.
type Scripts = boxclient.Scripts

// RepoConfigFile is where a repository describes how berth sets up its
// worktrees, committed alongside the code so every box does the same.
const RepoConfigFile = boxclient.RepoConfigFile

// RepoConfig is a repository's .berth/config.json.
type RepoConfig = boxclient.RepoConfig

// ReadRepoConfig reads repo's .berth/config.json; ok is false without one.
// It is the file as committed, trusted or not: what runs comes from
// repoLayer.
func ReadRepoConfig(repo string) (c RepoConfig, ok bool, err error) {
	c, _, ok, err = readRepoFile(repo)
	return c, ok, err
}

// scriptsFor is the location's own scripts if set, otherwise the
// repository's.
func scriptsFor(saved savedLocation) Scripts {
	repo, _, _ := repoLayer(saved)
	local := RepoConfig{Setup: saved.Setup, Archive: saved.Archive}
	if saved.Config != nil {
		local = merge(local, *saved.Config)
	}
	c := merge(repo, local)
	from := ""
	switch {
	case local.Setup != "" || local.Archive != "":
		from = "berth"
	case repo.Setup != "" || repo.Archive != "":
		from = "repo"
	}
	return Scripts{Setup: c.Setup, Archive: c.Archive, From: from}
}

// runScript runs a lifecycle script in the worktree through a login shell, so
// tools the user installed are on PATH, logging to logPath.
// quietEnv keeps an unattended worktree setup script from stopping at a
// question nobody sees:
// corepack asks before it downloads the yarn or pnpm a repository pins.
var quietEnv = []string{"COREPACK_ENABLE_DOWNLOAD_PROMPT=0"}

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
	cmd := groups.CommandContext(ctx, shell, "-lc", script)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(),
		"BERTH_ROOT_PATH="+repo, "BERTH_WORKTREE_PATH="+dir, "BERTH_WORKTREE_NAME="+name,
		"ORCA_ROOT_PATH="+repo, "ORCA_WORKTREE_PATH="+dir, "ORCA_WORKSPACE_NAME="+name)
	// A script has no terminal to answer a question in: corepack fetches
	// the yarn or pnpm a repository pins without asking. The repository's
	// own env (extra) can say otherwise.
	cmd.Env = append(cmd.Env, quietEnv...)
	cmd.Env = append(cmd.Env, extra...)
	cmd.Stdout, cmd.Stderr = log, log
	if err := cmd.Run(); err != nil {
		// What the script said last is why it failed: the error carries it,
		// so the app's Details can show it without a trip to the box.
		if tail := logTail(logPath, 40, 4096); tail != "" {
			return fmt.Errorf("%v (log: %s)\n%s", err, logPath, tail)
		}
		return fmt.Errorf("%v (log: %s)", err, logPath)
	}
	return nil
}

// logTail is the last lines of a log, at most max bytes of them.
func logTail(path string, lines, max int) string {
	b, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	if len(b) > max {
		b = b[len(b)-max:]
	}
	all := strings.Split(strings.TrimRight(string(b), "\n"), "\n")
	if len(all) > lines {
		all = all[len(all)-lines:]
	}
	return strings.TrimSpace(strings.Join(all, "\n"))
}
