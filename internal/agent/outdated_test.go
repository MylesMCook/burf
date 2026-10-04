package agent

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/sean-brydon/berthd/internal/wire"
)

func TestTheAppLearnsWhichBoxesAreOutdated(t *testing.T) {
	b := newBox(t)
	a := startAgent(t, b.pairLaptop())
	tok := uiToken(t, a)
	eventually(t, "box online", func() bool { return stateOf(t, a) == StateOnline })
	// The CLI answers the check; this one counts how often it is asked.
	count := filepath.Join(a.dir, "checks")
	script := `#!/bin/sh
echo x >> "` + count + `"
if [ "$1 $3 $4" = "upgrade --check --json" ]; then printf '{"box":"%s","current":"aaa","available":"bbb","outdated":true}\n' "$2"; exit 0; fi
echo "ran $*"
`
	if err := os.WriteFile(filepath.Join(a.dir, "fake-berth"), []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	read := func(q string) []OutdatedBox {
		resp, body := uiCall(t, a, "GET", "/v1/boxes/outdated"+q, tok)
		if resp.StatusCode != 200 {
			t.Fatalf("outdated: %d %s", resp.StatusCode, body)
		}
		var out struct{ Boxes []OutdatedBox }
		json.Unmarshal([]byte(body), &out)
		return out.Boxes
	}
	got := read("")
	if len(got) != 1 || got[0].Box != "devbox" || !got[0].Outdated || got[0].Current != "aaa" || got[0].Available != "bbb" {
		t.Fatalf("outdated = %+v", got)
	}
	checks := func() int { b, _ := os.ReadFile(count); return strings.Count(string(b), "x") }
	read("")
	if n := checks(); n != 1 {
		t.Fatalf("a second read checked again (%d checks)", n)
	}
	read("?fresh=1")
	if n := checks(); n != 2 {
		t.Fatalf("?fresh=1 did not check again (%d checks)", n)
	}
	// Upgrading forgets the answer.
	uiSend(t, a, "POST", "/v1/boxes/devbox/upgrade", tok, "")
	read("")
	if n := checks(); n != 4 {
		t.Fatalf("after an upgrade the box was not checked again (%d checks)", n)
	}
}

func TestBoxAPIErrorsCarryACode(t *testing.T) {
	b := newBoxWith(t, func(s *wire.Server) {
		s.Handle("GET /v1/known", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	})
	a := startAgent(t, b.pairLaptop())
	tok := uiToken(t, a)
	eventually(t, "box online", func() bool { return stateOf(t, a) == StateOnline })
	for _, tc := range []struct{ path, code string }{
		{"/v1/boxes/nobox/api/sessions", "box_unknown"},
		{"/v1/boxes/devbox/api/not-a-route", "box_outdated"},
	} {
		resp, body := uiCall(t, a, "GET", tc.path, tok)
		var e struct{ Error, Code string }
		json.Unmarshal([]byte(body), &e)
		if e.Code != tc.code || e.Error == "" || resp.StatusCode < 400 {
			t.Errorf("%s = %d %s, want code %s", tc.path, resp.StatusCode, body, tc.code)
		}
	}
}
