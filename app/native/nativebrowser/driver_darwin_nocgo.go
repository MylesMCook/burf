//go:build darwin && !cgo

package nativebrowser

import "errors"

func newDriver(Config) (driver, error) {
	return nil, errors.New("native macOS browser panes require CGO")
}
