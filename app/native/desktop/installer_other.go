//go:build !windows

package desktop

import "errors"

func RemoveInstallerCLIPath() error {
	return errors.New("the installer PATH hook is only available on Windows")
}
