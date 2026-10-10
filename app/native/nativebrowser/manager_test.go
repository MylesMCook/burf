package nativebrowser

import (
	"context"
	"sync/atomic"
	"testing"
	"time"
)

type fakeView struct {
	closes atomic.Int32
	url    string
	bounds Bounds
}

func (v *fakeView) SetBounds(b Bounds) error                   { v.bounds = b; return nil }
func (v *fakeView) Navigate(raw string) error                  { v.url = raw; return nil }
func (*fakeView) Show() error                                  { return nil }
func (*fakeView) Hide() error                                  { return nil }
func (*fakeView) Back() error                                  { return nil }
func (*fakeView) Forward() error                               { return nil }
func (*fakeView) Reload() error                                { return nil }
func (*fakeView) Inspect() error                               { return nil }
func (*fakeView) Eval(context.Context, string) (string, error) { return "", nil }
func (v *fakeView) Close() error                               { v.closes.Add(1); return nil }

type fakeDriver struct {
	entered, release chan struct{}
	v                *fakeView
	closes           atomic.Int32
}

func (d *fakeDriver) Open(string, string, Bounds) (view, error) {
	close(d.entered)
	<-d.release
	return d.v, nil
}
func (d *fakeDriver) Close() error { d.closes.Add(1); return nil }

func TestReopeningAnOwnedViewNavigatesAndPlacesIt(t *testing.T) {
	v := &fakeView{}
	m := &Manager{views: map[string]view{"one": v}}
	bounds := Bounds{X: 10, Y: 20, Width: 200, Height: 150}
	if err := m.Open("one", "https://example.test/next", bounds); err != nil {
		t.Fatal(err)
	}
	if v.url != "https://example.test/next" || v.bounds != bounds {
		t.Fatalf("view unchanged: %+v", v)
	}
}

func TestClosingWhileNativeCreationWaitsDoesNotBlockOrResurrect(t *testing.T) {
	for _, shutdown := range []bool{false, true} {
		t.Run(map[bool]string{false: "pane", true: "app"}[shutdown], func(t *testing.T) {
			d := &fakeDriver{entered: make(chan struct{}), release: make(chan struct{}), v: &fakeView{}}
			m := &Manager{driver: d, views: map[string]view{}, generation: map[string]uint64{}}
			opened := make(chan error, 1)
			go func() { opened <- m.Open("one", "https://example.test", Bounds{}) }()
			<-d.entered
			closed := make(chan error, 1)
			go func() {
				if shutdown {
					closed <- m.Shutdown()
				} else {
					closed <- m.Close("one")
				}
			}()
			select {
			case err := <-closed:
				if err != nil {
					t.Fatal(err)
				}
			case <-time.After(time.Second):
				close(d.release)
				t.Fatal("close waited for native creation")
			}
			close(d.release)
			if err := <-opened; err == nil {
				t.Fatal("canceled view was registered")
			}
			if len(m.views) != 0 || d.v.closes.Load() != 1 {
				t.Fatal("late native view was leaked")
			}
		})
	}
}
