package sshconfig

import "github.com/MylesMCook/burf/internal/statefile"

// OpenSSH rejects files writable by inherited unrelated Windows accounts.
func writeConfig(path string, data []byte) error { return statefile.Write(path, data) }
