//go:build windows

package nativebrowser

import (
	"context"
	"debug/pe"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const maxBrowserMessage = 64 * 1024
const consoleDrain = `(function(){try{var d=window.__berthDevtools;var s=d&&typeof d.drain==='function'?d.drain():'';return typeof s==='string'?s:'';}catch(e){return '';}})()`

var (
	user32           = windows.NewLazySystemDLL("user32.dll")
	isWindow         = user32.NewProc("IsWindow")
	windowThread     = user32.NewProc("GetWindowThreadProcessId")
	dpiForWindow     = user32.NewProc("GetDpiForWindow")
	errBrowserClosed = errors.New("native browser is closed")
	loaderOnce       sync.Once
	loaderCreate     uintptr
	loaderErr        error
	loaderHandle     windows.Handle
)

type windowsDriver struct {
	config   Config
	parent   uintptr
	uiThread uint32
	closed   bool // driver and view native state are confined to DispatchSync
	views    map[*windowsView]struct{}
}

type eventRegistration struct {
	remove int
	token  int64
}
type scriptResult struct {
	text string
	err  error
}
type windowsView struct {
	driver      *windowsDriver
	id          string
	parent      uintptr
	owner       *windowsView
	children    map[*windowsView]struct{}
	onReady     func(error)
	environment *webviewObject
	controller  *webviewObject
	core        *webviewObject
	registered  []eventRegistration
	ready       chan error
	done        chan struct{}
	initDone    bool
	closed      bool
	draining    bool
	nextEval    uint64
	pending     map[uint64]chan scriptResult
}

func newDriver(config Config) (driver, error) {
	if runtime.GOARCH != "amd64" && runtime.GOARCH != "arm64" {
		return nil, errors.New("native browser panes require 64-bit Windows")
	}
	if !filepath.IsAbs(config.ProfileDir) {
		return nil, errors.New("native browser requires an absolute browser profile directory")
	}
	parent := uintptr(config.Parent)
	valid, _, _ := isWindow.Call(parent)
	var process uint32
	thread, _, _ := windowThread.Call(parent, uintptr(unsafe.Pointer(&process)))
	if valid == 0 || thread == 0 || process != windows.GetCurrentProcessId() {
		return nil, errors.New("native browser parent is not an owned application window")
	}
	loaderOnce.Do(loadWebViewLoader)
	if loaderErr != nil {
		return nil, loaderErr
	}
	return &windowsDriver{config: config, parent: parent, uiThread: uint32(thread), views: make(map[*windowsView]struct{})}, nil
}

func loadWebViewLoader() {
	executable, err := os.Executable()
	if err != nil {
		loaderErr = err
		return
	}
	// No PATH or current-directory lookup. Packaging supplies the official SDK
	// loader beside this executable, with the same architecture as Burf.
	path := filepath.Join(filepath.Dir(executable), "WebView2Loader.dll")
	image, err := pe.Open(path)
	if err != nil {
		loaderErr = fmt.Errorf("open packaged WebView2Loader.dll: %w", err)
		return
	}
	machine := image.FileHeader.Machine
	_ = image.Close()
	want := uint16(pe.IMAGE_FILE_MACHINE_AMD64)
	if runtime.GOARCH == "arm64" {
		want = pe.IMAGE_FILE_MACHINE_ARM64
	}
	if machine != want {
		loaderErr = errors.New("packaged WebView2Loader.dll has the wrong architecture")
		return
	}
	loaderHandle, err = windows.LoadLibraryEx(path, 0, windows.LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|windows.LOAD_LIBRARY_SEARCH_SYSTEM32)
	if err == nil {
		loaderCreate, err = windows.GetProcAddress(loaderHandle, "CreateCoreWebView2EnvironmentWithOptions")
	}
	if err != nil {
		if loaderHandle != 0 {
			_ = windows.FreeLibrary(loaderHandle)
			loaderHandle = 0
		}
		loaderErr = fmt.Errorf("load packaged WebView2 loader: %w", err)
	}
	// Keep this single DLL loaded for the process lifetime. Environment creation
	// callbacks may finish after a pane closes; unloading under them is unsafe.
}

func (d *windowsDriver) Open(id, raw string, bounds Bounds) (view, error) {
	if windows.GetCurrentThreadId() == d.uiThread {
		return nil, errors.New("browser creation must be called outside the UI thread")
	}
	v := &windowsView{driver: d, id: id, parent: d.parent, ready: make(chan error, 1), done: make(chan struct{}), pending: make(map[uint64]chan scriptResult), children: make(map[*windowsView]struct{})}
	d.config.DispatchSync(func() {
		if d.closed {
			v.complete(errBrowserClosed)
			return
		}
		d.views[v] = struct{}{}
		v.create(raw, bounds)
	})
	// Only this caller waits. The UI closures and COM callbacks never wait for
	// another callback or for a goroutine that needs the UI thread.
	timer := time.NewTimer(15 * time.Second)
	defer timer.Stop()
	select {
	case err := <-v.ready:
		if err != nil {
			return nil, err
		}
		go v.watchConsole()
		return v, nil
	case <-timer.C:
		_ = v.Close()
		return nil, errors.New("native browser creation timed out")
	}
}

func (v *windowsView) create(raw string, bounds Bounds) {
	profile, err := windows.UTF16PtrFromString(filepath.Clean(v.driver.config.ProfileDir))
	if err != nil {
		v.complete(err)
		return
	}
	callback := newCallback(iidEnvironmentReady, func(hr uintptr, result unsafe.Pointer) uintptr {
		if v.closed {
			return 0
		}
		if err := hresult(hr); err != nil || result == nil {
			v.complete(errors.Join(errors.New("create browser environment"), err))
			return 0
		}
		v.environment = (*webviewObject)(result)
		v.environment.addRef()
		controller := newCallback(iidControllerReady, func(hr uintptr, result unsafe.Pointer) uintptr {
			if v.closed {
				if result != nil {
					_ = (*webviewObject)(result).call(controllerClose)
				}
				return 0
			}
			if err := hresult(hr); err != nil || result == nil {
				v.complete(errors.Join(errors.New("create browser controller"), err))
				return 0
			}
			v.controller = (*webviewObject)(result)
			v.controller.addRef()
			v.initialise(raw, bounds)
			return 0
		})
		err := v.environment.call(3, v.parent, controller.pointer())
		controller.release()
		if err != nil {
			v.complete(err)
		}
		return 0
	})
	hr, _, _ := syscall.SyscallN(loaderCreate, 0, uintptr(unsafe.Pointer(profile)), 0, callback.pointer())
	runtime.KeepAlive(profile)
	callback.release()
	if err := hresult(hr); err != nil {
		v.complete(err)
	}
}

func (v *windowsView) initialise(raw string, bounds Bounds) {
	var parent uintptr
	if err := v.controller.call(controllerParent, uintptr(unsafe.Pointer(&parent))); err != nil || parent != v.parent {
		v.complete(errors.Join(errors.New("browser controller has the wrong parent"), err))
		return
	}
	var err error
	v.core, err = v.controller.object(controllerCore)
	if err != nil || v.core == nil {
		v.complete(errors.Join(errors.New("read browser controller"), err))
		return
	}
	settings, err := v.core.object(coreGetSettings)
	if err != nil || settings == nil {
		v.complete(errors.Join(errors.New("read browser settings"), err))
		return
	}
	// Keep ordinary browser APIs and inspection, but disable both host objects
	// and host messages. Diagnostics return only through owned Eval callbacks.
	err = errors.Join(settings.call(16, 0), settings.call(6, 0), settings.call(12, 1))
	settings.release()
	if err != nil {
		v.complete(err)
		return
	}
	if err := v.setBounds(bounds); err != nil {
		v.complete(err)
		return
	}
	if err := v.registerEvents(); err != nil {
		v.complete(err)
		return
	}
	// Wait for the document-created script registration before the first
	// navigation, so the first document's console is captured too.
	callback := newCallback(iidDocumentScript, func(hr uintptr, _ unsafe.Pointer) uintptr {
		if v.closed {
			return 0
		}
		err := hresult(hr)
		if err == nil && v.owner == nil {
			err = v.core.textArg(coreNavigate, raw)
		}
		if err == nil {
			err = v.controller.call(controllerVisible, 1)
		}
		v.complete(err)
		return 0
	})
	err = v.core.textArg(coreAddDocumentScript, v.driver.config.DevtoolsScript, callback.pointer())
	callback.release()
	if err != nil {
		v.complete(err)
	}
}

func (v *windowsView) complete(err error) {
	if v.initDone {
		return
	}
	v.initDone = true
	if err != nil {
		_ = v.closeUI()
	}
	v.ready <- err
	if v.onReady != nil {
		ready := v.onReady
		v.onReady = nil
		ready(err)
	}
}

func (v *windowsView) addEvent(method int, iid windows.GUID, fn func(a uintptr, b unsafe.Pointer) uintptr) error {
	callback := newCallback(iid, func(a uintptr, b unsafe.Pointer) uintptr {
		if v.closed {
			return 0
		}
		return fn(a, b)
	})
	defer callback.release()
	var token int64
	if err := v.core.call(method, callback.pointer(), uintptr(unsafe.Pointer(&token))); err != nil {
		return err
	}
	v.registered = append(v.registered, eventRegistration{method + 1, token})
	return nil
}

func (v *windowsView) registerEvents() error {
	navigate := func(frame bool) func(uintptr, unsafe.Pointer) uintptr {
		return func(_ uintptr, args unsafe.Pointer) uintptr {
			a := (*webviewObject)(args)
			raw, err := a.text(3, maxBrowserMessage)
			if err != nil {
				_ = a.call(8, 1)
				return 0
			}
			u, err := url.Parse(raw)
			if err == nil && u.Scheme == "berth-pick" {
				_ = a.call(8, 1)
				if u.Host == "pick" && v.owner == nil {
					v.driver.config.Emit("berth://browser-pick", PickEvent{ID: v.id, URL: raw})
				}
				return 0
			}
			if !allowsPageNavigation(raw, frame) {
				_ = a.call(8, 1)
				return 0
			}
			if checkURL(raw) == nil {
				v.emitBrowser(raw, "started")
			}
			return 0
		}
	}
	for _, event := range []struct {
		method int
		iid    windows.GUID
		fn     func(a uintptr, b unsafe.Pointer) uintptr
	}{
		{coreNavigationStart, iidNavigationStart, navigate(false)},
		{coreFrameStart, iidNavigationStart, navigate(true)},
		{coreContentLoading, iidContentLoading, func(_ uintptr, _ unsafe.Pointer) uintptr { v.emitNavigation("committed"); return 0 }},
		{coreSourceChanged, iidSourceChanged, func(_ uintptr, _ unsafe.Pointer) uintptr { v.emitNavigation("moved"); return 0 }},
		{coreNavigationDone, iidNavigationDone, func(_ uintptr, _ unsafe.Pointer) uintptr {
			// The existing browser event contract finishes both successful and
			// failed loads. WebView2 displays its own error document on failure.
			v.emitNavigation("finished")
			return 0
		}},
		{coreNewWindow, iidNewWindow, func(_ uintptr, args unsafe.Pointer) uintptr {
			v.openPopup((*webviewObject)(args))
			return 0
		}},
	} {
		if err := v.addEvent(event.method, event.iid, event.fn); err != nil {
			return err
		}
	}
	if v.owner != nil {
		return v.registerPopupEvents()
	}
	return nil
}

func allowsPageNavigation(raw string, frame bool) bool {
	if checkURL(raw) == nil {
		return true
	}
	u, err := url.Parse(raw)
	return frame && err == nil && u.Scheme == "about" && (u.Opaque == "blank" || u.Opaque == "srcdoc")
}

func (v *windowsView) emitConsoleReport(raw string) {
	if len(raw) > maxBrowserMessage {
		return
	}
	var report struct {
		Version int               `json:"v"`
		Entries []json.RawMessage `json:"entries"`
	}
	if json.Unmarshal([]byte(raw), &report) == nil && report.Version == 1 && report.Entries != nil {
		// The page controls this report, including any ID inside it. The
		// envelope's identity always comes from the owned native controller.
		v.driver.config.Emit("berth://browser-console", ConsoleEvent{ID: v.id, Data: raw})
	}
}

func (v *windowsView) emitNavigation(state string) {
	if raw, err := v.core.text(coreGetSource, maxBrowserMessage); err == nil && checkURL(raw) == nil {
		v.emitBrowser(raw, state)
	}
}

func (v *windowsView) emitBrowser(raw, state string) {
	if v.owner == nil {
		v.driver.config.Emit("berth://browser", Event{ID: v.id, URL: raw, State: state})
	}
}

type browserRect struct{ Left, Top, Right, Bottom int32 }

func (v *windowsView) setBounds(b Bounds) error {
	dpi, _, _ := dpiForWindow.Call(v.parent)
	if dpi == 0 {
		return errors.New("read browser parent DPI")
	}
	scale := float64(dpi) / 96
	coordinate := func(n float64) int32 {
		return int32(math.Max(math.Min(math.Round(n*scale), math.MaxInt32), math.MinInt32))
	}
	r := browserRect{coordinate(b.X), coordinate(b.Y), coordinate(b.X + math.Max(1, b.Width)), coordinate(b.Y + math.Max(1, b.Height))}
	return v.putBounds(r)
}

func (v *windowsView) putBounds(r browserRect) error {
	var err error
	if runtime.GOARCH == "arm64" {
		words := (*[2]uintptr)(unsafe.Pointer(&r))
		err = v.controller.call(controllerBounds, words[0], words[1])
	} else {
		err = v.controller.call(controllerBounds, uintptr(unsafe.Pointer(&r)))
	}
	runtime.KeepAlive(r)
	if err == nil {
		err = v.controller.call(controllerMoved)
	}
	return err
}

func (v *windowsView) onUI(fn func() error) error {
	var err error
	v.driver.config.DispatchSync(func() {
		if v.closed || v.core == nil {
			err = errBrowserClosed
			return
		}
		err = fn()
	})
	return err
}
func (v *windowsView) SetBounds(b Bounds) error {
	return v.onUI(func() error { return v.setBounds(b) })
}
func (v *windowsView) Show() error {
	return v.onUI(func() error { return v.controller.call(controllerVisible, 1) })
}
func (v *windowsView) Hide() error {
	return v.onUI(func() error { return v.controller.call(controllerVisible, 0) })
}
func (v *windowsView) Navigate(raw string) error {
	return v.onUI(func() error { return v.core.textArg(coreNavigate, raw) })
}
func (v *windowsView) Back() error { return v.onUI(func() error { return v.core.call(coreBack) }) }
func (v *windowsView) Forward() error {
	return v.onUI(func() error { return v.core.call(coreForward) })
}
func (v *windowsView) Reload() error { return v.onUI(func() error { return v.core.call(coreReload) }) }
func (v *windowsView) Inspect() error {
	return v.onUI(func() error { return v.core.call(coreOpenDevtools) })
}

func (v *windowsView) Eval(ctx context.Context, script string) (string, error) {
	if windows.GetCurrentThreadId() == v.driver.uiThread {
		return "", errors.New("browser evaluation must be called outside the UI thread")
	}
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if len(script) > maxBrowserMessage {
		return "", errors.New("browser script is too large")
	}
	result := make(chan scriptResult, 1)
	if err := v.onUI(func() error {
		if err := ctx.Err(); err != nil {
			return err
		}
		if len(v.pending) >= 8 {
			return errors.New("browser has too many pending evaluations")
		}
		v.nextEval++
		key := v.nextEval
		v.pending[key] = result
		callback := newCallback(iidExecuteScript, func(hr uintptr, value unsafe.Pointer) uintptr {
			if channel := v.pending[key]; channel != nil {
				delete(v.pending, key)
				text, err := readUTF16((*uint16)(value), maxBrowserMessage)
				channel <- scriptResult{text, errors.Join(hresult(hr), err)}
			}
			return 0
		})
		err := v.core.textArg(coreExecuteScript, script, callback.pointer())
		callback.release()
		if err != nil {
			delete(v.pending, key)
		}
		return err
	}); err != nil {
		return "", err
	}
	select {
	case answer := <-result:
		return answer.text, answer.err
	case <-ctx.Done():
		return "", ctx.Err()
	case <-v.done:
		return "", errBrowserClosed
	}
}

func (v *windowsView) watchConsole() {
	tick := time.NewTicker(500 * time.Millisecond)
	defer tick.Stop()
	for {
		select {
		case <-v.done:
			return
		case <-tick.C:
			v.driver.config.DispatchSync(func() {
				if v.closed || v.draining {
					return
				}
				v.draining = true
				callback := newCallback(iidExecuteScript, func(hr uintptr, result unsafe.Pointer) uintptr {
					v.draining = false
					if v.closed || hresult(hr) != nil {
						return 0
					}
					text, err := readUTF16((*uint16)(result), maxBrowserMessage)
					var data string
					if err == nil && json.Unmarshal([]byte(text), &data) == nil && data != "" {
						v.emitConsoleReport(data)
					}
					return 0
				})
				if err := v.core.textArg(coreExecuteScript, consoleDrain, callback.pointer()); err != nil {
					v.draining = false
				}
				callback.release()
			})
		}
	}
}

func (v *windowsView) closeUI() error {
	if v.closed {
		return nil
	}
	v.closed = true
	close(v.done)
	for child := range v.children {
		_ = child.closeUI()
	}
	if !v.initDone {
		v.initDone = true
		v.ready <- errBrowserClosed
		if v.onReady != nil {
			ready := v.onReady
			v.onReady = nil
			ready(errBrowserClosed)
		}
	}
	for key, result := range v.pending {
		result <- scriptResult{err: errBrowserClosed}
		delete(v.pending, key)
	}
	var errs []error
	if v.core != nil {
		for _, event := range v.registered {
			errs = append(errs, v.core.call(event.remove, uintptr(event.token)))
		}
	}
	if v.controller != nil {
		errs = append(errs, v.controller.call(controllerClose))
	}
	v.core.release()
	v.controller.release()
	v.environment.release()
	v.core, v.controller, v.environment = nil, nil, nil
	delete(v.driver.views, v)
	if v.owner != nil {
		delete(v.owner.children, v)
		v.destroyPopupHost()
	}
	return errors.Join(errs...)
}
func (v *windowsView) Close() error {
	var err error
	v.driver.config.DispatchSync(func() { err = v.closeUI() })
	return err
}
func (d *windowsDriver) Close() error {
	var errs []error
	d.config.DispatchSync(func() {
		if d.closed {
			return
		}
		d.closed = true
		for v := range d.views {
			errs = append(errs, v.closeUI())
		}
	})
	return errors.Join(errs...)
}
