package nativebrowser

import (
	"context"
	"errors"
	"math"
	"net/url"
	"regexp"
	"sync"
)

var validID = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

// Manager owns only raw remote views; the trusted application view is absent.
type Manager struct {
	mu     sync.Mutex
	driver driver
	views  map[string]view
	closed bool
}

func New(config Config) (*Manager, error) {
	if config.Parent == nil || config.DispatchSync == nil || config.Emit == nil {
		return nil, errors.New("native browser requires an owned main window")
	}
	d, err := newDriver(config)
	if err != nil {
		return nil, err
	}
	return &Manager{driver: d, views: make(map[string]view)}, nil
}

func checkURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil {
		return errors.New("browser URLs must be HTTP or HTTPS without credentials")
	}
	return nil
}
func checkBounds(b Bounds) error {
	for _, n := range []float64{b.X, b.Y, b.Width, b.Height} {
		if math.IsNaN(n) || math.IsInf(n, 0) {
			return errors.New("browser bounds must be finite")
		}
	}
	if b.Width < 0 || b.Height < 0 {
		return errors.New("browser bounds cannot be negative")
	}
	return nil
}
func (m *Manager) Open(id, raw string, bounds Bounds) error {
	if !validID.MatchString(id) {
		return errors.New("invalid browser id")
	}
	if err := checkURL(raw); err != nil {
		return err
	}
	if err := checkBounds(bounds); err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.closed {
		return errors.New("native browser is closed")
	}
	if _, ok := m.views[id]; ok {
		return nil
	}
	v, err := m.driver.Open(id, raw, bounds)
	if err != nil {
		return err
	}
	m.views[id] = v
	return nil
}
func (m *Manager) with(id string, f func(view) error) error {
	m.mu.Lock()
	v := m.views[id]
	m.mu.Unlock()
	if v == nil {
		return errors.New("browser view does not exist")
	}
	return f(v)
}
func (m *Manager) SetBounds(id string, b Bounds) error {
	if err := checkBounds(b); err != nil {
		return err
	}
	return m.with(id, func(v view) error { return v.SetBounds(b) })
}
func (m *Manager) Show(id string) error { return m.with(id, func(v view) error { return v.Show() }) }
func (m *Manager) Hide(id string) error { return m.with(id, func(v view) error { return v.Hide() }) }
func (m *Manager) Navigate(id, raw string) error {
	if err := checkURL(raw); err != nil {
		return err
	}
	return m.with(id, func(v view) error { return v.Navigate(raw) })
}
func (m *Manager) Back(id string) error { return m.with(id, func(v view) error { return v.Back() }) }
func (m *Manager) Forward(id string) error {
	return m.with(id, func(v view) error { return v.Forward() })
}
func (m *Manager) Reload(id string) error {
	return m.with(id, func(v view) error { return v.Reload() })
}
func (m *Manager) Pick(ctx context.Context, id, script string) error {
	if len(script) > 65536 {
		return errors.New("picker script is too large")
	}
	return m.with(id, func(v view) error { _, err := v.Eval(ctx, script); return err })
}
func (m *Manager) Inspect(id string) error {
	return m.with(id, func(v view) error { return v.Inspect() })
}
func (m *Manager) Close(id string) error {
	m.mu.Lock()
	v := m.views[id]
	delete(m.views, id)
	m.mu.Unlock()
	if v == nil {
		return nil
	}
	return v.Close()
}
func (m *Manager) Shutdown() error {
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return nil
	}
	m.closed = true
	views := m.views
	m.views = make(map[string]view)
	m.mu.Unlock()
	var errs []error
	for _, v := range views {
		errs = append(errs, v.Close())
	}
	errs = append(errs, m.driver.Close())
	return errors.Join(errs...)
}
