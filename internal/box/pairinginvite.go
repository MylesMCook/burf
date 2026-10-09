package box

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/MylesMCook/burf/internal/trust"
	"github.com/MylesMCook/burf/internal/wire"
)

// A paired laptop can ask the box for a pairing code for another computer of
// the same person (berth invite), and see and remove the laptops the box
// trusts. A code minted here is the same as one `berthd pair` prints: single
// use, ten minutes, and proven over the new laptop's own TLS session rather
// than sent. It is never logged or put in an event.

const (
	defaultInviteTTL = 10 * time.Minute
	// At most inviteBurst codes per inviteWindow, from every laptop together:
	// enough for a person adding computers, not for minting codes in bulk.
	inviteBurst  = 10
	inviteWindow = 10 * time.Minute
)

// Invites lets paired laptops mint pairing codes. Leaving Box.Invites nil
// turns invites off.
type Invites struct {
	// Address is the address berthd pair would advertise, offered beside
	// the one the inviting laptop already dials.
	Address func() string
	// TTL is how long a code lasts; ten minutes when zero.
	TTL time.Duration
	Now func() time.Time

	mu     sync.Mutex
	recent []time.Time
}

func (i *Invites) now() time.Time {
	if i.Now != nil {
		return i.Now()
	}
	return time.Now()
}

// allow spends one of the window's invites, if any are left.
func (i *Invites) allow(now time.Time) bool {
	i.mu.Lock()
	defer i.mu.Unlock()
	live := i.recent[:0]
	for _, t := range i.recent {
		if now.Sub(t) < inviteWindow {
			live = append(live, t)
		}
	}
	i.recent = live
	if len(live) >= inviteBurst {
		return false
	}
	i.recent = append(i.recent, now)
	return true
}

// PairingInvite is a fresh pairing code and what a new laptop needs with it.
type PairingInvite struct {
	Box         string    `json:"box"`
	Fingerprint string    `json:"fingerprint"`
	Addresses   []string  `json:"addresses"`
	Code        string    `json:"code"`
	Expires     time.Time `json:"expires"`
}

// ClientInfo is one laptop the box trusts.
type ClientInfo struct {
	Name        string    `json:"name"`
	Fingerprint string    `json:"fingerprint"`
	PairedAt    time.Time `json:"paired_at"`
	// You marks the laptop asking.
	You bool `json:"you,omitempty"`
}

func (b *Box) mountPairing(s *wire.Server, route func(string, func(http.ResponseWriter, *http.Request) error)) {
	route("POST /v1/pairing/invite", func(w http.ResponseWriter, r *http.Request) error { return b.invite(s, w, r) })
	route("GET /v1/clients", func(w http.ResponseWriter, r *http.Request) error { return b.listClients(s, w, r) })
	route("DELETE /v1/clients/{name}", func(w http.ResponseWriter, r *http.Request) error { return b.revokeClient(s, w, r) })
}

func (b *Box) invite(s *wire.Server, w http.ResponseWriter, r *http.Request) error {
	var req struct {
		// For names the computer being invited, for the gate and the event
		// only: the new laptop names itself when it pairs.
		For string `json:"for"`
	}
	if r.ContentLength != 0 {
		if err := decodeLimit(r, &req, 4<<10); err != nil {
			return err
		}
	}
	if !trust.ValidName(req.For) {
		req.For = ""
	}
	by := gateOrigin(r)
	if err := b.before(r, "pairing.invite", map[string]any{"for": req.For, "by": by}); err != nil {
		return err
	}
	if b.Invites == nil || s.Pending == nil || s.Identity == nil {
		return httpError{http.StatusNotImplemented, "this box does not make invites"}
	}
	now := b.Invites.now()
	if !b.Invites.allow(now) {
		return httpError{http.StatusTooManyRequests, "too many invites from this box; try again in a few minutes"}
	}
	ttl := b.Invites.TTL
	if ttl <= 0 {
		ttl = defaultInviteTTL
	}
	code, err := s.Pending.Issue(ttl, now)
	if err != nil {
		return httpError{http.StatusInternalServerError, "could not store the pairing code: " + err.Error()}
	}
	out := PairingInvite{
		Box:         b.Name,
		Fingerprint: s.Identity.Fingerprint().String(),
		Code:        code.String(),
		Expires:     now.Add(ttl).UTC(),
		Addresses:   []string{},
	}
	if b.Invites.Address != nil {
		if a := b.Invites.Address(); a != "" {
			out.Addresses = append(out.Addresses, a)
		}
	}
	// Never the code: events reach hooks, flows and every paired laptop.
	b.publish(r, "pairing.invited", map[string]any{"for": req.For, "by": by, "expires": out.Expires})
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, out)
	return nil
}

func (b *Box) listClients(s *wire.Server, w http.ResponseWriter, r *http.Request) error {
	if s.Clients == nil {
		return httpError{http.StatusNotImplemented, "this box keeps no paired laptops"}
	}
	peers, err := s.Clients.List()
	if err != nil {
		return httpError{http.StatusInternalServerError, err.Error()}
	}
	me := wire.PeerFrom(r.Context())
	out := make([]ClientInfo, 0, len(peers))
	for _, p := range peers {
		out = append(out, ClientInfo{
			Name:        p.Name,
			Fingerprint: p.Fingerprint.String(),
			PairedAt:    p.PairedAt,
			You:         !wire.IsLocal(r.Context()) && p.Fingerprint == me.Fingerprint,
		})
	}
	writeJSON(w, out)
	return nil
}

// revokeClient stops trusting a laptop, as berthd revoke does, and closes
// what it has open. A laptop cannot remove itself here: that would cut the
// connection this answer travels on; forgetting the box is the way.
func (b *Box) revokeClient(s *wire.Server, w http.ResponseWriter, r *http.Request) error {
	if s.Clients == nil {
		return httpError{http.StatusNotImplemented, "this box keeps no paired laptops"}
	}
	key := r.PathValue("name")
	peers, err := s.Clients.List()
	if err != nil {
		return httpError{http.StatusInternalServerError, err.Error()}
	}
	var target trust.Peer
	for _, p := range peers {
		if strings.EqualFold(p.Name, key) || p.Fingerprint.String() == key {
			target = p
			break
		}
	}
	if target.Name == "" {
		return httpError{http.StatusNotFound, trust.ErrNotFound.Error()}
	}
	data := map[string]any{"name": target.Name, "fingerprint": target.Fingerprint.String()}
	if err := b.before(r, "client.revoke", data); err != nil {
		return err
	}
	if !wire.IsLocal(r.Context()) && target.Fingerprint == wire.PeerFrom(r.Context()).Fingerprint {
		return badRequest("%s is the computer asking; forget the box on it instead", target.Name)
	}
	if _, err := s.Clients.Remove(target.Fingerprint.String()); err != nil {
		return err
	}
	s.ClientsChanged()
	b.publish(r, "client.revoked", data)
	writeJSON(w, map[string]string{"removed": target.Name})
	return nil
}
