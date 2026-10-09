//go:build !windows

package service

import (
	"errors"
	"os/exec"
	"syscall"
)

func configureCommand(cmd *exec.Cmd) {}

func configureShell(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
}

func currentWindowsSID() (string, error) {
	return "", errors.New("Windows user identity is unavailable on this platform")
}
