package service

import (
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"encoding/xml"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"
	"unicode/utf16"
)

var windowsSpec = Spec{
	Name: "berth-agent-home", Description: "Berth agent", Program: `C:\Users\Alex\Berth Apps\berth.exe`,
	Args: []string{"agent", "", `quote"and\`, "O'Brien & $HOME"},
	Env:  map[string]string{"BERTH_HOME": `C:\Users\Alex\Berth State`, "ODD": "a'b$c`d\ne"},
}

type fakeScheduler struct {
	xml       string
	state     int
	queries   int
	mutations []string
	queryErr  error
}

func fakeWindowsScheduler(t *testing.T) *fakeScheduler {
	t.Helper()
	oldOS, oldSID, oldCmd, oldInput := goos, windowsSID, command, commandInput
	goos = "windows"
	windowsSID = func() (string, error) { return "S-1-5-21-123-456-789-1001", nil }
	t.Setenv("SystemRoot", `C:\Windows`)
	f := &fakeScheduler{state: 3}
	command = func(name string, args ...string) ([]byte, error) {
		if name != powershellPath() || len(args) != 5 || args[4] == "" {
			t.Fatalf("unexpected command %s %v", name, args)
		}
		script := decodePowerShell(t, args[4])
		if strings.Contains(script, "ConvertTo-Json") {
			f.queries++
			if f.queryErr != nil {
				return nil, f.queryErr
			}
			return json.Marshal(windowsTask{Found: f.xml != "", XML: f.xml, State: f.state})
		}
		f.mutations = append(f.mutations, script)
		if strings.Contains(script, "DeleteTask") {
			f.xml = ""
		}
		return nil, nil
	}
	commandInput = func(name string, input []byte, args ...string) ([]byte, error) {
		if name != powershellPath() || len(args) != 5 {
			t.Fatal("registration did not use the OS PowerShell executable")
		}
		f.mutations = append(f.mutations, decodePowerShell(t, args[4]))
		f.xml = string(input)
		return nil, nil
	}
	t.Cleanup(func() { goos, windowsSID, command, commandInput = oldOS, oldSID, oldCmd, oldInput })
	return f
}

func decodePowerShell(t *testing.T, encoded string) string {
	t.Helper()
	b, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(b)%2 != 0 {
		t.Fatalf("invalid encoded PowerShell command: %v", err)
	}
	words := make([]uint16, len(b)/2)
	for i := range words {
		words[i] = binary.LittleEndian.Uint16(b[2*i:])
	}
	return string(utf16.Decode(words))
}

func TestWindowsTaskPreservesInteractiveLoginAndCleanStop(t *testing.T) {
	fakeWindowsScheduler(t)
	b, err := Render(windowsSpec)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"<LogonType>InteractiveToken</LogonType>", "<RunLevel>LeastPrivilege</RunLevel>",
		"<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>",
		"<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>",
		"<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>",
		"<RestartOnFailure><Interval>PT1M</Interval><Count>255</Count></RestartOnFailure>",
	} {
		if !strings.Contains(string(b), want) {
			t.Errorf("task is missing %s", want)
		}
	}
	if strings.Contains(string(b), "Password") || strings.Contains(string(b), "HighestAvailable") {
		t.Fatal("task requested stored credentials or elevation")
	}
	var doc taskDocument
	if err := xml.Unmarshal(b, &doc); err != nil {
		t.Fatal(err)
	}
	script := decodePowerShell(t, strings.TrimPrefix(doc.Actions.Exec[0].Arguments, "-NoLogo -NoProfile -NonInteractive -EncodedCommand "))
	for _, want := range []string{"if (!restartAlways) return p.ExitCode;", "p.StartInfo.UseShellExecute = false;", "[string[]]@('BERTH_HOME','ODD')", "'a''b$c`d\ne'", ", $false))"} {
		if !strings.Contains(script, want) {
			t.Errorf("launcher is missing %q", want)
		}
	}
	if strings.Contains(script, "ExecutionPolicy") {
		t.Fatal("launcher changed PowerShell execution policy")
	}
}

func TestWindowsTaskInstallReadUpdateRemoveAndStatePreservation(t *testing.T) {
	f := fakeWindowsScheduler(t)
	path, err := Install(windowsSpec)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(path, `\Berth-`) || !Installed(windowsSpec) {
		t.Fatalf("not installed at the user-owned task identity: %q", path)
	}
	u, ok, err := Read(windowsSpec.Name)
	if err != nil || !ok || u.Path != path || u.Program != windowsSpec.Program || !reflect.DeepEqual(u.Args, windowsSpec.Args) || !reflect.DeepEqual(u.Env, windowsSpec.Env) {
		t.Fatalf("Read = %+v, %v, %v", u, ok, err)
	}
	s := windowsSpec
	s.Program = `C:\Users\Alex\New Berth\berth.exe`
	if _, err := Install(s); err != nil {
		t.Fatal(err)
	}
	if Installed(windowsSpec) || !Installed(s) {
		t.Fatal("updated executable was not read structurally")
	}
	if _, err := Uninstall(windowsSpec); err == nil {
		t.Fatal("another executable removed the updated login task")
	}
	if _, err := Uninstall(s); err != nil {
		t.Fatal(err)
	}
	if Installed(s) || f.xml != "" {
		t.Fatal("task remains installed")
	}
	for _, script := range f.mutations {
		if strings.Contains(script, "Remove-Item") || strings.Contains(script, "Stop-Process") || strings.Contains(script, ".Stop(") {
			t.Fatal("service mutation deleted state or force-stopped a process")
		}
	}
	if !strings.Contains(f.mutations[0], "6, 'S-1-5-21-123-456-789-1001', $null, 3, $null") || !strings.Contains(f.mutations[0], ".Run($null)") || !strings.Contains(f.mutations[1], "SHA256") {
		t.Fatal("registration lacks explicit interactive user, starts-now or change guard")
	}
}

func TestWindowsTaskRefusesForeignTaskAndQueryFailures(t *testing.T) {
	f := fakeWindowsScheduler(t)
	b, _ := Render(windowsSpec)
	for _, data := range []string{
		strings.Replace(string(b), "InteractiveToken", "Password", 1),
		strings.Replace(string(b), "LeastPrivilege", "HighestAvailable", 1),
		strings.Replace(string(b), "S-1-5-21-123-456-789-1001", "S-1-5-21-123-456-789-1002", -1),
		strings.Replace(string(b), "<AllowHardTerminate>false</AllowHardTerminate>", "", 1),
		strings.Replace(string(b), "</Actions>", "<ComHandler><ClassId>foreign</ClassId></ComHandler></Actions>", 1),
		strings.Replace(string(b), "</Triggers>", "<BootTrigger/></Triggers>", 1),
		`<Task xmlns="` + taskNamespace + `"><RegistrationInfo><Source>someone else</Source></RegistrationInfo></Task>`,
	} {
		f.xml = data
		if _, err := Install(windowsSpec); err == nil {
			t.Fatal("replaced a foreign or changed task")
		}
		if _, err := Uninstall(windowsSpec); err == nil {
			t.Fatal("removed a foreign or changed task")
		}
		if Installed(windowsSpec) || Running(windowsSpec) {
			t.Fatal("foreign task counted as this service")
		}
	}
	f.xml = ""
	f.queryErr = errors.New("permission denied")
	if _, err := Install(windowsSpec); err == nil {
		t.Fatal("query failure was treated as an absent task")
	}
	if len(f.mutations) != 0 {
		t.Fatal("an ownership failure still mutated Task Scheduler")
	}
}

func TestWindowsTaskRefusesAnotherHomeAndRunningReplacement(t *testing.T) {
	f := fakeWindowsScheduler(t)
	b, _ := Render(windowsSpec)
	f.xml = string(b)
	s := windowsSpec
	s.Env = map[string]string{"BERTH_HOME": `C:\Users\Alex\Other State`}
	if _, err := Install(s); err == nil {
		t.Fatal("replaced a task belonging to another home")
	}
	if _, err := Uninstall(s); err == nil {
		t.Fatal("removed another home's task")
	}
	f.state = 4
	if !Running(windowsSpec) {
		t.Fatal("numeric running state was not detected")
	}
	if _, err := Install(windowsSpec); err == nil {
		t.Fatal("replaced a running service")
	}
	if _, err := Uninstall(windowsSpec); err == nil {
		t.Fatal("removed a running service")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
	defer cancel()
	if err := WaitStopped(ctx, windowsSpec); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("running launcher wait = %v", err)
	}
}

func TestWindowsArgumentsKeepEmptyQuotedAndTrailingBackslashValues(t *testing.T) {
	for input, want := range map[string]string{
		"": `""`, "agent": "agent", "two words": `"two words"`, `a"b`: `"a\"b"`,
		`C:\two words\`: `"C:\two words\\"`, `a\"b`: `"a\\\"b"`, "O'Brien&$HOME": "O'Brien&$HOME",
	} {
		if got := windowsArgument(input); got != want {
			t.Errorf("%q => %q, want %q", input, got, want)
		}
	}
}

func TestWindowsTaskIdentityIsUserSpecificAndStableAcrossExecutableUpdates(t *testing.T) {
	fakeWindowsScheduler(t)
	first, _ := UnitPath(windowsSpec)
	s := windowsSpec
	s.Program = `C:\New Version\berth.exe`
	second, _ := UnitPath(s)
	if first != second {
		t.Fatal("task identity changes with the executable")
	}
	windowsSID = func() (string, error) { return "S-1-5-21-123-456-789-1002", nil }
	otherUser, _ := UnitPath(s)
	if otherUser == first {
		t.Fatal("two users share the same task identity")
	}
}
