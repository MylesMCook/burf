package agent

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	box "github.com/MylesMCook/burf/internal/boxclient"
	"github.com/MylesMCook/burf/internal/statefile"
)

// A browser extension reaches the app API with its own credential, never the
// app's token. The app's token opens everything the app can do: terminals,
// files, pairings, settings. A browser credential opens only structured chat
// and the browser bridge on the user's boxes (browserScope).
//
// Pairing: the user asks for a code (`burf browser pair`, or the app through
// POST /v1/browser/pairing) and types it into the extension, which trades it
// once at POST /v1/browser/pair for its credential. A code lasts ten minutes,
// works once and closes after five wrong guesses. Only an extension page may
// trade a code; a web page cannot forge that origin. The credential is kept
// hashed, listed by `burf browser list` and ended by `burf browser revoke`.

// BrowserPairingsFile holds the paired browsers, inside the state directory.
const BrowserPairingsFile = "browser-pairings.json"

const (
	browserCodeTTL      = 10 * time.Minute
	browserCodeAttempts = 5
	maxBrowserPairings  = 8
	browserCodeLetters  = "ABCDEFGHJKMNPQRSTVWXYZ23456789"
	browserTokenPrefix  = "brw_"
)

var browserNow = time.Now

// browserOrigin is an extension's own page, as Chrome and Firefox name it.
var browserOrigin = regexp.MustCompile(`^(chrome|moz)-extension://[a-z0-9-]{1,64}$`)

// BrowserPairing is one paired browser. Hash never leaves the state file.
type BrowserPairing struct {
	ID      string    `json:"id"`
	Name    string    `json:"name"`
	Origin  string    `json:"origin"`
	Created time.Time `json:"created"`
	Hash    string    `json:"hash,omitempty"`
}

type browserPairs struct {
	mu       sync.Mutex
	path     string
	loaded   bool
	list     []BrowserPairing
	code     string
	expires  time.Time
	attempts int
}

var (
	errNoBrowserCode    = errors.New("no browser pairing is open; ask Burf for a new code")
	errBrowserCode      = errors.New("that pairing code is wrong")
	errBrowserPairLimit = errors.New("eight browsers are paired; revoke one first")
)

func (a *Agent) browserPairs() *browserPairs {
	a.browser.mu.Lock()
	defer a.browser.mu.Unlock()
	if a.browser.path == "" {
		a.browser.path = filepath.Join(a.cfg.Dir, BrowserPairingsFile)
	}
	return &a.browser
}

// Caller holds mu.
func (p *browserPairs) load() error {
	if p.loaded {
		return nil
	}
	b, err := os.ReadFile(p.path)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if err == nil && json.Unmarshal(b, &p.list) != nil {
		return errors.New("browser pairings could not be read")
	}
	p.loaded = true
	return nil
}

// Caller holds mu.
func (p *browserPairs) save() error {
	b, err := json.MarshalIndent(p.list, "", "  ")
	if err != nil {
		return err
	}
	return statefile.Write(p.path, append(b, '\n'))
}

func randomHex(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func hashBrowserToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// mint opens a pairing, replacing any code still open.
func (p *browserPairs) mint() (string, time.Time, error) {
	var code strings.Builder
	limit := big.NewInt(int64(len(browserCodeLetters)))
	for i := 0; i < 8; i++ {
		n, err := rand.Int(rand.Reader, limit)
		if err != nil {
			return "", time.Time{}, err
		}
		if i == 4 {
			code.WriteByte('-')
		}
		code.WriteByte(browserCodeLetters[n.Int64()])
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.code, p.expires, p.attempts = code.String(), browserNow().Add(browserCodeTTL), 0
	return p.code, p.expires, nil
}

func normalizeBrowserCode(code string) string {
	return strings.ToUpper(strings.NewReplacer("-", "", " ", "").Replace(code))
}

// redeem trades an open code for a new credential, once.
func (p *browserPairs) redeem(code, name, origin string) (string, BrowserPairing, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.code == "" || !browserNow().Before(p.expires) {
		p.code = ""
		return "", BrowserPairing{}, errNoBrowserCode
	}
	if subtle.ConstantTimeCompare([]byte(normalizeBrowserCode(code)), []byte(normalizeBrowserCode(p.code))) != 1 {
		if p.attempts++; p.attempts >= browserCodeAttempts {
			p.code = ""
		}
		return "", BrowserPairing{}, errBrowserCode
	}
	if err := p.load(); err != nil {
		return "", BrowserPairing{}, err
	}
	if len(p.list) >= maxBrowserPairings {
		return "", BrowserPairing{}, errBrowserPairLimit
	}
	secret, err := randomHex(32)
	if err != nil {
		return "", BrowserPairing{}, err
	}
	id, err := randomHex(6)
	if err != nil {
		return "", BrowserPairing{}, err
	}
	token := browserTokenPrefix + secret
	pairing := BrowserPairing{ID: id, Name: name, Origin: origin, Created: browserNow().UTC(), Hash: hashBrowserToken(token)}
	p.list = append(p.list, pairing)
	if err = p.save(); err != nil {
		p.list = p.list[:len(p.list)-1]
		return "", BrowserPairing{}, err
	}
	p.code = ""
	pairing.Hash = ""
	return token, pairing, nil
}

// lookup finds the browser a credential belongs to.
func (p *browserPairs) lookup(token string) (BrowserPairing, bool) {
	if !strings.HasPrefix(token, browserTokenPrefix) {
		return BrowserPairing{}, false
	}
	hash := hashBrowserToken(token)
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.load() != nil {
		return BrowserPairing{}, false
	}
	for _, pairing := range p.list {
		if subtle.ConstantTimeCompare([]byte(pairing.Hash), []byte(hash)) == 1 {
			pairing.Hash = ""
			return pairing, true
		}
	}
	return BrowserPairing{}, false
}

func (p *browserPairs) pairings() ([]BrowserPairing, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if err := p.load(); err != nil {
		return nil, err
	}
	out := []BrowserPairing{}
	for _, pairing := range p.list {
		pairing.Hash = ""
		out = append(out, pairing)
	}
	return out, nil
}

func (p *browserPairs) revoke(id string) (bool, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if err := p.load(); err != nil {
		return false, err
	}
	for i, pairing := range p.list {
		if pairing.ID == id {
			kept := append(append([]BrowserPairing{}, p.list[:i]...), p.list[i+1:]...)
			old := p.list
			p.list = kept
			if err := p.save(); err != nil {
				p.list = old
				return false, err
			}
			return true, nil
		}
	}
	return false, nil
}

// browserBoxRoutes are the box API routes a browser credential may use,
// after /v1/boxes/{box}/api/: where to chat, structured chats, and the
// browser bridge's waiting calls and answers.
var browserBoxRoutes = []struct {
	method string
	path   *regexp.Regexp
}{
	{http.MethodGet, regexp.MustCompile(`^(info|locations|chats|chats/models)$`)},
	{http.MethodPost, regexp.MustCompile(`^chats$`)},
	{http.MethodGet, regexp.MustCompile(`^chats/[0-9a-f]{32}(/models|/browser/calls)?$`)},
	{http.MethodDelete, regexp.MustCompile(`^chats/[0-9a-f]{32}$`)},
	{http.MethodPost, regexp.MustCompile(`^chats/[0-9a-f]{32}/(messages|interrupt|approvals|browser/results)$`)},
}

var browserBoxPath = regexp.MustCompile(`^/v1/boxes/[A-Za-z0-9._-]{1,64}/api/([a-z0-9/]+)$`)

// browserScope reports whether a browser credential may make this request.
// It reads the path as the app sent it, so an escaped separator never matches.
func browserScope(r *http.Request) bool {
	path := r.URL.EscapedPath()
	if r.Method == http.MethodGet && path == "/v1/browser/boxes" {
		return true
	}
	m := browserBoxPath.FindStringSubmatch(path)
	if m == nil {
		return false
	}
	for _, route := range browserBoxRoutes {
		if route.method == r.Method && route.path.MatchString(m[1]) {
			return true
		}
	}
	return false
}

// browserAuthorize answers a request that did not carry the app's token:
// zero when a paired browser may make it, else the status to refuse with.
func (a *Agent) browserAuthorize(token string, r *http.Request) (int, string) {
	if _, ok := a.browserPairs().lookup(token); !ok {
		return http.StatusUnauthorized, "missing or wrong token"
	}
	if !browserScope(r) {
		return http.StatusForbidden, "a paired browser can only use chats and their browser tools"
	}
	if r.Method == http.MethodPost && browserMessage.MatchString(r.URL.EscapedPath()) {
		return browserMessageBody(r)
	}
	if m := browserApproval.FindStringSubmatch(r.URL.EscapedPath()); m != nil && r.Method == http.MethodPost {
		return a.browserApprovalBody(r, m[1], m[2])
	}
	return 0, ""
}

var browserApproval = regexp.MustCompile(`^/v1/boxes/([A-Za-z0-9._-]{1,64})/api/chats/([0-9a-f]{32})/approvals$`)

// browserApprovalBody lets a paired browser refuse any approval, and grant
// only one for its own browser tools. Granting a command or a file change
// lets it happen on the box, so for now that is answered in Burf. Widening
// this is a product choice: the check is here, in one place.
func (a *Agent) browserApprovalBody(r *http.Request, boxName, chat string) (int, string) {
	var req struct {
		ID       string `json:"id"`
		Decision string `json:"decision"`
	}
	d := json.NewDecoder(io.LimitReader(r.Body, 64<<10))
	d.DisallowUnknownFields()
	if d.Decode(&req) != nil || d.Decode(new(any)) != io.EOF {
		return http.StatusBadRequest, "invalid request"
	}
	if req.Decision != "decline" {
		a.sync()
		c, ok := a.client(boxName)
		if !ok {
			return http.StatusNotFound, "no paired box named " + boxName
		}
		resp, err := c.DoWithHeader(r.Context(), http.MethodGet, "/v1/chats/"+chat, nil, http.Header{box.OriginHeader: {"app"}})
		if err != nil {
			return http.StatusBadGateway, "the approval could not be checked: " + err.Error()
		}
		defer resp.Body.Close()
		var current struct {
			Approvals []struct {
				ID   string `json:"id"`
				Kind string `json:"kind"`
			} `json:"approvals"`
		}
		if resp.StatusCode != http.StatusOK || json.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(&current) != nil {
			return http.StatusConflict, "the approval could not be checked"
		}
		kind := ""
		for _, approval := range current.Approvals {
			if approval.ID == req.ID {
				kind = approval.Kind
			}
		}
		if kind != "browser" {
			return http.StatusForbidden, "a paired browser can deny this but not allow it; allow commands and file changes in Burf"
		}
	}
	// The box gets exactly what was checked, not the bytes that were sent.
	body, _ := json.Marshal(req)
	r.Body = io.NopCloser(bytes.NewReader(body))
	r.ContentLength = int64(len(body))
	return 0, ""
}

var browserMessage = regexp.MustCompile(`/chats/[0-9a-f]{32}/messages$`)

// browserMessageBody lets a paired browser send text and nothing else. A
// message can also carry a chat's model, effort and permission, up to full
// access to the box; those are chosen in Burf, never by a browser extension.
func browserMessageBody(r *http.Request) (int, string) {
	const limit = 3 << 20
	body, err := io.ReadAll(io.LimitReader(r.Body, limit+1))
	if err != nil || len(body) > limit {
		return http.StatusRequestEntityTooLarge, "the message is too large"
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(body, &fields) != nil {
		return http.StatusBadRequest, "invalid request"
	}
	for name := range fields {
		if name != "text" {
			return http.StatusForbidden, "a paired browser can send only text; choose a chat's model and permissions in Burf"
		}
	}
	r.Body = io.NopCloser(bytes.NewReader(body))
	r.ContentLength = int64(len(body))
	return 0, ""
}

// browserRedeem is POST /v1/browser/pair: the one request an extension makes
// without a credential, to trade the code the user typed for one.
func (a *Agent) browserRedeem(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if !browserOrigin.MatchString(origin) {
		writeError(w, http.StatusForbidden, "only a browser extension can pair")
		return
	}
	var req struct {
		Code string `json:"code"`
		Name string `json:"name"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&req) != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = "Browser"
	}
	if len(name) > 64 || strings.ContainsFunc(name, func(c rune) bool { return c < 0x20 || c == 0x7f }) {
		writeError(w, http.StatusBadRequest, "a browser's name is at most 64 printable characters")
		return
	}
	token, pairing, err := a.browserPairs().redeem(req.Code, name, origin)
	switch {
	case errors.Is(err, errNoBrowserCode), errors.Is(err, errBrowserCode):
		writeError(w, http.StatusForbidden, err.Error())
	case errors.Is(err, errBrowserPairLimit):
		writeError(w, http.StatusConflict, err.Error())
	case err != nil:
		writeError(w, http.StatusInternalServerError, err.Error())
	default:
		writeJSON(w, http.StatusOK, map[string]any{"token": token, "id": pairing.ID, "name": pairing.Name})
	}
}

// browserRoutes are on the agent's own socket, so the CLI reaches them and
// the app reaches them with its token. A paired browser reaches only boxes.
func (a *Agent) browserRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/browser/pairing", func(w http.ResponseWriter, r *http.Request) {
		code, expires, err := a.browserPairs().mint()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"code": code, "expires_at": expires.UTC()})
	})
	mux.HandleFunc("GET /v1/browser/pairings", func(w http.ResponseWriter, r *http.Request) {
		list, err := a.browserPairs().pairings()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"pairings": list})
	})
	mux.HandleFunc("DELETE /v1/browser/pairings/{id}", func(w http.ResponseWriter, r *http.Request) {
		found, err := a.browserPairs().revoke(r.PathValue("id"))
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if !found {
			writeError(w, http.StatusNotFound, "no paired browser with that id")
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	})
	// The boxes a browser can chat on: names and whether they answer, nothing
	// about addresses, routes or forwards.
	mux.HandleFunc("GET /v1/browser/boxes", func(w http.ResponseWriter, r *http.Request) {
		a.sync()
		type box struct {
			Name  string `json:"name"`
			State string `json:"state"`
			Local bool   `json:"local,omitempty"`
		}
		out := []box{}
		for _, b := range a.status().Boxes {
			out = append(out, box{Name: b.Name, State: b.State, Local: b.Local})
		}
		writeJSON(w, http.StatusOK, map[string]any{"boxes": out})
	})
}
