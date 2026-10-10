//go:build !windows

package agent

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"os"
	"path/filepath"
	"runtime/debug"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/identity"
	"github.com/MylesMCook/burf/internal/service"
	"github.com/MylesMCook/burf/internal/trust"
)

// A fake berthd for Use this Mac: it logs each run, and install writes the
// service unit from a template (as `berthd install` would, minus launchd),
// records where it listens and marks itself serving. Nothing here touches
// launchd or systemd.
const fakeBerthdScript = `#!/bin/sh
VERSION=%VERSION%
echo "$BERTH_HOME|$*" >> "$FAKE_BERTHD_LOG"
case "$1" in
  version) echo "berthd $VERSION (build x, test)" ;;
  id) echo "$FAKE_FP" ;;
  install)
    if [ -n "$FAKE_NO_SESSION" ]; then
      echo "berthd: launchd has no login session for you on this Mac (Could not find domain), so berthd cannot run as your launch agent." >&2
      exit 1
    fi
    if [ "$2" = "--listen" ]; then listen="$3"; else listen="$(cat "$BERTH_HOME/box/listen")"; fi
    mkdir -p "$BERTH_HOME/box" "$(dirname "$FAKE_UNIT")"
    sed -e "s|__LISTEN__|$listen|" -e "s|__PROGRAM__|$0|" -e "s|__HOME__|$BERTH_HOME|" "$FAKE_UNIT_TEMPLATE" > "$FAKE_UNIT"
    printf '%s' "$listen" > "$BERTH_HOME/box/listen"
    touch "$BERTH_HOME/box/serving"
    echo "Installed $FAKE_UNIT; berthd is serving on $listen."
    echo "Next: berthd pair"
    ;;
  pair) printf '{"link":"berth://%s?code=c0de&fp=%s","address":"%s"}\n' "$6" "$FAKE_FP" "$6" ;;
  uninstall) rm -f "$FAKE_UNIT" "$BERTH_HOME/box/serving"; echo "Removed $FAKE_UNIT" ;;
esac
`

// A fake berth CLI: pair prints the peer it would save; forget forgets.
const fakeBerthForLocal = `#!/bin/sh
echo "$BERTH_HOME|$*" >> "$FAKE_BERTH_LOG"
case "$1" in
  pair) name=from-box; [ "$4" = "--name" ] && name="$5"; printf '{"name":"%s","address":"127.0.0.1:1"}\n' "$name" ;;
  forget) echo "Forgot $2" ;;
esac
`

type localEnv struct {
	t       *testing.T
	root    string // BERTH_HOME
	dir     string // the agent's state, root/client
	home    string // HOME
	unit    string
	fp      identity.Fingerprint
	berthd  string // the log of berthd runs
	berth   string // the log of berth runs
	stable  string
	bundled string
}

// newLocalEnv is a temporary HOME and BERTH_HOME, a fake berthd beside the
// agent's berth, and serving read from the fake's marker file.
func newLocalEnv(t *testing.T) *localEnv {
	t.Helper()
	root, err := os.MkdirTemp("/tmp", "lb")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(root) })
	e := &localEnv{t: t, root: root, dir: filepath.Join(root, "client"), home: filepath.Join(root, "home")}
	for _, d := range []string{e.dir, e.home} {
		if err := os.MkdirAll(d, 0o700); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("HOME", e.home)
	t.Setenv("XDG_CONFIG_HOME", "")
	e.unit, err = service.UnitPath(service.Spec{Name: service.BerthdName()})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(e.unit, e.home) {
		t.Fatalf("unit path %s is outside the test HOME", e.unit)
	}
	// The unit berthd install would write, with the values it is given.
	tmpl, err := service.Render(service.Spec{Name: service.BerthdName(), Program: "__PROGRAM__", Args: []string{"serve", "--listen", "__LISTEN__"}, Env: map[string]string{"BERTH_HOME": "__HOME__"}})
	if err != nil {
		t.Fatal(err)
	}
	writeFile(t, filepath.Join(root, "unit.tmpl"), string(tmpl), 0o644)
	e.fp = identity.Fingerprint{1, 2, 3, 4}
	e.berthd, e.berth = filepath.Join(root, "berthd.log"), filepath.Join(root, "berth.log")
	t.Setenv("FAKE_BERTHD_LOG", e.berthd)
	t.Setenv("FAKE_BERTH_LOG", e.berth)
	t.Setenv("FAKE_FP", e.fp.String())
	t.Setenv("FAKE_UNIT", e.unit)
	t.Setenv("FAKE_UNIT_TEMPLATE", filepath.Join(root, "unit.tmpl"))
	e.stable = filepath.Join(root, "bin", "berthd")
	e.bundled = filepath.Join(e.dir, "berthd")
	writeFile(t, e.bundled, fakeBerthd("dev-new"), 0o755)
	writeFile(t, filepath.Join(e.dir, "fake-berth"), fakeBerthForLocal, 0o755)
	old := serving
	serving = func(home string) bool { return isFile(filepath.Join(home, "box", "serving")) }
	t.Cleanup(func() { serving = old })
	return e
}

func fakeBerthd(v string) string { return strings.Replace(fakeBerthdScript, "%VERSION%", v, 1) }

func (e *localEnv) log(path string) string {
	b, _ := os.ReadFile(path)
	return string(b)
}

// installUnit writes a unit as berthd install would have.
func (e *localEnv) installUnit(program, listen, home string) {
	e.t.Helper()
	b, err := service.Render(service.Spec{Name: service.BerthdName(), Program: program, Args: []string{"serve", "--listen", listen}, Env: map[string]string{"BERTH_HOME": home}})
	if err != nil {
		e.t.Fatal(err)
	}
	writeFile(e.t, e.unit, string(b), 0o644)
	writeFile(e.t, filepath.Join(home, "box", "listen"), listen, 0o600)
}

func streamed(t *testing.T, body string) (lines []string, last StreamLine) {
	t.Helper()
	for _, l := range strings.Split(strings.TrimSpace(body), "\n") {
		var sl StreamLine
		if err := json.Unmarshal([]byte(l), &sl); err != nil {
			t.Fatalf("not a stream line: %q", l)
		}
		if sl.Done {
			last = sl
			continue
		}
		lines = append(lines, sl.Line)
	}
	if !last.Done {
		t.Fatalf("the stream did not finish:\n%s", body)
	}
	return lines, last
}

func TestUseThisMacSetsUpPairsReconnectsAndUninstalls(t *testing.T) {
	e := newLocalEnv(t)
	a := startAgent(t, e.dir)
	tok := uiToken(t, a)

	resp, body := uiSend(t, a, "GET", "/v1/boxes/local", tok, "")
	var st LocalBoxStatus
	json.Unmarshal([]byte(body), &st)
	if resp.StatusCode != 200 || !st.Available || st.Installed || st.Name != localName() {
		t.Fatalf("before: %d %s", resp.StatusCode, body)
	}

	_, body = uiSend(t, a, "POST", "/v1/boxes/local", tok, "")
	lines, last := streamed(t, body)
	if last.Error != "" || last.Box != localName() {
		t.Fatalf("set up: %s", body)
	}
	all := strings.Join(lines, "\n")
	for _, want := range []string{"Copying berthd to " + e.stable, "Installing the berthd service, listening on 127.0.0.1:", "  Installed " + e.unit, "Pairing this laptop with it…", "Paired as " + localName() + "."} {
		if !strings.Contains(all, want) {
			t.Errorf("set up did not say %q:\n%s", want, all)
		}
	}
	if strings.Contains(all, "Next: berthd pair") {
		t.Error("the set up passed on berthd's advice to pair by hand")
	}
	// The service runs Burf's own copy, on loopback, in BERTH_HOME.
	unit, ok, err := service.Read(service.BerthdName())
	if err != nil || !ok || unit.Program != e.stable || unit.Env["BERTH_HOME"] != e.root || !loopback(unit.Arg("--listen")) {
		t.Fatalf("installed unit = %+v, %v, %v", unit, ok, err)
	}
	if same, _ := sameBuild(e.bundled, e.stable); !same {
		t.Fatal("the copy is not the bundled berthd")
	}
	listen := unit.Arg("--listen")
	berthdRuns := e.log(e.berthd)
	for _, want := range []string{
		e.root + "|install --listen " + listen + " --no-tools",
		e.root + "|id",
		e.root + "|pair --json --ttl 2m --address " + listen,
	} {
		if !strings.Contains(berthdRuns, want+"\n") {
			t.Errorf("berthd did not run %q:\n%s", want, berthdRuns)
		}
	}
	if want := e.root + "|pair berth://" + listen + "?code=c0de&fp=" + e.fp.String() + " --json --name " + localName(); !strings.Contains(e.log(e.berth), want) {
		t.Errorf("burf pair was not run with the link berthd printed:\n%s", e.log(e.berth))
	}

	// What burf pair saved; the box is this Mac's.
	if err := trust.NewStore(filepath.Join(e.dir, "boxes.json")).Add(trust.Peer{Name: localName(), Address: listen, Fingerprint: e.fp, PairedAt: time.Now()}); err != nil {
		t.Fatal(err)
	}
	eventually(t, "the box marked local", func() bool {
		s, err := a.client.Status(context.Background())
		return err == nil && len(s.Boxes) == 1 && s.Boxes[0].Local
	})

	// Again: nothing is installed twice; it only reconnects.
	_, body = uiSend(t, a, "POST", "/v1/boxes/local", tok, "")
	lines, last = streamed(t, body)
	all = strings.Join(lines, "\n")
	if last.Error != "" || last.Box != localName() || !strings.Contains(all, "berthd is installed and running.") || !strings.Contains(all, "Already paired as "+localName()+"; reconnecting.") {
		t.Fatalf("set up again: %s", body)
	}
	if n := strings.Count(e.log(e.berthd), "|install "); n != 1 {
		t.Fatalf("berthd install ran %d times", n)
	}
	_, body = uiSend(t, a, "GET", "/v1/boxes/local", tok, "")
	st = LocalBoxStatus{}
	json.Unmarshal([]byte(body), &st)
	if !st.Installed || !st.Owned || !st.Running || st.Box != localName() || st.Listen != listen {
		t.Fatalf("after: %s", body)
	}

	// Removing it keeps or deletes its data, as asked.
	_, body = uiSend(t, a, "POST", "/v1/boxes/local/uninstall", tok, `{"remove_data":true}`)
	lines, last = streamed(t, body)
	if last.Error != "" {
		t.Fatalf("uninstall: %s", body)
	}
	if !strings.Contains(e.log(e.berth), "|forget "+localName()) || !strings.Contains(e.log(e.berthd), e.root+"|uninstall") {
		t.Fatalf("uninstall ran:\n%s\n%s", e.log(e.berth), e.log(e.berthd))
	}
	for _, gone := range []string{e.unit, e.stable, filepath.Join(e.root, "box"), filepath.Join(e.dir, "localbox.json")} {
		if _, err := os.Stat(gone); !os.IsNotExist(err) {
			t.Errorf("%s is still there after removing with its data", gone)
		}
	}
	if resp, _ := uiSend(t, a, "POST", "/v1/boxes/local/uninstall", tok, ""); resp.StatusCode != 200 {
		t.Fatal(resp.Status)
	}
}

func TestUseThisMacReusesABerthdTheInstallScriptInstalled(t *testing.T) {
	e := newLocalEnv(t)
	cliHome := filepath.Join(e.root, "cli-home")
	cliBerthd := filepath.Join(e.home, ".local", "bin", "berthd")
	writeFile(t, cliBerthd, fakeBerthd("v0.1.0"), 0o755)
	e.installUnit(cliBerthd, "100.101.102.103:7444", cliHome)
	writeFile(t, filepath.Join(cliHome, "box", "serving"), "", 0o600)
	// The app carries an older release: the install is used as it is.
	writeFile(t, e.bundled, fakeBerthd("v0.0.9"), 0o755)
	a := startAgent(t, e.dir)
	tok := uiToken(t, a)

	_, body := uiSend(t, a, "POST", "/v1/boxes/local", tok, "")
	lines, last := streamed(t, body)
	all := strings.Join(lines, "\n")
	if last.Error != "" || !strings.Contains(all, "berthd is already installed on this computer ("+cliBerthd+")") || !strings.Contains(all, "berthd is installed and running.") {
		t.Fatalf("set up: %s", body)
	}
	if strings.Contains(e.log(e.berthd), "|install") || isFile(e.stable) {
		t.Fatalf("installed a second berthd:\n%s", e.log(e.berthd))
	}
	if !strings.Contains(e.log(e.berthd), cliHome+"|pair --json --ttl 2m --address 100.101.102.103:7444") {
		t.Fatalf("did not pair with the installed berthd, in its home:\n%s", e.log(e.berthd))
	}

	// A newer release remains pending; reconnecting never installs over
	// the running daemon or bypasses its own chat upgrade guard.
	writeFile(t, e.bundled, fakeBerthd("v0.2.0"), 0o755)
	_, body = uiSend(t, a, "POST", "/v1/boxes/local", tok, "")
	lines, last = streamed(t, body)
	all = strings.Join(lines, "\n")
	if last.Error != "" || !strings.Contains(all, "use Install bundled") {
		t.Fatalf("pending update: %s", body)
	}
	if strings.Contains(e.log(e.berthd), "|install ") || isFile(e.stable) {
		t.Fatalf("reconnect changed the service:\n%s", e.log(e.berthd))
	}
	if b, _ := os.ReadFile(cliBerthd); string(b) != fakeBerthd("v0.1.0") {
		t.Fatal("reconnect replaced the install script's berthd")
	}
	// Removing it stops that service but never deletes the person's berthd.
	_, body = uiSend(t, a, "POST", "/v1/boxes/local/uninstall", tok, `{"remove_data":false}`)
	if _, last := streamed(t, body); last.Error != "" || !isFile(cliBerthd) || !isFile(filepath.Join(cliHome, "box", "listen")) {
		t.Fatalf("uninstall: %s", body)
	}
}

func TestUseThisMacReconnectKeepsTheOwnedDaemonAndReportsTheUpdate(t *testing.T) {
	e := newLocalEnv(t)
	installed := fakeBerthd("v0.1.0")
	writeFile(t, e.stable, installed, 0o755)
	writeFile(t, e.bundled, fakeBerthd("v0.2.0"), 0o755)
	e.installUnit(e.stable, "127.0.0.1:7445", e.root)
	writeFile(t, filepath.Join(e.root, "box", "serving"), "", 0o600)
	beforeUnit, err := os.ReadFile(e.unit)
	if err != nil {
		t.Fatal(err)
	}
	a := startAgent(t, e.dir)
	_, body := uiSend(t, a, "POST", "/v1/boxes/local", uiToken(t, a), "")
	lines, last := streamed(t, body)
	if last.Error != "" || last.Box != localName() || !strings.Contains(strings.Join(lines, "\n"), "use Install bundled") {
		t.Fatalf("reconnect did not report the pending update: %s", body)
	}
	if b, err := os.ReadFile(e.stable); err != nil || string(b) != installed {
		t.Fatalf("reconnect replaced the owned daemon: %v", err)
	}
	if unit, err := os.ReadFile(e.unit); err != nil || string(unit) != string(beforeUnit) {
		t.Fatalf("reconnect changed the service definition: %v", err)
	}
	if strings.Contains(e.log(e.berthd), "|install ") {
		t.Fatalf("reconnect restarted the owned daemon: %s", e.log(e.berthd))
	}
}

func TestFirstLocalBoxSetupChoosesAFreePort(t *testing.T) {
	e := newLocalEnv(t)
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	taken := ln.Addr().String()
	a := startAgentConfig(t, e.dir, nil, func(cfg *Config) { cfg.LocalBoxPort = ln.Addr().(*net.TCPAddr).Port })
	_, body := uiSend(t, a, "POST", "/v1/boxes/local", uiToken(t, a), "")
	_, last := streamed(t, body)
	unit, have, err := service.Read(service.BerthdName())
	if last.Error != "" || err != nil || !have || unit.Arg("--listen") == taken || !loopback(unit.Arg("--listen")) {
		t.Fatalf("first setup did not choose a free loopback port: %s\n%+v, %v", body, unit, err)
	}
}

func TestUseThisMacDoesNotReplaceAMissingInstalledProgram(t *testing.T) {
	e := newLocalEnv(t)
	e.installUnit(e.stable, "127.0.0.1:7445", e.root)
	a := startAgent(t, e.dir)
	_, body := uiSend(t, a, "POST", "/v1/boxes/local", uiToken(t, a), "")
	_, last := streamed(t, body)
	if !strings.Contains(last.Error, "is missing") || !strings.Contains(last.Error, "service was left unchanged") {
		t.Fatalf("missing installed program was not reported safely: %s", body)
	}
	if isFile(e.stable) || strings.Contains(e.log(e.berthd), "|install ") {
		t.Fatal("reconnect replaced a missing installed program or restarted its service")
	}
}

func TestUseThisMacDoesNotTreatAnUnreadableServiceAsFirstSetup(t *testing.T) {
	e := newLocalEnv(t)
	if err := os.MkdirAll(e.unit, 0o755); err != nil {
		t.Fatal(err)
	}
	a := startAgent(t, e.dir)
	_, body := uiSend(t, a, "POST", "/v1/boxes/local", uiToken(t, a), "")
	_, last := streamed(t, body)
	if !strings.Contains(last.Error, "cannot be read") || !strings.Contains(last.Error, "left unchanged") {
		t.Fatalf("unreadable installed service was not reported safely: %s", body)
	}
	if isFile(e.stable) || strings.Contains(e.log(e.berthd), "|install ") {
		t.Fatal("reconnect copied a daemon or restarted an unreadable existing service")
	}
}

func TestFirstLocalBoxSetupDoesNotInstallOverAnUnmanagedRunningDaemon(t *testing.T) {
	e := newLocalEnv(t)
	writeFile(t, filepath.Join(e.root, "box", "serving"), "", 0o600)
	a := startAgent(t, e.dir)
	_, body := uiSend(t, a, "POST", "/v1/boxes/local", uiToken(t, a), "")
	_, last := streamed(t, body)
	if !strings.Contains(last.Error, "already running without an installed service") || !strings.Contains(last.Error, "stop it explicitly") {
		t.Fatalf("unmanaged running daemon was not preserved: %s", body)
	}
	if isFile(e.stable) || isFile(e.unit) || strings.Contains(e.log(e.berthd), "|install ") {
		t.Fatal("first setup replaced an unmanaged running daemon")
	}
}

func TestUseThisMacLeavesAnUnreachableServiceForExplicitRepair(t *testing.T) {
	e := newLocalEnv(t)
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	taken := ln.Addr().String()
	// Set up before, but not running now, and its port is someone else's.
	writeFile(t, e.stable, fakeBerthd("dev-new"), 0o755)
	e.installUnit(e.stable, taken, e.root)
	a := startAgent(t, e.dir)
	tok := uiToken(t, a)
	_, body := uiSend(t, a, "POST", "/v1/boxes/local", tok, "")
	_, last := streamed(t, body)
	unit, _, _ := service.Read(service.BerthdName())
	if !strings.Contains(last.Error, "installed but not reachable") || !strings.Contains(last.Error, "install --keep-listen --no-tools") || unit.Arg("--listen") != taken {
		t.Fatalf("repair guidance: %s\nlistens on %s", body, unit.Arg("--listen"))
	}
	if strings.Contains(e.log(e.berthd), "|install ") || strings.Contains(e.log(e.berth), "|pair ") {
		t.Fatalf("reconnect silently installed or paired with an unreachable service: %s\n%s", e.log(e.berthd), e.log(e.berth))
	}
	if b, _ := os.ReadFile(e.stable); string(b) != fakeBerthd("dev-new") {
		t.Fatal("reconnect replaced the unreachable service's program")
	}
}

func TestUseThisMacSaysWhyLaunchdRefused(t *testing.T) {
	e := newLocalEnv(t)
	t.Setenv("FAKE_NO_SESSION", "1")
	a := startAgent(t, e.dir)
	tok := uiToken(t, a)
	_, body := uiSend(t, a, "POST", "/v1/boxes/local", tok, "")
	_, last := streamed(t, body)
	if !strings.HasPrefix(last.Error, "launchd has no login session for you on this Mac") {
		t.Fatalf("set up: %s", body)
	}
	if strings.Contains(e.log(e.berth), "pair") {
		t.Fatal("paired with a berthd that did not start")
	}
}

func TestUseThisMacWithoutABundledBerthd(t *testing.T) {
	e := newLocalEnv(t)
	os.Remove(e.bundled)
	a := startAgent(t, e.dir)
	tok := uiToken(t, a)
	_, body := uiSend(t, a, "GET", "/v1/boxes/local", tok, "")
	var st LocalBoxStatus
	json.Unmarshal([]byte(body), &st)
	if st.Available || st.Reason == "" {
		t.Fatalf("status: %s", body)
	}
	_, body = uiSend(t, a, "POST", "/v1/boxes/local", tok, "")
	if _, last := streamed(t, body); last.Error != errNoBerthd.Error() {
		t.Fatalf("set up: %s", body)
	}
}

// Copies outside an existing service still obey source chronology and
// release ordering. Existing services never enter this copy path.
func TestOwnedDaemonCopyPreservesDevelopmentAndReleaseOrdering(t *testing.T) {
	e := newLocalEnv(t)
	nextBuild := localTestBuildInfo("new", "2026-10-10T10:00:00Z", "false")
	haveBuild := localTestBuildInfo("old", "2026-10-09T10:00:00Z", "false")
	oldBuildInfo := localBuildInfo
	localBuildInfo = func(path string) (*debug.BuildInfo, error) {
		if path == e.bundled {
			return nextBuild, nil
		}
		return haveBuild, nil
	}
	t.Cleanup(func() { localBuildInfo = oldBuildInfo })
	writeFile(t, e.stable, fakeBerthd("dev-old"), 0o755)
	a := &Agent{}
	say := func(string, ...any) {}
	updated, err := a.updateLocalBerthd(context.Background(), e.bundled, e.stable, e.root, true, say)
	if err != nil || !updated {
		t.Fatalf("newer development copy: updated=%v, err=%v", updated, err)
	}
	if same, _ := sameBuild(e.bundled, e.stable); !same {
		t.Fatal("newer development copy did not match the bundle")
	}
	before := e.log(e.berthd)
	updated, err = a.updateLocalBerthd(context.Background(), e.bundled, e.stable, e.root, true, say)
	if err != nil || updated || e.log(e.berthd) != before {
		t.Fatalf("identical build copied again: updated=%v, err=%v", updated, err)
	}
	// A direct development rollout is newer than the stale bundled copy.
	// The next app check keeps it, even though the bundle's mtime changed.
	haveBuild = localTestBuildInfo("newer", "2026-10-11T10:00:00Z", "false")
	installed := fakeBerthd("dev-newer")
	writeFile(t, e.stable, installed, 0o755)
	os.Chtimes(e.bundled, time.Now(), time.Now().Add(time.Minute))
	updated, err = a.updateLocalBerthd(context.Background(), e.bundled, e.stable, e.root, true, say)
	if err != nil || updated {
		t.Fatalf("stale development copy: updated=%v, err=%v", updated, err)
	}
	if b, err := os.ReadFile(e.stable); err != nil || string(b) != installed {
		t.Fatalf("downgraded a newer development daemon: %v", err)
	}
	// The box was upgraded past what the app now carries.
	writeFile(t, e.stable, fakeBerthd("v0.3.0"), 0o755)
	writeFile(t, e.bundled, fakeBerthd("v0.2.0"), 0o755)
	os.Chtimes(e.bundled, time.Now(), time.Now().Add(time.Minute))
	updated, err = a.updateLocalBerthd(context.Background(), e.bundled, e.stable, e.root, true, say)
	if err != nil || updated {
		t.Fatalf("stale release copy: updated=%v, err=%v", updated, err)
	}
	if b, _ := os.ReadFile(e.stable); !strings.Contains(string(b), "VERSION=v0.3.0") {
		t.Fatal("downgraded the box")
	}
}

func TestAStaleDevelopmentBundleDoesNotReplaceTheOwnedDaemon(t *testing.T) {
	e := newLocalEnv(t)
	writeFile(t, e.bundled, fakeBerthd("dev")+"\n# stale bundled build\n", 0o755)
	installed := fakeBerthd("dev") + "\n# newer installed build\n"
	writeFile(t, e.stable, installed, 0o755)
	// Copying an old binary into a new app can give it a newer file time.
	// Without source chronology, that is not permission to replace it.
	if err := os.Chtimes(e.bundled, time.Now(), time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	a := &Agent{}
	updated, err := a.updateLocalBerthd(context.Background(), e.bundled, e.stable, e.root, true, func(string, ...any) {})
	if err != nil || updated {
		t.Fatalf("stale development bundle updated the daemon: updated=%v, err=%v", updated, err)
	}
	if b, err := os.ReadFile(e.stable); err != nil || string(b) != installed {
		t.Fatalf("installed daemon was replaced: %v", err)
	}
}

func TestAutomaticRefreshLeavesExistingDaemonBytesAndServiceAlone(t *testing.T) {
	e := newLocalEnv(t)
	installed := fakeBerthd("v0.1.0")
	writeFile(t, e.stable, installed, 0o755)
	writeFile(t, e.bundled, fakeBerthd("v0.2.0"), 0o755)
	e.installUnit(e.stable, "127.0.0.1:7445", e.root)
	// A missing service PATH also must not authorize a silent restart.
	a := &Agent{cfg: Config{Dir: e.dir, CLI: filepath.Join(e.dir, "fake-berth"), Log: log.New(io.Discard, "", 0)}, boxes: trust.NewStore(filepath.Join(e.dir, "boxes.json"))}
	if err := a.saveLocalRecord(&localBoxRecord{Fingerprint: e.fp.String(), Program: e.stable, Home: e.root, Owned: true}); err != nil {
		t.Fatal(err)
	}
	a.refreshLocalBox(context.Background())
	if b, err := os.ReadFile(e.stable); err != nil || string(b) != installed {
		t.Fatalf("automatic refresh replaced an existing daemon: %v", err)
	}
	if strings.Contains(e.log(e.berthd), "|install ") {
		t.Fatalf("automatic refresh reinstalled an existing service: %s", e.log(e.berthd))
	}
}

// Legacy PATH repair is reported without restarting a daemon whose chats
// live in another process and cannot be guarded by this client.
func TestAPlistWithoutAPATHIsReportedWithoutRestartingTheService(t *testing.T) {
	e := newLocalEnv(t)
	old := localGOOS
	t.Cleanup(func() { localGOOS = old })
	localGOOS = "darwin"
	copyFile(t, e.bundled, e.stable)
	e.installUnit(e.stable, "127.0.0.1:7445", e.root)
	var reports strings.Builder
	a := &Agent{cfg: Config{Dir: e.dir, CLI: filepath.Join(e.dir, "fake-berth"), Log: log.New(&reports, "", 0)}, boxes: trust.NewStore(filepath.Join(e.dir, "boxes.json"))}
	if err := a.saveLocalRecord(&localBoxRecord{Fingerprint: e.fp.String(), Program: e.stable, Home: e.root, Owned: true}); err != nil {
		t.Fatal(err)
	}
	a.refreshLocalBox(context.Background())
	if strings.Contains(e.log(e.berthd), "|install ") || !strings.Contains(reports.String(), localBoxRepairCommand(e.stable)) {
		t.Fatalf("repair was not safely reported: %s\n%s", reports.String(), e.log(e.berthd))
	}
	before := reports.String()
	a.refreshLocalBox(context.Background())
	if reports.String() != before {
		t.Fatalf("reported the same unchanged bundle again: %s", reports.String())
	}
}

func copyFile(t *testing.T, src, dst string) {
	t.Helper()
	b, err := os.ReadFile(src)
	if err != nil {
		t.Fatal(err)
	}
	writeFile(t, dst, string(b), 0o755)
}

func TestTheCopyKeepsItsSignatureAndLosesAQuarantine(t *testing.T) {
	oldOS, oldTool := localGOOS, localTool
	t.Cleanup(func() { localGOOS, localTool = oldOS, oldTool })
	localGOOS = "darwin"
	dir := t.TempDir()
	src, dst := filepath.Join(dir, "src"), filepath.Join(dir, "dst")
	writeFile(t, src, "signed", 0o755)
	writeFile(t, dst, "signed", 0o755)
	var mu sync.Mutex
	var calls []string
	verifies, quarantined := true, true
	localTool = func(_ context.Context, name string, args ...string) ([]byte, error) {
		mu.Lock()
		defer mu.Unlock()
		call := name + " " + strings.Join(args, " ")
		calls = append(calls, call)
		switch {
		case strings.HasPrefix(call, "/usr/bin/codesign --verify --strict "+dst) && !verifies:
			return []byte(dst + ": invalid signature (code or signature have been modified)"), errors.New("exit status 1")
		case strings.HasPrefix(call, "/usr/bin/xattr -p") && !quarantined:
			return []byte("No such xattr"), errors.New("exit status 1")
		}
		return nil, nil
	}
	var said []string
	say := func(f string, args ...any) { said = append(said, f) }
	if err := checkCopy(context.Background(), src, dst, say); err != nil {
		t.Fatal(err)
	}
	if want := "/usr/bin/xattr -d com.apple.quarantine " + dst; calls[len(calls)-1] != want || len(said) != 1 {
		t.Fatalf("calls %q, said %q", calls, said)
	}
	calls, quarantined = nil, false
	if err := checkCopy(context.Background(), src, dst, say); err != nil || len(calls) != 3 {
		t.Fatalf("an unquarantined copy: %v, %q", err, calls)
	}
	verifies = false
	if err := checkCopy(context.Background(), src, dst, say); err == nil || !strings.Contains(err.Error(), "fails its code signature check") || isFile(dst) {
		t.Fatalf("a copy that fails its signature check: %v", err)
	}
}

// Inside Burf.app the agent takes only the app's own berthd, and only when
// the app's team signed it (security audit M-4).
func TestTheBundledBerthdIsTheAppsOwnAndSignedByItsTeam(t *testing.T) {
	dir := t.TempDir()
	macos := filepath.Join(dir, "Burf.app", "Contents", "MacOS")
	cli := filepath.Join(macos, "berth-cli")
	writeFile(t, cli, "cli", 0o755)
	writeFile(t, filepath.Join(macos, "berthd"), "planted", 0o755)
	a := &Agent{cfg: Config{CLI: cli}}
	if _, err := a.bundledBerthd(); err == nil {
		t.Fatal("took a berthd beside berth-cli instead of the app's Resources")
	}
	resource := filepath.Join(dir, "Burf.app", "Contents", "Resources", "berthd")
	writeFile(t, resource, "bundled", 0o755)
	resource, _ = filepath.EvalSymlinks(resource) // /var is /private/var on a Mac
	if got, err := a.bundledBerthd(); err != nil || got != resource {
		t.Fatalf("bundledBerthd = %q, %v", got, err)
	}

	oldOS, oldTool := localGOOS, localTool
	t.Cleanup(func() { localGOOS, localTool = oldOS, oldTool })
	localGOOS = "darwin"
	team, signedByTeam := "TeamIdentifier=ABCDE12345", true
	var verified string
	localTool = func(_ context.Context, name string, args ...string) ([]byte, error) {
		if args[0] == "-dv" {
			return []byte("Executable=" + cli + "\n" + team + "\n"), nil
		}
		verified = strings.Join(args, " ")
		if !signedByTeam {
			return []byte("test-requirement: code failed to satisfy specified code requirement(s)"), errors.New("exit status 3")
		}
		return nil, nil
	}
	if err := a.checkBundled(context.Background(), resource); err != nil || !strings.Contains(verified, `certificate leaf[subject.OU] = "ABCDE12345"`) {
		t.Fatalf("a berthd signed by the team: %v (verified %q)", err, verified)
	}
	signedByTeam = false
	if err := a.checkBundled(context.Background(), resource); err == nil || !strings.Contains(err.Error(), "not signed by Burf's team") {
		t.Fatalf("a berthd from someone else: %v", err)
	}
	// An unsigned build has no team to hold berthd to.
	team, verified = "TeamIdentifier=not set", ""
	if err := a.checkBundled(context.Background(), resource); err != nil || verified != "" {
		t.Fatalf("an unsigned build: %v, %q", err, verified)
	}
}
