//go:build !windows

package integrations

import (
	"io/fs"
	"os"
	"syscall"
)

func openNoFollow(root *os.Root, name string, perm fs.FileMode) (*os.File, error) {
	return root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_TRUNC|syscall.O_NOFOLLOW, perm)
}
