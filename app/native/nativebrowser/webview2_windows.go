//go:build windows

package nativebrowser

// These are the small public Win32 WebView2 interfaces used by browser panes.
// Method order is checked against the SDK bindings vendored in Wails beta.28.
// There are deliberately no Wails runtime, host object or resource interfaces.

import (
	"errors"
	"fmt"
	"runtime"
	"sync"
	"sync/atomic"
	"syscall"
	"unicode/utf16"
	"unsafe"

	"golang.org/x/sys/windows"
)

type webviewObject struct{ table *[61]uintptr }

const (
	coreGetSettings       = 3
	coreGetSource         = 4
	coreNavigate          = 5
	coreNavigationStart   = 7
	coreContentLoading    = 9
	coreSourceChanged     = 11
	coreNavigationDone    = 15
	coreFrameStart        = 17
	coreAddDocumentScript = 27
	coreExecuteScript     = 29
	coreReload            = 31
	coreBack              = 40
	coreForward           = 41
	coreNewWindow         = 44
	coreOpenDevtools      = 51
	controllerVisible     = 4
	controllerBounds      = 6
	controllerParent      = 21
	controllerMoved       = 23
	controllerClose       = 24
	controllerCore        = 25
)

func hresult(hr uintptr) error {
	if int32(hr) < 0 {
		return fmt.Errorf("WebView2 HRESULT 0x%08x", uint32(hr))
	}
	return nil
}

//go:uintptrescapes
func (o *webviewObject) call(method int, args ...uintptr) error {
	if o == nil {
		return errors.New("WebView2 interface is unavailable")
	}
	a := append([]uintptr{uintptr(unsafe.Pointer(o))}, args...)
	hr, _, _ := syscall.SyscallN(o.table[method], a...)
	runtime.KeepAlive(o)
	return hresult(hr)
}

func (o *webviewObject) addRef() {
	if o != nil {
		_ = o.call(1)
	}
}
func (o *webviewObject) release() {
	if o != nil {
		_ = o.call(2)
	}
}
func (o *webviewObject) object(method int) (*webviewObject, error) {
	var result *webviewObject
	err := o.call(method, uintptr(unsafe.Pointer(&result)))
	return result, err
}
func (o *webviewObject) text(method, limit int) (string, error) {
	var result *uint16
	if err := o.call(method, uintptr(unsafe.Pointer(&result))); err != nil {
		return "", err
	}
	if result == nil {
		return "", nil
	}
	defer coTaskMemFree.Call(uintptr(unsafe.Pointer(result)))
	return readUTF16(result, limit)
}
func (o *webviewObject) textArg(method int, text string, args ...uintptr) error {
	p, err := windows.UTF16PtrFromString(text)
	if err != nil {
		return err
	}
	err = o.call(method, append([]uintptr{uintptr(unsafe.Pointer(p))}, args...)...)
	runtime.KeepAlive(p)
	return err
}

// Native callback results are copied while their COM-owned string is valid.
// Read only up to the limit, even if a remote page sends a huge message.
func readUTF16(p *uint16, limit int) (string, error) {
	if p == nil {
		return "", nil
	}
	units := make([]uint16, 0, 256)
	for i := 0; i <= limit; i++ {
		c := *(*uint16)(unsafe.Add(unsafe.Pointer(p), i*2))
		if c == 0 {
			text := string(utf16.Decode(units))
			if len(text) <= limit {
				return text, nil
			}
			break
		}
		units = append(units, c)
	}
	return "", errors.New("WebView2 message exceeds the size limit")
}

var coTaskMemFree = windows.NewLazySystemDLL("ole32.dll").NewProc("CoTaskMemFree")

// One native vtable serves every callback. Allocate a COM object per operation,
// not a NewCallback trampoline per Eval, which would exhaust Go's fixed table.
// The registry roots the object until COM releases its last reference.
type webviewCallback struct {
	table *[4]uintptr
	iid   windows.GUID
	refs  atomic.Int32
	fn    func(a uintptr, b unsafe.Pointer) uintptr
}

var callbacks = struct {
	sync.RWMutex
	objects map[uintptr]*webviewCallback
}{objects: make(map[uintptr]*webviewCallback)}

var callbackTable = [4]uintptr{
	windows.NewCallback(callbackQuery),
	windows.NewCallback(callbackAddRef),
	windows.NewCallback(callbackRelease),
	windows.NewCallback(callbackInvoke),
}

func callbackAt(this uintptr) *webviewCallback {
	callbacks.RLock()
	c := callbacks.objects[this]
	callbacks.RUnlock()
	return c
}
func callbackQuery(this *webviewCallback, requested *windows.GUID, result *unsafe.Pointer) uintptr {
	if result == nil {
		return 0x80004003 // E_POINTER
	}
	*result = nil
	c := callbackAt(this.pointer())
	if c == nil || requested == nil {
		return 0x80004002 // E_NOINTERFACE
	}
	iid := *requested
	if iid != iidUnknown && iid != c.iid {
		return 0x80004002
	}
	c.refs.Add(1)
	*result = unsafe.Pointer(this)
	return 0
}
func callbackAddRef(this *webviewCallback) uintptr {
	if c := callbackAt(this.pointer()); c != nil {
		return uintptr(c.refs.Add(1))
	}
	return 0
}
func callbackRelease(this *webviewCallback) uintptr {
	c := callbackAt(this.pointer())
	if c == nil {
		return 0
	}
	n := c.refs.Add(-1)
	if n == 0 {
		callbacks.Lock()
		delete(callbacks.objects, this.pointer())
		callbacks.Unlock()
	}
	return uintptr(n)
}
func callbackInvoke(this *webviewCallback, a uintptr, b unsafe.Pointer) uintptr {
	if c := callbackAt(this.pointer()); c != nil {
		return c.fn(a, b)
	}
	return 0
}
func newCallback(iid windows.GUID, fn func(a uintptr, b unsafe.Pointer) uintptr) *webviewCallback {
	c := &webviewCallback{table: &callbackTable, iid: iid, fn: fn}
	c.refs.Store(1)
	callbacks.Lock()
	callbacks.objects[c.pointer()] = c
	callbacks.Unlock()
	return c
}
func (c *webviewCallback) pointer() uintptr { return uintptr(unsafe.Pointer(c)) }
func (c *webviewCallback) release()         { callbackRelease(c) }

func guid(text string) windows.GUID {
	g, err := windows.GUIDFromString(text)
	if err != nil {
		panic(err)
	}
	return g
}

var (
	iidUnknown          = guid("{00000000-0000-0000-C000-000000000046}")
	iidEnvironmentReady = guid("{4E8A3389-C9D8-4BD2-B6B5-124FEE6CC14D}")
	iidControllerReady  = guid("{6C4819F3-C9B7-4260-8127-C9F5BDE7F68C}")
	iidDocumentScript   = guid("{B99369F3-9B11-47B5-BC6F-8E7895FCEA17}")
	iidExecuteScript    = guid("{49511172-CC67-4BCA-9923-137112F4C4CC}")
	iidNavigationStart  = guid("{9ADBE429-F36D-432B-9DDC-F8881FBD76E3}")
	iidContentLoading   = guid("{364471E7-F2BE-4910-BDBA-D72077D51C4B}")
	iidSourceChanged    = guid("{3C067F9F-5388-4772-8B48-79F7EF1AB37C}")
	iidNavigationDone   = guid("{D33A35BF-1C49-4F98-93AB-006E0533FE1C}")
	iidNewWindow        = guid("{D4C185FE-C81C-4989-97AF-2D3FA7AB5651}")
)
