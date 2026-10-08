package box

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/png"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Capture for visual before/after (shots.go): a short-lived Chromium of
// its own, behind a proxy that reaches two worktrees' pages and nothing
// else, and a tab per side, size and colour scheme, each set up so that two
// loads of an unchanged page give the same pixels.

// shooter is a short-lived Chromium with a tab per side, size and scheme.
type shooter struct {
	cdp     *cdpConn
	cmd     *exec.Cmd
	profile string
	done    chan struct{}
	bin     string

	mu   sync.Mutex
	tabs map[string]*shotTab // session →
}

type shotTab struct {
	s       *shooter
	session string
	frame   string
	scheme  string

	run      sync.Mutex
	mu       sync.Mutex
	loaded   chan struct{}
	inflight map[string]bool
	lastNet  time.Time
	docReq   string
	status   int
	failed   string
	errs     []string
}

// startShooter starts Chromium, the agents' binary and flags, plus a few
// that make text and colour render the same every time.
func (m *Browsers) startShooter(ctx context.Context, proxy string) (*shooter, error) {
	bin := m.Chromium
	if bin == "" {
		var err error
		if bin, err = FindChromium(); err != nil {
			return nil, err
		}
	}
	os.MkdirAll(filepath.Join(m.Dir, "profiles"), 0o700)
	profile, err := os.MkdirTemp(filepath.Join(m.Dir, "profiles"), "shots-")
	if err != nil {
		return nil, err
	}
	off, _ := m.noSandbox()
	// Its window keeps the size it always had; each shot sets its own
	// viewport.
	args := append(chromiumArgs(profile, proxy, off, Viewport{Width: 1280, Height: 800}), "--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb", "about:blank")
	toChrome, ours, err := os.Pipe()
	if err != nil {
		return nil, err
	}
	theirs, fromChrome, err := os.Pipe()
	if err != nil {
		return nil, err
	}
	cmd := exec.Command(bin, args...)
	cmd.ExtraFiles = []*os.File{toChrome, fromChrome}
	cmd.Dir = profile
	cmd.Env = append(os.Environ(), "HOME="+profile, "BERTH_BROWSER=shots")
	stderr := &stderrTail{max: 4 << 10}
	cmd.Stderr = stderr
	if err := cmd.Start(); err != nil {
		os.RemoveAll(profile)
		return nil, err
	}
	toChrome.Close()
	fromChrome.Close()
	s := &shooter{cmd: cmd, profile: profile, done: make(chan struct{}), tabs: map[string]*shotTab{}, bin: bin}
	s.cdp = newCDP(ours, theirs, s.onEvent)
	go func() {
		cmd.Wait()
		ours.Close()
		theirs.Close()
		close(s.done)
	}()
	cctx, cancel := context.WithTimeout(ctx, browserStartTimeout())
	defer cancel()
	if err := s.cdp.call(cctx, "", "Browser.getVersion", nil, nil); err != nil {
		s.close()
		if out := strings.TrimSpace(stderr.String()); out != "" {
			return nil, fmt.Errorf("starting Chromium: %w; it said: %s", err, strings.ReplaceAll(lastLines(out, 6), "\n", " | "))
		}
		return nil, fmt.Errorf("starting Chromium: %w", err)
	}
	return s, nil
}

// chromiumName is the browser's build as its install folder names it
// (chromium_headless_shell-1243), recorded with each visual diff.
func (s *shooter) chromiumName() string {
	return filepath.Base(filepath.Dir(filepath.Dir(s.bin)))
}

func (s *shooter) close() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	s.cdp.call(ctx, "", "Browser.close", nil, nil)
	cancel()
	select {
	case <-s.done:
	case <-time.After(3 * time.Second):
		if s.cmd.Process != nil {
			s.cmd.Process.Kill()
		}
		<-s.done
	}
	s.cdp.close()
	os.RemoveAll(s.profile)
}

// freezeJS runs before any page script: no transitions, no caret, no
// smooth scrolling.
const freezeJS = `(() => {
  const css = "*,*::before,*::after{transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}";
  const add = () => { const s = document.createElement("style"); s.dataset.berthShots = ""; s.textContent = css; (document.head || document.documentElement).appendChild(s); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add, { once: true }); else add();
})();`

// seedJS replaces Math.random with a fixed sequence (mulberry32).
const seedJS = `(() => { let a = 0x9e3779b9; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`

func (s *shooter) newTab(ctx context.Context, cfg ShotsConfig, scheme string) (*shotTab, error) {
	var created struct {
		TargetID string `json:"targetId"`
	}
	if err := s.cdp.call(ctx, "", "Target.createTarget", map[string]any{"url": "about:blank"}, &created); err != nil {
		return nil, err
	}
	var att struct {
		SessionID string `json:"sessionId"`
	}
	if err := s.cdp.call(ctx, "", "Target.attachToTarget", map[string]any{"targetId": created.TargetID, "flatten": true}, &att); err != nil {
		return nil, err
	}
	t := &shotTab{s: s, session: att.SessionID, frame: created.TargetID, scheme: scheme, inflight: map[string]bool{}}
	s.mu.Lock()
	s.tabs[t.session] = t
	s.mu.Unlock()
	type call struct {
		m string
		p any
	}
	calls := []call{
		{"Page.enable", nil}, {"Runtime.enable", nil}, {"Network.enable", nil},
		{"Network.setCacheDisabled", map[string]any{"cacheDisabled": true}},
		{"Emulation.setEmulatedMedia", map[string]any{"media": "screen", "features": []map[string]string{{"name": "prefers-reduced-motion", "value": "reduce"}, {"name": "prefers-color-scheme", "value": scheme}}}},
		{"Emulation.setTimezoneOverride", map[string]any{"timezoneId": "UTC"}},
		{"Emulation.setLocaleOverride", map[string]any{"locale": "en-US"}},
		{"Page.addScriptToEvaluateOnNewDocument", map[string]any{"source": freezeJS}},
	}
	if cfg.Seed {
		calls = append(calls, call{"Page.addScriptToEvaluateOnNewDocument", map[string]any{"source": seedJS}})
	}
	for _, c := range calls {
		// An older Chromium without the locale override still shoots.
		if err := s.cdp.call(ctx, t.session, c.m, c.p, nil); err != nil && c.m != "Emulation.setLocaleOverride" {
			return nil, err
		}
	}
	return t, nil
}

func (s *shooter) onEvent(method, session string, params json.RawMessage) {
	s.mu.Lock()
	t := s.tabs[session]
	s.mu.Unlock()
	if t == nil {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	switch method {
	case "Page.loadEventFired":
		if t.loaded != nil {
			close(t.loaded)
			t.loaded = nil
		}
	case "Network.requestWillBeSent":
		var p struct {
			RequestID string `json:"requestId"`
			Type      string `json:"type"`
			FrameID   string `json:"frameId"`
		}
		json.Unmarshal(params, &p)
		t.inflight[p.RequestID] = true
		t.lastNet = time.Now()
		if p.Type == "Document" && p.FrameID == t.frame {
			t.docReq = p.RequestID
		}
	case "Network.responseReceived":
		var p struct {
			RequestID string `json:"requestId"`
			Response  struct {
				Status int `json:"status"`
			} `json:"response"`
		}
		json.Unmarshal(params, &p)
		if p.RequestID == t.docReq {
			t.status = p.Response.Status
		}
	case "Network.loadingFinished", "Network.loadingFailed":
		var p struct {
			RequestID string `json:"requestId"`
			ErrorText string `json:"errorText"`
			Canceled  bool   `json:"canceled"`
		}
		json.Unmarshal(params, &p)
		delete(t.inflight, p.RequestID)
		t.lastNet = time.Now()
		if method == "Network.loadingFailed" && p.RequestID == t.docReq && !p.Canceled {
			t.failed = p.ErrorText
		}
	case "Runtime.exceptionThrown":
		var p struct {
			Details struct {
				Text      string `json:"text"`
				Exception struct {
					Description string `json:"description"`
				} `json:"exception"`
			} `json:"exceptionDetails"`
		}
		json.Unmarshal(params, &p)
		msg := p.Details.Exception.Description
		if msg == "" {
			msg = p.Details.Text
		}
		if len(t.errs) < 5 {
			t.errs = append(t.errs, clip(firstLineOf(msg), 160))
		}
	}
}

// settle waits until no request has been in flight for 300ms (at most max).
func (t *shotTab) settle(ctx context.Context, max time.Duration) {
	deadline := time.Now().Add(max)
	for time.Now().Before(deadline) {
		t.mu.Lock()
		quiet := len(t.inflight) == 0 && time.Since(t.lastNet) > 300*time.Millisecond
		t.mu.Unlock()
		if quiet {
			return
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(50 * time.Millisecond):
		}
	}
	// A request that never ends (a long poll, an event stream) is not
	// waited on again.
	t.mu.Lock()
	t.inflight = map[string]bool{}
	t.mu.Unlock()
}

func (t *shotTab) eval(ctx context.Context, expr string, out any) error {
	var r struct {
		Result struct {
			Value json.RawMessage `json:"value"`
		} `json:"result"`
		ExceptionDetails *struct {
			Text string `json:"text"`
		} `json:"exceptionDetails"`
	}
	if err := t.s.cdp.call(ctx, t.session, "Runtime.evaluate", map[string]any{"expression": expr, "returnByValue": true, "awaitPromise": true, "timeout": 15000}, &r); err != nil {
		return err
	}
	if r.ExceptionDetails != nil {
		return errors.New(r.ExceptionDetails.Text)
	}
	if out != nil && len(r.Result.Value) > 0 {
		return json.Unmarshal(r.Result.Value, out)
	}
	return nil
}

// shot is one page at one width in one scheme, as it loaded.
type shot struct {
	png    []byte
	img    *image.NRGBA
	w, h   int
	cut    bool
	status int
	title  string
	why    string // it could not be shot
	errs   []string
	masks  []image.Rectangle
	els    []pageEl
	ms     int
	// overflow is how far the page is wider than the viewport: it scrolls
	// sideways, the usual sign of a broken small-screen layout.
	overflow int
}

// pageEl is an element's box on the page (in image pixels) and a short
// name for it, to say what a changed region is.
type pageEl struct {
	R      image.Rectangle
	Name   string
	Parent int // index of the nearest recorded ancestor, -1 for none
}

// maxPageEls caps the element boxes a shot records.
const maxPageEls = 4000

// readyJS waits for fonts and images, loads lazy content by scrolling
// through the page, settles animations (a finite one at its end, an
// endless one removed), and measures the page, the masked elements and the
// boxes of the page's elements (to name what changed).
func readyJS(masks []string, waitFor string) string {
	sel, _ := json.Marshal(masks)
	wf, _ := json.Marshal(waitFor)
	return `(async () => {
  const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const wf = ` + string(wf) + `;
  if (wf) { const end = Date.now() + 10000; while (!document.querySelector(wf) && Date.now() < end) await new Promise(r => setTimeout(r, 100)); }
  const h0 = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  for (let y = 0; y < h0; y += innerHeight) { scrollTo(0, y); await frames(); }
  scrollTo(0, 0);
  try { await document.fonts.ready; } catch (e) {}
  await Promise.all([...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); setTimeout(r, 5000); })));
  for (const a of document.getAnimations()) { try { const t = a.effect && a.effect.getComputedTiming(); if (t && t.iterations === Infinity) a.cancel(); else a.finish(); } catch (e) {} }
  await frames();
  const box = r => [Math.floor(r.left + scrollX), Math.floor(r.top + scrollY), Math.ceil(r.width), Math.ceil(r.height)];
  const masks = [];
  for (const s of ` + string(sel) + `) { try { for (const el of document.querySelectorAll(s)) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) masks.push(box(r)); } } catch (e) {} }
  const junk = /^(css|sc|jsx|svelte|emotion)-|__|^_|[:\[\/]|\d.*\d/i;
  const say = el => {
    const tag = el.tagName.toLowerCase();
    let s = tag;
    const tid = el.getAttribute("data-testid");
    if (el.id && el.id.length < 32 && !/\d{3}/.test(el.id)) s += "#" + el.id;
    else if (tid) s += "[data-testid=" + tid.slice(0, 32) + "]";
    else { const c = [...el.classList].filter(c => c.length < 28 && !junk.test(c)).slice(0, 2); if (c.length) s += "." + c.join("."); }
    if (/^(a|button|h[1-6]|label|summary|th|legend|option)$/.test(tag)) { const t = (el.textContent || "").replace(/\s+/g, " ").trim(); if (t && t.length <= 32) s += ' "' + t + '"'; }
    return s;
  };
  const els = [], at = new Map();
  if (document.body) for (const el of document.body.querySelectorAll("*")) {
    if (els.length >= ` + fmt.Sprint(maxPageEls) + `) break;
    if ((el instanceof SVGElement && !(el instanceof SVGSVGElement)) || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|BR|WBR)$/.test(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    let p = el.parentElement; while (p && !at.has(p)) p = p.parentElement;
    at.set(el, els.length);
    els.push([...box(r), say(el), p ? at.get(p) : -1]);
  }
  const h = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
  return { h, sw, masks, els, title: document.title };
})()`
}

func (t *shotTab) shoot(ctx context.Context, url string, width int, cfg ShotsConfig) shot {
	t.run.Lock()
	defer t.run.Unlock()
	start := time.Now()
	vh := viewportHeight(width)
	t.s.cdp.call(ctx, t.session, "Emulation.setDeviceMetricsOverride", map[string]any{"width": width, "height": vh, "deviceScaleFactor": cfg.Scale, "mobile": width < 600}, nil)
	t.s.cdp.call(ctx, t.session, "Emulation.setTouchEmulationEnabled", map[string]any{"enabled": width < 600}, nil)
	loaded := make(chan struct{})
	t.mu.Lock()
	t.loaded, t.docReq, t.status, t.failed, t.errs = loaded, "", 0, "", nil
	t.mu.Unlock()
	var nav struct {
		ErrorText string `json:"errorText"`
	}
	if err := t.s.cdp.call(ctx, t.session, "Page.navigate", map[string]any{"url": url}, &nav); err != nil {
		return shot{why: err.Error()}
	}
	if nav.ErrorText != "" {
		return shot{why: "could not load: " + nav.ErrorText}
	}
	select {
	case <-loaded:
	case <-time.After(20 * time.Second):
	case <-ctx.Done():
		return shot{why: ctx.Err().Error()}
	}
	t.settle(ctx, 6*time.Second)
	var m struct {
		H     float64           `json:"h"`
		SW    float64           `json:"sw"`
		Masks [][4]int          `json:"masks"`
		Els   []json.RawMessage `json:"els"`
		Title string            `json:"title"`
	}
	if err := t.eval(ctx, readyJS(cfg.Mask, cfg.WaitFor), &m); err != nil {
		return shot{why: "the page did not settle: " + err.Error()}
	}
	t.settle(ctx, 3*time.Second)
	h := max(int(m.H), vh)
	cut := h > cfg.MaxHeight
	if cut {
		h = cfg.MaxHeight
	}
	var capd struct {
		Data string `json:"data"`
	}
	params := map[string]any{"format": "png", "captureBeyondViewport": true, "clip": map[string]any{"x": 0, "y": 0, "width": width, "height": h, "scale": 1}}
	if err := t.s.cdp.call(ctx, t.session, "Page.captureScreenshot", params, &capd); err != nil {
		return shot{why: err.Error()}
	}
	raw, err := base64.StdEncoding.DecodeString(capd.Data)
	if err != nil {
		return shot{why: err.Error()}
	}
	img, err := png.Decode(bytes.NewReader(raw))
	if err != nil {
		return shot{why: err.Error()}
	}
	t.mu.Lock()
	out := shot{png: raw, img: toNRGBA(img), cut: cut, status: t.status, title: m.Title, errs: append([]string(nil), t.errs...), overflow: max(0, int(m.SW)-width)}
	if t.failed != "" {
		out.why = t.failed
	}
	t.mu.Unlock()
	out.w, out.h = out.img.Rect.Dx(), out.img.Rect.Dy()
	k := cfg.Scale
	scale := func(x, y, w, h int) image.Rectangle {
		return image.Rect(int(float64(x)*k), int(float64(y)*k), int(float64(x+w)*k), int(float64(y+h)*k))
	}
	for _, r := range m.Masks {
		out.masks = append(out.masks, scale(r[0], r[1], r[2], r[3]))
	}
	out.els = parsePageEls(m.Els, scale)
	out.ms = int(time.Since(start).Milliseconds())
	return out
}

// parsePageEls reads readyJS's element rows: [x, y, w, h, name, parent].
func parsePageEls(rows []json.RawMessage, scale func(x, y, w, h int) image.Rectangle) []pageEl {
	out := make([]pageEl, 0, len(rows))
	for _, raw := range rows {
		var row []any
		if json.Unmarshal(raw, &row) != nil || len(row) != 6 {
			continue
		}
		n := func(i int) int { f, _ := row[i].(float64); return int(f) }
		name, _ := row[4].(string)
		out = append(out, pageEl{R: scale(n(0), n(1), n(2), n(3)), Name: name, Parent: n(5)})
	}
	return out
}

// --- the proxy --------------------------------------------------------------

// shotsProxy reaches the pages of a few worktrees (the one compared and
// its base) the way each one's own browser proxy does, and nothing else:
// no public origin, no other worktree, not berthd, not a database.
type shotsProxy struct {
	ln  net.Listener
	srv *http.Server
}

// newShotsProxy serves scopes worked out once by the caller: finding a
// worktree's dev server lists the box's ports (lsof on a Mac), far too
// slow to do per request, and a compare lasts seconds.
func (b *Box) newShotsProxy(scopes ...browserScope) (*shotsProxy, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, err
	}
	type side struct {
		px    *worktreeProxy
		scope browserScope
	}
	var sides []side
	for _, s := range scopes {
		sides = append(sides, side{&worktreeProxy{path: filepath.Clean(s.wt.Path)}, s})
	}
	var h http.Handler
	h = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := r.Host
		if r.Method == http.MethodConnect {
			host = r.RequestURI
		}
		for _, sd := range sides {
			rt, ok := sd.scope.route(host)
			if !ok || rt.public {
				continue
			}
			switch {
			case r.Method == http.MethodConnect:
				sd.px.connect(w, r, h, rt, b)
			case rt.rewrite:
				sd.px.rewriter(rt.port).ServeHTTP(w, r)
			default:
				passLocal(w, r, rt.port)
			}
			return
		}
		http.Error(w, "berth: a visual diff's browser only reaches the two sides it compares", http.StatusForbidden)
	})
	sp := &shotsProxy{ln: ln, srv: &http.Server{Handler: h, ReadHeaderTimeout: 30 * time.Second}}
	go sp.srv.Serve(ln)
	return sp, nil
}

func (p *shotsProxy) Addr() string { return "http://" + p.ln.Addr().String() }
func (p *shotsProxy) Close()       { p.srv.Close() }
