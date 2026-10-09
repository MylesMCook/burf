// Package netfault is a TCP proxy that breaks a link on purpose, for tests:
// it adds latency, or blackholes the link the way a dead route does (the
// connection stays open, and nothing gets through either way until it is
// lifted, when what was held up arrives, as TCP's retransmits would deliver
// it). Tests put one between the laptop agent and a test box.
package netfault

import (
	"context"
	"io"
	"net"
	"sync"
	"time"
)

// Proxy forwards connections on its own loopback address to a target.
type Proxy struct {
	target string
	ln     net.Listener

	mu        sync.Mutex
	cond      *sync.Cond
	blackhole bool
	delay     time.Duration
	closed    bool
	conns     map[net.Conn]bool
	accepted  int
}

// New starts a proxy to target on 127.0.0.1.
func New(target string) (*Proxy, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, err
	}
	p := &Proxy{target: target, ln: ln, conns: map[net.Conn]bool{}}
	p.cond = sync.NewCond(&p.mu)
	go p.accept()
	return p, nil
}

// Addr is where the proxy listens.
func (p *Proxy) Addr() string { return p.ln.Addr().String() }

// Dial connects to the proxy whatever address it is asked for: a dialer
// for a route that goes through it.
func (p *Proxy) Dial(ctx context.Context, _, _ string) (net.Conn, error) {
	return (&net.Dialer{}).DialContext(ctx, "tcp", p.Addr())
}

// Blackhole stops (true) or restarts (false) everything through the proxy,
// on open connections and new ones alike.
func (p *Proxy) Blackhole(on bool) {
	p.mu.Lock()
	p.blackhole = on
	p.cond.Broadcast()
	p.mu.Unlock()
}

// SetDelay holds every chunk this long before passing it on, each way.
func (p *Proxy) SetDelay(d time.Duration) {
	p.mu.Lock()
	p.delay = d
	p.mu.Unlock()
}

// Accepted is how many connections the proxy has taken.
func (p *Proxy) Accepted() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.accepted
}

// Close stops the proxy and drops every connection through it.
func (p *Proxy) Close() {
	p.mu.Lock()
	p.closed = true
	p.blackhole = false
	conns := p.conns
	p.conns = map[net.Conn]bool{}
	p.cond.Broadcast()
	p.mu.Unlock()
	p.ln.Close()
	for c := range conns {
		c.Close()
	}
}

func (p *Proxy) accept() {
	for {
		c, err := p.ln.Accept()
		if err != nil {
			return
		}
		go p.serve(c)
	}
}

func (p *Proxy) track(c net.Conn) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.closed {
		c.Close()
		return false
	}
	p.conns[c] = true
	return true
}

func (p *Proxy) forget(c net.Conn) {
	p.mu.Lock()
	delete(p.conns, c)
	p.mu.Unlock()
	c.Close()
}

// pass waits out a blackhole and returns the delay to add, or false once
// the proxy is closed.
func (p *Proxy) pass() (time.Duration, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	for p.blackhole && !p.closed {
		p.cond.Wait()
	}
	return p.delay, !p.closed
}

func (p *Proxy) serve(down net.Conn) {
	if !p.track(down) {
		return
	}
	p.mu.Lock()
	p.accepted++
	p.mu.Unlock()
	defer p.forget(down)
	// A blackholed route never even connects.
	if _, ok := p.pass(); !ok {
		return
	}
	up, err := net.Dial("tcp", p.target)
	if err != nil {
		return
	}
	if !p.track(up) {
		return
	}
	defer p.forget(up)
	done := make(chan struct{}, 2)
	go func() { p.copy(up, down); done <- struct{}{} }()
	go func() { p.copy(down, up); done <- struct{}{} }()
	<-done
}

func (p *Proxy) copy(dst io.Writer, src net.Conn) {
	buf := make([]byte, 32<<10)
	for {
		n, err := src.Read(buf)
		if n > 0 {
			delay, ok := p.pass()
			if !ok {
				return
			}
			if delay > 0 {
				time.Sleep(delay)
			}
			// A blackhole that began while this chunk waited holds it too.
			if _, ok := p.pass(); !ok {
				return
			}
			if _, werr := dst.Write(buf[:n]); werr != nil {
				return
			}
		}
		if err != nil {
			if c, ok := dst.(interface{ CloseWrite() error }); ok {
				c.CloseWrite()
			}
			return
		}
	}
}
