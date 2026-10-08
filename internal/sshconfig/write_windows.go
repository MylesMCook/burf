package sshconfig

import (
	"os"
	"path/filepath"

	"github.com/MylesMCook/burf/internal/statefile"
)

func (c Config) prepareDir(dir string) error {
	if dir == filepath.Join(c.Dir, "berth") {
		return statefile.EnsurePrivateDir(dir)
	}
	return os.MkdirAll(dir, 0o700)
}

// OpenSSH rejects files writable by inherited unrelated Windows accounts.
func writeConfig(path string, data []byte) error { return statefile.Write(path, data) }
