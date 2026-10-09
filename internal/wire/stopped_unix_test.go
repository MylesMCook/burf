//go:build unix

package wire

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/pairing"
	"github.com/MylesMCook/burf/internal/trust"
)

// A box that has stopped serving answers a laptop it can no longer check the
// way a stopping box answers a ping: with the code that says it is on its
// way down. The check comes before the ping's own answer, so without the
// code a laptop would never hear it from a box stopped this way.
func TestAStoppedBoxAnswersAsAStoppingOne(t *testing.T) {
	b := serveBox(t, nil)
	me := laptop(t)
	code, err := b.server.Pending.Issue(time.Minute, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	box := trust.Peer{Name: "dev-test", Address: b.address, Fingerprint: b.server.Identity.Fingerprint()}
	if _, err := Pair(context.Background(), me, pairing.Token{Address: box.Address, Fingerprint: box.Fingerprint, Code: code}, "laptop"); err != nil {
		t.Fatal(err)
	}
	c := NewClient(me, box)
	defer c.Reset()
	if _, err := c.Ping(context.Background()); err != nil {
		t.Fatal(err)
	}
	b.ln.Close()
	select {
	case <-b.done:
	case <-time.After(5 * time.Second):
		t.Fatal("Serve did not return when its listener closed")
	}
	resp, err := c.Do(context.Background(), http.MethodGet, "/v1/ping", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var e errorResponse
	if err := json.NewDecoder(resp.Body).Decode(&e); err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusServiceUnavailable || e.Code != codeStopping {
		t.Fatalf("got %d %+v, want 503 with code %q", resp.StatusCode, e, codeStopping)
	}
}
