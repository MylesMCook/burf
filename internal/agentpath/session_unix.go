//go:build !windows

package agentpath

import (
	"os/exec"
	"syscall"
)

// ownSession starts a probe in its own session, so whatever a shell's rc
// files start can be stopped with it.
func ownSession(cmd *exec.Cmd) { cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true} }

// killSession stops the probe and everything in its session.
func killSession(cmd *exec.Cmd) error { return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL) }
