// Package openurl launches the system handler for a URL.
package openurl

import (
	"os/exec"
	"runtime"
)

// Command keeps URLs as one argument rather than inserting them into a shell.
func Command(goos, url string) []string {
	switch goos {
	case "darwin":
		return []string{"open", url}
	case "windows":
		return []string{"rundll32.exe", "url.dll,FileProtocolHandler", url}
	default:
		return []string{"xdg-open", url}
	}
}

func Open(url string) error {
	args := Command(runtime.GOOS, url)
	cmd := exec.Command(args[0], args[1:]...)
	if err := cmd.Start(); err != nil {
		return err
	}
	go cmd.Wait()
	return nil
}
