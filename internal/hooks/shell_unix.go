//go:build !windows

package hooks

import (
	"context"
	"os/exec"

	"github.com/sean-brydon/berthd/internal/groups"
)

func shellCommand(ctx context.Context, command string) (*exec.Cmd, error) {
	return groups.CommandContext(ctx, "/bin/sh", "-c", command), nil
}
