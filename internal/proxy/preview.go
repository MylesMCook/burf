package proxy

import (
	"bytes"
	"crypto/sha256"
	_ "embed"
	"encoding/base64"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"sync"
	"time"
)

// The app's Preview tab shows a worktree's page at several widths at once,
// each in an iframe. Those frames, and only those, get a small script at the
// top of each page (preview.js), which mirrors navigation, scrolling, clicks
// and typing between them, forces light or dark, and draws a frame for a
// screenshot, talking to the app with postMessage. Normal browsing (the
// Browser tab, your own browser) never gets it.
//
// A Preview frame's first request carries ?__berth_preview=1. The flag is
// taken off before the request reaches the dev server, and the script takes
// it off the address the page sees. After that, an iframe's page request to
// the same host (Sec-Fetch-Dest: iframe: a link followed in the frame, a
// reload, a dev server's full reload) is a Preview frame's too, for as long
// as Preview frames keep asking. The script itself only acts in a frame the
// app named, so the page's own iframes stay untouched.
//
// For those requests the proxy also lets the page be framed: it drops
// X-Frame-Options and the frame-ancestors of a Content-Security-Policy, and
// lets the script run under a policy that would refuse inline scripts.
//
// Cookies: to the browser a frame is a third party, and it keeps a site's
// cookies from third parties (SameSite=Lax, and WebKit's tracking
// prevention), so a page you are logged in to in the Browser tab would be
// logged out in its frames. The proxy remembers the cookies a host sets, in
// memory, and adds the ones a Preview request lacks: a login in the Browser
// tab (or in a frame) holds in every frame.

// PreviewParam is the query parameter that marks a Preview frame's request.
const PreviewParam = "__berth_preview"

// PreviewHeader marks a Preview frame's own fetches (the script adds it to
// same-origin fetch and XMLHttpRequest calls), so they get its cookies.
const PreviewHeader = "X-Berth-Preview"

//go:embed preview.js
var previewSource string

// previewJS is the script without its comment lines, as pages get it;
// previewTag is it as it goes into a page, and previewHash lets it run under
// a Content-Security-Policy.
var (
	previewJS   = stripComments(previewSource)
	previewTag  = []byte("<script data-berth-preview>" + previewJS + "</script>")
	previewHash = func() string {
		sum := sha256.Sum256([]byte(previewJS))
		return "'sha256-" + base64.StdEncoding.EncodeToString(sum[:]) + "'"
	}()
)

func stripComments(src string) string {
	var out []string
	for _, line := range strings.Split(src, "\n") {
		t := strings.TrimSpace(line)
		if t == "" || strings.HasPrefix(t, "//") {
			continue
		}
		out = append(out, t)
	}
	return strings.Join(out, "\n")
}

// previewWindow is how long after a Preview frame last asked for a page its
// host's iframe navigations count as Preview frames'.
const previewWindow = 30 * time.Minute

type previewState struct {
	mu    sync.Mutex
	hosts map[string]time.Time
	jars  map[string]*cookiejar.Jar
	now   func() time.Time
}

func (s *previewState) clock() time.Time {
	if s.now != nil {
		return s.now()
	}
	return time.Now()
}

// kind says what a request is to Preview: not one (""), a frame's page
// ("page", which gets the script) or a frame's own fetch ("fetch").
func (s *previewState) kind(r *http.Request, host string) string {
	dest := r.Header.Get("Sec-Fetch-Dest")
	flagged := r.URL.Query().Has(PreviewParam)
	s.mu.Lock()
	defer s.mu.Unlock()
	if flagged && (dest == "" || dest == "iframe") {
		if s.hosts == nil {
			s.hosts = map[string]time.Time{}
		}
		s.hosts[host] = s.clock()
		return "page"
	}
	if dest == "iframe" && r.Method == http.MethodGet {
		if t, ok := s.hosts[host]; ok && s.clock().Sub(t) < previewWindow {
			s.hosts[host] = s.clock()
			return "page"
		}
	}
	if r.Header.Get(PreviewHeader) != "" {
		return "fetch"
	}
	return ""
}

func (s *previewState) jar(host string) *cookiejar.Jar {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.jars == nil {
		s.jars = map[string]*cookiejar.Jar{}
	}
	j := s.jars[host]
	if j == nil {
		j, _ = cookiejar.New(nil)
		s.jars[host] = j
	}
	return j
}

// remember keeps the cookies a response sets for its public host.
func (s *previewState) remember(host string, resp *http.Response) {
	cookies := resp.Cookies()
	if len(cookies) == 0 {
		return
	}
	s.jar(host).SetCookies(jarURL(host, resp.Request.URL.Path), cookies)
}

// lend adds the cookies remembered for host that the request lacks.
func (s *previewState) lend(host string, r *http.Request) {
	s.mu.Lock()
	j := s.jars[host]
	s.mu.Unlock()
	if j == nil {
		return
	}
	have := map[string]bool{}
	for _, c := range r.Cookies() {
		have[c.Name] = true
	}
	for _, c := range j.Cookies(jarURL(host, r.URL.Path)) {
		if !have[c.Name] {
			r.AddCookie(c)
		}
	}
}

// jarURL is where a host's cookies are kept. The scheme is https so cookies
// marked Secure, which browsers accept from localhost, are kept and lent too.
func jarURL(host, path string) *url.URL {
	if path == "" {
		path = "/"
	}
	return &url.URL{Scheme: "https", Host: host, Path: path}
}

// stripPreviewParam takes the flag off a request's query.
func stripPreviewParam(u *url.URL) {
	if !strings.Contains(u.RawQuery, PreviewParam) {
		return
	}
	q := u.Query()
	q.Del(PreviewParam)
	u.RawQuery = q.Encode()
}

// framable lets a Preview frame's page be framed and run the script: it
// drops X-Frame-Options and the policy's frame-ancestors, and allows the
// script's hash where the policy limits scripts.
func framable(h http.Header) {
	h.Del("X-Frame-Options")
	for _, name := range []string{"Content-Security-Policy", "Content-Security-Policy-Report-Only"} {
		values := h.Values(name)
		if len(values) == 0 {
			continue
		}
		h.Del(name)
		for _, v := range values {
			if v = previewPolicy(v); v != "" {
				h.Add(name, v)
			}
		}
	}
}

// previewPolicy is a Content-Security-Policy without frame-ancestors, whose
// script-src (or default-src, when that is what limits scripts) also allows
// the preview script.
func previewPolicy(policy string) string {
	var out []string
	scripts := false
	for _, d := range strings.Split(policy, ";") {
		d = strings.TrimSpace(d)
		if d == "" {
			continue
		}
		name := strings.ToLower(strings.Fields(d)[0])
		switch name {
		case "frame-ancestors":
			continue
		case "script-src", "script-src-elem":
			scripts = true
			d = allowScript(d)
		}
		out = append(out, d)
	}
	if !scripts {
		for i, d := range out {
			if strings.ToLower(strings.Fields(d)[0]) == "default-src" {
				out[i] = allowScript(d)
			}
		}
	}
	return strings.Join(out, "; ")
}

// allowScript adds the script's hash to a source list, unless the list
// already lets any inline script run ('unsafe-inline' without a hash or a
// nonce, which a hash would turn off) or allows none at all.
func allowScript(directive string) string {
	sources := strings.Fields(directive)[1:]
	inline, keyed := false, false
	for _, s := range sources {
		ls := strings.ToLower(s)
		if ls == "'unsafe-inline'" {
			inline = true
		}
		if strings.HasPrefix(ls, "'nonce-") || strings.HasPrefix(ls, "'sha") {
			keyed = true
		}
		if ls == "'none'" && len(sources) == 1 {
			return directive
		}
	}
	if inline && !keyed {
		return directive
	}
	return directive + " " + previewHash
}

// injectPreview puts the script into an HTML response's head as it streams.
func injectPreview(resp *http.Response) {
	resp.Body = &injector{src: resp.Body}
	resp.ContentLength = -1
	resp.Header.Del("Content-Length")
	resp.Header.Del("Etag")
	resp.Header.Del("Last-Modified")
	// The page with the script is for the frame that asked: never cached
	// for the Browser tab to show.
	resp.Header.Set("Cache-Control", "no-store")
}

// isHTML is a response the script can go into.
func isHTML(resp *http.Response) bool {
	if resp.StatusCode < 200 || resp.StatusCode >= 300 || resp.StatusCode == http.StatusNoContent {
		return false
	}
	if enc := resp.Header.Get("Content-Encoding"); enc != "" && enc != "identity" {
		return false
	}
	return strings.HasPrefix(strings.ToLower(resp.Header.Get("Content-Type")), "text/html")
}

// injectLimit is how much of a page is read looking for its <head>.
const injectLimit = 64 << 10

// injector streams a body with the script put in once, after <head>, else
// <html>, else the doctype, else at the start.
type injector struct {
	src  io.ReadCloser
	buf  []byte
	out  []byte
	done bool
	err  error
}

func (j *injector) Read(p []byte) (int, error) {
	for !j.done && len(j.out) == 0 {
		chunk := make([]byte, 8<<10)
		n, err := j.src.Read(chunk)
		j.buf = append(j.buf, chunk[:n]...)
		if at, ok := insertPoint(j.buf, err != nil || len(j.buf) >= injectLimit); ok {
			j.out = append(append(append([]byte(nil), j.buf[:at]...), previewTag...), j.buf[at:]...)
			j.buf = nil
			j.done = true
		}
		if err != nil {
			j.err = err
			if !j.done {
				j.out = j.buf
				j.done = true
			}
		}
	}
	if len(j.out) > 0 {
		n := copy(p, j.out)
		j.out = j.out[n:]
		return n, nil
	}
	if j.err != nil {
		return 0, j.err
	}
	return j.src.Read(p)
}

func (j *injector) Close() error { return j.src.Close() }

// insertPoint finds where the script goes in the start of a page. Until
// final (the page ended, or enough was read), it only answers once <head>
// is found; then it settles for <html>, the doctype or the start.
func insertPoint(b []byte, final bool) (int, bool) {
	if at, ok := afterTag(b, "head"); ok {
		return at, true
	}
	if !final {
		return 0, false
	}
	if at, ok := afterTag(b, "html"); ok {
		return at, true
	}
	lower := bytes.ToLower(b)
	if i := bytes.Index(lower, []byte("<!doctype")); i >= 0 {
		if end := bytes.IndexByte(b[i:], '>'); end >= 0 {
			return i + end + 1, true
		}
	}
	return 0, true
}

// afterTag is the index just past the first <name ...> opening tag, where
// name is the whole tag name (<head>, not <header>).
func afterTag(b []byte, name string) (int, bool) {
	lower := bytes.ToLower(b)
	needle := []byte("<" + name)
	from := 0
	for {
		i := bytes.Index(lower[from:], needle)
		if i < 0 {
			return 0, false
		}
		i += from
		next := i + len(needle)
		if next >= len(b) {
			return 0, false
		}
		switch b[next] {
		case '>', ' ', '\t', '\n', '\r', '/':
			end := bytes.IndexByte(b[next:], '>')
			if end < 0 {
				return 0, false
			}
			return next + end + 1, true
		}
		from = next
	}
}
