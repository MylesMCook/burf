//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
	"syscall"

	"github.com/sean-brydon/berthd/internal/terminal"
)

func watchTerminalResize(fd uintptr, resized func(int, int)) func() {
	winch := make(chan os.Signal, 1)
	done := make(chan struct{})
	signal.Notify(winch, syscall.SIGWINCH)
	go func() {
		for {
			select {
			case <-done:
				return
			case <-winch:
				if cols, rows, err := terminal.Size(fd); err == nil {
					resized(cols, rows)
				}
			}
		}
	}()
	return func() { signal.Stop(winch); close(done) }
}

func openTerminalCommand(exe string, args []string) error {
	words := []string{shellQuote(exe)}
	for _, a := range args {
		words = append(words, shellQuote(a))
	}
	return openTerminalRunning(strings.Join(words, " "))
}

func openTerminalRunning(command string) error {
	if runtime.GOOS != "darwin" {
		return exec.Command("x-terminal-emulator", "-e", "sh", "-c", command).Start()
	}
	script := fmt.Sprintf("tell application \"Terminal\"\n  do script %q\n  activate\nend tell", command)
	return exec.Command("osascript", "-e", script).Run()
}
