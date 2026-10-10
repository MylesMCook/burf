//go:build windows

package nativebrowser

import (
	"errors"
	"fmt"
	"sync"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	registerClass     = user32.NewProc("RegisterClassW")
	createWindow      = user32.NewProc("CreateWindowExW")
	destroyWindow     = user32.NewProc("DestroyWindow")
	defaultWindow     = user32.NewProc("DefWindowProcW")
	showWindow        = user32.NewProc("ShowWindow")
	getClientRect     = user32.NewProc("GetClientRect")
	setWindowText     = user32.NewProc("SetWindowTextW")
	loadCursor        = user32.NewProc("LoadCursorW")
	moduleHandle      = windows.NewLazySystemDLL("kernel32.dll").NewProc("GetModuleHandleW")
	popupClassOnce    sync.Once
	popupClassErr     error
	popupProcedure    = windows.NewCallback(popupWindowProc)
	popupClassName, _ = windows.UTF16PtrFromString("BurfIsolatedBrowserPopup")
)

var popupHosts = struct {
	sync.Mutex
	views map[uintptr]*windowsView
}{views: make(map[uintptr]*windowsView)}

type popupWindowClass struct {
	Style       uint32
	Procedure   uintptr
	ClassExtra  int32
	WindowExtra int32
	Instance    uintptr
	Icon        uintptr
	Cursor      uintptr
	Background  uintptr
	Menu        *uint16
	Name        *uint16
}

func registerPopupClass() {
	instance, _, _ := moduleHandle.Call(0)
	cursor, _, _ := loadCursor.Call(0, 32512) // IDC_ARROW
	class := popupWindowClass{Procedure: popupProcedure, Instance: instance, Cursor: cursor, Background: 6, Name: popupClassName}
	atom, _, err := registerClass.Call(uintptr(unsafe.Pointer(&class)))
	if atom == 0 {
		popupClassErr = fmt.Errorf("register isolated browser popup: %w", err)
	}
}

func (v *windowsView) openPopup(args *webviewObject) {
	// Always handle the request ourselves. A failed or cancelled creation must
	// not fall through to an untracked WebView2 window.
	if args.call(6, 1) != nil {
		return
	}
	raw, err := args.text(3, maxBrowserMessage)
	if err != nil || checkURL(raw) != nil {
		return
	}
	popups := 0
	for candidate := range v.driver.views {
		if candidate.owner != nil {
			popups++
		}
	}
	if popups >= 16 {
		return
	}
	deferral, err := args.object(9)
	if err != nil || deferral == nil {
		return
	}
	args.addRef()
	popup := &windowsView{
		driver: v.driver, id: v.id, owner: v,
		ready: make(chan error, 1), done: make(chan struct{}),
		pending: make(map[uint64]chan scriptResult), children: make(map[*windowsView]struct{}),
	}
	popup.onReady = func(err error) {
		defer args.release()
		defer deferral.release()
		if err == nil && (v.closed || popup.closed) {
			err = errBrowserClosed
		}
		if err == nil && !v.closed && !popup.closed {
			err = args.call(4, uintptr(unsafe.Pointer(popup.core)))
			if err == nil {
				showWindow.Call(popup.parent, 1) // SW_SHOWNORMAL
			}
		}
		// Complete exactly once even when the owning pane closes during the
		// asynchronous controller or document-script registration.
		if completeErr := deferral.call(3); err == nil {
			err = completeErr
		}
		if err != nil {
			_ = popup.closeUI()
		}
	}
	v.children[popup] = struct{}{}
	v.driver.views[popup] = struct{}{}
	if err := popup.createPopupHost(); err != nil {
		popup.complete(err)
		return
	}
	// NewWindow must use an independently owned controller in the opener's
	// environment. Sharing that environment preserves cookies and opener/login
	// semantics without giving the popup a Wails bridge.
	popup.environment = v.environment
	popup.environment.addRef()
	controller := newCallback(iidControllerReady, func(hr uintptr, result unsafe.Pointer) uintptr {
		if popup.closed {
			if result != nil {
				_ = (*webviewObject)(result).call(controllerClose)
			}
			return 0
		}
		if err := hresult(hr); err != nil || result == nil {
			popup.complete(errors.Join(errors.New("create popup browser controller"), err))
			return 0
		}
		popup.controller = (*webviewObject)(result)
		popup.controller.addRef()
		var rect browserRect
		getClientRect.Call(popup.parent, uintptr(unsafe.Pointer(&rect)))
		dpi, _, _ := dpiForWindow.Call(popup.parent)
		scale := float64(dpi) / 96
		if dpi == 0 {
			popup.complete(errors.New("read popup DPI"))
			return 0
		}
		popup.initialise(raw, Bounds{Width: float64(rect.Right) / scale, Height: float64(rect.Bottom) / scale})
		return 0
	})
	err = popup.environment.call(3, popup.parent, controller.pointer())
	controller.release()
	if err != nil {
		popup.complete(err)
		return
	}
	go func() {
		timer := time.NewTimer(15 * time.Second)
		defer timer.Stop()
		select {
		case <-popup.ready:
		case <-popup.done:
		case <-timer.C:
			_ = popup.Close()
		}
	}()
}

func (v *windowsView) createPopupHost() error {
	popupClassOnce.Do(registerPopupClass)
	if popupClassErr != nil {
		return popupClassErr
	}
	title, _ := windows.UTF16PtrFromString("Browser")
	instance, _, _ := moduleHandle.Call(0)
	dpi, _, _ := dpiForWindow.Call(v.owner.parent)
	if dpi == 0 {
		return errors.New("read popup owner DPI")
	}
	const overlappedWindow = 0x00cf0000
	const clipChildren = 0x02000000
	const defaultPosition = 0x80000000
	host, _, err := createWindow.Call(0, uintptr(unsafe.Pointer(popupClassName)), uintptr(unsafe.Pointer(title)), overlappedWindow|clipChildren,
		defaultPosition, defaultPosition, 800*dpi/96, 600*dpi/96, v.owner.parent, 0, instance, 0)
	if host == 0 {
		return fmt.Errorf("create isolated browser popup: %w", err)
	}
	v.parent = host
	popupHosts.Lock()
	popupHosts.views[host] = v
	popupHosts.Unlock()
	return nil
}

func (v *windowsView) resizePopup() {
	if v.closed || v.controller == nil {
		return
	}
	var rect browserRect
	if ok, _, _ := getClientRect.Call(v.parent, uintptr(unsafe.Pointer(&rect))); ok != 0 {
		_ = v.putBounds(rect)
	}
}

func (v *windowsView) destroyPopupHost() {
	host := v.parent
	if host == 0 {
		return
	}
	v.parent = 0
	popupHosts.Lock()
	delete(popupHosts.views, host)
	popupHosts.Unlock()
	destroyWindow.Call(host)
}

func popupWindowProc(host uintptr, message uint32, wParam, lParam uintptr) uintptr {
	popupHosts.Lock()
	v := popupHosts.views[host]
	popupHosts.Unlock()
	if v != nil {
		switch message {
		case 0x0005, 0x02e0: // WM_SIZE, WM_DPICHANGED
			v.resizePopup()
		case 0x0010: // WM_CLOSE
			_ = v.closeUI()
			return 0
		case 0x0002: // WM_DESTROY, including destruction of its owning window
			popupHosts.Lock()
			delete(popupHosts.views, host)
			popupHosts.Unlock()
			v.parent = 0
			_ = v.closeUI()
		}
	}
	result, _, _ := defaultWindow.Call(host, uintptr(message), wParam, lParam)
	return result
}

func (v *windowsView) registerPopupEvents() error {
	if err := v.addEvent(46, guid("{F5F2B923-953E-4042-9F95-F3A118E1AFD4}"), func(_ uintptr, _ unsafe.Pointer) uintptr {
		if title, err := v.core.text(48, 2048); err == nil {
			p, err := windows.UTF16PtrFromString(title)
			if err == nil {
				setWindowText.Call(v.parent, uintptr(unsafe.Pointer(p)))
			}
		}
		return 0
	}); err != nil {
		return err
	}
	return v.addEvent(59, guid("{5C19E9E0-092F-486B-AFFA-CA8231913039}"), func(_ uintptr, _ unsafe.Pointer) uintptr {
		_ = v.closeUI()
		return 0
	})
}
