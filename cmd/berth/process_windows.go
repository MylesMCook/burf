package main

import (
	"context"
	"errors"
	"os/exec"
	"syscall"

	"golang.org/x/sys/windows"
)

func detachAgentProcess(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: windows.DETACHED_PROCESS | windows.CREATE_NEW_PROCESS_GROUP, HideWindow: true}
}

func openAgentProcess(pid int) (func(context.Context) error, func(), error) {
	if pid <= 0 {
		return nil, nil, errors.New("the running agent did not report a PID; leave the current installation in place")
	}
	handle, err := windows.OpenProcess(windows.SYNCHRONIZE, false, uint32(pid))
	if err != nil {
		if errors.Is(err, windows.ERROR_INVALID_PARAMETER) {
			// This PID already exited before its handle could be opened.
			return func(context.Context) error { return nil }, func() {}, nil
		}
		return nil, nil, err
	}
	return func(ctx context.Context) error {
		for {
			if err := ctx.Err(); err != nil {
				return err
			}
			status, err := windows.WaitForSingleObject(handle, 100)
			if err != nil {
				return err
			}
			if status == windows.WAIT_OBJECT_0 {
				return nil
			}
			if status != uint32(windows.WAIT_TIMEOUT) {
				return errors.New("unexpected Windows process wait result")
			}
		}
	}, func() { windows.CloseHandle(handle) }, nil
}
