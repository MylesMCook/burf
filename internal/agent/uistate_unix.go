//go:build !windows

package agent

import (
	"errors"
	"os"
	"syscall"
)

func openClientUIFile(root *os.Root, name string) (*os.File, error) {
	return root.OpenFile(name, os.O_RDONLY|syscall.O_NOFOLLOW|syscall.O_NONBLOCK, 0)
}

func clientUIOwner(file *os.File) error {
	info, err := file.Stat()
	if err != nil {
		return err
	}
	stat, ok := info.Sys().(*syscall.Stat_t)
	// Existing client directories may be readable. Their private state files
	// must not be, and no directory may permit another account to replace them.
	mask := os.FileMode(0o077)
	if info.IsDir() {
		mask = 0o022
	}
	if !ok || stat.Uid != uint32(os.Geteuid()) || info.Mode().Perm()&mask != 0 {
		return errors.New("desktop state must be private to this account")
	}
	return nil
}

func createClientUIFile(root *os.Root, name string) (*os.File, error) {
	return root.OpenFile(name, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
}
