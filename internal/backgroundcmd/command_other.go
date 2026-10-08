//go:build !windows

package backgroundcmd

import "os/exec"

func configure(cmd *exec.Cmd) {}
