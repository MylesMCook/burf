package box

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// WorktreeRequest asks for a new git worktree at a location.
type WorktreeRequest struct {
	Name   string `json:"name"`
	Branch string `json:"branch,omitempty"`
	Base   string `json:"base,omitempty"`
}

// toolPath finds a tool on PATH or in ~/.local/bin, where agent CLIs install
// themselves but which a systemd unit's PATH omits.
func toolPath(name string) (string, error) {
	if p, err := exec.LookPath(name); err == nil {
		return p, nil
	}
	if home, err := os.UserHomeDir(); err == nil {
		p := filepath.Join(home, ".local", "bin", name)
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}
	return "", fmt.Errorf("%s is not installed on this box", name)
}

func runTool(ctx context.Context, env []string, name string, args ...string) ([]byte, error) {
	bin, err := toolPath(name)
	if err != nil {
		return nil, err
	}
	// A caller with its own deadline (a create that runs setup) keeps it.
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, 3*time.Minute)
		defer cancel()
	}
	cmd := exec.CommandContext(ctx, bin, args...)
	cmd.Env = append(os.Environ(), env...)
	out, err := cmd.Output()
	if err != nil {
		var ee *exec.ExitError
		if errors.As(err, &ee) && len(ee.Stderr) > 0 {
			return out, fmt.Errorf("%s: %s", name, strings.TrimSpace(string(ee.Stderr)))
		}
		if len(out) > 0 {
			return out, fmt.Errorf("%s: %s", name, strings.TrimSpace(string(out)))
		}
		return out, fmt.Errorf("%s: %w", name, err)
	}
	return out, nil
}
