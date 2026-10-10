//go:build windows

package desktop

import (
	"context"
	_ "embed"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

//go:embed cli-path.ps1
var pathScript string

func cliDirectory() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(exe), "cli"), nil
}

func pathAction(action string) (string, error) {
	if development {
		return "", errors.New("PATH integration is only available in an installed build")
	}
	if err := ordinaryUser(); err != nil {
		return "", err
	}
	dir, err := cliDirectory()
	if err != nil {
		return "", err
	}
	if action == "Add" && !executable(filepath.Join(dir, "burf.exe")) {
		return "", errors.New("this build carries no command to add to PATH")
	}
	root := os.Getenv("SystemRoot")
	if !filepath.IsAbs(root) {
		return "", errors.New("Windows system directory is unavailable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	command := "& {\n" + pathScript + "\n} -Action '" + action + "' -CliDirectory '" + strings.ReplaceAll(dir, "'", "''") + "'"
	cmd := exec.CommandContext(ctx, filepath.Join(root, "System32/WindowsPowerShell/v1.0/powershell.exe"), "-NoProfile", "-NonInteractive", "-Command", command)
	backgroundCommand(cmd)
	var stdout, stderr boundedOutput
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	if err := cmd.Run(); err != nil {
		if why := strings.TrimSpace(stderr.String()); why != "" {
			return "", errors.New(why)
		}
		return "", err
	}
	return strings.TrimSpace(stdout.String()), nil
}

func cliLinkStatus() (cliLink, error) {
	dir, err := cliDirectory()
	if err != nil {
		return cliLink{}, err
	}
	result := cliLink{Link: dir, State: "missing", Blocked: privateStateReason()}
	bin := filepath.Join(dir, "burf.exe")
	if !development && executable(bin) {
		result.Bundled = &bin
		state, err := pathAction("Status")
		if err != nil {
			return cliLink{}, err
		}
		switch state {
		case "linked":
			result.State = "linked"
		case "external":
			result.State = "file"
		}
	}
	return result, nil
}

func installCLILink() (cliLink, error) {
	if why := privateStateReason(); why != nil {
		return cliLink{}, errors.New(*why)
	}
	if _, err := pathAction("Add"); err != nil {
		return cliLink{}, err
	}
	return cliLinkStatus()
}

func removeCLILink() (cliLink, error) {
	if _, err := pathAction("Remove"); err != nil {
		return cliLink{}, err
	}
	return cliLinkStatus()
}

// RemoveInstallerCLIPath preserves the existing NSIS uninstaller entry point.
func RemoveInstallerCLIPath() error {
	_, err := pathAction("Remove")
	return err
}
