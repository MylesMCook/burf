package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"

	"github.com/MylesMCook/burf/internal/netfault"
	"github.com/MylesMCook/burf/internal/sshroute/sshtest"
	"github.com/MylesMCook/burf/internal/sshsetup"
	"github.com/MylesMCook/burf/internal/terminal"
	"github.com/MylesMCook/burf/internal/trust"
	"github.com/MylesMCook/burf/internal/wire"
)

var testRouteTiming = wire.RouteTiming{
	Stall:        150 * time.Millisecond,
	ProbeTimeout: 600 * time.Millisecond,
	ProbeUp:      100 * time.Millisecond,
	ProbeDown:    150 * time.Millisecond,
	ProbeStalled: 50 * time.Millisecond,
	InUse:        time.Minute,
}

// routedBox is a test box the laptop reaches two ways: its paired address
// through one fault proxy, and SSH (the fake ssh) through another.
type routedBox struct {
	*testBox
	dir    string
	paired *netfault.Proxy
	ssh    *netfault.Proxy
}

func newRoutedBox(t *testing.T, extra func(*wire.Server)) *routedBox {
	t.Helper()
	b := newBoxWith(t, extra)
	dir := b.pairLaptop()
	rb := &routedBox{testBox: b, dir: dir}
	var err error
	if rb.paired, err = netfault.New(b.address); err != nil {
		t.Fatal(err)
	}
	if rb.ssh, err = netfault.New(b.address); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(rb.paired.Close)
	t.Cleanup(rb.ssh.Close)
	// The laptop knows the box at the first proxy.
	store := trust.NewStore(filepath.Join(dir, "boxes.json"))
	p, _, err := store.ByName("devbox")
	if err != nil {
		t.Fatal(err)
	}
	p.Address = rb.paired.Addr()
	if err := store.Add(p); err != nil {
		t.Fatal(err)
	}
	// Added over SSH: the host it was added with, berthd behind the second.
	if err := RecordSSHRoute(dir, "devbox", p.Fingerprint.String(), "alex@devbox", "", rb.ssh.Addr()); err != nil {
		t.Fatal(err)
	}
	return rb
}

// startRoutedAgent is startAgent with the fake ssh, no SSH agent or
// ~/.ssh/config of the person running the tests, and quick route timing.
func startRoutedAgent(t *testing.T, dir string) *runningAgent {
	t.Helper()
	for _, kv := range sshtest.Environ(filepath.Join(dir, "ssh.log")) {
		k, v, _ := strings.Cut(kv, "=")
		t.Setenv(k, v)
	}
	return startAgentConfig(t, dir, &fakeNetworks{}, func(c *Config) {
		c.SSH = os.Args[0]
		c.SSHFinder = &sshsetup.Finder{Getenv: func(string) string { return "" }, Alive: func(string) bool { return false }}
		c.SSHHosts = func() []string { return []string{"devbox-other"} }
		c.RouteTiming = testRouteTiming
	})
}

func routeOf(b BoxStatus, id string) RouteStatus {
	for _, r := range b.Routes {
		if r.ID == id {
			return r
		}
	}
	return RouteStatus{}
}

// recordingTerminal is a box's terminal that echoes what is typed, and
// keeps everything typed into it, across attaches.
type recordingTerminal struct {
	mu  sync.Mutex
	got bytes.Buffer
	n   int
}

func (rt *recordingTerminal) attaches() int {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	return rt.n
}

func (rt *recordingTerminal) typed() string {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	return rt.got.String()
}

func (rt *recordingTerminal) mount(s *wire.Server) {
	s.Handle("POST /v1/sessions/{name}/attach", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rc := http.NewResponseController(w)
		rc.EnableFullDuplex()
		rt.mu.Lock()
		rt.n++
		rt.mu.Unlock()
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("$ "))
		rc.Flush()
		terminal.ReadFrames(r.Body, func(p []byte) error {
			rt.mu.Lock()
			rt.got.Write(p)
			rt.mu.Unlock()
			w.Write(p)
			return rc.Flush()
		}, func(int, int) {})
	}))
}

// appTerminal does what the app's terminal does (terminal-view.tsx): it
// sends keys while attached, holds them while it isn't, attaches again
// when the agent closes it, and sends what it held once it is back.
type appTerminal struct {
	url      string
	mu       sync.Mutex
	ws       *websocket.Conn
	held     [][]byte
	attaches int
	opened   chan struct{}
}

func (at *appTerminal) run(ctx context.Context) {
	for ctx.Err() == nil {
		ws, _, err := websocket.Dial(ctx, at.url, nil)
		if err != nil {
			time.Sleep(20 * time.Millisecond)
			continue
		}
		at.mu.Lock()
		at.ws = ws
		at.attaches++
		held := at.held
		at.held = nil
		at.mu.Unlock()
		select {
		case at.opened <- struct{}{}:
		default:
		}
		for _, k := range held {
			ws.Write(ctx, websocket.MessageBinary, k)
		}
		for {
			if _, _, err := ws.Read(ctx); err != nil {
				break
			}
		}
		at.mu.Lock()
		at.ws = nil
		at.mu.Unlock()
		ws.CloseNow()
		// The app waits a moment before it attaches again.
		time.Sleep(50 * time.Millisecond)
	}
}

func (at *appTerminal) key(ctx context.Context, k []byte) {
	at.mu.Lock()
	defer at.mu.Unlock()
	if at.ws == nil || at.ws.Write(ctx, websocket.MessageBinary, k) != nil {
		at.held = append(at.held, k)
	}
}

// The route a terminal rides is blackholed while someone types: the agent
// moves to the SSH route, the terminal attaches again over it once the old
// route is declared down, and every key arrives, once and in order.
func TestATerminalSurvivesItsRouteGoingDownWithoutLosingKeys(t *testing.T) {
	term := &recordingTerminal{}
	rb := newRoutedBox(t, term.mount)
	a := startRoutedAgent(t, rb.dir)
	tok := uiToken(t, a)
	eventually(t, "box online", func() bool { return boxStatus(t, a).State == StateOnline })
	if st := boxStatus(t, a); st.Route != wire.RoutePaired || len(st.Routes) != 2 || routeOf(st, "ssh").Detail != "alex@devbox" || !routeOf(st, "ssh").Auto {
		t.Fatalf("routes at the start: %+v", st)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	app := &appTerminal{url: "ws://" + a.ui + "/v1/boxes/devbox/sessions/fix/attach?cols=80&rows=24&token=" + tok, opened: make(chan struct{}, 1)}
	go app.run(ctx)
	<-app.opened
	// In use: the SSH route is measured too.
	eventually(t, "ssh route measured", func() bool { return routeOf(boxStatus(t, a), "ssh").State == wire.RouteUp })

	var want strings.Builder
	var blackholed, moved time.Time
	for i := range 200 {
		k := fmt.Sprintf("k%03d,", i)
		want.WriteString(k)
		app.key(ctx, []byte(k))
		if i == 40 {
			rb.paired.Blackhole(true)
			blackholed = time.Now()
		}
		if i > 40 && moved.IsZero() && term.attaches() > 1 {
			moved = time.Now()
		}
		time.Sleep(5 * time.Millisecond)
	}
	deadline := time.Now().Add(10 * time.Second)
	for term.typed() != want.String() {
		if time.Now().After(deadline) {
			t.Fatalf("the box got\n%s\nwant\n%s", term.typed(), want.String())
		}
		time.Sleep(20 * time.Millisecond)
	}
	st := boxStatus(t, a)
	if st.State != StateOnline || st.Route != "ssh" || routeOf(st, wire.RoutePaired).State != wire.RouteDown {
		t.Fatalf("after the failover: %+v", st)
	}
	app.mu.Lock()
	attaches := app.attaches
	app.mu.Unlock()
	// The agent attached again by itself: the app's terminal never closed.
	if attaches != 1 {
		t.Fatalf("the app attached %d times, want once", attaches)
	}
	t.Logf("the terminal moved to SSH %s after its route was blackholed", moved.Sub(blackholed).Round(time.Millisecond))
	// Requests go over SSH now.
	if resp, body := uiCall(t, a, "GET", "/v1/boxes/devbox/api/services", tok); resp.StatusCode != http.StatusOK {
		t.Fatalf("a request after the failover: %d %s", resp.StatusCode, body)
	}
	b, _ := os.ReadFile(filepath.Join(rb.dir, "ssh.log"))
	if !strings.Contains(string(b), "BatchMode=yes") || !strings.Contains(string(b), "-W "+rb.ssh.Addr()+" alex@devbox") {
		t.Fatalf("ssh ran as:\n%s", b)
	}
}

// The person turns routes on and off, and adds one, in Settings › Boxes;
// the status says which is in use and how each is doing.
func TestRoutesCanBeTurnedOffAndAdded(t *testing.T) {
	rb := newRoutedBox(t, nil)
	rb.paired.SetDelay(30 * time.Millisecond)
	a := startRoutedAgent(t, rb.dir)
	tok := uiToken(t, a)
	eventually(t, "box online", func() bool { return boxStatus(t, a).State == StateOnline })
	// In use, the faster SSH route takes over.
	uiCall(t, a, "GET", "/v1/boxes/devbox/api/services", tok)
	eventually(t, "ssh to take over", func() bool {
		uiCall(t, a, "GET", "/v1/boxes/devbox/api/services", tok)
		return boxStatus(t, a).Route == "ssh"
	})
	st := boxStatus(t, a)
	if p, s := routeOf(st, wire.RoutePaired), routeOf(st, "ssh"); p.LatencyMs <= s.LatencyMs || p.State != wire.RouteUp || !s.Active {
		t.Fatalf("routes %+v", st.Routes)
	}

	// SSH off: back to the paired address.
	if resp, body := uiSend(t, a, "PATCH", "/v1/boxes/devbox/routes/ssh", tok, `{"off":true}`); resp.StatusCode != http.StatusOK {
		t.Fatalf("turning ssh off: %d %s", resp.StatusCode, body)
	}
	st = boxStatus(t, a)
	if st.Route != wire.RoutePaired || routeOf(st, "ssh").State != "off" {
		t.Fatalf("with ssh off: %+v", st)
	}
	// The last route on can't be turned off.
	if resp, _ := uiSend(t, a, "PATCH", "/v1/boxes/devbox/routes/paired", tok, `{"off":true}`); resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("turning the last route off: %d", resp.StatusCode)
	}
	// A direct address, and nothing ssh would read as an option.
	if resp, body := uiSend(t, a, "POST", "/v1/boxes/devbox/routes", tok, `{"kind":"direct","address":"`+rb.address+`"}`); resp.StatusCode != http.StatusOK {
		t.Fatalf("adding a direct route: %d %s", resp.StatusCode, body)
	}
	if resp, _ := uiSend(t, a, "POST", "/v1/boxes/devbox/routes", tok, `{"kind":"ssh","host":"-oProxyCommand=sh"}`); resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("an option as a host: %d", resp.StatusCode)
	}
	eventually(t, "direct route used", func() bool {
		uiCall(t, a, "GET", "/v1/boxes/devbox/api/services", tok)
		return boxStatus(t, a).Route == "direct:"+rb.address
	})
	// The paired address can be off now that another route is on.
	if resp, body := uiSend(t, a, "PATCH", "/v1/boxes/devbox/routes/paired", tok, `{"off":true}`); resp.StatusCode != http.StatusOK {
		t.Fatalf("turning paired off: %d %s", resp.StatusCode, body)
	}
	st = boxStatus(t, a)
	if routeOf(st, wire.RoutePaired).State != "off" || st.State != StateOnline {
		t.Fatalf("paired off: %+v", st)
	}
	if resp, _ := uiSend(t, a, "DELETE", "/v1/boxes/devbox/routes/paired", tok, ""); resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("removing the paired route: %d", resp.StatusCode)
	}
	if resp, body := uiSend(t, a, "DELETE", "/v1/boxes/devbox/routes/ssh", tok, ""); resp.StatusCode != http.StatusOK {
		t.Fatalf("removing ssh: %d %s", resp.StatusCode, body)
	}
	if r := routeOf(boxStatus(t, a), "ssh"); r.ID != "" {
		t.Fatalf("ssh still listed: %+v", r)
	}
}

// An SSH host that can't be reached shows as down, and the box stays
// online over its other route.
func TestAnSSHRouteThatFailsIsShownDownAndTheBoxStaysUp(t *testing.T) {
	rb := newRoutedBox(t, nil)
	p, _, _ := trust.NewStore(filepath.Join(rb.dir, "boxes.json")).ByName("devbox")
	if err := RecordSSHRoute(rb.dir, "devbox", p.Fingerprint.String(), sshtest.Unreachable, "", ""); err != nil {
		t.Fatal(err)
	}
	a := startRoutedAgent(t, rb.dir)
	tok := uiToken(t, a)
	eventually(t, "box online", func() bool { return boxStatus(t, a).State == StateOnline })
	uiCall(t, a, "GET", "/v1/boxes/devbox/api/services", tok)
	eventually(t, "ssh down", func() bool {
		r := routeOf(boxStatus(t, a), "ssh")
		return r.State == wire.RouteDown && strings.Contains(r.Error, "Could not resolve hostname")
	})
	if st := boxStatus(t, a); st.State != StateOnline || st.Route != wire.RoutePaired {
		t.Fatalf("%+v", st)
	}
}

// A box added before routes existed has no SSH route; one ~/.ssh/config
// names like the box is offered, off.
func TestAnSSHHostNamedLikeTheBoxIsSuggested(t *testing.T) {
	b := newBox(t)
	dir := b.pairLaptop()
	store := trust.NewStore(filepath.Join(dir, "boxes.json"))
	p, _, _ := store.ByName("devbox")
	p.Name = "devbox-other"
	store.Remove("devbox")
	store.Add(p)
	a := startRoutedAgent(t, dir)
	var st BoxStatus
	eventually(t, "status", func() bool { st = boxStatus(t, a); return st.Name != "" })
	if r := routeOf(st, "ssh"); !r.Suggested || r.State != "off" || r.Detail != "devbox-other" {
		t.Fatalf("routes %+v", st.Routes)
	}
	raw, _ := json.Marshal(st)
	if !strings.Contains(string(raw), `"routes":[`) {
		t.Fatalf("status JSON %s", raw)
	}
}
