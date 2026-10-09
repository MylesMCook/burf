package agent

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"net/url"
	"os"
	"strings"
	"syscall"
	"testing"
	"time"

	"tailscale.com/ipn/ipnstate"
	"tailscale.com/types/key"

	"github.com/MylesMCook/burf/internal/doctor"
	"github.com/MylesMCook/burf/internal/network"
	"github.com/MylesMCook/burf/internal/trust"
	"github.com/MylesMCook/burf/internal/wire"
)

// As a ping fails: wrapped in the request, then the dial.
func pingErr(err error) error {
	return &url.Error{Op: "Get", URL: "https://100.64.0.4:7444/v1/ping", Err: &net.OpError{Op: "dial", Net: "tcp", Err: err}}
}

type timeoutErr struct{}

func (timeoutErr) Error() string   { return "i/o timeout" }
func (timeoutErr) Timeout() bool   { return true }
func (timeoutErr) Temporary() bool { return true }

func TestOneSlowCheckMarksTheBoxSlowNotAway(t *testing.T) {
	// It answered, slowly.
	s := stepLink(StateOnline, 0, 6200*time.Millisecond, 8*time.Second, nil)
	if s.State != StateOnline || !s.Slow || s.Fails != 0 || s.Reason != "health check took 6.2s" {
		t.Fatalf("a slow answer: %+v", s)
	}
	if got := linkLabel(s.State, s.Slow); got != "slow" {
		t.Fatalf("label %q", got)
	}
	// It didn't answer at all, once.
	s = stepLink(StateOnline, 0, 8*time.Second, 8*time.Second, pingErr(timeoutErr{}))
	if s.State != StateOnline || !s.Slow || s.Fails != 1 || s.Reason != "health check failed: i/o timeout" {
		t.Fatalf("one timed-out check: %+v", s)
	}
	s = stepLink(StateOnline, 0, 8*time.Second, 8*time.Second, fmt.Errorf("ping: %w", context.DeadlineExceeded))
	if s.State != StateOnline || !s.Slow || s.Reason != "health check failed: no answer in 8s" {
		t.Fatalf("a check past its deadline: %+v", s)
	}
	// A quick answer is not slow.
	if s := stepLink(StateOnline, 0, 80*time.Millisecond, 8*time.Second, nil); s.Slow {
		t.Fatalf("80ms is slow: %+v", s)
	}
}

func TestTwoFailedChecksInARowTakeTheBoxAway(t *testing.T) {
	first := stepLink(StateOnline, 0, time.Second, 8*time.Second, pingErr(timeoutErr{}))
	second := stepLink(first.State, first.Fails, time.Second, 8*time.Second, pingErr(timeoutErr{}))
	if second.State != StateOffline || second.Fails != 2 || second.Reason != "2 checks failed: i/o timeout" {
		t.Fatalf("second failure: %+v", second)
	}
	if got := linkLabel(second.State, second.Slow); got != "away" {
		t.Fatalf("label %q", got)
	}
	// Away stays away while it keeps failing.
	if s := stepLink(StateOffline, 5, time.Second, 8*time.Second, pingErr(timeoutErr{})); s.State != StateOffline || s.Fails != 6 {
		t.Fatalf("still failing: %+v", s)
	}
	// A box never reached yet is still connecting after one failure.
	if s := stepLink(StateConnecting, 0, time.Second, 8*time.Second, pingErr(timeoutErr{})); s.State != StateConnecting {
		t.Fatalf("connecting, one failure: %+v", s)
	}
}

func TestAHardFailureTakesTheBoxAwayAtOnce(t *testing.T) {
	for name, err := range map[string]error{
		"refused":         pingErr(&os.SyscallError{Syscall: "connect", Err: syscall.ECONNREFUSED}),
		"refused (tsnet)": pingErr(errors.New("connect tcp 100.64.0.4:7444: connection was refused")),
		// Windows numbers it differently, and words it "actively refused it".
		"refused (Windows)": pingErr(&os.SyscallError{Syscall: "connectex", Err: syscall.Errno(10061)}),
		"wrong key":         pingErr(wire.ErrPinMismatch),
		"stopping":          wire.ErrStopping,
		"goaway":            errors.New("http2: server sent GOAWAY and closed the connection; LastStreamID=3, ErrCode=NO_ERROR"),
	} {
		s := stepLink(StateOnline, 0, time.Millisecond, 8*time.Second, err)
		if s.State != StateOffline || s.Fails != 1 {
			t.Fatalf("%s: %+v", name, s)
		}
	}
	s := stepLink(StateOnline, 0, time.Millisecond, 8*time.Second, pingErr(&os.SyscallError{Syscall: "connect", Err: syscall.ECONNREFUSED}))
	if s.Reason != "connection refused" {
		t.Fatalf("reason %q", s.Reason)
	}
	if s := stepLink(StateOnline, 0, time.Millisecond, 8*time.Second, pingErr(&os.SyscallError{Syscall: "connectex", Err: syscall.Errno(10061)})); s.Reason != "connection refused" {
		t.Fatalf("reason on Windows %q", s.Reason)
	}
	// A box that no longer trusts this laptop is untrusted, as before.
	if s := stepLink(StateOnline, 0, time.Millisecond, 8*time.Second, wire.ErrUntrusted); s.State != StateUntrusted {
		t.Fatalf("untrusted: %+v", s)
	}
}

func TestOneGoodCheckBringsTheBoxBack(t *testing.T) {
	for _, prev := range []string{StateOffline, StateConnecting, StateOnline} {
		s := stepLink(prev, 3, 90*time.Millisecond, 8*time.Second, nil)
		if s.State != StateOnline || s.Slow || s.Fails != 0 {
			t.Fatalf("from %s: %+v", prev, s)
		}
	}
}

func TestLinkSamplesKeepTheRecentMaxAndJitter(t *testing.T) {
	var samples []time.Duration
	var hi, jit int64
	for _, ms := range []int{80, 80, 1900, 80, 80, 80, 80, 80, 80} {
		samples, hi, jit = noteSample(samples, time.Duration(ms)*time.Millisecond)
		if len(samples) > linkSamples {
			t.Fatalf("%d samples kept", len(samples))
		}
	}
	// The 1.9s spike has left the window of six.
	if hi != 80 || jit != 0 {
		t.Fatalf("max %d jitter %d", hi, jit)
	}
	samples, hi, jit = noteSample(samples, 1900*time.Millisecond)
	if hi != 1900 || jit != 364 {
		t.Fatalf("max %d jitter %d", hi, jit)
	}
}

func TestARelayedBoxSaysThroughWhichServer(t *testing.T) {
	p := network.Path{Via: "relay", Relay: "nyc", RelayName: "New York", Nearest: "London"}
	if got := describePath(p); got != "relayed through Tailscale's New York server: no direct connection (this computer's nearest is London)" {
		t.Fatalf("%q", got)
	}
	if got := describePath(network.Path{Via: "direct", Endpoint: "203.0.113.4:41641"}); got != "direct connection over Tailscale" {
		t.Fatalf("%q", got)
	}
}

// relayedStatus is a tailnet where box "cal" is reached only through the
// New York relay, while this computer's nearest is London.
func relayedStatus() *ipnstate.Status {
	return &ipnstate.Status{
		Self: &ipnstate.PeerStatus{Relay: "lhr"},
		Peer: map[key.NodePublic]*ipnstate.PeerStatus{
			key.NewNode().Public(): {HostName: "cal", DNSName: "cal.acme.ts.net.", TailscaleIPs: []netip.Addr{netip.MustParseAddr("100.64.0.7")}, Relay: "nyc", Active: true},
		},
	}
}

func TestTheAgentLearnsABoxIsRelayedAndAsksTailscaleRarely(t *testing.T) {
	asked := 0
	a := &Agent{cfg: Config{
		Networks: &fakeNetworks{},
		TailscaleStatus: func(context.Context) (*ipnstate.Status, error) {
			asked++
			return relayedStatus(), nil
		},
	}}
	for range 3 {
		p := a.pathOf(context.Background(), trust.Peer{Name: "cal", Address: "100.64.0.7:7444"})
		if p == nil || p.Via != "relay" || p.RelayName != "New York" || p.Nearest != "London" || p.Tailnet != "" {
			t.Fatalf("path %+v", p)
		}
	}
	if asked != 1 {
		t.Fatalf("asked Tailscale %d times; want once in a couple of minutes", asked)
	}
	// A box at an address that isn't Tailscale's: nothing to ask.
	if p := a.pathOf(context.Background(), trust.Peer{Name: "lan", Address: "192.168.1.20:7444"}); p != nil {
		t.Fatalf("a LAN box's path %+v", p)
	}
	if !strings.Contains(describePath(*a.pathOf(context.Background(), trust.Peer{Name: "cal", Address: "100.64.0.7:7444"})), "New York") {
		t.Fatal("no city")
	}
}

func TestDoctorSaysABoxIsRelayedAndWhatFixesIt(t *testing.T) {
	b := BoxStatus{Name: "cal", State: StateOnline, LatencyMs: 80, Link: Link{
		Slow: true, Reason: "health check took 1.9s", MaxMs: 1900, JitterMs: 364,
		Path: &network.Path{Via: "relay", Relay: "nyc", RelayName: "New York", Nearest: "London"},
	}}
	checks := LinkChecks("Link", b)
	if len(checks) != 2 {
		t.Fatalf("%+v", checks)
	}
	if c := checks[0]; c.Status != doctor.Warn || !strings.Contains(c.Detail, "slow: health check took 1.9s") {
		t.Fatalf("latency: %+v", c)
	}
	if c := checks[1]; c.Status != doctor.Warn || !strings.Contains(c.Detail, "relayed through Tailscale's New York server: no direct connection") || !strings.Contains(c.Fix, "UDP 41641") {
		t.Fatalf("path: %+v", c)
	}
	b.Link = Link{MaxMs: 95, JitterMs: 6, Path: &network.Path{Via: "direct", Endpoint: "203.0.113.4:41641"}}
	checks = LinkChecks("Link", b)
	if checks[0].Status != doctor.OK || checks[0].Detail != "80ms, up to 95ms lately (±6ms)" || checks[1].Status != doctor.OK {
		t.Fatalf("a steady direct link: %+v", checks)
	}
	if LinkChecks("Link", BoxStatus{State: StateOffline}) != nil {
		t.Fatal("an away box has no link to describe")
	}
}
