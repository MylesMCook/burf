package box

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/hooks"
	"github.com/MylesMCook/burf/internal/identity"
	"github.com/MylesMCook/burf/internal/pairing"
	"github.com/MylesMCook/burf/internal/trust"
	"github.com/MylesMCook/burf/internal/wire"
)

// newLaptop is another computer, with its own key and nothing paired.
func newLaptop(t *testing.T) *identity.Identity {
	t.Helper()
	id, err := identity.LoadOrCreate(filepath.Join(t.TempDir(), "identity.pem"))
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func mintInvite(t *testing.T, c *wire.Client) (PairingInvite, int) {
	t.Helper()
	var inv PairingInvite
	status := call(t, c, "POST", "/v1/pairing/invite", "", map[string]string{"for": "mac-mini"}, &inv)
	return inv, status
}

func tokenFor(t *testing.T, c *wire.Client, inv PairingInvite) pairing.Token {
	t.Helper()
	tok, err := pairing.ParseToken("berth://" + c.Box().Address + "?fp=" + inv.Fingerprint + "&code=" + inv.Code)
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func TestAPairedLaptopInvitesAnotherComputerOnce(t *testing.T) {
	c, bus := servedBox(t, func(b *Box) { b.Invites = &Invites{Address: func() string { return "100.64.0.4:7444" }} })
	seen, stop := bus.Subscribe()
	defer stop()

	inv, status := mintInvite(t, c)
	if status != 200 {
		t.Fatalf("invite: %d", status)
	}
	if inv.Box != "devbox" || inv.Fingerprint != c.Box().Fingerprint.String() || len(inv.Addresses) != 1 || inv.Addresses[0] != "100.64.0.4:7444" {
		t.Fatalf("invite = %+v", inv)
	}
	if left := time.Until(inv.Expires); left < 9*time.Minute || left > 10*time.Minute {
		t.Fatalf("invite expires in %s, want ten minutes", left)
	}

	// The event says who invited, never the code.
	select {
	case e := <-seen:
		b, _ := json.Marshal(e)
		if e.Type != "pairing.invited" || e.Data["by"] != "laptop:laptop" || e.Data["for"] != "mac-mini" || strings.Contains(string(b), inv.Code) {
			t.Fatalf("event = %s", b)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("no pairing.invited event")
	}

	tok := tokenFor(t, c, inv)
	mini := newLaptop(t)
	if _, err := wire.Pair(context.Background(), mini, tok, "mac-mini"); err != nil {
		t.Fatalf("pairing with the invite: %v", err)
	}
	// Single use, even for the computer it was meant for.
	if _, err := wire.Pair(context.Background(), newLaptop(t), tok, "thief"); err == nil {
		t.Fatal("a used code paired a second computer")
	}

	// Both laptops are trusted, and each sees which one it is.
	var clients []ClientInfo
	call(t, c, "GET", "/v1/clients", "", nil, &clients)
	if len(clients) != 2 || clients[0].Name != "laptop" || !clients[0].You || clients[1].Name != "mac-mini" || clients[1].You || clients[1].Fingerprint != mini.Fingerprint().String() {
		t.Fatalf("clients = %+v", clients)
	}
	mc := wire.NewClient(mini, c.Box())
	defer mc.Reset()
	if _, err := mc.Ping(context.Background()); err != nil {
		t.Fatalf("the new computer: %v", err)
	}
	if _, err := c.Ping(context.Background()); err != nil {
		t.Fatalf("the inviting laptop lost access: %v", err)
	}
}

func TestAnInviteExpires(t *testing.T) {
	c, _ := servedBox(t, func(b *Box) { b.Invites = &Invites{TTL: 50 * time.Millisecond} })
	inv, status := mintInvite(t, c)
	if status != 200 {
		t.Fatalf("invite: %d", status)
	}
	time.Sleep(150 * time.Millisecond)
	if _, err := wire.Pair(context.Background(), newLaptop(t), tokenFor(t, c, inv), "late"); err == nil {
		t.Fatal("an expired code paired")
	}
}

func TestAGateCanRefuseInvites(t *testing.T) {
	cfg := filepath.Join(t.TempDir(), "hooks.json")
	os.WriteFile(cfg, []byte(`{"hooks":[{"on":"before:pairing.invite","run":"echo no new computers; exit 1"}]}`), 0o600)
	invites := &Invites{}
	c, _ := servedBox(t, func(b *Box) { b.Invites = invites; b.Hooks = &hooks.Runner{Path: cfg} })
	var resp struct {
		Error string
		Code  string
	}
	// Code is the error's ("refused"), never a pairing code.
	if status := call(t, c, "POST", "/v1/pairing/invite", "", nil, &resp); status != 403 || !strings.Contains(resp.Error, "no new computers") || resp.Code != CodeRefused {
		t.Fatalf("refused invite: %d %+v", status, resp)
	}
	if len(invites.recent) != 0 {
		t.Fatal("a refused invite counted against the limit")
	}
}

func TestInvitesAreRateLimited(t *testing.T) {
	c, _ := servedBox(t, func(b *Box) { b.Invites = &Invites{} })
	for i := range inviteBurst {
		if _, status := mintInvite(t, c); status != 200 {
			t.Fatalf("invite %d: %d", i+1, status)
		}
	}
	if _, status := mintInvite(t, c); status != 429 {
		t.Fatalf("invite past the limit: %d, want 429", status)
	}
}

func TestABoxWithoutInvitesRefusesThem(t *testing.T) {
	c, _ := servedBox(t)
	if _, status := mintInvite(t, c); status != 501 {
		t.Fatalf("invite: %d, want 501", status)
	}
}

func TestRemovingAnotherLaptop(t *testing.T) {
	c, bus := servedBox(t, func(b *Box) { b.Invites = &Invites{} })
	inv, _ := mintInvite(t, c)
	mini := newLaptop(t)
	if _, err := wire.Pair(context.Background(), mini, tokenFor(t, c, inv), "mac-mini"); err != nil {
		t.Fatal(err)
	}
	mc := wire.NewClient(mini, trust.Peer{Name: "devbox", Address: c.Box().Address, Fingerprint: c.Box().Fingerprint})
	defer mc.Reset()

	var resp struct{ Error string }
	if status := call(t, c, "DELETE", "/v1/clients/laptop", "", nil, &resp); status != 400 || !strings.Contains(resp.Error, "forget the box") {
		t.Fatalf("removing itself: %d %q", status, resp.Error)
	}
	if status := call(t, c, "DELETE", "/v1/clients/nobody", "", nil, &resp); status != 404 {
		t.Fatalf("removing an unknown laptop: %d", status)
	}
	seen, stop := bus.Subscribe()
	defer stop()
	if status := call(t, c, "DELETE", "/v1/clients/mac-mini", "", nil, &resp); status != 200 {
		t.Fatalf("removing mac-mini: %d %q", status, resp.Error)
	}
	if e := <-seen; e.Type != "client.revoked" || e.Data["name"] != "mac-mini" {
		t.Fatalf("event = %+v", e)
	}
	if _, err := mc.Ping(context.Background()); !errors.Is(err, wire.ErrUntrusted) {
		t.Fatalf("removed laptop still answered: %v", err)
	}
	if _, err := c.Ping(context.Background()); err != nil {
		t.Fatalf("the laptop that removed it lost access: %v", err)
	}
}
