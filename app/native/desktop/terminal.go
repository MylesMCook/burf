package desktop

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

func openTerminal() error {
	if err := ordinaryUser(); err != nil {
		return err
	}
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("/usr/bin/open", "-a", "Terminal")
	case "windows":
		root := os.Getenv("SystemRoot")
		if !filepath.IsAbs(root) {
			return errors.New("Windows system directory is unavailable")
		}
		cmd = exec.Command(filepath.Join(root, "System32/cmd.exe"))
	case "linux":
		for _, name := range []string{"x-terminal-emulator", "gnome-terminal", "konsole", "xfce4-terminal", "xterm"} {
			if path, err := exec.LookPath(name); err == nil {
				cmd = exec.Command(path)
				break
			}
		}
		if cmd == nil {
			return errors.New("no terminal app was found")
		}
	default:
		return errors.New("opening a terminal is only for macOS, Windows and Linux")
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	return cmd.Process.Release()
}
