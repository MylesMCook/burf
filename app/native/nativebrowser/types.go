package nativebrowser

import (
	"context"
	"unsafe"
)

// Bounds uses logical coordinates relative to the trusted main window's content.
type Bounds struct{ X, Y, Width, Height float64 }

type Event struct {
	ID    string `json:"id"`
	URL   string `json:"url"`
	State string `json:"state"`
}
type ConsoleEvent struct {
	ID   string `json:"id"`
	Data string `json:"data"`
}
type PickEvent struct {
	ID  string `json:"id"`
	URL string `json:"url"`
}

// Remote views never receive Wails bindings, asset handlers or the app token.
// Emit only carries page/navigation diagnostics back to the trusted UI.
type Config struct {
	Parent         unsafe.Pointer
	ProfileDir     string
	DevtoolsScript string
	Emit           func(name string, payload any)
	DispatchSync   func(fn func())
}

type driver interface {
	Open(id, url string, bounds Bounds) (view, error)
	Close() error
}
type view interface {
	SetBounds(Bounds) error
	Show() error
	Hide() error
	Navigate(string) error
	Back() error
	Forward() error
	Reload() error
	Eval(context.Context, string) (string, error)
	Inspect() error
	Close() error
}
