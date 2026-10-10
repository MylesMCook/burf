//go:build darwin && cgo

package nativebrowser

/*
#cgo CFLAGS: -x objective-c -fobjc-arc -fblocks
#cgo LDFLAGS: -framework Cocoa -framework WebKit
#include <stdlib.h>
#include "browser_darwin.h"
*/
import "C"

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"runtime/cgo"
	"sync"
	"sync/atomic"
	"unsafe"
)

const (
	macMaxURLBytes        = 64 << 10
	macMaxDiagnosticBytes = 4 << 20
)

var errMacBrowserClosed = errors.New("native browser view is closed")

type darwinDriver struct {
	config Config
	closed atomic.Bool
}

type macEvaluation struct {
	json string
	err  error
}

type macEvent struct {
	kind        int
	data, state string
}

type darwinView struct {
	driver *darwinDriver
	id     string
	// Only DispatchSync closures read or change ptr. Cocoa owns the retained
	// object behind it; no Go pointer crosses into WebKit.
	ptr     unsafe.Pointer
	handle  cgo.Handle
	closed  atomic.Bool
	stop    chan struct{}
	events  chan macEvent
	mu      sync.Mutex
	next    uint64
	pending map[uint64]chan macEvaluation
}

func newDriver(config Config) (driver, error) {
	return &darwinDriver{config: config}, nil
}

func (d *darwinDriver) Open(id, raw string, bounds Bounds) (view, error) {
	if d.closed.Load() {
		return nil, errMacBrowserClosed
	}
	v := &darwinView{
		driver: d, id: id, stop: make(chan struct{}), events: make(chan macEvent, 4),
		pending: make(map[uint64]chan macEvaluation),
	}
	v.handle = cgo.NewHandle(v)
	var err error
	d.config.DispatchSync(func() {
		if d.closed.Load() {
			err = errMacBrowserClosed
			return
		}
		cURL := C.CString(raw)
		cScript := C.CString(d.config.DevtoolsScript)
		defer C.free(unsafe.Pointer(cURL))
		defer C.free(unsafe.Pointer(cScript))
		var cError *C.char
		v.ptr = C.burf_mac_browser_open(d.config.Parent, C.uintptr_t(v.handle), cURL, cScript,
			C.double(bounds.X), C.double(bounds.Y), C.double(bounds.Width), C.double(bounds.Height), &cError)
		err = macError(cError)
		if v.ptr == nil && err == nil {
			err = errors.New("WebKit did not create the browser view")
		}
	})
	if err != nil {
		v.handle.Delete()
		return nil, err
	}
	go v.emitEvents()
	return v, nil
}

func (d *darwinDriver) Close() error {
	d.closed.Store(true)
	return nil
}

func macError(raw *C.char) error {
	if raw == nil {
		return nil
	}
	defer C.free(unsafe.Pointer(raw))
	return errors.New(C.GoString(raw))
}

func (v *darwinView) onUI(f func(unsafe.Pointer) *C.char) error {
	if v.closed.Load() {
		return errMacBrowserClosed
	}
	var err error
	v.driver.config.DispatchSync(func() {
		if v.closed.Load() || v.ptr == nil {
			err = errMacBrowserClosed
			return
		}
		err = macError(f(v.ptr))
	})
	return err
}

func (v *darwinView) SetBounds(b Bounds) error {
	return v.onUI(func(p unsafe.Pointer) *C.char {
		return C.burf_mac_browser_bounds(p, C.double(b.X), C.double(b.Y), C.double(b.Width), C.double(b.Height))
	})
}

func (v *darwinView) Show() error { return v.visible(1) }
func (v *darwinView) Hide() error { return v.visible(0) }
func (v *darwinView) visible(visible int) error {
	return v.onUI(func(p unsafe.Pointer) *C.char { return C.burf_mac_browser_visible(p, C.int(visible)) })
}

func (v *darwinView) Navigate(raw string) error {
	if len(raw) > macMaxURLBytes {
		return errors.New("browser URL is too large")
	}
	return v.onUI(func(p unsafe.Pointer) *C.char {
		cURL := C.CString(raw)
		defer C.free(unsafe.Pointer(cURL))
		return C.burf_mac_browser_navigate(p, cURL)
	})
}

func (v *darwinView) Back() error    { return v.action(0) }
func (v *darwinView) Forward() error { return v.action(1) }
func (v *darwinView) Reload() error  { return v.action(2) }
func (v *darwinView) Inspect() error { return v.action(3) }
func (v *darwinView) action(action int) error {
	return v.onUI(func(p unsafe.Pointer) *C.char { return C.burf_mac_browser_action(p, C.int(action)) })
}

func (v *darwinView) Eval(ctx context.Context, script string) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if C.burf_mac_browser_is_main_thread() != 0 {
		return "", errors.New("browser evaluation must wait outside the UI thread")
	}
	result := make(chan macEvaluation, 1)
	v.mu.Lock()
	if v.closed.Load() {
		v.mu.Unlock()
		return "", errMacBrowserClosed
	}
	v.next++
	request := v.next
	v.pending[request] = result
	v.mu.Unlock()
	defer func() {
		v.mu.Lock()
		delete(v.pending, request)
		v.mu.Unlock()
	}()
	// Starting the evaluation runs on the UI thread. Waiting for its WebKit
	// completion runs here, after DispatchSync has returned to its event loop.
	err := v.onUI(func(p unsafe.Pointer) *C.char {
		cScript := C.CString(script)
		defer C.free(unsafe.Pointer(cScript))
		return C.burf_mac_browser_eval(p, C.uint64_t(request), cScript)
	})
	if err != nil {
		return "", err
	}
	select {
	case answer := <-result:
		return answer.json, answer.err
	case <-ctx.Done():
		// The native block may still finish. It has the pane handle and a
		// request number, never a pointer to this cancelled waiter.
		return "", ctx.Err()
	case <-v.stop:
		return "", errMacBrowserClosed
	}
}

func (v *darwinView) Close() error {
	if !v.closed.CompareAndSwap(false, true) {
		return nil
	}
	close(v.stop)
	var err error
	v.driver.config.DispatchSync(func() {
		if v.ptr != nil {
			err = macError(C.burf_mac_browser_close(v.ptr))
			if err == nil {
				v.ptr = nil
			}
		}
	})
	// Native Close first clears delegates, stops polling and zeros the native
	// handle. Late evaluation blocks inspect that state and cannot call Go.
	if err == nil {
		v.handle.Delete()
	}
	v.mu.Lock()
	v.pending = make(map[uint64]chan macEvaluation)
	v.mu.Unlock()
	return err
}

func (v *darwinView) emitEvents() {
	for {
		select {
		case <-v.stop:
			return
		case e := <-v.events:
			if v.closed.Load() {
				return
			}
			switch e.kind {
			case 0:
				v.driver.config.Emit("berth://browser", Event{ID: v.id, URL: e.data, State: e.state})
			case 1:
				v.driver.config.Emit("berth://browser-pick", PickEvent{ID: v.id, URL: e.data})
			case 2:
				v.driver.config.Emit("berth://browser-console", ConsoleEvent{ID: v.id, Data: e.data})
			}
		}
	}
}

//export burfMacBrowserEvent
func burfMacBrowserEvent(handle C.uintptr_t, kind C.int, raw, state *C.char) {
	v := cgo.Handle(handle).Value().(*darwinView)
	v.queueEvent(int(kind), C.GoString(raw), C.GoString(state))
}

func (v *darwinView) queueEvent(kind int, data, state string) {
	if v.closed.Load() {
		return
	}
	switch kind {
	case 0:
		if len(data) > macMaxURLBytes || (state != "started" && state != "committed" && state != "finished" && state != "moved") {
			return
		}
	case 1:
		if len(data) > macMaxURLBytes {
			return
		}
		u, err := url.Parse(data)
		if err != nil || u.Scheme != "berth-pick" || u.Host != "pick" {
			return
		}
		pick := u.Query().Get("d")
		if len(pick) > 64<<10 || !json.Valid([]byte(pick)) {
			return
		}
	case 2:
		if len(data) > macMaxDiagnosticBytes || !json.Valid([]byte(data)) {
			return
		}
	default:
		return
	}
	select {
	case v.events <- macEvent{kind: kind, data: data, state: state}:
	default:
		// A busy UI cannot make a remote page block Cocoa or grow an
		// unbounded queue. The next page poll reports subsequent activity.
	}
}

//export burfMacBrowserEvalResult
func burfMacBrowserEvalResult(handle C.uintptr_t, request C.uint64_t, raw, cError *C.char) {
	v := cgo.Handle(handle).Value().(*darwinView)
	result := macEvaluation{json: C.GoString(raw)}
	if cError != nil && *cError != 0 {
		result.err = errors.New(C.GoString(cError))
	}
	v.finishEvaluation(uint64(request), result)
}

func (v *darwinView) finishEvaluation(request uint64, result macEvaluation) {
	v.mu.Lock()
	waiter := v.pending[request]
	delete(v.pending, request)
	v.mu.Unlock()
	if waiter == nil {
		return
	}
	waiter <- result
}
