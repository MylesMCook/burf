//go:build !darwin && !windows

package nativebrowser

import "errors"

func newDriver(Config) (driver, error) {
	return nil, errors.New("isolated native browser panes are not available on this platform yet")
}
