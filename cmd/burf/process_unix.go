//go:build !windows

package main

import (
	"context"
	"os/exec"
	"syscall"
)

func detachAgentProcess(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
}

func openAgentProcess(pid int) (func(context.Context) error, func(), error) {
	return func(context.Context) error { return nil }, func() {}, nil
}
