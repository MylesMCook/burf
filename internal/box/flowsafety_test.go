package box

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/cosscom/shipyard/internal/box/runs"
	"io"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/cosscom/shipyard/internal/events"
	"github.com/cosscom/shipyard/internal/hooks"
)

// payloads are values an attacker can put in a PR comment, a PR title, a
// branch name or a command's output. Each tries to touch marker.
func payloads(marker string) []string {
	return []string{
		"$(touch " + marker + ")",
		"`touch " + marker + "`",
		"; touch " + marker,
		"&& touch " + marker,
		"| touch " + marker,
		"' ; touch " + marker + " ; '",
		`" ; touch ` + marker + ` ; "`,
		`"$(touch ` + marker + `)"`,
		`'$(touch ` + marker + `)'`,
		"x\ntouch " + marker + "\n",
		"${IFS}touch${IFS}" + marker,
		`\"; touch ` + marker + `; echo \"`,
		"{{event.body}}",
		"*",
		"",
	}
}

// The command templates a flow author might write around a variable.
var shellContexts = []struct {
	command string
	want    func(v string) string
}{
	{`printf '%s' {{v}}`, func(v string) string { return v }},
	{`printf '%s' "{{v}}"`, func(v string) string { return v }},
	{`printf '%s' '{{v}}'`, func(v string) string { return v }},
	{`printf '%s' "pre-{{v}}-post"`, func(v string) string { return "pre-" + v + "-post" }},
	{`printf '%s' 'pre-{{v}}-post'`, func(v string) string { return "pre-" + v + "-post" }},
	{`printf '%s' pre{{v}}post`, func(v string) string { return "pre" + v + "post" }},
	{`printf '%s' "$(printf '%s' {{v}})"`, func(v string) string { return strings.TrimRight(v, "\n") }},
	{`printf '%s' "$(printf '%s' "{{v}}")"`, func(v string) string { return strings.TrimRight(v, "\n") }},
	{"printf '%s' \"`printf '%s' {{v}}`\"", func(v string) string { return strings.TrimRight(v, "\n") }},
	{`printf '%s' "{{v}}" "{{v}}" > /dev/null; printf '%s' {{ v }}`, func(v string) string { return v }},
}

func TestFlowValuesNeverRunAsShellCode(t *testing.T) {
	shells := []string{"sh"}
	for _, s := range []string{"bash", "zsh", "dash"} {
		if _, err := exec.LookPath(s); err == nil {
			shells = append(shells, s)
		}
	}
	dir := t.TempDir()
	marker := filepath.Join(dir, "PWNED")
	for _, shell := range shells {
		for _, c := range shellContexts {
			for _, v := range payloads(marker) {
				script, env := shellTemplate(c.command, map[string]string{"v": v})
				if strings.Contains(script, "touch") {
					t.Fatalf("the value reached the script: %q", script)
				}
				cmd := exec.Command(shell, "-c", script)
				cmd.Dir = dir
				cmd.Env = append(os.Environ(), env...)
				out, err := cmd.CombinedOutput()
				if err != nil {
					t.Errorf("%s: %s with %q: %v %s", shell, c.command, v, err, out)
					continue
				}
				if _, err := os.Stat(marker); err == nil {
					t.Fatalf("%s: %s with %q ran the value as code", shell, c.command, v)
				}
				if got, want := string(out), c.want(v); got != want {
					t.Errorf("%s: %s with %q printed %q, want %q", shell, c.command, v, got, want)
				}
			}
		}
	}
}

func TestShellTemplatesExportEveryVariable(t *testing.T) {
	script, env := shellTemplate(`echo {{event.body}} {{steps.my-test.output}} {{nothing.set}}`, map[string]string{
		"event.body": "hi", "steps.my-test.output": "ok", "steps.my_test.output": "clash",
	})
	if script != `echo "$BERTH_FLOW_EVENT_BODY" "$BERTH_FLOW_STEPS_MY_TEST_OUTPUT" "$BERTH_FLOW_NOTHING_SET"` {
		t.Fatalf("script = %s", script)
	}
	want := []string{"BERTH_FLOW_EVENT_BODY=hi", "BERTH_FLOW_NOTHING_SET=", "BERTH_FLOW_STEPS_MY_TEST_OUTPUT=ok", "BERTH_FLOW_STEPS_MY_TEST_OUTPUT_2=clash"}
	if strings.Join(env, ",") != strings.Join(want, ",") {
		t.Fatalf("env = %q", env)
	}
}

// boxFlowBox is flowBox with the flows as the box's own, which run without a
// repository needing to be trusted.
func boxFlowBox(t *testing.T, flows []Flow) (*Box, Session, Worktree) {
	t.Helper()
	b, sess, wt := flowBox(t, nil)
	if err := b.Flows.SaveBox(flows); err != nil {
		t.Fatal(err)
	}
	return b, sess, wt
}

func TestAFlowRunsHostileEventDataAndOutputAsText(t *testing.T) {
	// A quiet login shell, so a step's output is only what it printed.
	t.Setenv("SHELL", "/bin/sh")
	out := t.TempDir()
	marker := filepath.Join(out, "PWNED")
	title := "fix: it `touch " + marker + "`"
	body := "LGTM $(touch " + marker + "); rm -rf ~ \"quoted\" 'single'\nsecond line"
	branch := "feat/$(touch${IFS}" + marker + ")"
	b, _, wt := boxFlowBox(t, []Flow{{
		ID: "pr", Name: "PR comment", Enabled: true, Trigger: Trigger{Event: "agent.waiting"},
		Steps: []Step{
			{ID: "first", Kind: "run", Command: `printf '%s' "{{event.body}}" > ` + filepath.Join(out, "body") +
				`; printf '%s' {{event.title}} > ` + filepath.Join(out, "title") +
				`; printf '%s' '{{event.branch}}' > ` + filepath.Join(out, "branch") +
				`; printf '%s' "$(touch ` + marker + `-ok)"; echo '$(touch ` + marker + `)'`},
			{Kind: "run", Command: `printf '%s' {{prev.output}} > ` + filepath.Join(out, "prev") + `; printf '%s' "{{steps.first.output}}" > ` + filepath.Join(out, "steps")},
		},
	}})
	b.Events.Publish(events.Event{Type: "agent.waiting", Data: map[string]any{"path": wt.Path, "body": body, "title": title, "branch": branch}})
	run := waitRun(t, b, "pr")
	if run.Status != "succeeded" {
		t.Fatalf("run = %+v", run)
	}
	if _, err := os.Stat(marker); err == nil {
		t.Fatal("event data or a step's output ran as a command")
	}
	if _, err := os.Stat(marker + "-ok"); err != nil {
		t.Fatal("the flow author's own command substitution should still run")
	}
	for file, want := range map[string]string{"body": body, "title": title, "branch": branch, "prev": "$(touch " + marker + ")\n", "steps": "$(touch " + marker + ")\n"} {
		got, _ := os.ReadFile(filepath.Join(out, file))
		if string(got) != want {
			t.Errorf("%s = %q, want %q", file, got, want)
		}
	}
}

func TestWebhookValuesAreEncodedNotInterpreted(t *testing.T) {
	type hit struct {
		path, query string
		body        map[string]any
	}
	got := make(chan hit, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var m map[string]any
		raw, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(raw, &m); err != nil {
			t.Errorf("the body is not JSON: %s", raw)
		}
		got <- hit{r.URL.EscapedPath(), r.URL.Query().Get("title"), m}
	}))
	defer srv.Close()
	b, _, wt := boxFlowBox(t, []Flow{{ID: "hook", Name: "hook", Enabled: true, Trigger: Trigger{Event: "agent.waiting"},
		Steps: []Step{{Kind: "webhook", URL: srv.URL + "/hook/{{event.branch}}?title={{event.title}}",
			Text: `{"text": "{{event.title}}", "n": {{event.pr}}, "raw": {{event.title}}}`}}}})
	b.Flows.AllowOutbound = []string{"127.0.0.1"}
	title := `a&admin=1#frag", "evil": true, "x": "/../`
	b.Events.Publish(events.Event{Type: "agent.waiting", Data: map[string]any{"path": wt.Path, "title": title, "branch": "../../admin", "pr": 12}})
	select {
	case h := <-got:
		if h.path != "/hook/..%2F..%2Fadmin" || h.query != title {
			t.Fatalf("url path %q query %q", h.path, h.query)
		}
		if h.body["text"] != title || h.body["raw"] != title || h.body["n"] != float64(12) || h.body["evil"] != nil {
			t.Fatalf("body = %v", h.body)
		}
	case <-time.After(5 * time.Second):
		t.Fatalf("the webhook was never called: %+v", b.Flows.Runs("hook", 1))
	}
}

func TestWebhooksRefusePrivateAddressesUnlessAllowed(t *testing.T) {
	called := make(chan bool, 4)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { called <- true }))
	defer srv.Close()
	port := srv.URL[strings.LastIndex(srv.URL, ":")+1:]
	b, _, wt := boxFlowBox(t, []Flow{
		{ID: "ip", Name: "ip", Enabled: true, Trigger: Trigger{Event: "agent.waiting"}, Steps: []Step{{Kind: "webhook", URL: srv.URL}}},
		{ID: "name", Name: "name", Enabled: true, Trigger: Trigger{Event: "agent.waiting"}, Steps: []Step{{Kind: "webhook", URL: "http://localhost:" + port + "/"}}},
		{ID: "event", Name: "event", Enabled: true, Trigger: Trigger{Event: "agent.waiting"}, Steps: []Step{{Kind: "webhook", URL: "http://{{event.host}}/"}}},
	})
	b.Events.Publish(events.Event{Type: "agent.waiting", Data: map[string]any{"path": wt.Path, "host": "169.254.169.254"}})
	for _, id := range []string{"ip", "name", "event"} {
		run := waitRun(t, b, id)
		if run.Status != "failed" || !strings.Contains(run.Steps[0].Error, "refusing to connect") {
			t.Fatalf("%s: %+v", id, run)
		}
	}
	select {
	case <-called:
		t.Fatal("a refused webhook reached the server")
	default:
	}

	// The box's owner allows it in network.json.
	os.WriteFile(filepath.Join(filepath.Dir(b.Flows.Path), NetworkFile), []byte(`{"allow_outbound": ["127.0.0.0/8"]}`), 0o600)
	run := b.runFlow(context.Background(), ScopedFlow{Scope: "box", Flow: Flow{ID: "ip2", Steps: []Step{{Kind: "webhook", URL: srv.URL}}}}, events.Event{Type: "agent.waiting", Data: map[string]any{"path": wt.Path}})
	if run.Status != "succeeded" {
		t.Fatalf("allowed: %+v", run)
	}
}

func TestOutboundPolicyJudgesTheDialledAddress(t *testing.T) {
	p := parseAllow([]string{"10.1.2.0/24", "192.168.7.7", "ntfy.home.lan."})
	for addr, want := range map[string]bool{
		"8.8.8.8": true, "2606:4700::1111": true,
		"127.0.0.1": false, "::1": false, "0.0.0.0": false, "::": false,
		"10.0.0.1": false, "172.16.0.1": false, "192.168.1.1": false,
		"169.254.169.254": false, "fe80::1": false, "fd00:ec2::254": false, "fc00::1": false,
		"100.100.100.200": false, "100.64.0.1": false, "192.0.0.192": false,
		"224.0.0.1": false, "255.255.255.255": false, "::ffff:127.0.0.1": false, "64:ff9b::a9fe:a9fe": false,
		"10.1.2.3": true, "192.168.7.7": true, "::ffff:10.1.2.9": true,
	} {
		if got := p.allowedIP(netip.MustParseAddr(addr)); got != want {
			t.Errorf("%s allowed = %v, want %v", addr, got, want)
		}
	}
	if !p.hosts["ntfy.home.lan"] {
		t.Error("a host name entry was not kept")
	}
	p.tailnet = true
	if !p.allowedIP(netip.MustParseAddr("100.101.102.103")) {
		t.Error("the tailnet is allowed for the phone")
	}
}

func TestRedirectsAreCheckedLikeTheFirstRequest(t *testing.T) {
	inner := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { t.Error("the redirect reached a private address") }))
	defer inner.Close()
	outer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, inner.URL, http.StatusFound)
	}))
	defer outer.Close()
	port := outer.URL[strings.LastIndex(outer.URL, ":")+1:]
	// localhost is allowed by name; the redirect's 127.0.0.1 is not.
	c := parseAllow([]string{"localhost"}).client(5 * time.Second)
	_, err := c.Get("http://localhost:" + port + "/")
	if err == nil || !errors.Is(err, errBlockedAddress) {
		t.Fatalf("err = %v", err)
	}
}

func TestWebhooksNeverSendASecretAStepPrinted(t *testing.T) {
	got := make(chan string, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		got <- r.URL.String() + " " + string(raw)
	}))
	defer srv.Close()
	b, _, wt := boxFlowBox(t, nil)
	b.Flows.AllowOutbound = []string{"127.0.0.1"}
	secret := "hunter2-very-secret"
	sf := ScopedFlow{Scope: "box", Flow: Flow{ID: "leak", Steps: []Step{
		{Kind: "run", Command: "echo " + secret},
		{Kind: "webhook", URL: srv.URL + "/?q={{prev.output}}", Text: `{"out": "{{prev.output}}"}`},
	}}}
	// The run host sends the webhook with the worktree's resolved secrets.
	vars := map[string]string{"prev.output": secret + "\n", "worktree.path": wt.Path}
	h := &runHost{b: b, env: map[string]*runEnv{"r_test|" + wt.Path: {wt: wt, scoped: true, secrets: []string{secret}}}}
	if res := h.webhook(context.Background(), &runs.StepCtx{Run: runs.Summary{ID: "r_test"}, Step: sf.Flow.Steps[1], Vars: vars}); res.Status != runs.Succeeded {
		t.Fatal(res.Err)
	}
	if s := <-got; strings.Contains(s, secret) || !strings.Contains(s, "[secret]") {
		t.Fatalf("sent %q", s)
	}
}

func TestThePhonesKeysGoThroughTheSendGate(t *testing.T) {
	b, _, h := phoneBox(t)
	cfg := filepath.Join(t.TempDir(), "hooks.json")
	os.WriteFile(cfg, []byte(`{"hooks":[{"on":"before:session.send","run":"echo not from a phone; exit 1"}]}`), 0o600)
	b.Hooks = &hooks.Runner{Path: cfg}
	if _, err := b.Sessions.Create(context.Background(), "agent", "", t.TempDir(), "cat", nil); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/phone/v1/sessions/agent/keys", "/phone/v1/sessions/agent/send"} {
		w := phoneReq(t, h, "POST", path, phoneAddr, "right-token", `{"key":"y","text":"y"}`)
		if w.Code != 403 || !strings.Contains(w.Body.String(), "not from a phone") {
			t.Fatalf("%s: %d %s", path, w.Code, w.Body)
		}
	}
}

func TestPhonePushesRefuseTheBoxsOwnLoopback(t *testing.T) {
	hit := make(chan bool, 1)
	ntfy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { hit <- true }))
	defer ntfy.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	b, p, _ := phoneBox(t)
	p.save(PhoneConfig{Enabled: false, Token: "t", Notify: &PhoneNotify{URL: ntfy.URL + "/berth-topic"}})
	go p.Run(ctx, b)
	time.Sleep(100 * time.Millisecond)
	b.Events.Publish(events.Event{Type: "agent.waiting", Data: map[string]any{"agent": "claude"}})
	select {
	case <-hit:
		t.Fatal("a push reached a loopback address nobody allowed")
	case <-time.After(700 * time.Millisecond):
	}
}
