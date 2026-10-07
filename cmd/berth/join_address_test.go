package main

import (
	"context"
	"net"
	"strings"
	"testing"
	"time"

	"github.com/sean-brydon/berthd/internal/identity"
	"github.com/sean-brydon/berthd/internal/pairing"
	"github.com/sean-brydon/berthd/internal/trust"
	"github.com/sean-brydon/berthd/internal/wire"
)

func TestJoinCheckRejectsLoopbackOnlyLinkEvenWithThisComputerName(t *testing.T) {
	for _, address := range []string{"127.0.0.1:7445", "127.0.0.2:7445", "[::1]:7445", "[::ffff:127.0.0.1]:7445", "localhost:7445", "LOCALHOST.:7445", "box.localhost:7445", "localhost.localdomain:7445", "0.0.0.0:7445", "[::]:7445", "[fe80::1%en0]:7445"} {
		t.Run(address, func(t *testing.T) {
			inv := pairing.Invite{From: thisComputerName(), Expires: time.Now().Add(time.Minute), Boxes: []pairing.InviteBox{{Name: "local-box", Addresses: []string{address}}}}
			got := checkJoin(laptop{dir: t.TempDir()}, inv, nil)
			if len(got) != 1 || got[0].Status != joinFailed || !strings.Contains(got[0].Error, "local-only") {
				t.Fatalf("join preview advertises a local-only address as ready: %+v", got)
			}
		})
	}
}

func TestJoinDirectDialRejectsResolvedLocalSocketBeforeConnection(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	_, port, _ := net.SplitHostPort(listener.Addr().String())
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	conn, err := joinDirectDial(ctx, "tcp", net.JoinHostPort("localhost.", port))
	if conn != nil {
		conn.Close()
		t.Fatal("join opened a local connection")
	}
	if err == nil || !strings.Contains(err.Error(), "local-only") {
		t.Fatalf("resolved local socket = %v", err)
	}
}

func TestJoinDoesNotDialLoopbackAndKeepsExplicitlyPairedLocalBox(t *testing.T) {
	l := laptop{dir: t.TempDir()}
	id, err := l.identity()
	if err != nil {
		t.Fatal(err)
	}
	b := pairing.InviteBox{Name: "local", Addresses: []string{"127.0.0.1:7445", "localhost:7445"}}
	b.Fingerprint[0] = 1
	old := pairInvitedBox
	t.Cleanup(func() { pairInvitedBox = old })
	calls := 0
	pairInvitedBox = func(context.Context, *identity.Identity, pairing.Token, string, wire.DialFunc) (string, error) {
		calls++
		return "local", nil
	}
	if got := joinOne(context.Background(), l, id, "recipient", b, nil); got.Status != joinFailed || !strings.Contains(got.Error, "local-only") || calls != 0 {
		t.Fatalf("local-only join=%+v dials=%d", got, calls)
	}
	if err := l.boxes().Add(trust.Peer{Name: b.Name, Address: b.Addresses[0], Fingerprint: b.Fingerprint}); err != nil {
		t.Fatal(err)
	}
	if got := joinOne(context.Background(), l, id, "recipient", b, nil); got.Status != joinAlready || calls != 0 {
		t.Fatalf("explicit local pairing changed: %+v dials=%d", got, calls)
	}
}

func TestJoinDropsLocalCandidatesAndPreservesPinAndCode(t *testing.T) {
	l := laptop{dir: t.TempDir()}
	id, err := l.identity()
	if err != nil {
		t.Fatal(err)
	}
	b := pairing.InviteBox{Name: "remote", Addresses: []string{"127.0.0.1:7445", "[::1]:7445", "100.64.0.10:7445"}}
	b.Fingerprint[0], b.Code[0] = 1, 2
	old := pairInvitedBox
	t.Cleanup(func() { pairInvitedBox = old })
	calls := 0
	pairInvitedBox = func(_ context.Context, _ *identity.Identity, tok pairing.Token, _ string, _ wire.DialFunc) (string, error) {
		calls++
		if tok.Address != "100.64.0.10:7445" || tok.Fingerprint != b.Fingerprint || tok.Code != b.Code {
			t.Fatalf("pairing proof inputs changed: %+v", tok)
		}
		return "remote", nil
	}
	got := joinOne(context.Background(), l, id, "recipient", b, nil)
	if got.Status != joinPaired || got.Address != "100.64.0.10:7445" || calls != 1 {
		t.Fatalf("mixed-address join=%+v dials=%d", got, calls)
	}
}
