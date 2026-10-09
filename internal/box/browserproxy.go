package box

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/MylesMCook/burf/internal/proxy"
	"github.com/MylesMCook/burf/internal/statefile"
)

// The browser proxy: every page an agent's browser loads goes through a
// forward proxy inside berthd, one listener per worktree, which is the one
// place its egress is decided. It serves the names the human's laptop uses
// for the worktree (wt.loc.box.localhost on any port, so :1377 and :80
// URLs both work), rewritten exactly as the laptop's proxy does, and the
// worktree's own port block on localhost. Everything else is refused: other
// worktrees, berthd, databases on other ports, private ranges, metadata
// endpoints and the internet, unless the box's owner allows an origin in
// network.json (browser_allow) or a trusted repository config asks for it.
//
// Chromium runs with --proxy-server=<this> --proxy-bypass-list=<-loopback>,
// so even loopback goes through it.

// BrowserProxies keeps one proxy per worktree, on a port kept across
// restarts so env that names it (BERTH_BROWSER_PROXY) stays right.
type BrowserProxies struct {
	// Path keeps each worktree's port.
	Path string

	mu      sync.Mutex
	b       *Box
	proxies map[string]*worktreeProxy // worktree path →
	saved   map[string]int
	loaded  bool
}

type worktreeProxy struct {
	path string
	ln   net.Listener
	srv  *http.Server
	port int
	// refused counts what it turned away, for the browser's status.
	refused int
	mu      sync.Mutex
	last    []string // the last refused hosts, at most 5
	// pxs keeps one rewriting proxy (and its connection pool) per port.
	pxs map[int]*proxy.Proxy
}

// rewriter is the worktree's rewriting proxy to port: one per port, so its
// connections to the dev server are pooled and reused.
func (p *worktreeProxy) rewriter(port int) *proxy.Proxy {
	p.mu.Lock()
	defer p.mu.Unlock()
	if px := p.pxs[port]; px != nil {
		return px
	}
	local := func(ctx context.Context, port int) (net.Conn, error) {
		var d net.Dialer
		return d.DialContext(ctx, "tcp", "127.0.0.1:"+strconv.Itoa(port))
	}
	px := &proxy.Proxy{
		Dialer:   func(string) (proxy.DialFunc, bool) { return local, true },
		Worktree: func([]string) (string, int, bool) { return "box", port, true },
	}
	if p.pxs == nil {
		p.pxs = map[int]*proxy.Proxy{}
	}
	p.pxs[port] = px
	return px
}

// errBrowserRefused is the page a refused request gets.
const browserRefused = "berth: this browser only reaches this worktree's own pages; the box's owner can allow an origin with `berthd browser allow ORIGIN`"

func (bp *BrowserProxies) load() {
	if bp.loaded {
		return
	}
	bp.loaded = true
	bp.proxies = map[string]*worktreeProxy{}
	bp.saved = map[string]int{}
	if bp.Path != "" {
		if b, err := os.ReadFile(bp.Path); err == nil {
			json.Unmarshal(b, &bp.saved)
		}
	}
}

// For returns the proxy of the worktree at path, starting it if need be.
func (bp *BrowserProxies) For(b *Box, path string) (*worktreeProxy, error) {
	path = filepath.Clean(path)
	bp.mu.Lock()
	defer bp.mu.Unlock()
	bp.load()
	bp.b = b
	if p := bp.proxies[path]; p != nil {
		return p, nil
	}
	var ln net.Listener
	var err error
	if port := bp.saved[path]; port > 0 {
		ln, err = net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(port))
	}
	if ln == nil {
		ln, err = net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			return nil, err
		}
	}
	p := &worktreeProxy{path: path, ln: ln, port: ln.Addr().(*net.TCPAddr).Port}
	p.srv = &http.Server{Handler: p.handler(b), ReadHeaderTimeout: 30 * time.Second}
	go p.srv.Serve(ln)
	bp.proxies[path] = p
	if bp.saved[path] != p.port {
		bp.saved[path] = p.port
		if raw, err := json.Marshal(bp.saved); err == nil && bp.Path != "" {
			statefile.Write(bp.Path, raw)
		}
	}
	return p, nil
}

func (p *worktreeProxy) close() {
	p.srv.Close()
	p.mu.Lock()
	for _, px := range p.pxs {
		px.ResetBox("box")
	}
	p.mu.Unlock()
}

// Addr is the proxy's URL, http://127.0.0.1:PORT.
func (p *worktreeProxy) Addr() string { return "http://127.0.0.1:" + strconv.Itoa(p.port) }

// Close stops a worktree's proxy (its worktree went away).
func (bp *BrowserProxies) Close(path string) {
	bp.mu.Lock()
	defer bp.mu.Unlock()
	bp.load()
	path = filepath.Clean(path)
	if p := bp.proxies[path]; p != nil {
		p.close()
		delete(bp.proxies, path)
	}
	if _, ok := bp.saved[path]; ok {
		delete(bp.saved, path)
		if raw, err := json.Marshal(bp.saved); err == nil && bp.Path != "" {
			statefile.Write(bp.Path, raw)
		}
	}
}

// CloseAll stops every proxy.
func (bp *BrowserProxies) CloseAll() {
	bp.mu.Lock()
	defer bp.mu.Unlock()
	for _, p := range bp.proxies {
		p.close()
	}
	bp.proxies = map[string]*worktreeProxy{}
	localTransport.CloseIdleConnections()
}

func (p *worktreeProxy) refuse(host string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.refused++
	p.last = append(p.last, host)
	if len(p.last) > 5 {
		p.last = p.last[len(p.last)-5:]
	}
}

// Refused is how many requests it refused, and the last hosts.
func (p *worktreeProxy) Refused() (int, []string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.refused, append([]string(nil), p.last...)
}

// scope is what a worktree's browser may reach, read fresh per request (a
// cheap read of locations and the port block).
type browserScope struct {
	loc   Location
	wt    Worktree
	ports []int // the worktree's port block, then any other port it serves
	dev   int   // the port its names lead to: the lowest it listens on
	allow []string
}

func (b *Box) browserScope(ctx context.Context, path string) (browserScope, bool) {
	ports, err := ListPorts(ctx)
	if err != nil {
		ports = nil
	}
	return b.browserScopeWith(ctx, path, ports)
}

// browserScopeWith is browserScope with the box's listening ports already
// listed (lsof on a Mac is slow; a caller scoping several worktrees at
// once lists them once).
func (b *Box) browserScopeWith(ctx context.Context, path string, ports []Port) (browserScope, bool) {
	loc, wt, ok := b.worktreeAt(ctx, path)
	if !ok {
		return browserScope{}, false
	}
	s := browserScope{loc: loc, wt: wt}
	base, _ := b.Locations.Ports.For(wt.Path)
	n := 1
	if cfg, err := b.Locations.Config(ctx, loc.Name); err == nil {
		n = max(cfg.Effective.Ports, 1)
		s.allow = append(s.allow, cfg.Effective.BrowserAllow...)
	}
	for i := 0; i < n && base > 0; i++ {
		s.ports = append(s.ports, base+i)
	}
	if ports != nil {
		locs := []Location{loc}
		for _, sv := range Services(ports, locs) {
			if samePath(sv.Path, wt.Path) {
				if !slices.Contains(s.ports, sv.Port) {
					s.ports = append(s.ports, sv.Port)
				}
				if s.dev == 0 || sv.Port < s.dev {
					s.dev = sv.Port
				}
			}
		}
	}
	if s.dev == 0 {
		s.dev = base
	}
	s.allow = append(s.allow, b.browserAllowList()...)
	return s, true
}

// browserAllowList is the owner's browser_allow from network.json.
func (b *Box) browserAllowList() []string {
	dir := ""
	if b.Flows != nil && b.Flows.Path != "" {
		dir = filepath.Dir(b.Flows.Path)
	}
	if dir == "" {
		return nil
	}
	raw, err := os.ReadFile(filepath.Join(dir, NetworkFile))
	if err != nil {
		return nil
	}
	var doc struct {
		BrowserAllow []string `json:"browser_allow"`
	}
	json.Unmarshal(raw, &doc)
	return doc.BrowserAllow
}

// AllowBrowserOrigin adds an origin (https://host[:port] or a host) to the
// owner's browser_allow.
func (b *Box) AllowBrowserOrigin(origin string) error {
	host := allowHost(origin)
	if host == "" || strings.HasSuffix(host, ".localhost") || host == "localhost" {
		return errors.New("allow a public origin such as https://accounts.example.com")
	}
	if b.Flows == nil || b.Flows.Path == "" {
		return errors.New("this box has no config folder")
	}
	path := filepath.Join(filepath.Dir(b.Flows.Path), NetworkFile)
	doc := map[string]any{}
	if raw, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(raw, &doc); err != nil {
			return errors.New(path + " is not valid JSON")
		}
	}
	var list []any
	if l, ok := doc["browser_allow"].([]any); ok {
		list = l
	}
	for _, v := range list {
		if allowHost(v.(string)) == host {
			return nil
		}
	}
	doc["browser_allow"] = append(list, host)
	raw, _ := json.MarshalIndent(doc, "", "  ")
	return statefile.Write(path, append(raw, '\n'))
}

// allowHost is the host an allow entry names.
func allowHost(entry string) string {
	e := strings.TrimSpace(strings.ToLower(entry))
	e = strings.TrimPrefix(strings.TrimPrefix(e, "https://"), "http://")
	if i := strings.IndexAny(e, "/?#"); i >= 0 {
		e = e[:i]
	}
	if h, _, err := net.SplitHostPort(e); err == nil {
		e = h
	}
	return strings.TrimSuffix(e, ".")
}

// route decides where a request for host goes: a local port (rewrite says
// whether to rewrite it as the laptop's proxy does), or a public host.
type route struct {
	port    int
	rewrite bool
	public  bool
}

func (s browserScope) route(hostport string) (route, bool) {
	host, port := hostport, ""
	if h, p, err := net.SplitHostPort(hostport); err == nil {
		host, port = h, p
	}
	host = strings.TrimSuffix(strings.ToLower(strings.Trim(host, "[]")), ".")
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		n, _ := strconv.Atoi(port)
		if slices.Contains(s.ports, n) {
			return route{port: n}, true
		}
		return route{}, false
	}
	if rest, ok := strings.CutSuffix(host, ".localhost"); ok {
		labels := strings.Split(rest, ".")
		name, locName := strings.ToLower(s.wt.Name), strings.ToLower(s.loc.Name)
		switch {
		case len(labels) == 3 && labels[0] == name && labels[1] == locName && !s.wt.Main:
			return route{port: s.dev, rewrite: true}, s.dev > 0
		case len(labels) == 2 && labels[0] == name && labels[1] == locName && !s.wt.Main:
			return route{port: s.dev, rewrite: true}, s.dev > 0
		case len(labels) == 2 && labels[0] == locName && s.wt.Main:
			return route{port: s.dev, rewrite: true}, s.dev > 0
		case len(labels) == 2:
			// PORT.BOX: only a port of this worktree's own.
			if n, err := strconv.Atoi(labels[0]); err == nil && slices.Contains(s.ports, n) {
				return route{port: n, rewrite: true}, true
			}
		}
		return route{}, false
	}
	for _, a := range s.allow {
		if allowHost(a) == host {
			return route{public: true}, true
		}
	}
	return route{}, false
}

func (p *worktreeProxy) handler(b *Box) http.Handler {
	var h http.Handler
	h = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s, ok := b.browserScope(r.Context(), p.path)
		if !ok {
			http.Error(w, "berth: this worktree is gone", http.StatusGone)
			return
		}
		host := r.Host
		if r.Method == http.MethodConnect {
			host = r.RequestURI
		}
		rt, ok := s.route(host)
		if !ok {
			p.refuse(hostOnly(host))
			http.Error(w, browserRefused, http.StatusForbidden)
			return
		}
		if r.Method == http.MethodConnect {
			p.connect(w, r, h, rt, b)
			return
		}
		switch {
		case rt.public:
			publicForward(w, r, b)
		case rt.rewrite:
			// Any box label is this box: the route was decided above, and
			// the Host stays, so redirects map back to the name the page
			// was opened by.
			p.rewriter(rt.port).ServeHTTP(w, r)
		default:
			passLocal(w, r, rt.port)
		}
	})
	return h
}

func hostOnly(host string) string {
	if h, _, err := net.SplitHostPort(host); err == nil {
		return h
	}
	return host
}

// passLocal relays a request for localhost:PORT unchanged.
func passLocal(w http.ResponseWriter, r *http.Request, port int) {
	out := r.Clone(r.Context())
	out.RequestURI = ""
	out.URL.Scheme, out.URL.Host = "http", "127.0.0.1:"+strconv.Itoa(port)
	removeHopHeaders(out.Header)
	resp, err := localTransport.RoundTrip(out)
	if err != nil {
		http.Error(w, "berth: nothing answers on port "+strconv.Itoa(port), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	removeHopHeaders(resp.Header)
	for k, v := range resp.Header {
		w.Header()[k] = v
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(flushWriter{w}, resp.Body)
}

var localTransport = &http.Transport{Proxy: nil, DialContext: (&net.Dialer{Timeout: 5 * time.Second}).DialContext, MaxIdleConnsPerHost: 4, IdleConnTimeout: 30 * time.Second}

// publicForward fetches an allowed public origin over plain HTTP, through
// the netguard check on the address actually dialled.
func publicForward(w http.ResponseWriter, r *http.Request, b *Box) {
	out := r.Clone(r.Context())
	out.RequestURI = ""
	if out.URL.Host == "" {
		out.URL.Host = r.Host
	}
	if out.URL.Scheme == "" {
		out.URL.Scheme = "http"
	}
	removeHopHeaders(out.Header)
	c := b.browserPolicy().client(60 * time.Second)
	c.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	resp, err := c.Do(out)
	if err != nil {
		http.Error(w, "berth: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	removeHopHeaders(resp.Header)
	for k, v := range resp.Header {
		w.Header()[k] = v
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(flushWriter{w}, resp.Body)
}

// browserPolicy is the netguard policy for the browser's public origins:
// the owner's allow_outbound applies, names alone never open private
// addresses.
func (b *Box) browserPolicy() outboundPolicy {
	p := b.outboundPolicy()
	p.hosts = map[string]bool{}
	return p
}

func (p *worktreeProxy) connect(w http.ResponseWriter, r *http.Request, h http.Handler, rt route, b *Box) {
	conn, rw, err := http.NewResponseController(w).Hijack()
	if err != nil {
		return
	}
	if rt.public {
		// A TLS tunnel to an allowed origin: dialled through netguard.
		target, err := guardedDial(r.Context(), b.browserPolicy(), r.RequestURI)
		if err != nil {
			rw.WriteString("HTTP/1.1 403 Forbidden\r\n\r\n")
			rw.Flush()
			conn.Close()
			return
		}
		rw.WriteString("HTTP/1.1 200 Connection Established\r\n\r\n")
		rw.Flush()
		go func() {
			io.Copy(target, rw.Reader)
			target.Close()
		}()
		io.Copy(conn, target)
		conn.Close()
		return
	}
	// A tunnel to the worktree's own pages (Chromium uses CONNECT for
	// ws:// through a proxy): it carries plain HTTP, served by the same
	// handler, one connection.
	rw.WriteString("HTTP/1.1 200 Connection Established\r\n\r\n")
	rw.Flush()
	ln := &oneConn{c: &bufConn{Conn: conn, r: rw.Reader}, done: make(chan struct{})}
	srv := &http.Server{Handler: h, ReadHeaderTimeout: 30 * time.Second}
	ln.srv = srv
	go srv.Serve(ln)
}

func guardedDial(ctx context.Context, p outboundPolicy, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}
	ips, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
	if err != nil {
		return nil, err
	}
	for _, ip := range ips {
		if !p.allowedIP(ip) {
			continue
		}
		var d net.Dialer
		d.Timeout = 10 * time.Second
		return d.DialContext(ctx, "tcp", net.JoinHostPort(ip.String(), port))
	}
	return nil, errBlockedAddress
}

var hopHeaders = []string{"Connection", "Proxy-Connection", "Keep-Alive", "Proxy-Authenticate", "Proxy-Authorization", "Te", "Trailer", "Transfer-Encoding"}

func removeHopHeaders(h http.Header) {
	for _, k := range hopHeaders {
		h.Del(k)
	}
}

type flushWriter struct{ w http.ResponseWriter }

func (f flushWriter) Write(p []byte) (int, error) {
	n, err := f.w.Write(p)
	if fl, ok := f.w.(http.Flusher); ok {
		fl.Flush()
	}
	return n, err
}

type bufConn struct {
	net.Conn
	r *bufio.Reader
}

func (b *bufConn) Read(p []byte) (int, error) { return b.r.Read(p) }

// oneConn is a listener of a single connection: the tunnel.
type oneConn struct {
	c    net.Conn
	once sync.Once
	done chan struct{}
	srv  *http.Server
}

func (l *oneConn) Accept() (net.Conn, error) {
	var c net.Conn
	l.once.Do(func() {
		c = &closeNotify{Conn: l.c, done: l.done}
	})
	if c != nil {
		return c, nil
	}
	<-l.done
	return nil, net.ErrClosed
}
func (l *oneConn) Close() error   { return nil }
func (l *oneConn) Addr() net.Addr { return l.c.LocalAddr() }

// closeNotify ends the tunnel's server when its connection closes, so no
// goroutine outlives the tunnel.
type closeNotify struct {
	net.Conn
	done chan struct{}
	once sync.Once
}

func (c *closeNotify) Close() error {
	c.once.Do(func() { close(c.done) })
	return c.Conn.Close()
}
