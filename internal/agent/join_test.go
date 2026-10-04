package agent

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The app's invite and join run the CLI; a join link reaches it on stdin
// only, never in its arguments (which ps shows to every user).
func TestTheAppInvitesAndJoinsThroughTheCLI(t *testing.T) {
	b := newBox(t)
	a := startAgent(t, b.pairLaptop())
	tok := uiToken(t, a)
	script := `#!/bin/sh
printf '{"args":"%s","stdin":"%s"}\n' "$*" "$(cat)"
`
	if err := os.WriteFile(filepath.Join(a.dir, "fake-berth"), []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	resp, body := uiSend(t, a, "POST", "/v1/invite", tok, `{"boxes":["devl","cal"],"for":"mac-mini"}`)
	if resp.StatusCode != 200 || !strings.Contains(body, `"args":"invite --json --yes --boxes devl,cal --for mac-mini"`) {
		t.Fatalf("invite: %d %s", resp.StatusCode, body)
	}
	if resp, _ := uiSend(t, a, "POST", "/v1/invite", tok, `{"boxes":["--help"]}`); resp.StatusCode != 400 {
		t.Fatalf("a box that is a flag gave %d", resp.StatusCode)
	}

	const link = "berth://join?v=1&d=AAAA"
	resp, body = uiSend(t, a, "POST", "/v1/join", tok, `{"link":"On the other computer: berth join '`+link+`'\n"}`)
	if resp.StatusCode != 200 || !strings.Contains(body, `"args":"join --json --yes -"`) || !strings.Contains(body, `"stdin":"`+link+`"`) {
		t.Fatalf("join: %d %s", resp.StatusCode, body)
	}
	resp, body = uiSend(t, a, "POST", "/v1/join/check", tok, `{"link":"`+link+`"}`)
	if resp.StatusCode != 200 || !strings.Contains(body, `"args":"join --check --json -"`) {
		t.Fatalf("check: %d %s", resp.StatusCode, body)
	}
	if resp, body := uiSend(t, a, "POST", "/v1/join", tok, `{"link":"berth://1.2.3.4:7444?code=x"}`); resp.StatusCode != 400 || !strings.Contains(body, "no join link") {
		t.Fatalf("a pairing link: %d %s", resp.StatusCode, body)
	}
}
