//go:build windows

package desktop

import (
	"errors"
	"os/exec"
	"syscall"

	"golang.org/x/sys/windows"
)

func ordinaryUser() error {
	token, err := windows.OpenCurrentProcessToken()
	if err != nil {
		return err
	}
	defer token.Close()
	if token.IsElevated() {
		return errors.New("open Burf normally, without Run as administrator, before starting its agent")
	}
	return nil
}

func backgroundCommand(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: windows.CREATE_NO_WINDOW}
}
