package wire

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/MylesMCook/burf/internal/identity"
	"github.com/MylesMCook/burf/internal/pairing"
	"github.com/MylesMCook/burf/internal/trust"
)

const dialTimeout = 15 * time.Second

// DialFunc opens the TCP connection berth's TLS runs over. The default is
// the system network; a box on another tailnet is reached through that
// tailnet's embedded node instead.
type DialFunc func(ctx context.Context, network, addr string) (net.Conn, error)

func defaultDial(dial DialFunc) DialFunc {
	if dial == nil {
		dial = (&net.Dialer{Timeout: dialTimeout, KeepAlive: 30 * time.Second}).DialContext
	}
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		c, err := dial(ctx, network, addr)
		if err != nil {
			return nil, &dialError{err}
		}
		return c, nil
	}
}

// dialError marks a failure to open the connection at all, whatever the
// dialer (the system's, or another tailnet's node) said.
type dialError struct{ err error }

func (e *dialError) Error() string { return e.err.Error() }
func (e *dialError) Unwrap() error { return e.err }

// Unsent reports whether a request's error shows it never reached the box:
// the connection could not be opened, or its TLS handshake did not finish.
// Anything later (a connection dropping mid-request, a timeout waiting for
// the answer) may have happened after the box acted, so it is not unsent.
// Callers retrying something that must not happen twice, such as typing a
// prompt, retry only unsent requests.
func Unsent(err error) bool {
	if err == nil || errors.Is(err, ErrUntrusted) {
		return false
	}
	var de *dialError
	if errors.As(err, &de) {
		return true
	}
	var op *net.OpError
	if errors.As(err, &op) && op.Op == "dial" {
		return true
	}
	var rh tls.RecordHeaderError
	var alert tls.AlertError
	if errors.As(err, &rh) || errors.As(err, &alert) {
		return true
	}
	// http.Transport's handshake timeout has no exported type.
	return strings.Contains(err.Error(), "TLS handshake timeout")
}

// ErrPairingRefused means the box answered and refused the code: used,
// expired, or never issued by it.
var ErrPairingRefused = errors.New("box refused pairing: the link may be expired, already used, or for another box; run `berthd pair` for a new one")

// ErrStopping means the box answered that it is on its way down (berthd
// stopping or restarting), rather than going quiet.
var ErrStopping = errors.New("the box is stopping")

// Stopping reports whether err shows the box said it is going: a ping it
// answered so, or the HTTP/2 GOAWAY a stopping box sends its connections.
func Stopping(err error) bool {
	return err != nil && (errors.Is(err, ErrStopping) || strings.Contains(err.Error(), "GOAWAY"))
}

// ErrUntrusted means the box answered but no longer trusts this laptop.
var ErrUntrusted = errors.New("box no longer trusts this laptop; pair again")

// Pair proves to the box that this laptop holds tok's code, and returns the
// name the box reports for itself. The code never leaves the laptop.
//
// Pairing uses its own HTTP/1.1 connection so the proof can be bound to that
// exact TLS session; a pooled HTTP/2 connection would hide which session a
// request travels on.
func Pair(ctx context.Context, id *identity.Identity, tok pairing.Token, clientName string) (string, error) {
	return PairVia(ctx, id, tok, clientName, nil)
}

// PairVia is Pair over a specific dialer, such as another tailnet.
//
// A box built from Burf's renamed builds knows the proof under their name
// only (pairing.RenamedProof), so a refusal under the protocol's name is
// tried once more under that one. A refused proof leaves the code unused,
// and each proof is bound to its own connection.
func PairVia(ctx context.Context, id *identity.Identity, tok pairing.Token, clientName string, dial DialFunc) (string, error) {
	name, err := pairWith(ctx, id, tok, clientName, dial, pairing.Proof)
	if errors.Is(err, ErrPairingRefused) {
		return pairWith(ctx, id, tok, clientName, dial, pairing.RenamedProof)
	}
	return name, err
}

func pairWith(ctx context.Context, id *identity.Identity, tok pairing.Token, clientName string, dial DialFunc, proof func(pairing.Code, []byte, identity.Fingerprint) []byte) (string, error) {
	cfg := clientConfig(id, tok.Fingerprint)
	cfg.NextProtos = []string{"http/1.1"}
	conn, err := dialTLSVia(ctx, cfg, tok.Address, dial)
	if err != nil {
		return "", err
	}
	defer conn.Close()
	cs := conn.ConnectionState()
	exporter, err := cs.ExportKeyingMaterial(pairing.ExporterLabel, nil, pairing.ExporterSize)
	if err != nil {
		return "", err
	}
	body, _ := json.Marshal(pairRequest{Name: clientName, Proof: proof(tok.Code, exporter, id.Fingerprint())})
	resp, err := exchange(ctx, conn, tok.Address, "/v1/pair", body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	switch resp.StatusCode {
	case http.StatusOK:
		var out nameResponse
		if err := json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&out); err != nil {
			return "", fmt.Errorf("reading reply: %w", err)
		}
		return out.Name, nil
	case http.StatusTooManyRequests:
		return "", errors.New(errTooManyPairings)
	default:
		return "", ErrPairingRefused
	}
}

func exchange(ctx context.Context, conn *tls.Conn, address, path string, body []byte) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://"+address+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if err := req.Write(conn); err != nil {
		return nil, err
	}
	return http.ReadResponse(bufio.NewReader(conn), req)
}

func dialTLS(ctx context.Context, cfg *tls.Config, address string) (*tls.Conn, error) {
	return dialTLSVia(ctx, cfg, address, nil)
}

func dialTLSVia(ctx context.Context, cfg *tls.Config, address string, dial DialFunc) (*tls.Conn, error) {
	ctx, cancel := context.WithTimeout(ctx, dialTimeout)
	defer cancel()
	raw, err := defaultDial(dial)(ctx, "tcp", address)
	if err != nil {
		return nil, err
	}
	tc := tls.Client(raw, cfg)
	tc.SetDeadline(time.Now().Add(dialTimeout))
	if err := tc.HandshakeContext(ctx); err != nil {
		raw.Close()
		return nil, err
	}
	return tc, nil
}

// Client talks to one paired box over a pooled HTTP/2 connection per route
// (routes.go), which carries every ping and stream. Health pings detect a
// connection that died silently, and Reset abandons it immediately when the
// caller knows better.
type Client struct {
	id  *identity.Identity
	box trust.Peer

	mu     sync.Mutex
	routes []*route
	active *route
	timing RouteTiming
	// lastUse is when something other than a check last asked the box for
	// anything, and streams how many such streams are open: a box in use
	// has its other routes measured.
	lastUse  time.Time
	streams  int
	onChange func(RouteChange)
}

func NewClient(id *identity.Identity, box trust.Peer) *Client {
	return NewClientVia(id, box, nil)
}

// NewClientVia is NewClient over a specific dialer, such as another tailnet.
func NewClientVia(id *identity.Identity, box trust.Peer, dial DialFunc) *Client {
	return NewClientRoutes(id, box, []Route{{ID: RoutePaired, Kind: RouteTailscale, Label: "Tailscale", Dial: dial}})
}

// NewClientRoutes is a client that reaches the box over several routes,
// the first of which it starts on.
func NewClientRoutes(id *identity.Identity, box trust.Peer, routes []Route) *Client {
	c := &Client{id: id, box: box, timing: DefaultRouteTiming}
	c.SetRoutes(routes)
	return c
}

func (c *Client) newTransport(r *route) *http.Transport {
	protocols := new(http.Protocols)
	protocols.SetHTTP2(true)
	dial := defaultDial(r.Dial)
	return &http.Transport{
		// The same pinned TLS on every route: a route is only a transport.
		TLSClientConfig: clientConfig(c.id, c.box.Fingerprint),
		Protocols:       protocols,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			conn, err := dial(ctx, network, addr)
			if err != nil {
				return nil, err
			}
			return c.track(r, conn), nil
		},
		TLSHandshakeTimeout: dialTimeout,
		// Some calls wait on slow tools (Orca fetches before it creates a
		// worktree); the pings below are what detect a dead connection.
		ResponseHeaderTimeout: 3 * time.Minute,
		IdleConnTimeout:       5 * time.Minute,
		HTTP2:                 &http.HTTP2Config{SendPingTimeout: 15 * time.Second, PingTimeout: 10 * time.Second},
	}
}

func (c *Client) Box() trust.Peer { return c.box }

// Reset makes the next request dial a fresh connection, on every route.
// After sleep or a network change the pooled connection may be dead yet
// still carry streams, so closing idle connections alone would leave new
// streams queued behind it.
func (c *Client) Reset() {
	c.mu.Lock()
	var old []*http.Transport
	for _, r := range c.routes {
		old = append(old, r.transport)
		r.transport = c.newTransport(r)
	}
	c.mu.Unlock()
	for _, t := range old {
		t.CloseIdleConnections()
	}
}

// Do sends an authenticated request to the box.
func (c *Client) Do(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	return c.DoWithHeader(ctx, method, path, body, nil)
}

// DoWithHeader is Do with extra request headers, such as the origin a tool
// attributes its request to. It goes over the active route; one that could
// not even be opened is tried on the others, since the box never saw it.
func (c *Client) DoWithHeader(ctx context.Context, method, path string, body io.Reader, header http.Header) (*http.Response, error) {
	c.touch(ctx)
	req, err := http.NewRequestWithContext(ctx, method, "https://"+c.box.Address+path, body)
	if err != nil {
		return nil, err
	}
	for k, v := range header {
		req.Header[k] = v
	}
	resp, _, err := c.roundTrip(req, func() (*http.Request, bool) {
		if req.Body == nil || req.Body == http.NoBody {
			return req.Clone(ctx), true
		}
		if req.GetBody == nil {
			return nil, false
		}
		b, err := req.GetBody()
		if err != nil {
			return nil, false
		}
		again := req.Clone(ctx)
		again.Body = b
		return again, true
	})
	return resp, err
}

// Ping checks that the box is reachable and still trusts this laptop, and
// returns the name it reports.
func (c *Client) Ping(ctx context.Context) (string, error) {
	name, _, err := c.PingTimed(ctx)
	return name, err
}

// DialPort opens a stream to a port on the box's loopback. ctx bounds only the
// setup; the stream lives until it is closed.
func (c *Client) DialPort(ctx context.Context, port int) (net.Conn, error) {
	return c.OpenStream(ctx, "/v1/tcp?port="+strconv.Itoa(port), net.JoinHostPort(c.box.Name, strconv.Itoa(port)))
}

// OpenStream starts a two-way stream with a box route that reads the request
// body while writing its response, such as a port or a terminal. It goes
// over the active route, and stays on it: a stream moves to another route
// only by being opened again, once its own is declared down.
func (c *Client) OpenStream(ctx context.Context, path, label string) (net.Conn, error) {
	c.touch(ctx)
	streamCtx, cancel := context.WithCancel(context.Background())
	if background(ctx) {
		streamCtx = Background(streamCtx)
	}
	stop := context.AfterFunc(ctx, cancel)
	var pw *io.PipeWriter
	// Each try gets its own pipe: a request that fails closes its body.
	attempt := func() (*http.Request, bool) {
		var pr *io.PipeReader
		pr, pw = io.Pipe()
		req, err := http.NewRequestWithContext(streamCtx, http.MethodPost, "https://"+c.box.Address+path, pr)
		if err != nil {
			return nil, false
		}
		return req, true
	}
	first, ok := attempt()
	if !ok {
		stop()
		cancel()
		return nil, fmt.Errorf("bad stream path %q", path)
	}
	resp, r, err := c.roundTrip(first, attempt)
	stop()
	if err == nil && resp.StatusCode != http.StatusOK {
		err = responseError(resp)
		resp.Body.Close()
	}
	if err != nil {
		pw.Close()
		cancel()
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return nil, err
	}
	counted := !background(ctx)
	if counted {
		c.mu.Lock()
		c.streams++
		c.mu.Unlock()
	}
	return &streamConn{
		body: resp.Body,
		pw:   pw,
		cancel: func() {
			cancel()
			if counted {
				c.mu.Lock()
				c.streams--
				c.lastUse = time.Now()
				c.mu.Unlock()
			}
		},
		remote: streamAddr(label),
		route:  r.ID,
	}, nil
}

func responseError(resp *http.Response) error {
	var e errorResponse
	if json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&e) == nil && e.Error != "" {
		return errors.New(e.Error)
	}
	return fmt.Errorf("box replied %s", resp.Status)
}
