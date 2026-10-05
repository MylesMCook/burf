package proxy

import (
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
)

// devPage stands in for a dev server whose pages refuse framing, as many
// do (helmet, Rails, Django): it reports what it received in headers.
func devPage(t *testing.T) int {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Seen-Query", r.URL.RawQuery)
		w.Header().Set("X-Seen-Cookie", r.Header.Get("Cookie"))
		w.Header().Set("X-Seen-Accept-Encoding", r.Header.Get("Accept-Encoding"))
		w.Header().Set("X-Seen-Preview-Header", r.Header.Get(PreviewHeader))
		w.Header().Set("X-Seen-If-None-Match", r.Header.Get("If-None-Match"))
		switch r.URL.Path {
		case "/login":
			http.SetCookie(w, &http.Cookie{Name: "session", Value: "abc", Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode})
			http.Redirect(w, r, "http://localhost:"+strconv.Itoa(portOf(r.Host))+"/home", http.StatusFound)
		case "/api":
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Frame-Options", "DENY")
			io.WriteString(w, `{"ok":true}`)
		default:
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("X-Frame-Options", "SAMEORIGIN")
			w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; frame-ancestors 'self'")
			w.Header().Set("ETag", `"v1"`)
			io.WriteString(w, "<!doctype html><html lang=en><head><title>shop</title></head><body><header>Shop</header></body></html>")
		}
	}))
	t.Cleanup(srv.Close)
	return srv.Listener.Addr().(*net.TCPAddr).Port
}

func read(t *testing.T, resp *http.Response) string {
	t.Helper()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

var iframe = http.Header{"Sec-Fetch-Dest": {"iframe"}}

func TestPreviewScriptOnlyGoesToAPreviewFrame(t *testing.T) {
	port := devPage(t)
	host := strconv.Itoa(port) + ".devl.localhost:1377"
	p := newProxy()

	// Normal browsing: the page exactly as the dev server sent it.
	plain := get(t, p, host, "/", http.Header{"Sec-Fetch-Dest": {"document"}, "Accept-Encoding": {"gzip"}})
	if body := read(t, plain); strings.Contains(body, "data-berth-preview") {
		t.Fatalf("normal browsing got the preview script: %q", body)
	}
	if plain.Header.Get("X-Frame-Options") != "SAMEORIGIN" || !strings.Contains(plain.Header.Get("Content-Security-Policy"), "frame-ancestors") {
		t.Errorf("normal browsing lost the page's framing headers: %v", plain.Header)
	}
	if plain.Header.Get("X-Seen-Accept-Encoding") != "gzip" {
		t.Errorf("normal browsing changed Accept-Encoding")
	}
	// An iframe, before any Preview frame asked: still nothing.
	if body := read(t, get(t, p, host, "/", iframe)); strings.Contains(body, "data-berth-preview") {
		t.Fatalf("an unflagged iframe got the preview script")
	}
	// The flag in a tab of its own (Sec-Fetch-Dest: document) is not a frame.
	if body := read(t, get(t, p, host, "/?"+PreviewParam+"=1", http.Header{"Sec-Fetch-Dest": {"document"}})); strings.Contains(body, "data-berth-preview") {
		t.Fatalf("a flagged document got the preview script")
	}

	// A Preview frame's page: the script, right after <head>.
	resp := get(t, p, host, "/cart?x=1&"+PreviewParam+"=1", http.Header{"Sec-Fetch-Dest": {"iframe"}, "Accept-Encoding": {"gzip, br"}, "If-None-Match": {`"v1"`}})
	body := read(t, resp)
	if !strings.HasPrefix(body, "<!doctype html><html lang=en><head><script data-berth-preview>") || !strings.Contains(body, "</script><title>shop</title>") {
		t.Fatalf("preview page = %.200q", body)
	}
	if strings.Count(body, "data-berth-preview>") != 1 {
		t.Errorf("the script went in more than once")
	}
	if got := resp.Header.Get("X-Seen-Query"); got != "x=1" {
		t.Errorf("the dev server saw the query %q; the flag should be taken off", got)
	}
	if got := resp.Header.Get("X-Seen-Accept-Encoding"); got != "identity" {
		t.Errorf("the dev server was asked for %q; the page must come plain for the script to go in", got)
	}
	if got := resp.Header.Get("X-Seen-If-None-Match"); got != "" {
		t.Errorf("a conditional request (%q) could come back 304, a cached copy without the script", got)
	}
	if resp.Header.Get("X-Frame-Options") != "" {
		t.Errorf("X-Frame-Options kept: the frame would refuse the page")
	}
	csp := resp.Header.Get("Content-Security-Policy")
	if strings.Contains(csp, "frame-ancestors") || !strings.Contains(csp, "script-src 'self' "+previewHash) || !strings.HasPrefix(csp, "default-src 'self'") {
		t.Errorf("policy = %q", csp)
	}
	if resp.Header.Get("Cache-Control") != "no-store" || resp.Header.Get("Etag") != "" || resp.Header.Get("Content-Length") != "" {
		t.Errorf("the page with the script could be cached or mis-sized: %v", resp.Header)
	}

	// A link followed in the frame, or a reload, has no flag; it is the
	// frame's while Preview frames keep asking.
	if body := read(t, get(t, p, host, "/next", iframe)); !strings.Contains(body, "data-berth-preview") {
		t.Errorf("a navigation in a Preview frame lost the script")
	}
	// Still never for normal browsing of that host, nor for another host.
	if body := read(t, get(t, p, host, "/next", http.Header{"Sec-Fetch-Dest": {"document"}})); strings.Contains(body, "data-berth-preview") {
		t.Errorf("normal browsing got the script while a Preview frame was open")
	}
	other := strconv.Itoa(devPage(t)) + ".devl.localhost:1377"
	if body := read(t, get(t, p, other, "/", iframe)); strings.Contains(body, "data-berth-preview") {
		t.Errorf("another host's iframe got the script")
	}
	// Nor for what isn't a page: a JSON response is only made framable.
	api := get(t, p, host, "/api?"+PreviewParam+"=1", iframe)
	if body := read(t, api); body != `{"ok":true}` || api.Header.Get("X-Frame-Options") != "" {
		t.Errorf("api = %q %v", body, api.Header)
	}
}

func TestPreviewFramesStopBeingRecognisedAfterAWhile(t *testing.T) {
	port := devPage(t)
	host := strconv.Itoa(port) + ".devl.localhost:1377"
	p := newProxy()
	now := time.Now()
	p.preview.now = func() time.Time { return now }
	read(t, get(t, p, host, "/?"+PreviewParam+"=1", iframe))
	now = now.Add(previewWindow - time.Minute)
	if body := read(t, get(t, p, host, "/", iframe)); !strings.Contains(body, "data-berth-preview") {
		t.Fatalf("a frame still in use lost the script")
	}
	now = now.Add(previewWindow + time.Minute)
	if body := read(t, get(t, p, host, "/", iframe)); strings.Contains(body, "data-berth-preview") {
		t.Fatalf("an iframe long after the last Preview frame got the script")
	}
}

// To the browser a frame is a third party, which is sent no Lax cookies: a
// login made in the Browser tab is lent to Preview requests by the proxy,
// and only to them.
func TestPreviewFramesAreLentTheHostsCookies(t *testing.T) {
	port := devPage(t)
	host := strconv.Itoa(port) + ".devl.localhost:1377"
	p := newProxy()
	login := get(t, p, host, "/login", http.Header{"Sec-Fetch-Dest": {"document"}})
	if loc := login.Header.Get("Location"); loc != "http://"+host+"/home" {
		t.Fatalf("login redirect = %q", loc)
	}
	if got := get(t, p, host, "/", http.Header{"Sec-Fetch-Dest": {"document"}}).Header.Get("X-Seen-Cookie"); got != "" {
		t.Errorf("normal browsing was lent cookies: %q", got)
	}
	frame := get(t, p, host, "/?"+PreviewParam+"=1", iframe)
	if got := frame.Header.Get("X-Seen-Cookie"); got != "session=abc" {
		t.Errorf("a Preview frame's page was sent %q, want the session", got)
	}
	// Its own fetches, which the script marks; the mark stops at the proxy.
	fetch := get(t, p, host, "/api", http.Header{PreviewHeader: {"1"}, "Sec-Fetch-Dest": {"empty"}})
	if got := fetch.Header.Get("X-Seen-Cookie"); got != "session=abc" {
		t.Errorf("a Preview frame's fetch was sent %q", got)
	}
	if got := fetch.Header.Get("X-Seen-Preview-Header"); got != "" {
		t.Errorf("the dev server saw %s: %q", PreviewHeader, got)
	}
	// A cookie the browser did send wins over the remembered one.
	own := get(t, p, host, "/", http.Header{"Sec-Fetch-Dest": {"iframe"}, "Cookie": {"session=mine"}})
	if got := own.Header.Get("X-Seen-Cookie"); got != "session=mine" {
		t.Errorf("cookie = %q, want the browser's own", got)
	}
}

func TestPreviewPolicy(t *testing.T) {
	h := previewHash
	for in, want := range map[string]string{
		"frame-ancestors 'none'":                                           "",
		"default-src 'self'; frame-ancestors 'self'":                       "default-src 'self' " + h,
		"default-src 'self'; script-src 'self' 'nonce-abc'":                "default-src 'self'; script-src 'self' 'nonce-abc' " + h,
		"script-src 'self' 'unsafe-inline'; img-src *":                     "script-src 'self' 'unsafe-inline'; img-src *",
		"script-src 'self' 'unsafe-inline' 'sha256-x'":                     "script-src 'self' 'unsafe-inline' 'sha256-x' " + h,
		"img-src 'self'; Frame-Ancestors https://example.com; style-src *": "img-src 'self'; style-src *",
	} {
		if got := previewPolicy(in); got != want {
			t.Errorf("previewPolicy(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestInsertPoint(t *testing.T) {
	for in, want := range map[string]int{
		"<!doctype html><html><head><title>":   len("<!doctype html><html><head>"),
		"<html><HEAD lang=en>x":                len("<html><HEAD lang=en>"),
		"<html><body><header>no head</header>": len("<html>"),
		"<!DOCTYPE html>\n<body>hi":            len("<!DOCTYPE html>"),
		"just text":                            0,
		"<headless></headless><head>":          len("<headless></headless><head>"),
	} {
		got, ok := insertPoint([]byte(in), true)
		if !ok || got != want {
			t.Errorf("insertPoint(%q) = %d, %v; want %d", in, got, ok, want)
		}
	}
	// Until the page ends, only <head> settles it.
	if _, ok := insertPoint([]byte("<!doctype html><html><he"), false); ok {
		t.Error("settled before <head> could arrive")
	}
}

// slow hands a body over a few bytes at a time, as a streaming server does.
type slow struct {
	s string
	n int
}

func (s *slow) Read(p []byte) (int, error) {
	if s.s == "" {
		return 0, io.EOF
	}
	n := min(len(p), s.n, len(s.s))
	copy(p, s.s[:n])
	s.s = s.s[n:]
	return n, nil
}
func (s *slow) Close() error { return nil }

func TestInjectorStreamsAndFindsAHeadSplitAcrossReads(t *testing.T) {
	page := "<!doctype html><html><head><meta charset=utf-8></head><body>" + strings.Repeat("x", 100<<10) + "</body></html>"
	resp := &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": {"text/html"}}, Body: &slow{s: page, n: 3}}
	if !isHTML(resp) {
		t.Fatal("not HTML")
	}
	injectPreview(resp)
	got := read(t, resp)
	want := "<!doctype html><html><head>" + string(previewTag) + "<meta charset=utf-8>"
	if !strings.HasPrefix(got, want) || len(got) != len(page)+len(previewTag) {
		t.Fatalf("injected page starts %.120q (len %d)", got, len(got))
	}
	// Compressed or not-OK responses are left alone.
	for _, r := range []*http.Response{
		{StatusCode: 200, Header: http.Header{"Content-Type": {"text/html"}, "Content-Encoding": {"gzip"}}},
		{StatusCode: 404, Header: http.Header{"Content-Type": {"text/html"}}},
		{StatusCode: 200, Header: http.Header{"Content-Type": {"text/css"}}},
	} {
		if isHTML(r) {
			t.Errorf("isHTML(%v %v) = true", r.StatusCode, r.Header)
		}
	}
}
