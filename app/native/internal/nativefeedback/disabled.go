//go:build !dev || !wailsfeedback || production

package nativefeedback

import "github.com/wailsapp/wails/v3/pkg/application"

// No transport or bound Service is compiled into an ordinary or production build.
type Bridge struct{}

func Start(Config) (*Bridge, error) { return nil, nil }

func Services(_ *Bridge, existing []application.Service) []application.Service { return existing }

func Attach(*Bridge, application.Window) {}

func Stop(*Bridge) {}

func InstanceID(_ *Bridge, original string) string { return original }
