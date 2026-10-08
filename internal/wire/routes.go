package wire

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"sort"
	"sync"
	"time"
)

// A box can have several routes: the address it was paired at (over this
// computer's Tailscale or one of berth's own networks), an SSH connection
// that forwards to berthd, or another address on the LAN or the internet.
// A route is only a transport. Each has its own pooled HTTP/2 connection,
// and TLS with the box's pinned key runs on top of every one of them
// exactly as it does on the paired address.
//
// New requests take the active route. The health check's ping goes over it
// too; a ping it doesn't answer in time (RouteTiming.Stall) is raced on
// the other routes, and the first that answers becomes the active route.
// The route that stalled is then "stalled": new requests avoid it, but the
// streams on it (terminals, the event stream) are left alone in case it was
// a hiccup. Only when it fails again is it declared "down", and its
// connections are closed, so those streams end and are opened again on the
// new route. While the box is in use, the routes not carrying its traffic
// are measured now and then (RouteTiming.ProbeUp), and a clearly faster one
// takes over; a route that recovers is used again.

// Route kinds.
const (
	RouteTailscale = "tailscale"
	RouteSSH       = "ssh"
	RouteDirect    = "direct"
)

// RoutePaired is the ID of the route to the address the box was paired at.
const RoutePaired = "paired"

// Route states.
const (
	// RouteUnknown: not tried yet.
	RouteUnknown = "unknown"
	RouteUp      = "up"
	// RouteStalled: it didn't answer once. New requests go elsewhere;
	// streams on it stay.
	RouteStalled = "stalled"
	// RouteDown: it failed twice in a row, or couldn't connect at all.
	RouteDown = "down"
)

// Route is one way to reach a box.
type Route struct {
	// ID is stable across restarts: RoutePaired, "ssh", "direct:ADDR".
	ID    string
	Kind  string
	Label string
	// Key changes when anything about how the route dials does; a route
	// whose key changes starts over.
	Key string
	// Dial opens the connection TLS runs over; nil dials the paired
	// address on this computer's network.
	Dial DialFunc
}

// RouteStatus is how a route is doing.
type RouteStatus struct {
	ID      string
	Kind    string
	Label   string
	State   string
	Latency time.Duration
	Active  bool
	Error   string
	Checked time.Time
}

// RouteChange tells the owner of a client that its active route changed or
// a route was declared down (Down: their streams were closed).
type RouteChange struct {
	From, To string
	Down     string
	Reason   string
}

// RouteTiming is how quickly routes are judged. Tests make it quick.
type RouteTiming struct {
	// Stall is the least time the active route has to answer a ping before
	// the others are tried; a route with a high latency gets four times it.
	Stall time.Duration
	// ProbeTimeout bounds a background measurement of one route.
	ProbeTimeout time.Duration
	// ProbeUp and ProbeDown are how often a route that works, and one that
	// doesn't, is measured while the box is in use; ProbeStalled how soon a
	// stalled one is tried again, which declares it down or up.
	ProbeUp, ProbeDown, ProbeStalled time.Duration
	// InUse is how long after its last request a box counts as in use.
	InUse time.Duration
}

// DefaultRouteTiming measures each route at most every 30-45s, and only for
// boxes in use.
var DefaultRouteTiming = RouteTiming{
	Stall:        3 * time.Second,
	ProbeTimeout: 6 * time.Second,
	ProbeUp:      45 * time.Second,
	ProbeDown:    30 * time.Second,
	ProbeStalled: 2 * time.Second,
	InUse:        10 * time.Minute,
}

// Clearly faster: a route takes over from a working one only if it is at
// least a quarter quicker and switchMargin quicker, so two similar routes
// don't trade places on every measurement.
const switchMargin = 10 * time.Millisecond

type route struct {
	Route
	transport *http.Transport
	conns     map[*trackedConn]struct{}
	state     string
	latency   time.Duration
	strikes   int
	err       string
	checked   time.Time
	nextProbe time.Time
	probing   bool
	// rough: its latency came from a ping that also opened the connection.
	rough bool
	// okSent is when the last ping that came back on this route was sent:
	// everything written on it before then reached the box.
	okSent time.Time
}

// trackedConn is a route's connection, remembered so a route declared down
// can close it and end the streams on it.
type trackedConn struct {
	net.Conn
	once  sync.Once
	close func()
}

func (t *trackedConn) Close() error {
	err := t.Conn.Close()
	t.once.Do(t.close)
	return err
}

// abandoned closes a connection on a route that is down, dropping what it
// hadn't delivered yet rather than delivering it late: by then it has been
// sent again on another route (a terminal's keys), or failed.
type abandoned struct{ t *trackedConn }

func (a abandoned) Close() error {
	if tcp, ok := a.t.Conn.(*net.TCPConn); ok {
		tcp.SetLinger(0)
	}
	return a.t.Close()
}

func (c *Client) track(r *route, conn net.Conn) net.Conn {
	t := &trackedConn{Conn: conn}
	t.close = func() {
		c.mu.Lock()
		delete(r.conns, t)
		c.mu.Unlock()
	}
	c.mu.Lock()
	r.conns[t] = struct{}{}
	c.mu.Unlock()
	return t
}

// SetRoutes changes the routes to the box. Routes that stay (same ID and
// Key) keep their connections and measurements; ones that go are closed.
// The active route stays unless it went.
func (c *Client) SetRoutes(routes []Route) {
	c.mu.Lock()
	old := map[string]*route{}
	for _, r := range c.routes {
		old[r.ID] = r
	}
	var next []*route
	for _, spec := range routes {
		if r, ok := old[spec.ID]; ok && r.Key == spec.Key {
			r.Kind, r.Label, r.Dial = spec.Kind, spec.Label, spec.Dial
			delete(old, spec.ID)
			next = append(next, r)
			continue
		}
		r := &route{Route: spec, conns: map[*trackedConn]struct{}{}, state: RouteUnknown}
		r.transport = c.newTransport(r)
		next = append(next, r)
	}
	c.routes = next
	if c.active == nil || old[c.active.ID] == c.active {
		c.active = nil
		if len(next) > 0 {
			c.active = next[0]
		}
	}
	var closing []io.Closer
	for _, r := range old {
		closing = append(closing, r.closeLocked()...)
	}
	c.mu.Unlock()
	for _, cl := range closing {
		cl.Close()
	}
}

// closeLocked returns what abandoning a route's connections closes: its
// transport's idle ones and every connection it has open, streams and all.
// They are closed once the client's lock is released.
func (r *route) closeLocked() []io.Closer {
	out := []io.Closer{idleCloser{r.transport}}
	for t := range r.conns {
		out = append(out, t)
	}
	return out
}

type idleCloser struct{ t *http.Transport }

func (i idleCloser) Close() error {
	i.t.CloseIdleConnections()
	return nil
}

// SetTiming changes how quickly routes are judged.
func (c *Client) SetTiming(t RouteTiming) {
	c.mu.Lock()
	c.timing = t
	c.mu.Unlock()
}

// OnRouteChange registers fn to hear about route changes; it is called
// without the client's lock held.
func (c *Client) OnRouteChange(fn func(RouteChange)) {
	c.mu.Lock()
	c.onChange = fn
	c.mu.Unlock()
}

// Routes reports every route, the active one marked.
func (c *Client) Routes() []RouteStatus {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]RouteStatus, 0, len(c.routes))
	for _, r := range c.routes {
		out = append(out, RouteStatus{ID: r.ID, Kind: r.Kind, Label: r.Label, State: r.state, Latency: r.latency, Active: r == c.active, Error: r.err, Checked: r.checked})
	}
	return out
}

// RouteState is a route's state and the time before which everything
// written on it is known to have reached the box.
func (c *Client) RouteState(id string) (string, time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, r := range c.routes {
		if r.ID == id {
			return r.state, r.okSent
		}
	}
	return RouteDown, time.Time{}
}

type backgroundKey struct{}

// Background marks requests made under ctx as the agent's own (checks, the
// event stream) rather than someone using the box: they don't keep its
// routes measured.
func Background(ctx context.Context) context.Context {
	return context.WithValue(ctx, backgroundKey{}, true)
}

func background(ctx context.Context) bool {
	v, _ := ctx.Value(backgroundKey{}).(bool)
	return v
}

func (c *Client) touch(ctx context.Context) {
	if background(ctx) {
		return
	}
	c.mu.Lock()
	c.lastUse = time.Now()
	c.mu.Unlock()
}

// InUse reports whether someone used the box lately, or has a stream open.
func (c *Client) InUse() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.inUseLocked()
}

func (c *Client) inUseLocked() bool {
	return c.streams > 0 || (!c.lastUse.IsZero() && time.Since(c.lastUse) < c.timing.InUse)
}

// roundTrip sends req on the active route. A request that never reached the
// box (it could not connect, or the key didn't match) is tried on the other
// routes while again can make a fresh copy of it.
func (c *Client) roundTrip(req *http.Request, again func() (*http.Request, bool)) (*http.Response, *route, error) {
	c.mu.Lock()
	r := c.active
	c.mu.Unlock()
	resp, err := c.send(r, req)
	if err != nil && failover(req.Context(), err) {
		c.noteFail(r, err, true)
		for _, alt := range c.alternatives(r) {
			next, ok := again()
			if !ok {
				break
			}
			var aerr error
			resp, aerr = c.send(alt, next)
			if aerr == nil {
				r, err = alt, nil
				c.noteCarried(alt)
				break
			}
			if !failover(req.Context(), aerr) {
				return nil, alt, aerr
			}
			c.noteFail(alt, aerr, true)
		}
	}
	if err != nil {
		return nil, r, err
	}
	return resp, r, nil
}

func (c *Client) send(r *route, req *http.Request) (*http.Response, error) {
	c.mu.Lock()
	t := r.transport
	c.mu.Unlock()
	resp, err := t.RoundTrip(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode == http.StatusUnauthorized {
		resp.Body.Close()
		return nil, ErrUntrusted
	}
	return resp, nil
}

// failover reports whether a request's error means its route didn't carry
// it to the box at all, so another route may.
func failover(ctx context.Context, err error) bool {
	if ctx.Err() != nil {
		return false
	}
	return Unsent(err) || errors.Is(err, ErrPinMismatch)
}

// alternatives are the routes to try after r: working ones fastest first,
// then the untried, then the rest.
func (c *Client) alternatives(r *route) []*route {
	c.mu.Lock()
	defer c.mu.Unlock()
	var out []*route
	for _, o := range c.routes {
		if o != r {
			out = append(out, o)
		}
	}
	rank := map[string]int{RouteUp: 0, RouteUnknown: 1, RouteStalled: 2, RouteDown: 3}
	sort.SliceStable(out, func(i, j int) bool {
		if rank[out[i].state] != rank[out[j].state] {
			return rank[out[i].state] < rank[out[j].state]
		}
		return out[i].state == RouteUp && out[i].latency < out[j].latency
	})
	return out
}

// errStalled is a route that didn't answer while another one did.
var errStalled = errors.New("didn't answer in time")

// errWon cancels the pings still running once one route has answered.
var errWon = errors.New("another route answered")

// PingTimed checks that the box is reachable and still trusts this laptop,
// and returns the name it reports and how long the route that answered
// took. It asks over the active route; if that doesn't answer within the
// stall time, or fails, the other routes are asked too and the first to
// answer becomes the active one. It fails only if no route answers.
func (c *Client) PingTimed(ctx context.Context) (string, time.Duration, error) {
	c.mu.Lock()
	first := c.active
	var others []*route
	for _, r := range c.routes {
		if r != first {
			others = append(others, r)
		}
	}
	stall := c.stallLocked(first)
	c.mu.Unlock()
	if len(others) == 0 {
		res := c.pingRoute(Background(ctx), first)
		return res.name, res.latency, res.err
	}

	ctx, cancel := context.WithCancelCause(Background(ctx))
	defer cancel(errWon)
	results := make(chan pingResult, 1+len(others))
	run := func(r *route) {
		go func() { results <- c.pingRoute(ctx, r) }()
	}
	run(first)
	pending, raced := 1, false
	race := func() {
		if raced {
			return
		}
		raced = true
		for _, r := range others {
			run(r)
			pending++
		}
	}
	timer := time.NewTimer(stall)
	defer timer.Stop()
	var firstErr error
	for pending > 0 {
		select {
		case <-timer.C:
			race()
		case res := <-results:
			pending--
			if answered(res.err) {
				if res.route != first && firstErr == nil {
					// Still waiting on the active route: it stalled.
					c.noteFail(first, errStalled, false)
				}
				return res.name, res.latency, res.err
			}
			if res.route == first {
				firstErr = res.err
				race()
			}
		}
	}
	return "", 0, firstErr
}

// answered reports whether a ping's result came from the box itself: it
// answered, or said it no longer trusts this laptop or is stopping. Either
// way the route works.
func answered(err error) bool {
	return err == nil || errors.Is(err, ErrUntrusted) || errors.Is(err, ErrStopping)
}

type pingResult struct {
	route   *route
	name    string
	latency time.Duration
	err     error
}

// pingRoute pings the box over one route and records how it went, unless
// the ping was called off because another route answered first.
func (c *Client) pingRoute(ctx context.Context, r *route) pingResult {
	sent := time.Now()
	res := pingResult{route: r}
	c.mu.Lock()
	cold := len(r.conns) == 0
	c.mu.Unlock()
	res.name, res.err = c.pingOn(ctx, r)
	res.latency = time.Since(sent)
	if errors.Is(context.Cause(ctx), errWon) {
		return res
	}
	if answered(res.err) {
		c.noteOK(r, sent, res.latency, cold)
	} else {
		c.noteFail(r, res.err, false)
	}
	return res
}

func (c *Client) pingOn(ctx context.Context, r *route) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://"+c.box.Address+"/v1/ping", nil)
	if err != nil {
		return "", err
	}
	resp, err := c.send(r, req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		var e errorResponse
		if json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&e) == nil && e.Code == codeStopping {
			return "", ErrStopping
		}
		if e.Error != "" {
			return "", errors.New(e.Error)
		}
		return "", fmt.Errorf("box replied %s", resp.Status)
	}
	var out nameResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&out); err != nil {
		return "", err
	}
	return out.Name, nil
}

// stallLocked is how long r may take to answer a ping before the other
// routes are asked: the stall time, or four times r's usual latency.
func (c *Client) stallLocked(r *route) time.Duration {
	return min(max(c.timing.Stall, 4*r.latency), c.timing.ProbeTimeout)
}

// ProbeRoutes measures the routes that are due: while the box is in use,
// each route not carrying its traffic every ProbeUp (ProbeDown when it
// doesn't work); and, in use or not, a stalled route again soon, which
// settles whether it is down. The active route is measured by the health
// check's own pings. It returns when the probes it started have finished.
func (c *Client) ProbeRoutes(ctx context.Context) {
	c.mu.Lock()
	if len(c.routes) < 2 {
		c.mu.Unlock()
		return
	}
	now := time.Now()
	inUse := c.inUseLocked()
	var due []*route
	for _, r := range c.routes {
		switch {
		case r.probing, now.Before(r.nextProbe):
		case r.state == RouteStalled:
			due = append(due, r)
		case !inUse:
		case r == c.active && r.state == RouteUp:
		default:
			due = append(due, r)
		}
	}
	for _, r := range due {
		r.probing = true
	}
	timing := c.timing
	c.mu.Unlock()
	var wg sync.WaitGroup
	for _, r := range due {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c.mu.Lock()
			timeout := timing.ProbeTimeout
			switch {
			case len(r.conns) == 0:
				// Opening the connection may take a while (an SSH login):
				// as long as a dial may.
				timeout = max(timeout, dialTimeout)
			case r.state == RouteStalled:
				// Confirming a stall: as long as the stall itself.
				timeout = c.stallLocked(r)
			}
			c.mu.Unlock()
			pctx, cancel := context.WithTimeout(Background(ctx), timeout)
			defer cancel()
			c.pingRoute(pctx, r)
			c.mu.Lock()
			r.probing = false
			c.mu.Unlock()
		}()
	}
	wg.Wait()
}

// noteOK records a ping that came back on r. A cold one also opened the
// connection (an SSH login, say), so its time is only a first guess: the
// route is measured again soon, and that time replaces it.
func (c *Client) noteOK(r *route, sent time.Time, latency time.Duration, cold bool) {
	c.mu.Lock()
	if r.state == RouteUp && r.latency > 0 && !r.rough && !cold {
		r.latency = (3*r.latency + latency) / 4
	} else {
		r.latency = latency
	}
	r.state, r.strikes, r.err = RouteUp, 0, ""
	r.checked = time.Now()
	r.nextProbe = r.checked.Add(c.timing.ProbeUp)
	r.rough = cold
	if cold {
		r.nextProbe = r.checked
	}
	if sent.After(r.okSent) {
		r.okSent = sent
	}
	change, closing := c.chooseLocked("")
	fn := c.onChange
	c.mu.Unlock()
	c.settle(change, closing, fn)
}

// noteCarried records that a request got through on r, which wasn't known
// to work: it is up, and measured soon.
func (c *Client) noteCarried(r *route) {
	c.mu.Lock()
	if r.state == RouteUp {
		c.mu.Unlock()
		return
	}
	r.state, r.strikes, r.err = RouteUp, 0, ""
	r.checked = time.Now()
	r.nextProbe = time.Time{}
	change, closing := c.chooseLocked("")
	fn := c.onChange
	c.mu.Unlock()
	c.settle(change, closing, fn)
}

// noteFail records a failure on r. hard is a route that could not connect
// at all: there is nothing on it to wait for, so it is down at once.
func (c *Client) noteFail(r *route, err error, hard bool) {
	c.mu.Lock()
	r.strikes++
	r.err = err.Error()
	r.checked = time.Now()
	if hard || r.strikes >= 2 {
		r.state = RouteDown
		r.nextProbe = r.checked.Add(c.timing.ProbeDown)
	} else {
		r.state = RouteStalled
		r.nextProbe = r.checked.Add(c.timing.ProbeStalled)
	}
	change, closing := c.chooseLocked(r.Label + " " + r.err)
	fn := c.onChange
	c.mu.Unlock()
	c.settle(change, closing, fn)
}

func (c *Client) settle(change *RouteChange, closing []io.Closer, fn func(RouteChange)) {
	for _, cl := range closing {
		cl.Close()
	}
	if change != nil && fn != nil {
		fn(*change)
	}
}

// chooseLocked picks the active route after a measurement: a working route
// instead of one that stalled or is down, and a clearly faster one instead
// of a working one. Routes that are down give up their connections once
// another route works, so the streams on them reattach there; with no
// other route, they are left to the health check.
func (c *Client) chooseLocked(why string) (*RouteChange, []io.Closer) {
	cur := c.active
	if cur == nil {
		return nil, nil
	}
	var best *route
	for _, r := range c.routes {
		if r.state == RouteUp && (best == nil || r.latency < best.latency) {
			best = r
		}
	}
	next := cur
	switch {
	case best == nil:
	case cur.state == RouteStalled || cur.state == RouteDown:
		next = best
	case cur.state == RouteUp && best != cur && best.latency*4 < cur.latency*3 && cur.latency-best.latency > switchMargin:
		next = best
		why = "faster"
	}
	var change *RouteChange
	if next != cur {
		c.active = next
		change = &RouteChange{From: cur.ID, To: next.ID, Reason: why}
	}
	var closing []io.Closer
	if best != nil {
		for _, r := range c.routes {
			if r.state == RouteDown && len(r.conns) > 0 {
				closing = append(closing, idleCloser{r.transport})
				for t := range r.conns {
					closing = append(closing, abandoned{t})
				}
				r.transport = c.newTransport(r)
				if change == nil {
					change = &RouteChange{From: c.active.ID, To: c.active.ID}
				}
				change.Down = r.ID
				if change.Reason == "" {
					change.Reason = r.err
				}
			}
		}
	}
	return change, closing
}
