package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/service"
)

// The whole of Use this Mac with the real berth and berthd, opt in:
//
//	BERTH_E2E_LOCALBOX=1 go test -run TestUseThisMacEndToEnd ./internal/agent/
//
// Everything is its own: a temporary HOME and BERTH_HOME, an agent on free
// ports (never 1377-1379), and berthd on a free port from 7460. launchd is
// left out: a wrapper stands in for `berthd install` and `uninstall`,
// starting and stopping `berthd serve` itself; every other command is the
// real berthd. The pairing, the box connection and its API are real.
const e2eWrapper = `#!/bin/sh
REAL='%s'
box="$BERTH_HOME/box"
stop() { [ -f "$box/serve.pid" ] && kill "$(cat "$box/serve.pid")" 2>/dev/null; rm -f "$box/serve.pid"; }
case "$1" in
  install)
    if [ "$2" = "--listen" ]; then listen="$3"; else listen="$(cat "$box/listen")"; fi
    stop
    mkdir -p "$box" "$(dirname "$FAKE_UNIT")"
    sed -e "s|__LISTEN__|$listen|" -e "s|__PROGRAM__|$0|" -e "s|__HOME__|$BERTH_HOME|" "$FAKE_UNIT_TEMPLATE" > "$FAKE_UNIT"
    rm -f "$box/berthd.sock"
    nohup "$REAL" serve --listen "$listen" >> "$box/berthd.log" 2>&1 < /dev/null &
    echo $! > "$box/serve.pid"
    i=0; while [ ! -S "$box/berthd.sock" ] && [ $i -lt 100 ]; do sleep 0.1; i=$((i+1)); done
    [ -S "$box/berthd.sock" ] || { echo "berthd: berthd did not start" >&2; exit 1; }
    echo "Installed $FAKE_UNIT (no launchd: end-to-end test); berthd is serving on $listen."
    ;;
  uninstall) stop; rm -f "$FAKE_UNIT"; echo "Removed $FAKE_UNIT" ;;
  *) exec "$REAL" "$@" ;;
esac
`

func TestUseThisMacEndToEnd(t *testing.T) {
	if os.Getenv("BERTH_E2E_LOCALBOX") != "1" {
		t.Skip("set BERTH_E2E_LOCALBOX=1 to run berth and berthd for real")
	}
	root, err := os.MkdirTemp("/tmp", "lbe2e")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(root) })
	bin := filepath.Join(root, "bin")
	for _, cmd := range []string{"berth", "berthd"} {
		out := filepath.Join(bin, cmd)
		if cmd == "berthd" {
			out = filepath.Join(bin, "berthd-real")
		}
		if b, err := exec.Command("go", "build", "-o", out, "../../cmd/"+cmd).CombinedOutput(); err != nil {
			t.Fatalf("go build %s: %v\n%s", cmd, err, b)
		}
	}
	writeFile(t, filepath.Join(bin, "berthd"), fmt.Sprintf(e2eWrapper, filepath.Join(bin, "berthd-real")), 0o755)

	home, state := filepath.Join(root, "home"), filepath.Join(root, "state")
	dir := filepath.Join(state, "client")
	os.MkdirAll(home, 0o700)
	os.MkdirAll(dir, 0o700)
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", "")
	t.Setenv("BERTH_HOME", state)
	t.Setenv("BERTH_USER_DIR", filepath.Join(root, "user"))
	unit, _ := service.UnitPath(service.Spec{Name: service.BerthdName()})
	tmpl, _ := service.Render(service.Spec{Name: service.BerthdName(), Program: "__PROGRAM__", Args: []string{"serve", "--listen", "__LISTEN__"}, Env: map[string]string{"BERTH_HOME": "__HOME__"}})
	writeFile(t, filepath.Join(root, "unit.tmpl"), string(tmpl), 0o644)
	t.Setenv("FAKE_UNIT", unit)
	t.Setenv("FAKE_UNIT_TEMPLATE", filepath.Join(root, "unit.tmpl"))
	t.Cleanup(func() {
		if b, err := os.ReadFile(filepath.Join(state, "box", "serve.pid")); err == nil {
			exec.Command("kill", strings.TrimSpace(string(b))).Run()
		}
	})

	proxy, ui := fmt.Sprintf("127.0.0.1:%d", freePort(t)), fmt.Sprintf("127.0.0.1:%d", freePort(t))
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- Run(ctx, Config{
			Dir: dir, ProxyAddrs: []string{proxy}, UIAddr: ui, HealthInterval: 200 * time.Millisecond,
			CLI: filepath.Join(bin, "berth"), Berthd: filepath.Join(bin, "berthd"), LocalBoxPort: 7460,
			UserDir: filepath.Join(root, "user"), Networks: &fakeNetworks{}, Log: log.New(io.Discard, "", 0),
		})
	}()
	t.Cleanup(func() { cancel(); <-done })
	a := &runningAgent{client: NewClient(filepath.Join(dir, "agent.sock")), ui: ui, dir: dir}
	eventually(t, "the agent", func() bool { return a.client.Running(context.Background()) })
	tok := uiToken(t, a)

	_, body := uiSend(t, a, "POST", "/v1/boxes/local", tok, "")
	t.Logf("set up:\n%s", body)
	_, last := streamed(t, body)
	if last.Error != "" || last.Box == "" {
		t.Fatalf("set up failed: %s", body)
	}
	name := last.Box
	u, _, _ := service.Read(service.BerthdName())
	listen := u.Arg("--listen")
	if !loopback(listen) || strings.HasSuffix(listen, ":7444") || u.Program != filepath.Join(state, "bin", "berthd") {
		t.Fatalf("the service runs %s on %s", u.Program, listen)
	}
	eventually(t, "the box online and marked local", func() bool {
		s, err := a.client.Status(context.Background())
		return err == nil && len(s.Boxes) == 1 && s.Boxes[0].Name == name && s.Boxes[0].State == StateOnline && s.Boxes[0].Local && s.Boxes[0].Address == listen
	})
	// Its API, through the agent, as the app reaches it.
	resp, info := uiSend(t, a, "GET", "/v1/boxes/"+name+"/api/info", tok, "")
	var bi struct{ OS, Arch string }
	json.Unmarshal([]byte(info), &bi)
	if resp.StatusCode != 200 || bi.OS == "" {
		t.Fatalf("box info: %d %s", resp.StatusCode, info)
	}

	// Again: only reconnects.
	_, body = uiSend(t, a, "POST", "/v1/boxes/local", tok, "")
	if _, last := streamed(t, body); last.Error != "" || last.Box != name || !strings.Contains(body, "Already paired as "+name) {
		t.Fatalf("set up again: %s", body)
	}

	_, body = uiSend(t, a, "POST", "/v1/boxes/local/uninstall", tok, `{"remove_data":true}`)
	t.Logf("uninstall:\n%s", body)
	if _, last := streamed(t, body); last.Error != "" {
		t.Fatalf("uninstall: %s", body)
	}
	eventually(t, "berthd stopped and its port free", func() bool {
		c, err := net.DialTimeout("tcp", listen, 200*time.Millisecond)
		if err == nil {
			c.Close()
		}
		return err != nil
	})
	if s, _ := a.client.Status(context.Background()); len(s.Boxes) != 0 {
		t.Fatalf("still paired: %+v", s.Boxes)
	}
	if _, err := os.Stat(filepath.Join(state, "box")); !os.IsNotExist(err) {
		t.Fatal("the box's data is still there")
	}
}
