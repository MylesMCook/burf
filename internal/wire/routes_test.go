package wire

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/netfault"
)

var quickTiming = RouteTiming{
	Stall:        150 * time.Millisecond,
	ProbeTimeout: 600 * time.Millisecond,
	ProbeUp:      100 * time.Millisecond,
	ProbeDown:    100 * time.Millisecond,
	ProbeStalled: 50 * time.Millisecond,
	InUse:        time.Minute,
}

func faulty(t *testing.T, target string) *netfault.Proxy {
	t.Helper()
	p, err := netfault.New(target)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(p.Close)
	return p
}

// twoRoutes is a client for b with two routes, each through its own fault
// proxy: "paired" (active first) and "ssh".
func twoRoutes(t *testing.T, b *box) (*Client, *netfault.Proxy, *netfault.Proxy, *[]RouteChange) {
	t.Helper()
	me := laptop(t)
	if _, err := Pair(context.Background(), me, b.issue(t), "alex-mbp"); err != nil {
		t.Fatal(err)
	}
	a, s := faulty(t, b.address), faulty(t, b.address)
	c := NewClientRoutes(me, b.peer(), []Route{
		{ID: RoutePaired, Kind: RouteTailscale, Label: "Tailscale", Dial: a.Dial},
		{ID: "ssh", Kind: RouteSSH, Label: "SSH", Dial: s.Dial},
	})
	c.SetTiming(quickTiming)
	var mu sync.Mutex
	changes := &[]RouteChange{}
	c.OnRouteChange(func(ch RouteChange) {
		mu.Lock()
		*changes = append(*changes, ch)
		mu.Unlock()
	})
	t.Cleanup(c.Reset)
	return c, a, s, changes
}

func activeRoute(c *Client) string {
	for _, r := range c.Routes() {
		if r.Active {
			return r.ID
		}
	}
	return ""
}

func routeState(c *Client, id string) string {
	s, _ := c.RouteState(id)
	return s
}

func waitFor(t *testing.T, what string, within time.Duration, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(within)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out after %s waiting for %s", within, what)
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func get(c *Client, path string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	resp, err := c.Do(ctx, http.MethodGet, path, nil)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// The route the requests take is blackholed: the next check notices it
// stalled and moves new requests to the other route at once, while a
// stream open on it is left alone until the route fails again, when the
// stream is closed so it can be opened again on the new route.
func TestABlackholedRouteFailsOverAndItsStreamsMoveOnlyOnceItIsDown(t *testing.T) {
	b := startBox(t)
	c, a, _, changes := twoRoutes(t, b)
	port, _ := startEcho(t)
	if _, err := c.Ping(context.Background()); err != nil {
		t.Fatal(err)
	}
	stream, err := c.DialPort(context.Background(), port)
	if err != nil {
		t.Fatal(err)
	}
	defer stream.Close()
	if StreamRoute(stream) != RoutePaired {
		t.Fatalf("stream rides %q", StreamRoute(stream))
	}

	a.Blackhole(true)
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := c.Ping(ctx); err != nil {
		t.Fatalf("a check with one route blackholed failed: %v", err)
	}
	switched := time.Since(start)
	if activeRoute(c) != "ssh" || routeState(c, RoutePaired) != RouteStalled {
		t.Fatalf("after the stall: active %s, paired %s", activeRoute(c), routeState(c, RoutePaired))
	}
	// New requests work at once, over the other route.
	for range 5 {
		if err := get(c, "/v1/ping"); err != nil {
			t.Fatalf("a request after the failover: %v", err)
		}
	}
	// The stream on the stalled route is still open: a hiccup doesn't end it.
	readDone := make(chan error, 1)
	go func() {
		_, err := stream.Read(make([]byte, 1))
		readDone <- err
	}()
	select {
	case err := <-readDone:
		t.Fatalf("the stream ended at the first stall: %v", err)
	case <-time.After(20 * time.Millisecond):
	}
	// The stalled route is tried again; failing, it is down, and the
	// stream on it ends.
	for routeState(c, RoutePaired) != RouteDown {
		c.ProbeRoutes(context.Background())
		time.Sleep(10 * time.Millisecond)
		if time.Since(start) > 5*time.Second {
			t.Fatal("the blackholed route was never declared down")
		}
	}
	select {
	case <-readDone:
	case <-time.After(2 * time.Second):
		t.Fatal("the stream on the down route stayed open")
	}
	down := time.Since(start)
	t.Logf("failover: new requests after %s (stall %s), streams released after %s", switched.Round(time.Millisecond), quickTiming.Stall, down.Round(time.Millisecond))
	again, err := c.DialPort(context.Background(), port)
	if err != nil {
		t.Fatal(err)
	}
	defer again.Close()
	if StreamRoute(again) != "ssh" {
		t.Fatalf("a stream opened again rides %q", StreamRoute(again))
	}
	again.Write([]byte("hi"))
	buf := make([]byte, 2)
	if _, err := io.ReadFull(again, buf); err != nil || string(buf) != "hi" {
		t.Fatalf("echo over the new route: %q %v", buf, err)
	}
	var sawDown bool
	for _, ch := range *changes {
		sawDown = sawDown || ch.Down == RoutePaired
	}
	if !sawDown {
		t.Fatalf("no change said the route went down: %+v", *changes)
	}
}

// A route that stalls once and then answers again was a hiccup: its stream
// carries on.
func TestAStreamRidesOutAHiccup(t *testing.T) {
	b := startBox(t)
	c, a, _, _ := twoRoutes(t, b)
	port, _ := startEcho(t)
	c.Ping(context.Background())
	stream, err := c.DialPort(context.Background(), port)
	if err != nil {
		t.Fatal(err)
	}
	defer stream.Close()
	a.Blackhole(true)
	c.Ping(context.Background())
	if routeState(c, RoutePaired) != RouteStalled {
		t.Fatalf("paired is %s", routeState(c, RoutePaired))
	}
	a.Blackhole(false)
	time.Sleep(quickTiming.ProbeStalled)
	c.ProbeRoutes(context.Background())
	if s := routeState(c, RoutePaired); s != RouteUp {
		t.Fatalf("after the hiccup, paired is %s", s)
	}
	stream.Write([]byte("still here"))
	buf := make([]byte, 10)
	if _, err := io.ReadFull(stream, buf); err != nil || string(buf) != "still here" {
		t.Fatalf("the stream after a hiccup: %q %v", buf, err)
	}
}

// New requests take the fastest working route; one that slows down is
// left, and one that recovers is used again.
func TestTheFastestLiveRouteCarriesNewRequests(t *testing.T) {
	b := startBox(t)
	c, a, s, _ := twoRoutes(t, b)
	a.SetDelay(40 * time.Millisecond)
	c.Ping(context.Background())
	if err := get(c, "/v1/ping"); err != nil { // in use
		t.Fatal(err)
	}
	waitFor(t, "the faster ssh route to take over", 3*time.Second, func() bool {
		c.ProbeRoutes(context.Background())
		return activeRoute(c) == "ssh"
	})

	// SSH goes away for a while: Tailscale, slow as it is, carries on.
	s.Blackhole(true)
	c.Ping(context.Background())
	if activeRoute(c) != RoutePaired {
		t.Fatalf("with ssh blackholed, active is %s", activeRoute(c))
	}
	waitFor(t, "ssh declared down", 3*time.Second, func() bool {
		c.ProbeRoutes(context.Background())
		return routeState(c, "ssh") == RouteDown
	})
	if err := get(c, "/v1/ping"); err != nil {
		t.Fatal(err)
	}
	// It comes back, and being faster, is used again.
	s.Blackhole(false)
	waitFor(t, "ssh to be used again", 3*time.Second, func() bool {
		c.ProbeRoutes(context.Background())
		return activeRoute(c) == "ssh"
	})
	var lat map[string]time.Duration = map[string]time.Duration{}
	for _, r := range c.Routes() {
		lat[r.ID] = r.Latency
	}
	if lat["ssh"] >= lat[RoutePaired] {
		t.Fatalf("latencies %v", lat)
	}
}

// Similar routes don't trade places on every measurement.
func TestSimilarRoutesDontFlap(t *testing.T) {
	b := startBox(t)
	c, _, _, changes := twoRoutes(t, b)
	c.Ping(context.Background())
	get(c, "/v1/ping")
	for range 20 {
		c.Ping(context.Background())
		c.ProbeRoutes(context.Background())
		time.Sleep(5 * time.Millisecond)
	}
	if len(*changes) > 0 {
		t.Fatalf("two equal routes switched: %+v", *changes)
	}
}

// A route that cannot connect at all is skipped for the request at hand,
// which never reached the box.
func TestARequestThatCannotConnectTakesAnotherRoute(t *testing.T) {
	b := startBox(t)
	c, a, _, _ := twoRoutes(t, b)
	a.Close()
	start := time.Now()
	if err := get(c, "/v1/ping"); err != nil {
		t.Fatalf("request with the first route refusing: %v", err)
	}
	if took := time.Since(start); took > time.Second {
		t.Fatalf("the failover took %s", took)
	}
	if activeRoute(c) != "ssh" || routeState(c, RoutePaired) != RouteDown {
		t.Fatalf("active %s, paired %s", activeRoute(c), routeState(c, RoutePaired))
	}
	body := strings.NewReader("posted")
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	resp, err := c.Do(ctx, http.MethodPost, "/v1/ping", body)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
}

// TLS and the pinned key are checked on every route: a route that reaches
// something else is refused, never trusted, and the other route used.
func TestARouteToTheWrongKeyIsRefused(t *testing.T) {
	b := startBox(t)
	other := startBox(t)
	me := laptop(t)
	if _, err := Pair(context.Background(), me, b.issue(t), "alex-mbp"); err != nil {
		t.Fatal(err)
	}
	impostor := func(ctx context.Context, network, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, network, other.address)
	}
	c := NewClientRoutes(me, b.peer(), []Route{
		{ID: "direct:evil", Kind: RouteDirect, Label: "Direct", Dial: impostor},
		{ID: RoutePaired, Kind: RouteTailscale, Label: "Tailscale"},
	})
	c.SetTiming(quickTiming)
	defer c.Reset()
	if err := get(c, "/v1/ping"); err != nil {
		t.Fatalf("request: %v", err)
	}
	st := map[string]RouteStatus{}
	for _, r := range c.Routes() {
		st[r.ID] = r
	}
	if st["direct:evil"].State != RouteDown || !strings.Contains(st["direct:evil"].Error, "does not match its pairing") || !st[RoutePaired].Active {
		t.Fatalf("routes %+v", st)
	}
	// Even alone, it never connects.
	solo := NewClientRoutes(me, b.peer(), []Route{{ID: "direct:evil", Kind: RouteDirect, Dial: impostor}})
	defer solo.Reset()
	if _, err := solo.Ping(context.Background()); !errors.Is(err, ErrPinMismatch) {
		t.Fatalf("ping through the impostor: %v", err)
	}
}

// Only a box in use has its other routes measured.
func TestRoutesAreMeasuredOnlyWhileTheBoxIsInUse(t *testing.T) {
	b := startBox(t)
	c, _, s, _ := twoRoutes(t, b)
	c.Ping(context.Background())
	for range 3 {
		c.ProbeRoutes(context.Background())
		time.Sleep(quickTiming.ProbeUp)
	}
	if s.Accepted() != 0 || routeState(c, "ssh") != RouteUnknown {
		t.Fatalf("an idle box's ssh route was measured: %d connections, %s", s.Accepted(), routeState(c, "ssh"))
	}
	// The agent's own event stream doesn't count as use.
	ctx, cancel := context.WithTimeout(Background(context.Background()), time.Second)
	defer cancel()
	resp, err := c.Do(ctx, http.MethodGet, "/v1/ping", nil)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	c.ProbeRoutes(context.Background())
	if routeState(c, "ssh") != RouteUnknown {
		t.Fatal("a background request made the box in use")
	}
	get(c, "/v1/ping")
	c.ProbeRoutes(context.Background())
	if routeState(c, "ssh") != RouteUp || s.Accepted() != 1 {
		t.Fatalf("in use, ssh is %s after %d connections", routeState(c, "ssh"), s.Accepted())
	}
}

// With the real timing (BERTH_ROUTE_NUMBERS=1; it takes ~10s): how long a
// blackholed route takes to hand new requests, then its streams, to the
// other, counted from the check that first finds it stalled. The agent
// checks each box every 10s, and at once when a request is slow to answer
// (5s) or typing gets no echo.
func TestFailoverNumbersWithTheRealTiming(t *testing.T) {
	if os.Getenv("BERTH_ROUTE_NUMBERS") == "" {
		t.Skip("set BERTH_ROUTE_NUMBERS=1 to measure")
	}
	b := startBox(t)
	c, a, _, _ := twoRoutes(t, b)
	c.SetTiming(DefaultRouteTiming)
	port, _ := startEcho(t)
	c.Ping(context.Background())
	stream, err := c.DialPort(context.Background(), port)
	if err != nil {
		t.Fatal(err)
	}
	defer stream.Close()
	ended := make(chan time.Time, 1)
	go func() {
		stream.Read(make([]byte, 1))
		ended <- time.Now()
	}()
	a.Blackhole(true)
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	if _, err := c.Ping(ctx); err != nil {
		t.Fatal(err)
	}
	moved := time.Since(start)
	// The agent's route loop ticks every second.
	tick := time.NewTicker(time.Second)
	defer tick.Stop()
	for {
		select {
		case at := <-ended:
			t.Logf("new requests moved after %s; streams after %s", moved.Round(time.Millisecond), at.Sub(start).Round(time.Millisecond))
			return
		case <-tick.C:
			go c.ProbeRoutes(context.Background())
		case <-time.After(20 * time.Second):
			t.Fatal("the stream never moved")
		}
	}
}
