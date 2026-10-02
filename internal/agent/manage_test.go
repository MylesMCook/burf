package agent

import (
	"bufio"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// fakeCLI stands in for the berth binary the agent runs: it prints its
// arguments, and fails when the first one is "fail".
func fakeCLI(t *testing.T, a *runningAgent) {
	t.Helper()
	script := `#!/bin/sh
if [ "$3" = "fail.example" ]; then echo "Checking $3…"; echo "berth: ssh: could not resolve fail.example" >&2; exit 1; fi
case "$1" in
  pair) printf '{"name":"devl","args":"%s","home":"%s"}\n' "$*" "$BERTH_HOME" ;;
  *) echo "step one"; echo "ran $*" ;;
esac
`
	if err := os.WriteFile(filepath.Join(a.dir, "fake-berth"), []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
}

func uiSend(t *testing.T, a *runningAgent, method, path, token, body string) (*http.Response, string) {
	t.Helper()
	req, _ := http.NewRequest(method, "http://"+a.ui+path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var b strings.Builder
	sc := bufio.NewScanner(resp.Body)
	for sc.Scan() {
		b.WriteString(sc.Text() + "\n")
	}
	return resp, b.String()
}

func TestTheAppAddsAndPairsBoxesThroughTheCLI(t *testing.T) {
	b := newBox(t)
	a := startAgent(t, b.pairLaptop())
	tok := uiToken(t, a)
	fakeCLI(t, a)

	resp, body := uiSend(t, a, "POST", "/v1/boxes/pair", tok, `{"link":"berth://1.2.3.4:7444?code=x","name":"devl","network":"personal"}`)
	if resp.StatusCode != 200 || !strings.Contains(body, "pair berth://1.2.3.4:7444?code=x --json --name devl --network personal") || !strings.Contains(body, filepath.Dir(a.dir)) {
		t.Fatalf("pair: %d %s", resp.StatusCode, body)
	}
	if resp, _ := uiSend(t, a, "POST", "/v1/boxes/pair", tok, `{"link":"--help"}`); resp.StatusCode != 400 {
		t.Fatalf("a link that is a flag gave %d", resp.StatusCode)
	}

	_, body = uiSend(t, a, "POST", "/v1/boxes/add-ssh", tok, `{"host":"sean@devl","network":"personal"}`)
	var lines []StreamLine
	for _, l := range strings.Split(strings.TrimSpace(body), "\n") {
		var sl StreamLine
		json.Unmarshal([]byte(l), &sl)
		lines = append(lines, sl)
	}
	last := lines[len(lines)-1]
	if len(lines) != 3 || lines[1].Line != "ran add ssh sean@devl --network personal" || !last.Done || last.Error != "" {
		t.Fatalf("add ssh streamed %s", body)
	}
	_, body = uiSend(t, a, "POST", "/v1/boxes/add-ssh", tok, `{"host":"fail.example"}`)
	if !strings.Contains(body, `"done":true,"error":"ssh: could not resolve fail.example"`) {
		t.Fatalf("a failed add ssh streamed %s", body)
	}
}

func TestTheAppEditsLaptopHooksAndTogglesPlugins(t *testing.T) {
	b := newBox(t)
	a := startAgent(t, b.pairLaptop())
	tok := uiToken(t, a)
	user := filepath.Join(a.dir, "user")
	os.MkdirAll(filepath.Join(user, "plugins", "hello"), 0o700)
	os.WriteFile(filepath.Join(user, "plugins", "hello", "berth-plugin.json"), []byte(`{"name":"Hello","hooks":[{"on":"agent.finished","run":"true"}]}`), 0o600)

	if resp, _ := uiSend(t, a, "PUT", "/v1/hooks", tok, `{"hooks":[{"on":"bad event","run":"x"}]}`); resp.StatusCode != 400 {
		t.Fatalf("an invalid hook gave %d", resp.StatusCode)
	}
	_, body := uiSend(t, a, "PUT", "/v1/hooks", tok, `{"hooks":[{"on":"agent.waiting","run":"say hi"}]}`)
	if !strings.Contains(body, `"say hi"`) || !strings.Contains(body, `"source":"plugin:hello"`) {
		t.Fatalf("hooks = %s", body)
	}
	_, body = uiSend(t, a, "POST", "/v1/plugins/hello/disable", tok, "")
	if !strings.Contains(body, `"enabled":false`) {
		t.Fatalf("disable = %s", body)
	}
	_, body = uiSend(t, a, "GET", "/v1/hooks", tok, "")
	if strings.Contains(body, "plugin:hello") {
		t.Fatalf("a disabled plugin's hooks are still listed: %s", body)
	}
	_, body = uiSend(t, a, "POST", "/v1/plugins/hello/enable", tok, "")
	if !strings.Contains(body, `"enabled":true`) {
		t.Fatalf("enable = %s", body)
	}
}
