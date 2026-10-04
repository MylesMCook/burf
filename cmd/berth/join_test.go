package main

import (
	"context"
	"net"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/sean-brydon/berthd/internal/box"
	"github.com/sean-brydon/berthd/internal/events"
	"github.com/sean-brydon/berthd/internal/identity"
	"github.com/sean-brydon/berthd/internal/pairing"
	"github.com/sean-brydon/berthd/internal/trust"
	"github.com/sean-brydon/berthd/internal/wire"
)

// throwawayBox runs a box's server on loopback with invites on, and returns
// how a laptop would know it once paired, and its trust store.
func throwawayBox(t *testing.T, name string, ttl time.Duration) (trust.Peer, *wire.Server, func()) {
	t.Helper()
	dir := t.TempDir()
	id, err := identity.LoadOrCreate(filepath.Join(dir, "identity.pem"))
	if err != nil {
		t.Fatal(err)
	}
	srv := &wire.Server{
		Identity: id,
		Clients:  trust.NewStore(filepath.Join(dir, "clients.json")),
		Pending:  pairing.NewPending(filepath.Join(dir, "pairing.json")),
		Name:     name,
	}
	bx := &box.Box{Name: name, Events: &events.Bus{}, Locations: box.NewLocations(filepath.Join(dir, "locations.json")), Invites: &box.Invites{TTL: ttl}}
	bx.Mount(srv)
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go srv.Serve(ctx, ln)
	return trust.Peer{Name: name, Address: ln.Addr().String(), Fingerprint: id.Fingerprint()}, srv, cancel
}

// pairedLaptop is a computer that paired with boxes the usual way.
func pairedLaptop(t *testing.T, boxes ...struct {
	peer trust.Peer
	srv  *wire.Server
}) laptop {
	t.Helper()
	l := laptop{dir: t.TempDir()}
	id, err := l.identity()
	if err != nil {
		t.Fatal(err)
	}
	for _, b := range boxes {
		code, _ := b.srv.Pending.Issue(time.Minute, time.Now())
		if _, err := wire.Pair(context.Background(), id, pairing.Token{Address: b.peer.Address, Fingerprint: b.peer.Fingerprint, Code: code}, "macbook"); err != nil {
			t.Fatal(err)
		}
		if err := l.boxes().Add(b.peer); err != nil {
			t.Fatal(err)
		}
	}
	return l
}

type served = struct {
	peer trust.Peer
	srv  *wire.Server
}

func pingAll(t *testing.T, l laptop) {
	t.Helper()
	peers, _ := l.boxes().List()
	for _, p := range peers {
		c, err := l.boxClient(p.Name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := c.Ping(context.Background()); err != nil {
			t.Errorf("%s: %s: %v", l.dir, p.Name, err)
		}
		c.Reset()
	}
}

func mustInvite(t *testing.T, l laptop) (InviteOutput, pairing.Invite) {
	t.Helper()
	peers, err := selectBoxes(l, "")
	if err != nil {
		t.Fatal(err)
	}
	out, err := makeInvite(context.Background(), l, peers, "mac-mini")
	if err != nil {
		t.Fatal(err)
	}
	inv, err := readInvite("On the other computer: berth join '"+out.Link+"'", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	return out, inv
}

func statuses(rs []JoinResult) string {
	var s []string
	for _, r := range rs {
		s = append(s, r.Name+"="+r.Status)
	}
	return strings.Join(s, " ")
}

func TestJoinPairsAnotherComputerWithEveryBox(t *testing.T) {
	devl, devlSrv, _ := throwawayBox(t, "devl", time.Minute)
	cal, calSrv, _ := throwawayBox(t, "cal", time.Minute)
	macbook := pairedLaptop(t, served{devl, devlSrv}, served{cal, calSrv})

	out, inv := mustInvite(t, macbook)
	if len(out.Boxes) != 2 || len(out.Skipped) != 0 || out.From == "" || time.Until(out.Expires) > time.Minute {
		t.Fatalf("invite = %+v", out)
	}
	if strings.Contains(inviteFields(inv), macbookKey(t, macbook)) {
		t.Fatal("the link carries the inviting computer's key")
	}

	mini := laptop{dir: t.TempDir()}
	got := joinInvite(context.Background(), mini, inv, nil)
	if statuses(got) != "cal=paired devl=paired" {
		t.Fatalf("join: %+v", got)
	}
	// Both computers work, at once.
	pingAll(t, macbook)
	pingAll(t, mini)
	for _, srv := range []*wire.Server{devlSrv, calSrv} {
		if clients, _ := srv.Clients.List(); len(clients) != 2 {
			t.Fatalf("%s trusts %d laptops, want 2", srv.Name, len(clients))
		}
	}
	// Joining again changes nothing and spends nothing.
	if again := joinInvite(context.Background(), mini, inv, nil); statuses(again) != "cal=already devl=already" {
		t.Fatalf("join again: %+v", again)
	}
}

// inviteFields is everything a link carries, as text.
func inviteFields(inv pairing.Invite) string {
	s := inv.From
	for _, b := range inv.Boxes {
		s += " " + b.Name + " " + b.Fingerprint.String() + " " + b.Network + " " + b.Tailnet + " " + strings.Join(b.Addresses, " ")
	}
	return s
}

func macbookKey(t *testing.T, l laptop) string {
	id, err := l.identity()
	if err != nil {
		t.Fatal(err)
	}
	return id.Fingerprint().String()
}

func TestAJoinLinkWorksOnce(t *testing.T) {
	devl, devlSrv, _ := throwawayBox(t, "devl", time.Minute)
	cal, calSrv, _ := throwawayBox(t, "cal", time.Minute)
	_, inv := mustInvite(t, pairedLaptop(t, served{devl, devlSrv}, served{cal, calSrv}))

	if got := joinInvite(context.Background(), laptop{dir: t.TempDir()}, inv, nil); statuses(got) != "cal=paired devl=paired" {
		t.Fatalf("first join: %+v", got)
	}
	thief := laptop{dir: t.TempDir()}
	got := joinInvite(context.Background(), thief, inv, nil)
	if statuses(got) != "cal=failed devl=failed" {
		t.Fatalf("reused link: %+v", got)
	}
	if peers, _ := thief.boxes().List(); len(peers) != 0 {
		t.Fatalf("a reused link saved boxes: %+v", peers)
	}
}

func TestAnExpiredJoinLinkFails(t *testing.T) {
	devl, devlSrv, _ := throwawayBox(t, "devl", 300*time.Millisecond)
	out, inv := mustInvite(t, pairedLaptop(t, served{devl, devlSrv}))
	if _, err := readInvite(out.Link, out.Expires.Add(2*expirySkew)); err == nil || !strings.Contains(err.Error(), "expired") {
		t.Fatalf("an expired link was read: %v", err)
	}
	// A link whose expiry was pushed out is still refused by the box.
	time.Sleep(600 * time.Millisecond)
	inv.Expires = time.Now().Add(time.Hour)
	inv, err := readInvite(inv.String(), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if got := joinInvite(context.Background(), laptop{dir: t.TempDir()}, inv, nil); statuses(got) != "devl=failed" {
		t.Fatalf("expired codes: %+v", got)
	}
}

func TestATamperedFingerprintFails(t *testing.T) {
	devl, devlSrv, _ := throwawayBox(t, "devl", time.Minute)
	cal, calSrv, _ := throwawayBox(t, "cal", time.Minute)
	_, inv := mustInvite(t, pairedLaptop(t, served{devl, devlSrv}, served{cal, calSrv}))

	tampered := inv
	tampered.Boxes = append([]pairing.InviteBox{}, inv.Boxes...)
	devlAt := 1 // boxes come in name order: cal, devl
	tampered.Boxes[devlAt].Fingerprint[0] ^= 0xff
	tampered, err := readInvite(tampered.String(), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	mini := laptop{dir: t.TempDir()}
	got := joinInvite(context.Background(), mini, tampered, nil)
	if statuses(got) != "cal=paired devl=failed" || !strings.Contains(got[devlAt].Error, "does not match") {
		t.Fatalf("tampered link: %+v", got)
	}
	if _, ok, _ := mini.boxes().ByName("devl"); ok {
		t.Fatal("a box whose key did not match was saved")
	}
	// The connection never reached the box, so its code is still good.
	if again := joinInvite(context.Background(), mini, inv, nil); statuses(again) != "cal=already devl=paired" {
		t.Fatalf("the real link after a tampered one: %+v", again)
	}
}

func TestAnOfflineBoxIsLeftOutOfAnInvite(t *testing.T) {
	devl, devlSrv, _ := throwawayBox(t, "devl", time.Minute)
	cal, calSrv, stopCal := throwawayBox(t, "cal", time.Minute)
	macbook := pairedLaptop(t, served{devl, devlSrv}, served{cal, calSrv})
	stopCal()
	time.Sleep(50 * time.Millisecond)
	out, inv := mustInvite(t, macbook)
	if len(out.Boxes) != 1 || out.Boxes[0].Name != "devl" || len(out.Skipped) != 1 || out.Skipped[0].Name != "cal" || len(inv.Boxes) != 1 {
		t.Fatalf("invite = %+v", out)
	}
}

func TestReadInviteExplainsOtherLinks(t *testing.T) {
	if _, err := readInvite("berth://100.64.0.1:7444?code="+strings.Repeat("a", 52)+"&fp="+strings.Repeat("b", 52), time.Now()); err == nil || !strings.Contains(err.Error(), "berth pair") {
		t.Fatalf("pairing link: %v", err)
	}
	if _, err := readInvite("hello", time.Now()); err == nil {
		t.Fatal("read a link from nothing")
	}
}
