package terminal

import (
	"errors"
	"io"
	"os"
	"os/exec"

	"golang.org/x/sys/windows"
)

// Native Windows boxes and interactive SSH provisioning need a process PTY
// backend; the Windows client only attaches its console to a remote PTY.
var errLocalPTY = errors.New("local pseudo-terminal execution is not supported on Windows")

func Start(*exec.Cmd, int, int) (*os.File, error) { return nil, errLocalPTY }
func Resize(*os.File, int, int) error             { return errLocalPTY }

func Size(fd uintptr) (cols, rows int, err error) {
	var info windows.ConsoleScreenBufferInfo
	if err := windows.GetConsoleScreenBufferInfo(windows.Handle(fd), &info); err != nil {
		return 0, 0, err
	}
	return int(info.Window.Right-info.Window.Left) + 1, int(info.Window.Bottom-info.Window.Top) + 1, nil
}

func IsTerminal(fd uintptr) bool {
	var mode uint32
	return windows.GetConsoleMode(windows.Handle(fd), &mode) == nil
}

// MakeRaw enables VT input so keys and Ctrl-C are bytes for the remote
// session, and restores both console handles when attachment ends.
func MakeRaw(fd uintptr) (func(), error) {
	input := windows.Handle(fd)
	var oldInput uint32
	if err := windows.GetConsoleMode(input, &oldInput); err != nil {
		return nil, err
	}
	oldCodePage, err := windows.GetConsoleCP()
	if err != nil {
		return nil, err
	}
	if err := windows.SetConsoleCP(65001); err != nil {
		return nil, err
	}
	raw := oldInput &^ (windows.ENABLE_ECHO_INPUT | windows.ENABLE_LINE_INPUT | windows.ENABLE_PROCESSED_INPUT | windows.ENABLE_QUICK_EDIT_MODE)
	raw |= windows.ENABLE_EXTENDED_FLAGS | windows.ENABLE_VIRTUAL_TERMINAL_INPUT
	if err := windows.SetConsoleMode(input, raw); err != nil {
		windows.SetConsoleCP(oldCodePage)
		return nil, err
	}
	output := windows.Handle(os.Stdout.Fd())
	var oldOutput uint32
	hasOutput := windows.GetConsoleMode(output, &oldOutput) == nil
	if hasOutput {
		if err := windows.SetConsoleMode(output, oldOutput|windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING); err != nil {
			windows.SetConsoleMode(input, oldInput)
			windows.SetConsoleCP(oldCodePage)
			return nil, err
		}
	}
	return func() {
		windows.SetConsoleMode(input, oldInput)
		windows.SetConsoleCP(oldCodePage)
		if hasOutput {
			windows.SetConsoleMode(output, oldOutput)
		}
	}, nil
}

// ReadInput bypasses Go's cooked-console reader, which interprets Ctrl-Z as
// EOF even after MakeRaw. ReadFile preserves it as input for the remote PTY.
func ReadInput(f *os.File, p []byte) (int, error) {
	if !IsTerminal(f.Fd()) {
		return f.Read(p)
	}
	return readConsoleInput(f, p)
}

func readConsoleInput(f *os.File, p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	var n uint32
	err := windows.ReadFile(windows.Handle(f.Fd()), p, &n, nil)
	if err == nil && n == 0 {
		err = io.EOF
	}
	return int(n), err
}
