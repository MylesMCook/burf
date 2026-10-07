package service

import (
	"os/exec"
	"syscall"

	"golang.org/x/sys/windows"
)

func configureCommand(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}

func configureShell(cmd *exec.Cmd) { configureCommand(cmd) }

func currentWindowsSID() (string, error) {
	u, err := windows.GetCurrentProcessToken().GetTokenUser()
	if err != nil {
		return "", err
	}
	return u.User.Sid.String(), nil
}
