// Package localpty runs a process in an owned Windows pseudoconsole.
package localpty

import (
	"errors"
	"fmt"
)

var ErrUnsupported = errors.New("native local terminals are only supported on Windows")
var ErrOutputOverflow = errors.New("local terminal output was not consumed quickly enough")

// ExitError records a nonzero native process exit code.
type ExitError struct{ Code uint32 }

func (e *ExitError) Error() string { return fmt.Sprintf("process exited with code %d", e.Code) }

func validSize(cols, rows int) error {
	if cols < 1 || cols > 1000 || rows < 1 || rows > 1000 {
		return errors.New("terminal dimensions must be between 1 and 1000")
	}
	return nil
}
