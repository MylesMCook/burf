package main

import (
	"time"
	"unsafe"

	"github.com/sean-brydon/berthd/internal/terminal"
	"golang.org/x/sys/windows"
)

func watchTerminalResize(fd uintptr, resized func(int, int)) func() {
	done := make(chan struct{})
	cols, rows, _ := terminal.Size(fd)
	go func() {
		ticker := time.NewTicker(250 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				c, r, err := terminal.Size(fd)
				if err == nil && (c != cols || r != rows) {
					cols, rows = c, r
					resized(c, r)
				}
			}
		}
	}()
	return func() { close(done) }
}

var createTerminalProcess = windows.CreateProcess

func openTerminalCommand(exe string, args []string) error {
	application, err := windows.UTF16PtrFromString(exe)
	if err != nil {
		return err
	}
	line, err := windows.UTF16PtrFromString(windows.ComposeCommandLine(append([]string{exe}, args...)))
	if err != nil {
		return err
	}
	// os/exec supplies NUL as stdin/stdout by default. A new console needs
	// CreateProcess to allocate its standard handles instead of inheriting them.
	startup := windows.StartupInfo{}
	startup.Cb = uint32(unsafe.Sizeof(startup))
	var process windows.ProcessInformation
	if err := createTerminalProcess(application, line, nil, nil, false, windows.CREATE_NEW_CONSOLE|windows.CREATE_NEW_PROCESS_GROUP, nil, nil, &startup, &process); err != nil {
		return err
	}
	if process.Thread != 0 {
		windows.CloseHandle(process.Thread)
	}
	if process.Process != 0 {
		windows.CloseHandle(process.Process)
	}
	return nil
}
