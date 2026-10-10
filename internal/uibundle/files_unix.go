//go:build unix

package uibundle

import (
	"os"
	"syscall"
)

func openDiskAsset(root *os.Root, name string) (*os.File, error) {
	// A FIFO swapped into an entry must not block before Stat rejects it.
	return root.OpenFile(name, os.O_RDONLY|syscall.O_NOFOLLOW|syscall.O_NONBLOCK, 0)
}
