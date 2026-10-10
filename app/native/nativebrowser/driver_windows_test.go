//go:build windows

package nativebrowser

import (
	"context"
	"errors"
	"strings"
	"testing"
	"unicode/utf16"
	"unsafe"
)

func TestRemoteDiagnosticsKeepTheControllerID(t *testing.T) {
	var events []ConsoleEvent
	v := &windowsView{id: "owned-pane", driver: &windowsDriver{config: Config{Emit: func(name string, payload any) {
		if name != "berth://browser-console" {
			t.Fatalf("unexpected event %q", name)
		}
		events = append(events, payload.(ConsoleEvent))
	}}}}
	data := `{"v":1,"entries":[],"id":"trusted-main"}`
	v.emitConsoleReport(data)
	if len(events) != 1 || events[0].ID != "owned-pane" || events[0].Data != data {
		t.Fatalf("remote message replaced controller identity: %#v", events)
	}
	for _, raw := range []string{
		`{"event":"go-call","data":"{}"}`,
		`{"v":1,"entries":"not an array"}`,
		`{"v":2,"entries":[]}`,
		`{"v":1,"entries":null}`,
		strings.Repeat(" ", maxBrowserMessage+1),
		`{"v":1,"entries":[]}` + strings.Repeat(" ", maxBrowserMessage),
	} {
		v.emitConsoleReport(raw)
	}
	if len(events) != 1 {
		t.Fatalf("accepted invalid or oversized remote diagnostics: %#v", events)
	}
}

func TestNativeStringsAreBoundedInBytes(t *testing.T) {
	for _, text := range []string{"", "plain", "an emoji 🦗", "éééé"} {
		units := append(utf16.Encode([]rune(text)), 0)
		got, err := readUTF16(&units[0], len(text))
		if err != nil || got != text {
			t.Fatalf("read %q: %q, %v", text, got, err)
		}
		if text != "" {
			if _, err := readUTF16(&units[0], len(text)-1); err == nil {
				t.Fatalf("accepted %q beyond byte limit", text)
			}
		}
	}
}

func TestCallbackLivesUntilTheNativeOwnerReleasesIt(t *testing.T) {
	c := newCallback(iidExecuteScript, func(a uintptr, _ unsafe.Pointer) uintptr { return a + 3 })
	pointer := c.pointer()
	if callbackAddRef(c) != 2 {
		t.Fatal("native reference was not retained")
	}
	c.release()
	if callbackAt(pointer) == nil || callbackInvoke(c, 2, nil) != 5 {
		t.Fatal("callback was removed before native completion")
	}
	if callbackRelease(c) != 0 || callbackAt(pointer) != nil {
		t.Fatal("completed callback stayed rooted")
	}
	if callbackQuery(c, nil, nil) != 0x80004003 {
		t.Fatal("null QueryInterface result was accepted")
	}
}

func TestCloseSettlesCreationAndPendingScripts(t *testing.T) {
	d := &windowsDriver{views: make(map[*windowsView]struct{})}
	v := &windowsView{driver: d, ready: make(chan error, 1), done: make(chan struct{}), pending: make(map[uint64]chan scriptResult)}
	result := make(chan scriptResult, 1)
	v.pending[1] = result
	d.views[v] = struct{}{}
	if err := v.closeUI(); err != nil {
		t.Fatal(err)
	}
	if err := <-v.ready; !errors.Is(err, errBrowserClosed) {
		t.Fatalf("unfinished creation was not cancelled: %v", err)
	}
	if got := <-result; !errors.Is(got.err, errBrowserClosed) {
		t.Fatalf("unfinished script was not cancelled: %v", got.err)
	}
	select {
	case <-v.done:
	default:
		t.Fatal("console watcher did not get its stop signal")
	}
	if len(d.views) != 0 || len(v.pending) != 0 {
		t.Fatal("closed pane retained pending work")
	}
	if err := v.closeUI(); err != nil {
		t.Fatal("closing a pane twice should be safe", err)
	}
}

func TestCancelledEvaluationDoesNotStartAfterDispatch(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	d := &windowsDriver{config: Config{DispatchSync: func(fn func()) { cancel(); fn() }}}
	v := &windowsView{driver: d, core: &webviewObject{}, done: make(chan struct{}), pending: make(map[uint64]chan scriptResult)}
	if _, err := v.Eval(ctx, "installPicker()"); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled evaluation started: %v", err)
	}
	if len(v.pending) != 0 {
		t.Fatal("cancelled evaluation allocated native work")
	}
}

func TestParentCloseCancelsItsNestedPopups(t *testing.T) {
	d := &windowsDriver{views: make(map[*windowsView]struct{})}
	parent := &windowsView{driver: d, done: make(chan struct{}), initDone: true, children: make(map[*windowsView]struct{})}
	child := &windowsView{driver: d, owner: parent, done: make(chan struct{}), initDone: true, children: make(map[*windowsView]struct{})}
	grandchild := &windowsView{driver: d, owner: child, done: make(chan struct{}), ready: make(chan error, 1)}
	completions := 0
	grandchild.onReady = func(err error) {
		if !errors.Is(err, errBrowserClosed) {
			t.Fatalf("popup completed after parent closed: %v", err)
		}
		completions++
	}
	parent.children[child] = struct{}{}
	child.children[grandchild] = struct{}{}
	for _, v := range []*windowsView{parent, child, grandchild} {
		d.views[v] = struct{}{}
	}
	if err := parent.closeUI(); err != nil {
		t.Fatal(err)
	}
	if !child.closed || !grandchild.closed || len(d.views) != 0 || len(parent.children) != 0 || completions != 1 {
		t.Fatal("parent closure left a popup or deferred creation alive")
	}
	if err := parent.closeUI(); err != nil || completions != 1 {
		t.Fatal("parent closure completed a popup twice")
	}
}

func TestOnlyInertSubframesCanNavigateWithoutHTTP(t *testing.T) {
	for _, raw := range []string{"https://example.com/login", "http://localhost:3000/"} {
		if !allowsPageNavigation(raw, false) || !allowsPageNavigation(raw, true) {
			t.Fatalf("HTTP page was blocked: %s", raw)
		}
	}
	for _, raw := range []string{"about:blank", "about:srcdoc"} {
		if allowsPageNavigation(raw, false) || !allowsPageNavigation(raw, true) {
			t.Fatalf("inert document escaped its frame boundary: %s", raw)
		}
	}
	for _, raw := range []string{"file:///C:/secret", "javascript:alert(1)", "data:text/html,test", "about:config", "https://user:password@example.com/"} {
		if allowsPageNavigation(raw, false) || allowsPageNavigation(raw, true) {
			t.Fatalf("unsupported navigation was allowed: %s", raw)
		}
	}
}
