//go:build !windows

package terminal

import "os"

func ReadInput(f *os.File, p []byte) (int, error) { return f.Read(p) }
