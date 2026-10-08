package agent

import (
	"bytes"
	"context"
	"io"
	"log"
	"math/rand/v2"
	"net"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/cosscom/shipyard/internal/trust"
)

// faultProxy sits between the agent and a test box and does to the link
// what a Tailscale relay on another continent does: adds latency, in
// spikes, stalls, drops everything (a blackhole), or refuses connections
// (the box's machine is up but berthd isn't).
type faultProxy struct {
	t      *testing.T
	target string
	addr   string

	mu        sync.Mutex
	ln        net.Listener
	conns     map[net.Conn]bool
	delay     func() time.Duration // per chunk, box → laptop
	stallTill time.Time
	blackhole bool
}

func newFaultProxy(t *testing.T, target string) *faultProxy {
	t.Helper()
	p := &faultProxy{t: t, target: target, conns: map[net.Conn]bool{}}
	p.listen("127.0.0.1:0")
	t.Cleanup(p.refuse)
	return p
}

func (p *faultProxy) listen(addr string) {
	p.t.Helper()
	var ln net.Listener
	var err error
	for range 50 {
		if ln, err = net.Listen("tcp", addr); err == nil {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if err != nil {
		p.t.Fatal(err)
	}
	p.mu.Lock()
	p.ln, p.addr = ln, ln.Addr().String()
	p.mu.Unlock()
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			go p.serve(c)
		}
	}()
}

func (p *faultProxy) serve(down net.Conn) {
	p.mu.Lock()
	p.conns[down] = true
	hole := p.blackhole
	p.mu.Unlock()
	if hole {
		// Accepted, never answered: what a dead route looks like.
		io.Copy(io.Discard, down)
		return
	}
	up, err := net.Dial("tcp", p.target)
	if err != nil {
		down.Close()
		return
	}
	p.mu.Lock()
	p.conns[up] = true
	p.mu.Unlock()
	go p.pump(up, down, true)
	p.pump(down, up, false)
}

type chunk struct {
	b   []byte
	due time.Time
}

// pump copies src to dst, each chunk held until it is due: after the
// latency (box → laptop) and after any stall, in order, like a link that
// queues rather than drops.
func (p *faultProxy) pump(dst, src net.Conn, toBox bool) {
	q := make(chan chunk, 1024)
	go func() {
		defer dst.Close()
		for c := range q {
			time.Sleep(time.Until(c.due))
			p.mu.Lock()
			hole := p.blackhole
			p.mu.Unlock()
			if hole {
				continue
			}
			if _, err := dst.Write(c.b); err != nil {
				return
			}
		}
	}()
	defer close(q)
	var last time.Time
	buf := make([]byte, 32<<10)
	for {
		n, err := src.Read(buf)
		if n > 0 {
			p.mu.Lock()
			due := time.Now()
			if !toBox && p.delay != nil {
				due = due.Add(p.delay())
			}
			if due.Before(p.stallTill) {
				due = p.stallTill
			}
			hole := p.blackhole
			p.mu.Unlock()
			if due.Before(last) {
				due = last
			}
			last = due
			if !hole {
				q <- chunk{append([]byte(nil), buf[:n]...), due}
			}
		}
		if err != nil {
			return
		}
	}
}

func (p *faultProxy) setDelay(f func() time.Duration) {
	p.mu.Lock()
	p.delay = f
	p.mu.Unlock()
}

func (p *faultProxy) stall(d time.Duration) {
	p.mu.Lock()
	p.stallTill = time.Now().Add(d)
	p.mu.Unlock()
}

func (p *faultProxy) closeConns() {
	for c := range p.conns {
		c.Close()
	}
	clear(p.conns)
}

// setBlackhole drops every byte, both ways, until it is turned off; the
// connections it ruined are closed then.
func (p *faultProxy) setBlackhole(on bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.blackhole = on
	if !on {
		p.closeConns()
	}
}

// refuse closes the proxy's port and every connection through it: the
// next dial is refused.
func (p *faultProxy) refuse() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.ln != nil {
		p.ln.Close()
		p.ln = nil
	}
	p.closeConns()
}

// syncBuffer is a log the agent writes while the test reads it.
type syncBuffer struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (s *syncBuffer) Write(b []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.b.Write(b)
}

func (s *syncBuffer) lines(prefix string) []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []string
	for _, l := range strings.Split(s.b.String(), "\n") {
		if strings.HasPrefix(l, prefix) {
			out = append(out, l)
		}
	}
	return out
}

func boxStatus(t *testing.T, a *runningAgent) BoxStatus {
	t.Helper()
	s, err := a.client.Status(context.Background())
	if err != nil || len(s.Boxes) != 1 {
		return BoxStatus{}
	}
	return s.Boxes[0]
}

func within(t *testing.T, d time.Duration, what string, cond func() bool) time.Duration {
	t.Helper()
	start := time.Now()
	for !cond() {
		if time.Since(start) > d {
			t.Fatalf("not %s within %s", what, d)
		}
		time.Sleep(20 * time.Millisecond)
	}
	return time.Since(start)
}

func TestASlowRelayedLinkStaysConnectedWhileARealOutageStillShows(t *testing.T) {
	if testing.Short() {
		t.Skip("rides out latency spikes for some seconds")
	}
	b := newBox(t)
	dir := b.pairLaptop()
	fp := newFaultProxy(t, b.address)
	// The laptop reaches the box through the proxy.
	store := trust.NewStore(filepath.Join(dir, "boxes.json"))
	peer, _, err := store.ByName("devbox")
	if err != nil {
		t.Fatal(err)
	}
	peer.Address = fp.addr
	if err := store.Add(peer); err != nil {
		t.Fatal(err)
	}
	const timeout = 2500 * time.Millisecond
	logs := &syncBuffer{}
	a := startAgentConfig(t, dir, &fakeNetworks{}, func(c *Config) {
		c.HealthInterval = 300 * time.Millisecond
		c.PingTimeout = timeout
		c.Log = log.New(logs, "", 0)
	})
	tok := uiToken(t, a)
	within(t, 5*time.Second, "online", func() bool { return boxStatus(t, a).State == StateOnline })

	// Calm: no line in the log for check after check.
	time.Sleep(time.Second)
	if l := logs.lines("box devbox:"); len(l) != 1 || !strings.HasPrefix(l[0], "box devbox: connecting → online (health check took ") {
		t.Fatalf("log while calm: %q", l)
	}

	// An open stream to the box (a forward; a terminal rides the same
	// connection), which must outlive everything below short of an outage.
	local := freePort(t)
	if _, err := a.client.AddForward(context.Background(), "devbox", local, echoServer(t)); err != nil {
		t.Fatal(err)
	}
	stream, err := net.Dial("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(local)))
	if err != nil {
		t.Fatal(err)
	}
	defer stream.Close()
	echo := func(msg string) {
		t.Helper()
		stream.SetDeadline(time.Now().Add(10 * time.Second))
		buf := make([]byte, len(msg))
		if _, err := stream.Write([]byte(msg)); err != nil {
			t.Fatalf("the open stream dropped: %v", err)
		}
		if _, err := io.ReadFull(stream, buf); err != nil || string(buf) != msg {
			t.Fatalf("the open stream dropped: %q, %v", buf, err)
		}
	}
	echo("before the spikes")

	// Spikes of 1.5–2 s on the laptop's side, with calm between, and one stall longer than a
	// check waits: the box is slow at times, and never away.
	watch := func(during func()) (slow bool) {
		t.Helper()
		done := make(chan struct{})
		go func() { during(); close(done) }()
		for {
			select {
			case <-done:
				return slow
			default:
			}
			st := boxStatus(t, a)
			if st.State != StateOnline {
				t.Fatalf("the box went %s (%s) on a slow link; log:\n%s", st.State, st.Error, strings.Join(logs.lines("box "), "\n"))
			}
			slow = slow || st.Link.Slow
			time.Sleep(25 * time.Millisecond)
		}
	}
	spikes := func() {
		for range 3 {
			fp.setDelay(func() time.Duration { return 1500*time.Millisecond + rand.N(500*time.Millisecond) })
			time.Sleep(2 * time.Second)
			fp.setDelay(nil)
			time.Sleep(time.Second)
		}
		// From steady, so the stall is what makes it slow.
		for steady := time.Now().Add(5 * time.Second); time.Now().Before(steady) && boxStatus(t, a).Link.Slow; {
			time.Sleep(20 * time.Millisecond)
		}
		// Longer than the first check waits, shorter than it and the
		// check confirming it together.
		fp.stall(timeout + 1500*time.Millisecond)
		time.Sleep(timeout + 2*time.Second)
	}
	if !watch(spikes) {
		t.Fatal("the link was never called slow")
	}
	within(t, 5*time.Second, "steady after the stall", func() bool { st := boxStatus(t, a); return st.State == StateOnline && !st.Link.Slow })
	if l := logs.lines("box devbox: online → slow (health check failed"); len(l) != 1 {
		t.Fatalf("the stall: %q\n%s", l, strings.Join(logs.lines("box "), "\n"))
	}
	// The stream opened before it all still carries bytes.
	echo("after the spikes and the stall")
	// Requests still go through while it is slow: no instant 503.
	fp.setDelay(func() time.Duration { return 1600 * time.Millisecond })
	within(t, 5*time.Second, "slow", func() bool { return boxStatus(t, a).Link.Slow })
	if resp, body := uiCall(t, a, "GET", "/v1/boxes/devbox/api/services", tok); resp.StatusCode != http.StatusOK {
		t.Fatalf("a request to a slow box: %d %s", resp.StatusCode, body)
	}
	st := boxStatus(t, a)
	if st.State != StateOnline || st.Link.Reason == "" || st.Link.MaxMs < 1500 || st.RetryAt != nil {
		t.Fatalf("a slow box's status: %+v", st)
	}
	// One good check and it is online again.
	fp.setDelay(nil)
	within(t, 5*time.Second, "steady", func() bool { st := boxStatus(t, a); return st.State == StateOnline && !st.Link.Slow })

	// A real outage (every byte dropped) is away after two checks.
	fp.setBlackhole(true)
	// The first check waits 2.5s, the one confirming it 3.1s (a quarter
	// longer), with about a fifth of the interval between: as 8s, 2s and
	// 10s do for a real box, about 20s in all.
	took := within(t, 4*timeout, "away in a blackhole", func() bool { return boxStatus(t, a).State == StateOffline })
	t.Logf("a blackholed box showed away after %s", took.Round(10*time.Millisecond))
	if took > timeout+timeout*5/4+1500*time.Millisecond {
		t.Fatalf("a blackholed box took %s to show away", took)
	}
	start := time.Now()
	resp, _ := uiCall(t, a, "GET", "/v1/boxes/devbox/api/services", tok)
	if resp.StatusCode != http.StatusServiceUnavailable || time.Since(start) > time.Second {
		t.Fatalf("an away box's request: %d after %s", resp.StatusCode, time.Since(start))
	}
	fp.setBlackhole(false)
	within(t, 5*time.Second, "back online", func() bool { st := boxStatus(t, a); return st.State == StateOnline && !st.Link.Slow })

	// A refused connection is away at the first check.
	fp.refuse()
	within(t, 3*time.Second, "away when refused", func() bool { return boxStatus(t, a).State == StateOffline })
	fp.listen(fp.addr)
	within(t, 5*time.Second, "back online", func() bool { return boxStatus(t, a).State == StateOnline })

	// Every change of state was logged once, with why; nothing else was.
	lines := logs.lines("box devbox:")
	text := strings.Join(lines, "\n")
	t.Logf("the agent's log:\n%s", text)
	for _, want := range []string{
		"box devbox: online → slow (health check took 1.6s)",
		"box devbox: online → slow (health check failed: no answer in 2.5s)",
		"box devbox: slow → away (2 checks failed: no answer in 3.1s)",
		"→ away (connection refused)",
		"box devbox: away → online (health check took ",
		"box devbox: slow → online (health check took ",
	} {
		if !strings.Contains(text, want) {
			t.Errorf("no %q in the log:\n%s", want, text)
		}
	}
	for i, l := range lines {
		from, to, ok := strings.Cut(strings.TrimPrefix(strings.SplitN(l, " (", 2)[0], "box devbox: "), " → ")
		if !ok || from == to {
			t.Errorf("not a change of state: %q", l)
		}
		if i > 0 {
			prevTo := strings.SplitN(strings.SplitN(lines[i-1], " → ", 2)[1], " (", 2)[0]
			if prevTo != from {
				t.Errorf("line %d starts from %s, but the last ended at %s", i, from, prevTo)
			}
		}
	}
}
