//go:build !windows

package sshconfig

import "os"

func (c Config) prepareDir(dir string) error { return os.MkdirAll(dir, 0o700) }

func writeConfig(path string, data []byte) error { return os.WriteFile(path, data, 0o600) }
