package service

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func stub(t *testing.T, os_ string) (home string, calls *[]string) {
	t.Helper()
	home = t.TempDir()
	oldOS, oldHome, oldCmd := goos, homeDir, command
	calls = &[]string{}
	goos = os_
	homeDir = func() (string, error) { return home, nil }
	command = func(name string, args ...string) ([]byte, error) {
		*calls = append(*calls, name+" "+strings.Join(args, " "))
		return nil, nil
	}
	t.Setenv("XDG_CONFIG_HOME", "")
	t.Cleanup(func() { goos, homeDir, command = oldOS, oldHome, oldCmd })
	return home, calls
}

var spec = Spec{
	Name:        "berth-agent",
	Description: "berth agent",
	Program:     "/opt/berth/bin/berth",
	Args:        []string{"agent"},
	Env:         map[string]string{"BERTH_HOME": "/Users/alex/Library/Application Support/berth"},
	LogPath:     "/Users/alex/Library/Logs/berth.log",
}

func TestUnitsRestartOnlyAfterFailure(t *testing.T) {
	stub(t, "darwin")
	plist, err := Render(spec)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"<key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>",
		"<key>RunAtLoad</key><true/>",
		"<string>/opt/berth/bin/berth</string>\n<string>agent</string>",
		"<key>BERTH_HOME</key><string>/Users/alex/Library/Application Support/berth</string>",
	} {
		if !strings.Contains(string(plist), want) {
			t.Errorf("plist missing %q:\n%s", want, plist)
		}
	}
	stub(t, "linux")
	unit, err := Render(spec)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"Restart=on-failure",
		"ExecStart=/opt/berth/bin/berth agent",
		`Environment="BERTH_HOME=/Users/alex/Library/Application Support/berth"`,
		"WantedBy=default.target",
	} {
		if !strings.Contains(string(unit), want) {
			t.Errorf("unit missing %q:\n%s", want, unit)
		}
	}
	if strings.Contains(string(unit), "Restart=always") {
		t.Error("a clean stop would be restarted")
	}
}

func TestRenderEscapesValues(t *testing.T) {
	stub(t, "darwin")
	s := spec
	s.Env = map[string]string{"X": `a<b>&"c"`}
	plist, _ := Render(s)
	if strings.Contains(string(plist), "a<b>") {
		t.Fatalf("plist value not escaped:\n%s", plist)
	}
	stub(t, "linux")
	s.Args = []string{"serve", "--listen", "$HOME 100%"}
	unit, _ := Render(s)
	if !strings.Contains(string(unit), `"$$HOME 100%%"`) {
		t.Fatalf("systemd argument not quoted:\n%s", unit)
	}
}

func TestUnsupportedPlatform(t *testing.T) {
	stub(t, "freebsd")
	if _, err := Render(spec); err == nil {
		t.Fatal("rendered a unit for freebsd")
	}
	if Installed(spec) {
		t.Fatal("reported installed on freebsd")
	}
}

func TestKeepChildrenSurvivesServiceRestarts(t *testing.T) {
	s := spec
	stub(t, "linux")
	plain, _ := Render(s)
	if strings.Contains(string(plain), "KillMode") {
		t.Fatal("KillMode set without KeepChildren")
	}
	s.KeepChildren = true
	unit, _ := Render(s)
	if !strings.Contains(string(unit), "KillMode=process\n") {
		t.Fatalf("unit does not keep children:\n%s", unit)
	}
	stub(t, "darwin")
	plist, _ := Render(s)
	if !strings.Contains(string(plist), "<key>AbandonProcessGroup</key><true/>") {
		t.Fatalf("plist does not keep children:\n%s", plist)
	}
}

func TestLinuxUnitsWriteOutputToTheLogPath(t *testing.T) {
	stub(t, "linux")
	unit, err := Render(Spec{
		Name:        "berth-orca",
		Description: "Orca runtime",
		Program:     "/usr/bin/orca",
		Args:        []string{"serve"},
		LogPath:     "/home/alex/.config/berth/units/berth-orca.log",
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"StandardOutput=append:/home/alex/.config/berth/units/berth-orca.log",
		"StandardError=append:/home/alex/.config/berth/units/berth-orca.log",
	} {
		if !strings.Contains(string(unit), want) {
			t.Fatalf("unit is missing %q:\n%s", want, unit)
		}
	}
}

func TestLinuxUnitsWithoutALogPathRedirectNothing(t *testing.T) {
	stub(t, "linux")
	unit, err := Render(Spec{Name: "berth-agent", Program: "/usr/bin/berth", Args: []string{"agent"}})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(unit), "StandardOutput=") {
		t.Fatalf("unit redirects output with no LogPath set:\n%s", unit)
	}
}

// berthd exits only when something is wrong, so on-failure is right for it:
// restarting forever would hide a bad configuration. A managed unit is the
// opposite - it exists to stay up, and the programs it runs can shut down
// cleanly on their own. An Orca runtime did exactly that, exited 0, and
// systemd left it dead because the policy said the job had succeeded.
func TestUnitsThatMustStayUpRestartOnACleanExitToo(t *testing.T) {
	stub(t, "linux")
	always, err := Render(Spec{Name: "orca-runtime", Program: "/usr/bin/orca", RestartAlways: true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(always), "Restart=always") {
		t.Fatalf("a stay-up unit must restart on a clean exit:\n%s", always)
	}

	onFailure, err := Render(Spec{Name: "berth-agent", Program: "/usr/bin/berth"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(onFailure), "Restart=on-failure") || strings.Contains(string(onFailure), "Restart=always") {
		t.Fatalf("the daemon's own policy must not change:\n%s", onFailure)
	}
}

func TestRunningAsksThePlatformWhetherTheServiceIsUp(t *testing.T) {
	_, calls := stub(t, "linux")
	Running(Spec{Name: "orca-runtime"})
	if len(*calls) != 1 || (*calls)[0] != "systemctl --user is-active orca-runtime.service" {
		t.Fatalf("calls = %v; want systemctl is-active", *calls)
	}

	_, macCalls := stub(t, "darwin")
	Running(Spec{Name: "orca-runtime"})
	if len(*macCalls) != 1 || !strings.HasPrefix((*macCalls)[0], "launchctl print gui/") {
		t.Fatalf("calls = %v; want launchctl print", *macCalls)
	}
}

func TestPreflightExplainsAMissingUserSession(t *testing.T) {
	stub(t, "linux")
	oldLook, oldRun := lookPath, runUserDir
	t.Cleanup(func() { lookPath, runUserDir = oldLook, oldRun })

	lookPath = func(string) (string, error) { return "", os.ErrNotExist }
	if err := Preflight(); err == nil || !strings.Contains(err.Error(), "no systemd") {
		t.Errorf("without systemctl: %v", err)
	}

	lookPath = func(string) (string, error) { return "/usr/bin/systemctl", nil }
	command = func(name string, args ...string) ([]byte, error) {
		return []byte("Failed to connect to bus: No medium found\n"), os.ErrNotExist
	}
	err := Preflight()
	if err == nil || !strings.Contains(err.Error(), "no user session") || !strings.Contains(err.Error(), "No medium found") {
		t.Errorf("without a user session: %v", err)
	}

	command = func(name string, args ...string) ([]byte, error) { return nil, nil }
	if err := Preflight(); err != nil {
		t.Errorf("with a user session: %v", err)
	}
}

func TestPreflightFindsTheUserManagerAfterSu(t *testing.T) {
	stub(t, "linux")
	oldLook, oldRun := lookPath, runUserDir
	t.Cleanup(func() { lookPath, runUserDir = oldLook, oldRun })
	lookPath = func(string) (string, error) { return "/usr/bin/systemctl", nil }
	runUserDir = t.TempDir()
	dir := filepath.Join(runUserDir, strconv.Itoa(os.Getuid()))
	if err := os.MkdirAll(filepath.Join(dir, "systemd"), 0o700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("XDG_RUNTIME_DIR", "")
	if err := Preflight(); err != nil {
		t.Fatal(err)
	}
	if got := os.Getenv("XDG_RUNTIME_DIR"); got != dir {
		t.Errorf("XDG_RUNTIME_DIR = %q, want %q", got, dir)
	}
}

func TestPreflightOnAMacNeedsALoginSession(t *testing.T) {
	_, calls := stub(t, "darwin")
	if err := Preflight(); err != nil {
		t.Fatal(err)
	}
	if len(*calls) != 1 || !strings.HasPrefix((*calls)[0], "launchctl print gui/") {
		t.Errorf("calls = %v", *calls)
	}
	command = func(name string, args ...string) ([]byte, error) {
		return []byte("Could not find domain for port identifier: 0x0\n"), os.ErrNotExist
	}
	if err := Preflight(); err == nil || !strings.Contains(err.Error(), "no login session") {
		t.Errorf("without a GUI session: %v", err)
	}
}
