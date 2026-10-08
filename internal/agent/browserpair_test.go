package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/wire"
)

const extensionOrigin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop"

// browserCall makes a request to the app API as a browser would.
func browserCall(t *testing.T, a *runningAgent, method, path, token, origin, body string) (int, string) {
	t.Helper()
	req, err := http.NewRequest(method, "http://"+a.ui+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(b)
}

// pairingCode asks the agent for a code the way `burf browser pair` does.
func pairingCode(t *testing.T, a *runningAgent) string {
	t.Helper()
	var out struct {
		Code      string    `json:"code"`
		ExpiresAt time.Time `json:"expires_at"`
	}
	if err := a.client.Call(context.Background(), "POST", "/v1/browser/pairing", nil, &out); err != nil {
		t.Fatal(err)
	}
	if len(out.Code) != 9 || out.Code[4] != '-' || !out.ExpiresAt.After(time.Now()) {
		t.Fatalf("pairing code: %+v", out)
	}
	return out.Code
}

// pairBrowser pairs an extension and returns its credential and id.
func pairBrowser(t *testing.T, a *runningAgent, name string) (string, string) {
	t.Helper()
	status, body := browserCall(t, a, "POST", "/v1/browser/pair", "", extensionOrigin, fmt.Sprintf(`{"code":%q,"name":%q}`, pairingCode(t, a), name))
	var out struct {
		Token string `json:"token"`
		ID    string `json:"id"`
	}
	if status != 200 || json.Unmarshal([]byte(body), &out) != nil || !strings.HasPrefix(out.Token, "brw_") || out.ID == "" {
		t.Fatalf("pair: %d %s", status, body)
	}
	return out.Token, out.ID
}

func browserAgent(t *testing.T) (*runningAgent, string) {
	t.Helper()
	b := newBoxWith(t, func(s *wire.Server) {
		reply := func(body string) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				io.WriteString(w, body)
			})
		}
		s.Handle("GET /v1/chats", reply(`{"chats":[]}`))
		s.Handle("GET /v1/chats/{id}/browser/calls", reply(`{"calls":[]}`))
		s.Handle("POST /v1/chats/{id}/browser/results", reply(`{"ok":true}`))
		// Echoes what the box was sent, so a test can see what got through.
		echo := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			body, _ := io.ReadAll(r.Body)
			w.Header().Set("Content-Type", "application/json")
			w.Write(body)
		})
		s.Handle("POST /v1/chats/{id}/messages", echo)
		s.Handle("POST /v1/chats/{id}/approvals", echo)
		// A chat waiting on one approval of each kind.
		s.Handle("GET /v1/chats/{id}", reply(`{"state":"waiting","approvals":[{"id":"41","kind":"browser"},{"id":"7","kind":"command"},{"id":"8","kind":"files"}]}`))
	})
	a := startAgent(t, b.pairLaptop())
	tok := uiToken(t, a)
	eventually(t, "box online", func() bool { return stateOf(t, a) == StateOnline })
	return a, tok
}

func TestABrowserPairsWithAOneTimeCodeAndGetsItsOwnCredential(t *testing.T) {
	a, _ := browserAgent(t)
	if status, body := browserCall(t, a, "POST", "/v1/browser/pair", "", extensionOrigin, `{"code":"ABCD-EFGH"}`); status != 403 || !strings.Contains(body, "no browser pairing is open") {
		t.Fatalf("pairing without a code: %d %s", status, body)
	}
	code := pairingCode(t, a)
	// A web page cannot pair, and its attempt costs the user's code nothing.
	for _, origin := range []string{"", "http://127.0.0.1:5173", "https://evil.example", "chrome-extension://evil.example/x"} {
		for i := 0; i < 6; i++ {
			if status, body := browserCall(t, a, "POST", "/v1/browser/pair", "", origin, fmt.Sprintf(`{"code":%q}`, code)); status != 403 || !strings.Contains(body, "only a browser extension") {
				t.Fatalf("origin %q paired: %d %s", origin, status, body)
			}
		}
	}
	typed := strings.ToLower(strings.ReplaceAll(code, "-", " "))
	status, body := browserCall(t, a, "POST", "/v1/browser/pair", "", extensionOrigin, fmt.Sprintf(`{"code":%q,"name":"Work Chrome"}`, typed))
	var paired struct {
		Token string `json:"token"`
		ID    string `json:"id"`
		Name  string `json:"name"`
	}
	if status != 200 || json.Unmarshal([]byte(body), &paired) != nil || !strings.HasPrefix(paired.Token, "brw_") || len(paired.Token) != 68 || paired.Name != "Work Chrome" {
		t.Fatalf("pair: %d %s", status, body)
	}
	if status, body = browserCall(t, a, "POST", "/v1/browser/pair", "", extensionOrigin, fmt.Sprintf(`{"code":%q}`, code)); status != 403 {
		t.Fatalf("a code worked twice: %d %s", status, body)
	}

	status, body = browserCall(t, a, "GET", "/v1/browser/boxes", paired.Token, extensionOrigin, "")
	if status != 200 || !strings.Contains(body, `"devbox"`) || strings.Contains(body, "address") || strings.Contains(body, "fingerprint") {
		t.Fatalf("boxes: %d %s", status, body)
	}

	// The credential is kept only as a hash, in a private file.
	file := filepath.Join(a.dir, BrowserPairingsFile)
	stored, err := os.ReadFile(file)
	if err != nil || strings.Contains(string(stored), paired.Token) || strings.Contains(string(stored), strings.TrimPrefix(paired.Token, "brw_")) || !strings.Contains(string(stored), `"hash"`) {
		t.Fatalf("stored pairings: %v %s", err, stored)
	}
	if st, _ := os.Stat(file); st.Mode().Perm()&0o077 != 0 {
		t.Fatalf("pairings file is readable by others: %v", st.Mode())
	}
	var listed struct {
		Pairings []BrowserPairing `json:"pairings"`
	}
	if err = a.client.Call(context.Background(), "GET", "/v1/browser/pairings", nil, &listed); err != nil || len(listed.Pairings) != 1 {
		t.Fatalf("list: %v %+v", err, listed)
	}
	if p := listed.Pairings[0]; p.ID != paired.ID || p.Name != "Work Chrome" || p.Origin != extensionOrigin || p.Hash != "" || p.Created.IsZero() {
		t.Fatalf("listed pairing: %+v", p)
	}
	// It outlives the agent: a restarted agent reads the same file.
	again := &browserPairs{path: file}
	if p, ok := again.lookup(paired.Token); !ok || p.ID != paired.ID {
		t.Fatal("a paired browser was forgotten")
	}
}

func TestAPairedBrowserReachesOnlyChatsAndTheirBrowserTools(t *testing.T) {
	a, appToken := browserAgent(t)
	token, _ := pairBrowser(t, a, "Chrome")
	chat := strings.Repeat("0123456789abcdef", 2)
	for _, tc := range []struct{ method, path, body string }{
		{"GET", "/v1/browser/boxes", ""},
		{"GET", "/v1/boxes/devbox/api/chats", ""},
		{"GET", "/v1/boxes/devbox/api/chats/" + chat + "/browser/calls?wait=0", ""},
		{"POST", "/v1/boxes/devbox/api/chats/" + chat + "/browser/results", `{"id":"x","content":[]}`},
	} {
		if status, body := browserCall(t, a, tc.method, tc.path, token, extensionOrigin, tc.body); status != 200 {
			t.Errorf("%s %s: %d %s", tc.method, tc.path, status, body)
		}
	}
	for _, tc := range []struct{ method, path string }{
		{"GET", "/v1/status"},
		{"GET", "/v1/events"},
		{"GET", "/v1/plugins"},
		{"GET", "/v1/themes"},
		{"POST", "/v1/stop"},
		{"POST", "/v1/refresh"},
		{"POST", "/v1/forwards"},
		{"POST", "/v1/browser/pairing"},
		{"GET", "/v1/browser/pairings"},
		{"DELETE", "/v1/browser/pairings/anything"},
		{"GET", "/v1/boxes/devbox/api/sessions"},
		{"POST", "/v1/boxes/devbox/api/sessions"},
		{"GET", "/v1/boxes/devbox/api/worktrees/project/main/file"},
		{"POST", "/v1/boxes/devbox/api/locations"},
		{"DELETE", "/v1/boxes/devbox/api/chats"},
		{"GET", "/v1/boxes/devbox/api/chats/" + chat + "/browser/tools"},
		{"POST", "/v1/boxes/devbox/api/chats/" + chat + "/browser/calls"},
		{"GET", "/v1/boxes/devbox/api/chats/../sessions"},
		{"GET", "/v1/boxes/devbox/api/chats%2F..%2Fsessions"},
		{"GET", "/v1/boxes/devbox/api/chats/" + chat + "%2F..%2F..%2Fsessions"},
		{"POST", "/v1/boxes/devbox/attach-local"},
	} {
		status, body := browserCall(t, a, tc.method, tc.path, token, extensionOrigin, "")
		if status != 403 || !strings.Contains(body, "paired browser") {
			t.Errorf("%s %s reached past the browser's scope: %d %s", tc.method, tc.path, status, body)
		}
	}
	// A terminal's WebSocket takes its token in the query; not a browser's.
	req, _ := http.NewRequest("GET", "http://"+a.ui+"/v1/boxes/devbox/sessions/main/attach?token="+token, nil)
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Upgrade", "websocket")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 403 {
		t.Fatalf("a browser credential opened a terminal: %d", resp.StatusCode)
	}
	// Anything shaped like a credential but unknown is not one.
	if status, _ := browserCall(t, a, "GET", "/v1/browser/boxes", "brw_"+strings.Repeat("0", 64), extensionOrigin, ""); status != 401 {
		t.Fatalf("unknown credential: %d", status)
	}
	// The app's own token is unchanged.
	if status, body := browserCall(t, a, "GET", "/v1/status", appToken, "", ""); status != 200 || !strings.Contains(body, `"devbox"`) {
		t.Fatalf("app token: %d %s", status, body)
	}
	if status, _ := browserCall(t, a, "GET", "/v1/browser/pairings", appToken, "", ""); status != 200 {
		t.Fatalf("the app cannot list paired browsers: %d", status)
	}
}

func TestAPairedBrowserSendsTextAndNeverChatOptions(t *testing.T) {
	a, appToken := browserAgent(t)
	token, _ := pairBrowser(t, a, "Chrome")
	path := "/v1/boxes/devbox/api/chats/" + strings.Repeat("0123456789abcdef", 2) + "/messages"
	if status, body := browserCall(t, a, "POST", path, token, extensionOrigin, `{"text":"open example.com"}`); status != 200 || body != `{"text":"open example.com"}` {
		t.Fatalf("a text message did not reach the box whole: %d %s", status, body)
	}
	// A message can raise a chat to full access. That choice is not a browser's.
	for _, body := range []string{
		`{"text":"x","options":{"permission":"full-access"}}`,
		`{"text":"x","Options":{"permission":"full-access"}}`,
		`{"text":"x","OPTIONS":{"model":"other"}}`,
		`{"text":"x","optionſ":{"permission":"full-access"}}`,
		`{"options":{"permission":"workspace"},"text":"x"}`,
		`{"text":"x","anything":1}`,
	} {
		if status, reply := browserCall(t, a, "POST", path, token, extensionOrigin, body); status != 403 || !strings.Contains(reply, "only text") {
			t.Errorf("%s reached the box: %d %s", body, status, reply)
		}
	}
	if status, _ := browserCall(t, a, "POST", path, token, extensionOrigin, `["text"]`); status != 400 {
		t.Errorf("a malformed message: %d", status)
	}
	// The app itself still chooses options.
	withOptions := `{"text":"x","options":{"permission":"full-access"}}`
	if status, body := browserCall(t, a, "POST", path, appToken, "", withOptions); status != 200 || body != withOptions {
		t.Fatalf("the app lost chat options: %d %s", status, body)
	}
}

func TestAPairedBrowserDeniesAnyApprovalButAllowsOnlyItsOwnBrowserTools(t *testing.T) {
	a, appToken := browserAgent(t)
	token, _ := pairBrowser(t, a, "Chrome")
	path := "/v1/boxes/devbox/api/chats/" + strings.Repeat("0123456789abcdef", 2) + "/approvals"
	decide := func(credential, body string) (int, string) {
		return browserCall(t, a, "POST", path, credential, extensionOrigin, body)
	}
	// Refusing is always safe, whatever is being asked.
	for _, id := range []string{"41", "7", "8", "gone"} {
		want := fmt.Sprintf(`{"id":%q,"decision":"decline"}`, id)
		if status, body := decide(token, want); status != 200 || body != want {
			t.Errorf("decline %s: %d %s", id, status, body)
		}
	}
	if status, body := decide(token, `{"id":"41","decision":"accept"}`); status != 200 || body != `{"id":"41","decision":"accept"}` {
		t.Fatalf("allowing its own browser tool: %d %s", status, body)
	}
	// Allowing a command or a file change lets it happen on the box.
	for _, body := range []string{
		`{"id":"7","decision":"accept"}`,
		`{"id":"7","decision":"acceptForSession"}`,
		`{"id":"7","decision":"acceptAlways"}`,
		`{"id":"8","decision":"accept"}`,
		`{"id":"gone","decision":"accept"}`,
		`{"id":"7","decision":""}`,
		// The same field twice: the box would read the last one.
		`{"id":"7","decision":"decline","Decision":"accept"}`,
		`{"id":"41","ID":"7","decision":"accept"}`,
	} {
		if status, reply := decide(token, body); status != 403 || !strings.Contains(reply, "in Burf") {
			t.Errorf("%s reached the box: %d %s", body, status, reply)
		}
	}
	// What reaches the box is what was checked, in one canonical form.
	if status, body := decide(token, `{"Decision":"accept","id":"7","decision":"decline"}`); status != 200 || body != `{"id":"7","decision":"decline"}` {
		t.Errorf("a decline was not relayed as checked: %d %s", status, body)
	}
	for _, body := range []string{`{"id":"41","decision":"accept","extra":1}`, `{"id":"41","decision":"accept"} {}`, `[]`} {
		if status, _ := decide(token, body); status != 400 {
			t.Errorf("malformed approval %s: %d", body, status)
		}
	}
	// A box this client is not paired with has nothing to check against.
	other := strings.Replace(path, "devbox", "elsewhere", 1)
	if status, _ := browserCall(t, a, "POST", other, token, extensionOrigin, `{"id":"41","decision":"accept"}`); status != 404 {
		t.Errorf("an unknown box: %d", status)
	}
	// The app itself still answers everything.
	command := `{"id":"7","decision":"acceptForSession"}`
	if status, body := browserCall(t, a, "POST", path, appToken, "", command); status != 200 || body != command {
		t.Fatalf("the app lost command approvals: %d %s", status, body)
	}
}

func TestPairingCodesExpireAndCloseAfterWrongGuesses(t *testing.T) {
	a, _ := browserAgent(t)
	redeem := func(code string) (int, string) {
		return browserCall(t, a, "POST", "/v1/browser/pair", "", extensionOrigin, fmt.Sprintf(`{"code":%q}`, code))
	}
	code := pairingCode(t, a)
	for i := 0; i < browserCodeAttempts; i++ {
		if status, body := redeem("ZZZZ-ZZZ2"); status != 403 || !strings.Contains(body, "wrong") {
			t.Fatalf("guess %d: %d %s", i, status, body)
		}
	}
	if status, body := redeem(code); status != 403 || !strings.Contains(body, "no browser pairing is open") {
		t.Fatalf("the code survived its guesses: %d %s", status, body)
	}

	// A new code replaces the one before it.
	first := pairingCode(t, a)
	second := pairingCode(t, a)
	if status, _ := redeem(first); status != 403 {
		t.Fatalf("a replaced code still works: %d", status)
	}
	if status, body := redeem(second); status != 200 {
		t.Fatalf("the current code: %d %s", status, body)
	}

	late := pairingCode(t, a)
	old := browserNow
	browserNow = func() time.Time { return time.Now().Add(browserCodeTTL + time.Second) }
	t.Cleanup(func() { browserNow = old })
	if status, body := redeem(late); status != 403 || !strings.Contains(body, "no browser pairing is open") {
		t.Fatalf("an expired code: %d %s", status, body)
	}
	browserNow = old

	for name, body := range map[string]string{
		"long name":    `{"code":"x","name":"` + strings.Repeat("n", 65) + `"}`,
		"control name": `{"code":"x","name":"a\u0007b"}`,
		"not json":     `code=x`,
		"too large":    `{"code":"` + strings.Repeat("x", 5000) + `"}`,
	} {
		if status, reply := browserCall(t, a, "POST", "/v1/browser/pair", "", extensionOrigin, body); status != 400 {
			t.Errorf("%s: %d %s", name, status, reply)
		}
	}
}

func TestRevokingABrowserEndsItsAccessAndPairingsAreLimited(t *testing.T) {
	a, _ := browserAgent(t)
	token, id := pairBrowser(t, a, "Chrome")
	other, _ := pairBrowser(t, a, "Firefox")
	if err := a.client.Call(context.Background(), "DELETE", "/v1/browser/pairings/"+id, nil, nil); err != nil {
		t.Fatal(err)
	}
	if status, _ := browserCall(t, a, "GET", "/v1/browser/boxes", token, extensionOrigin, ""); status != 401 {
		t.Fatalf("a revoked browser still has access: %d", status)
	}
	if status, _ := browserCall(t, a, "GET", "/v1/browser/boxes", other, extensionOrigin, ""); status != 200 {
		t.Fatalf("revoking one browser ended another: %d", status)
	}
	if err := a.client.Call(context.Background(), "DELETE", "/v1/browser/pairings/"+id, nil, nil); err == nil {
		t.Fatal("revoking an unknown browser succeeded")
	}
	for i := 1; i < maxBrowserPairings; i++ {
		pairBrowser(t, a, fmt.Sprintf("Browser %d", i))
	}
	status, body := browserCall(t, a, "POST", "/v1/browser/pair", "", extensionOrigin, fmt.Sprintf(`{"code":%q}`, pairingCode(t, a)))
	if status != 409 || !strings.Contains(body, "revoke one first") {
		t.Fatalf("a ninth browser: %d %s", status, body)
	}
}
