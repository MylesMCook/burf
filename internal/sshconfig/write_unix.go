//go:build !windows

package sshconfig

import "os"

func writeConfig(path string, data []byte) error { return os.WriteFile(path, data, 0o600) }
