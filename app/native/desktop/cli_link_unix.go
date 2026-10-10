//go:build !windows

package desktop

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

func cliLinkPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".local/bin/burf"), nil
}

func linkBundle() string {
	exe, err := os.Executable()
	if err != nil || (runtime.GOOS == "darwin" && !strings.HasSuffix(filepath.Dir(exe), "/Contents/MacOS")) {
		return ""
	}
	return bundledCLI()
}

func linkBlocked(src string) *string {
	if own := privateStateReason(); own != nil {
		return own
	}
	var why string
	if strings.HasPrefix(src, "/Volumes/") {
		why = "Burf is running from its disk image. Drag it to Applications, open it from there, then install the command."
	} else if strings.Contains(src, "/AppTranslocation/") {
		why = "macOS is running Burf from a temporary copy. Move Burf to Applications, open it from there, then install the command."
	}
	if why != "" {
		return &why
	}
	return nil
}

func cliLinkStatus() (cliLink, error) {
	link, err := cliLinkPath()
	if err != nil {
		return cliLink{}, err
	}
	result := cliLink{Link: link, State: "missing"}
	if src := linkBundle(); src != "" {
		result.Bundled = &src
		result.Blocked = linkBlocked(src)
	} else {
		result.Blocked = privateStateReason()
	}
	info, err := os.Lstat(link)
	if os.IsNotExist(err) {
		return result, nil
	}
	if err != nil {
		return cliLink{}, err
	}
	result.State = "file"
	if info.Mode()&os.ModeSymlink != 0 {
		target, err := os.Readlink(link)
		if err != nil {
			return cliLink{}, err
		}
		result.Target = &target
		result.State = "symlink"
		if result.Bundled != nil && target == *result.Bundled {
			result.State = "linked"
		}
	}
	return result, nil
}

func installCLILink() (cliLink, error) {
	current, err := cliLinkStatus()
	if err != nil {
		return cliLink{}, err
	}
	if current.Blocked != nil {
		return cliLink{}, errors.New(*current.Blocked)
	}
	if current.Bundled == nil {
		return cliLink{}, errors.New("this build of Burf carries no burf command to link to")
	}
	if current.State == "linked" {
		return current, nil
	}
	if err := os.MkdirAll(filepath.Dir(current.Link), 0755); err != nil {
		return cliLink{}, err
	}
	return replaceCLILink(current.Link, *current.Bundled)
}

// A replacement link is prepared first. A regular command is retained, and a
// failed rename restores it; an existing recovery copy is never overwritten.
func replaceCLILink(link, src string) (cliLink, error) {
	tmp, err := os.CreateTemp(filepath.Dir(link), ".burf-link-*")
	if err != nil {
		return cliLink{}, err
	}
	name := tmp.Name()
	if err := tmp.Close(); err != nil {
		_ = os.Remove(name)
		return cliLink{}, err
	}
	_ = os.Remove(name)
	defer os.Remove(name)
	if err := os.Symlink(src, name); err != nil {
		return cliLink{}, err
	}
	previous := ""
	info, err := os.Lstat(link)
	if err != nil && !os.IsNotExist(err) {
		return cliLink{}, err
	}
	if err == nil && info.IsDir() {
		return cliLink{}, fmt.Errorf("%s is a folder; move it aside first", link)
	}
	if err == nil && info.Mode()&os.ModeSymlink == 0 {
		previous = link + ".previous"
		if _, err := os.Lstat(previous); !os.IsNotExist(err) {
			return cliLink{}, fmt.Errorf("%s already exists; keep it elsewhere before replacing the command", previous)
		}
		if err := os.Rename(link, previous); err != nil {
			return cliLink{}, err
		}
	}
	if err := os.Rename(name, link); err != nil {
		if previous != "" {
			if recovery := os.Rename(previous, link); recovery != nil {
				return cliLink{}, fmt.Errorf("install command: %w; retained previous command at %s: %v", err, previous, recovery)
			}
		}
		return cliLink{}, err
	}
	return cliLinkStatus()
}

func removeCLILink() (cliLink, error) {
	current, err := cliLinkStatus()
	if err != nil {
		return cliLink{}, err
	}
	if current.State != "linked" {
		return cliLink{}, errors.New("the burf link is not owned by this app")
	}
	if err := os.Remove(current.Link); err != nil {
		return cliLink{}, err
	}
	return cliLinkStatus()
}
