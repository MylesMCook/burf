package hooks

import (
	"context"
	"os/exec"
	"path/filepath"

	"golang.org/x/sys/windows"
)

func shellCommand(ctx context.Context, command string) (*exec.Cmd, error) {
	system, err := windows.GetSystemDirectory()
	if err != nil {
		return nil, err
	}
	powershell := filepath.Join(system, "WindowsPowerShell", "v1.0", "powershell.exe")
	return exec.CommandContext(ctx, powershell, "-NoProfile", "-NonInteractive", "-Command", command), nil
}
