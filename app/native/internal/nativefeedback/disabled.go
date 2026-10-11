//go:build !dev || !wailsfeedback || production

package nativefeedback

import "github.com/wailsapp/wails/v3/pkg/application"

// The development bridge and its inspection Service stay out of normal builds.
// The separate Runtime controller remains dormant until explicitly enabled.
type Bridge struct{}

func DevelopmentEndpoint(*Bridge) string { return "" }

func Start(Config) (*Bridge, error) { return nil, nil }

func Services(_ *Bridge, existing []application.Service) []application.Service { return existing }

func Attach(*Bridge, application.Window) {}

func Stop(*Bridge) {}

func InstanceID(_ *Bridge, original string) string { return original }
