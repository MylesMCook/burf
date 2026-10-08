// Package backgroundcmd runs noninteractive helpers without a Windows console.
package backgroundcmd

import (
	"context"
	"os/exec"
)

func CommandContext(ctx context.Context, name string, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, name, args...)
	configure(cmd)
	return cmd
}
