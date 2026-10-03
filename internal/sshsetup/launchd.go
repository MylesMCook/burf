package sshsetup

import (
	"os/exec"
	"runtime"
	"strings"
)

// launchdAuthSock is the SSH_AUTH_SOCK launchd gives GUI apps' terminals: the
// system agent, or one a key manager set with `launchctl setenv`.
func launchdAuthSock() string {
	if runtime.GOOS != "darwin" {
		return ""
	}
	out, err := exec.Command("launchctl", "getenv", "SSH_AUTH_SOCK").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}
