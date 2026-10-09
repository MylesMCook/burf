package statefile

import (
	"errors"
	"os"

	"golang.org/x/sys/windows"
)

func lockFile(f *os.File, nonblocking bool) (func(), bool, error) {
	flags := uint32(windows.LOCKFILE_EXCLUSIVE_LOCK)
	if nonblocking {
		flags |= windows.LOCKFILE_FAIL_IMMEDIATELY
	}
	h := windows.Handle(f.Fd())
	overlap := &windows.Overlapped{}
	if err := windows.LockFileEx(h, flags, 0, 1, 0, overlap); err != nil {
		if nonblocking && errors.Is(err, windows.ERROR_LOCK_VIOLATION) {
			return nil, false, nil
		}
		return nil, false, err
	}
	return func() { windows.UnlockFileEx(h, 0, 1, 0, overlap) }, true, nil
}
