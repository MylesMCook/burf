//go:build unix

package wire

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"syscall"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/identity"
	"github.com/MylesMCook/burf/internal/pairing"
	"github.com/MylesMCook/burf/internal/trust"
)

// Once Serve has returned, the box is done with its state folder: a request
// still being checked against the trust store, or the revocation watch in
// the middle of a round, finishes first, and nothing starts another. Whoever
// stopped the box may remove the folder at once, as a test's cleanup does.

// servedBox is a box whose Serve the test stops and waits for itself.
type servedBox struct {
	server  *Server
	address string
	clients string
	ln      net.Listener
	stop    context.CancelFunc
	done    chan error
}

func serveBox(t *testing.T, configure func(*Server)) *servedBox {
	t.Helper()
	dir := t.TempDir()
	id, err := identity.LoadOrCreate(filepath.Join(dir, "identity.pem"))
	if err != nil {
		t.Fatal(err)
	}
	b := &servedBox{clients: filepath.Join(dir, "clients.json"), done: make(chan error, 1)}
	b.server = &Server{
		Identity: id,
		Clients:  trust.NewStore(b.clients),
		Pending:  pairing.NewPending(filepath.Join(dir, "pairing.json")),
		Name:     "dev-test",
	}
	if configure != nil {
		configure(b.server)
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	b.address, b.ln = ln.Addr().String(), ln
	ctx, cancel := context.WithCancel(context.Background())
	b.stop = cancel
	go func() { b.done <- b.server.Serve(ctx, ln) }()
	t.Cleanup(cancel)
	return b
}

// get sends one request as id and waits for whatever comes of it.
func (b *servedBox) get(id *identity.Identity, path string) {
	cfg := clientConfig(id, b.server.Identity.Fingerprint())
	cfg.NextProtos = []string{"http/1.1"}
	conn, err := dialTLS(context.Background(), cfg, b.address)
	if err != nil {
		return
	}
	defer conn.Close()
	io.WriteString(conn, "GET "+path+" HTTP/1.1\r\nHost: "+b.address+"\r\n\r\n")
	io.Copy(io.Discard, conn)
}

// holdNextRead swaps the trust store's file for a named pipe and returns
// once a read of the store has begun: a pipe opens for writing only when a
// reader has it open. That read then waits until finish hands it content.
func (b *servedBox) holdNextRead(t *testing.T, poke func()) (finish func(content []byte)) {
	t.Helper()
	os.Remove(b.clients)
	if err := syscall.Mkfifo(b.clients, 0o600); err != nil {
		t.Fatal(err)
	}
	poke()
	opened := make(chan *os.File, 1)
	go func() {
		f, err := os.OpenFile(b.clients, os.O_WRONLY, 0)
		if err != nil {
			t.Error(err)
		}
		opened <- f
	}()
	select {
	case f := <-opened:
		return func(content []byte) {
			f.Write(content)
			f.Close()
		}
	case <-time.After(5 * time.Second):
		t.Fatal("nothing read the trust store")
		return nil
	}
}

// stillServing fails if Serve has returned, giving it a moment to.
func (b *servedBox) stillServing(t *testing.T, during string) {
	t.Helper()
	select {
	case <-b.done:
		t.Fatalf("Serve returned while %s", during)
	case <-time.After(300 * time.Millisecond):
	}
}

func (b *servedBox) stopped(t *testing.T) {
	t.Helper()
	select {
	case err := <-b.done:
		if err != nil {
			t.Fatalf("Serve: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Serve did not return")
	}
}

func TestServeReturnsAfterARequestBeingCheckedHasLeftTheTrustStore(t *testing.T) {
	b := serveBox(t, nil)
	me := laptop(t)
	finish := b.holdNextRead(t, func() { go b.get(me, "/v1/ping") })
	b.stop()
	b.stillServing(t, "a request was still reading the trust store")
	finish([]byte("[]\n"))
	b.stopped(t)
}

// A box updating itself closes its listener and goes on answering the
// connections it has until the new build takes over. It reads its stores no
// more, so it says it has stopped; it does not call a laptop it cannot check
// untrusted, which that laptop would take as a reason to pair again.
func TestABoxThatStoppedServingDoesNotCallItsLaptopsUntrusted(t *testing.T) {
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
	if _, err := c.Ping(context.Background()); err == nil || errors.Is(err, ErrUntrusted) {
		t.Fatalf("a ping on the open connection: %v, want an error that is not ErrUntrusted", err)
	}
	resp, err := c.Do(context.Background(), http.MethodGet, "/v1/ping", nil)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status %d, want 503", resp.StatusCode)
	}
}

func TestServeReturnsAfterTheRevocationWatchHasLeftTheTrustStore(t *testing.T) {
	held := make(chan struct{})
	b := serveBox(t, func(s *Server) {
		// One round, when poked: a tick must not start a second read that
		// nothing would finish.
		s.RevokeCheck = time.Hour
		s.Handle("GET /v1/hold", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			close(held)
			<-r.Context().Done()
		}))
	})
	me := laptop(t)
	code, err := b.server.Pending.Issue(time.Minute, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Pair(context.Background(), me, pairing.Token{Address: b.address, Fingerprint: b.server.Identity.Fingerprint(), Code: code}, "laptop"); err != nil {
		t.Fatal(err)
	}
	go b.get(me, "/v1/hold")
	select {
	case <-held:
	case <-time.After(5 * time.Second):
		t.Fatal("the request never reached its handler")
	}
	paired, err := os.ReadFile(b.clients)
	if err != nil {
		t.Fatal(err)
	}
	finish := b.holdNextRead(t, b.server.ClientsChanged)
	b.stop()
	b.stillServing(t, "the revocation watch was still reading the trust store")
	finish(paired)
	b.stopped(t)
}
