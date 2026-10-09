package localagent

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// ValidateProjectDirectory gives listing and launch the same folder check.
// Launch checks again because a folder can disappear after it was listed.
func ValidateProjectDirectory(cwd string) error {
	drive := len(cwd) >= 3 && ((cwd[0] >= 'A' && cwd[0] <= 'Z') || (cwd[0] >= 'a' && cwd[0] <= 'z')) && cwd[1] == ':' && (cwd[2] == '\\' || cwd[2] == '/')
	windowsPath := drive || strings.HasPrefix(cwd, `\\`)
	if runtime.GOOS != "windows" && windowsPath || runtime.GOOS == "windows" && strings.HasPrefix(cwd, "/") && filepath.VolumeName(cwd) == "" {
		return fmt.Errorf("Its folder, %s, uses a path for another operating system.", cwd)
	}
	if !filepath.IsAbs(cwd) {
		return fmt.Errorf("Its folder, %s, is a relative path. Use a full folder path to continue here.", cwd)
	}
	st, err := os.Stat(cwd)
	if errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("Its folder, %s, is not on this computer.", cwd)
	}
	if err != nil {
		return fmt.Errorf("Burf cannot access its folder, %s. Check the folder's permissions.", cwd)
	}
	if st.Mode().IsRegular() {
		return fmt.Errorf("Its path, %s, is a file, not a folder.", cwd)
	}
	if !st.IsDir() {
		return fmt.Errorf("Its path, %s, is not a folder.", cwd)
	}
	return nil
}
