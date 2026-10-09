//go:build !windows && !darwin && !linux

package localchat

import "errors"

func StartProcess(LaunchOptions) (Process, error) {
	return nil, errors.New("owned Codex chat is supported on Windows, macOS and Linux only")
}
