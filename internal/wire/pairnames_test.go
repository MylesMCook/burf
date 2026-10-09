package wire

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/tls"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"sync/atomic"
	"testing"

	"github.com/MylesMCook/burf/internal/identity"
	"github.com/MylesMCook/burf/internal/pairing"
)

// The two names a pairing proof has been made under: the protocol's own,
// which upstream and every Berth release use, and the one Burf builds used
// from the rename until they went back to it. Spelled out here, not taken
// from the package, so a change to either is a change to the wire.
const (
	protocolName = "berth pair v1"
	renamedName  = "burf pair v1"
)

// proofUnder is a proof made by hand under one name: what a build other than
// this one sends.
func proofUnder(name string, code pairing.Code, exporter []byte, client identity.Fingerprint) []byte {
	m := hmac.New(sha256.New, code[:])
	m.Write([]byte(name))
	m.Write(exporter)
	m.Write(client[:])
	return m.Sum(nil)
}

// A box pairs with a client whichever of the two names its build proves
// under, and the code still pairs once: not again under either name.
func TestABoxPairsWithClientsOfEitherName(t *testing.T) {
	for _, name := range []string{protocolName, renamedName} {
		t.Run(name, func(t *testing.T) {
			b := startBox(t)
			tok := b.issue(t)
			me := laptop(t)
			status, _ := rawPair(t, me, b, func(e []byte) []byte { return proofUnder(name, tok.Code, e, me.Fingerprint()) })
			if status != http.StatusOK {
				t.Fatalf("a client proving under %q: status %d", name, status)
			}
			if _, ok, _ := b.server.Clients.Trusted(me.Fingerprint()); !ok {
				t.Fatal("the client was not pinned")
			}
			for _, again := range []string{protocolName, renamedName} {
				late := laptop(t)
				status, e := rawPair(t, late, b, func(e []byte) []byte { return proofUnder(again, tok.Code, e, late.Fingerprint()) })
				if status != http.StatusForbidden || e.Error != errPairingRejected {
					t.Fatalf("the used code under %q: got %d %+v, want the generic rejection", again, status, e)
				}
			}
		})
	}
}

// A name that is neither is refused like any other wrong proof.
func TestABoxRefusesAProofUnderAnotherName(t *testing.T) {
	b := startBox(t)
	tok := b.issue(t)
	me := laptop(t)
	status, e := rawPair(t, me, b, func(e []byte) []byte { return proofUnder("berth pair v2", tok.Code, e, me.Fingerprint()) })
	if status != http.StatusForbidden || e.Error != errPairingRejected {
		t.Fatalf("got %d %+v, want the generic rejection", status, e)
	}
}

// oneNameBox is a box built from other source: it accepts a proof under one
// name only, as upstream does and as Burf did between the two changes. It
// counts the proofs it was shown.
type oneNameBox struct {
	tok   pairing.Token
	shown atomic.Int32
}

func startOneNameBox(t *testing.T, name string) *oneNameBox {
	t.Helper()
	id := laptop(t)
	var code pairing.Code
	code[0] = 1
	b := &oneNameBox{}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/pair", func(w http.ResponseWriter, r *http.Request) {
		b.shown.Add(1)
		peer, _ := clientFingerprint(r)
		var req pairRequest
		json.NewDecoder(r.Body).Decode(&req)
		exporter, err := r.TLS.ExportKeyingMaterial(pairing.ExporterLabel, nil, pairing.ExporterSize)
		if err != nil || !hmac.Equal(req.Proof, proofUnder(name, code, exporter, peer)) {
			writeError(w, http.StatusForbidden, errPairingRejected)
			return
		}
		writeJSON(w, http.StatusOK, nameResponse{Name: "other-build"})
	})
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	srv := &http.Server{Handler: mux}
	go srv.Serve(tls.NewListener(ln, serverConfig(id)))
	t.Cleanup(func() { srv.Close() })
	b.tok = pairing.Token{Address: ln.Addr().String(), Fingerprint: id.Fingerprint(), Code: code}
	return b
}

// This build's client pairs with a box of either kind. It proves under the
// protocol's name first, so a box that knows it is asked once; only a box
// from the renamed builds costs a second connection.
func TestAClientPairsWithABoxOfEitherName(t *testing.T) {
	for name, proofs := range map[string]int32{protocolName: 1, renamedName: 2} {
		t.Run(name, func(t *testing.T) {
			b := startOneNameBox(t, name)
			reported, err := Pair(context.Background(), laptop(t), b.tok, "macbook")
			if err != nil || reported != "other-build" {
				t.Fatalf("pairing with a box that knows %q: %q, %v", name, reported, err)
			}
			if got := b.shown.Load(); got != proofs {
				t.Fatalf("the box was shown %d proofs, want %d", got, proofs)
			}
		})
	}
}

// A wrong code is refused under both names and then given up on: one proof
// each, and the error a person can act on.
func TestAWrongCodeIsTriedUnderEachNameOnce(t *testing.T) {
	b := startOneNameBox(t, protocolName)
	tok := b.tok
	tok.Code[0] = 2
	if _, err := Pair(context.Background(), laptop(t), tok, "macbook"); !errors.Is(err, ErrPairingRefused) {
		t.Fatalf("got %v, want ErrPairingRefused", err)
	}
	if got := b.shown.Load(); got != 2 {
		t.Fatalf("the box was shown %d proofs, want 2", got)
	}
}
