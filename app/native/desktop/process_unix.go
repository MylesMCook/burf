//go:build !windows

package desktop

import "os/exec"

func ordinaryUser() error         { return nil }
func backgroundCommand(*exec.Cmd) {}
