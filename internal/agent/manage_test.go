package agent

import (
	"bufio"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/sean-brydon/berthd/internal/hooks"
	"github.com/sean-brydon/berthd/internal/sshsetup"
)

// fakeCLI stands in for the berth binary the agent runs: it prints its
// arguments, and fails when the first one is "fail".
func fakeCLI(t *testing.T, a *runningAgent) {
	t.Helper()
	script := `#!/bin/sh
if [ "$3" = "fail.example" ]; then echo "Checking $3…"; echo "berth: ssh: could not resolve fail.example" >&2; exit 1; fi
if [ "$3" = "refused.example" ]; then
  echo "Using your SSH agent"
  [ "$BERTH_FAILURE_JSON" = 1 ] && echo 'berth-failure: {"kind":"refused","host":"refused.example","port":"22","message":"Nothing is accepting SSH on refused.example (port 22)."}' >&2
  echo "berth: Nothing is accepting SSH on refused.example (port 22)." >&2
  exit 1
fi
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

func TestAnSSHFailureIsSaidOnceWithItsDetails(t *testing.T) {
	b := newBox(t)
	a := startAgent(t, b.pairLaptop())
	tok := uiToken(t, a)
	fakeCLI(t, a)

	_, body := uiSend(t, a, "POST", "/v1/boxes/add-ssh", tok, `{"host":"refused.example"}`)
	lines := strings.Split(strings.TrimSpace(body), "\n")
	var last StreamLine
	if err := json.Unmarshal([]byte(lines[len(lines)-1]), &last); err != nil {
		t.Fatal(err)
	}
	if strings.Count(body, "Nothing is accepting SSH") != 2 || len(lines) != 2 {
		// Once as the error, once inside the structured failure: never as a
		// line of output too.
		t.Fatalf("the failure was not said once:\n%s", body)
	}
	var f struct{ Kind, Host, Port, Message string }
	if !last.Done || last.Error != "Nothing is accepting SSH on refused.example (port 22)." || json.Unmarshal(last.SSH, &f) != nil || f.Kind != "refused" || f.Port != "22" {
		t.Fatalf("done = %+v (%s)", last, last.SSH)
	}
	if strings.Contains(body, "berth-failure") {
		t.Fatalf("the JSON line leaked into the output: %s", body)
	}

	_, body = uiSend(t, a, "POST", "/v1/boxes/add-ssh", tok, `{"host":"me@new.example","identity":"/keys/id_ed25519","trust_host_key":"SHA256:abc"}`)
	if !strings.Contains(body, "ran add ssh me@new.example --identity /keys/id_ed25519 --trust-host-key SHA256:abc") {
		t.Fatalf("identity and host key were not passed on: %s", body)
	}
	if resp, _ := uiSend(t, a, "POST", "/v1/boxes/add-ssh", tok, `{"host":"me@new.example","trust_host_key":"yes"}`); resp.StatusCode != 400 {
		t.Fatalf("a host key that is not a fingerprint gave %d", resp.StatusCode)
	}
}

func TestTheAppSeesHowSSHWillLogIn(t *testing.T) {
	b := newBox(t)
	a := startAgent(t, b.pairLaptop())
	tok := uiToken(t, a)

	home := t.TempDir()
	os.MkdirAll(filepath.Join(home, ".ssh", "conf.d"), 0o700)
	os.WriteFile(filepath.Join(home, ".ssh", "config"), []byte("Include conf.d/*\nHost dev-box hetzner\n  User me\nHost *.internal !bastion\n"), 0o600)
	os.WriteFile(filepath.Join(home, ".ssh", "conf.d", "pi"), []byte("Host pi\n"), 0o600)
	old := sshFinder
	t.Cleanup(func() { sshFinder = old })
	sshFinder = func() sshsetup.Finder {
		return sshsetup.Finder{Home: home, GOOS: "linux", Getenv: func(string) string { return "" }, Alive: func(string) bool { return false }}
	}

	_, body := uiSend(t, a, "GET", "/v1/ssh/hosts", tok, "")
	if strings.TrimSpace(body) != `["dev-box","hetzner","pi"]` {
		t.Fatalf("hosts = %s", body)
	}
	resp, body := uiSend(t, a, "GET", "/v1/ssh/plan?host=nobody@test.invalid", tok, "")
	var plan sshsetup.Plan
	if resp.StatusCode != 200 || json.Unmarshal([]byte(body), &plan) != nil || plan.User != "nobody" || plan.HostName != "test.invalid" || plan.Summary == "" {
		t.Fatalf("plan = %d %s", resp.StatusCode, body)
	}
	if resp, _ := uiSend(t, a, "GET", "/v1/ssh/plan?host=-oProxyCommand=x", tok, ""); resp.StatusCode != 400 {
		t.Fatalf("a host that is a flag gave %d", resp.StatusCode)
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
	if !strings.Contains(body, `"say hi"`) {
		t.Fatalf("hooks = %s", body)
	}
	// An installed plugin is off, and its hooks do not run, until the user
	// allows it with the hash of what they reviewed.
	_, body = uiSend(t, a, "GET", "/v1/hooks", tok, "")
	if strings.Contains(body, "plugin:hello") {
		t.Fatalf("a plugin nobody allowed has its hooks listed: %s", body)
	}
	if resp, _ := uiSend(t, a, "POST", "/v1/plugins/hello/enable", tok, "{}"); resp.StatusCode != 400 {
		t.Fatalf("enabling without a reviewed hash gave %d", resp.StatusCode)
	}
	if resp, _ := uiSend(t, a, "POST", "/v1/plugins/hello/enable", tok, `{"hash":"sha256:00"}`); resp.StatusCode != 409 {
		t.Fatalf("enabling with a stale hash gave %d", resp.StatusCode)
	}
	manifest, _ := os.ReadFile(filepath.Join(user, "plugins", "hello", "berth-plugin.json"))
	hash := hooks.HashPluginFiles(manifest, nil)
	_, body = uiSend(t, a, "POST", "/v1/plugins/hello/enable", tok, `{"hash":"`+hash+`"}`)
	if !strings.Contains(body, `"enabled":true`) || !strings.Contains(body, hash) {
		t.Fatalf("enable = %s", body)
	}
	_, body = uiSend(t, a, "GET", "/v1/hooks", tok, "")
	if !strings.Contains(body, `"source":"plugin:hello"`) {
		t.Fatalf("an allowed plugin's hooks are missing: %s", body)
	}
	// A change to it turns it off until it is reviewed again.
	os.WriteFile(filepath.Join(user, "plugins", "hello", "berth-plugin.json"), []byte(`{"name":"Hello","hooks":[{"on":"agent.finished","run":"curl evil"}]}`), 0o600)
	_, body = uiSend(t, a, "GET", "/v1/plugins", tok, "")
	if !strings.Contains(body, `"enabled":false`) || !strings.Contains(body, `"changed":true`) {
		t.Fatalf("a changed plugin = %s", body)
	}
	os.WriteFile(filepath.Join(user, "plugins", "hello", "berth-plugin.json"), manifest, 0o600)

	_, body = uiSend(t, a, "POST", "/v1/plugins/hello/disable", tok, "")
	if !strings.Contains(body, `"enabled":false`) || strings.Contains(body, `"allowed"`) {
		t.Fatalf("disable = %s", body)
	}
	_, body = uiSend(t, a, "GET", "/v1/hooks", tok, "")
	if strings.Contains(body, "plugin:hello") {
		t.Fatalf("a disabled plugin's hooks are still listed: %s", body)
	}
	_, body = uiSend(t, a, "POST", "/v1/plugins/hello/enable", tok, `{"hash":"`+hash+`"}`)
	if !strings.Contains(body, `"enabled":true`) {
		t.Fatalf("enable = %s", body)
	}
}
