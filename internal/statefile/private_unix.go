//go:build !windows

package statefile

import "os"

func makePrivateDirs(dir string) error { return os.MkdirAll(dir, 0o700) }
func privateDir(string) error          { return nil }
func privateFile(path string) error    { return os.Chmod(path, 0o600) }

func createPrivateTemp(dir, prefix string) (*os.File, error) {
	return os.CreateTemp(dir, prefix+"*")
}
