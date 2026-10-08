//go:build !windows

package hooks

import (
	"context"
	"os/exec"

	"github.com/MylesMCook/burf/internal/groups"
)

func shellCommand(ctx context.Context, command string) (*exec.Cmd, error) {
	return groups.CommandContext(ctx, "/bin/sh", "-c", command), nil
}
