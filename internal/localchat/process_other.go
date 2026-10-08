//go:build !windows

package localchat

import "errors"

func StartProcess(program, cwd string) (Process, error) {
	return nil, errors.New("native local Codex chat is available on Windows only")
}
