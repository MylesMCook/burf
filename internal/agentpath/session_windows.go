package agentpath

import (
	"os/exec"
	"syscall"

	"golang.org/x/sys/windows"
)

// Windows has no sessions to own: a probe runs hidden, so looking for agent
// CLIs opens no console window, and is stopped alone.
func ownSession(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NO_WINDOW}
}

func killSession(cmd *exec.Cmd) error { return cmd.Process.Kill() }
