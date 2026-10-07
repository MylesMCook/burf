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
	xml        string
	state      int
	queries    int
	mutations  []string
	queryErr   error
	queryDelay time.Duration
}

func fakeWindowsScheduler(t *testing.T) *fakeScheduler {
	t.Helper()
	oldOS, oldSID, oldCmd := goos, windowsSID, taskCommand
	goos = "windows"
	windowsSID = func() (string, error) { return "S-1-5-21-123-456-789-1001", nil }
	t.Setenv("SystemRoot", `C:\Windows`)
	f := &fakeScheduler{state: 3}
	taskCommand = func(ctx context.Context, input []byte, args ...string) ([]byte, error) {
		if len(args) != 5 || args[4] == "" {
			t.Fatalf("unexpected command %v", args)
		}
		script := decodePowerShell(t, args[4])
		if input != nil {
			f.mutations = append(f.mutations, script)
			f.xml = string(input)
			return nil, nil
		}
		if strings.Contains(script, "ConvertTo-Json") {
			f.queries++
			if f.queryDelay != 0 {
				select {
				case <-ctx.Done():
					return nil, ctx.Err()
				case <-time.After(f.queryDelay):
				}
			}
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
	t.Cleanup(func() { goos, windowsSID, taskCommand = oldOS, oldSID, oldCmd })
	return f
}

func TestWindowsTaskWaitHonorsDeadlineDuringStalledQuery(t *testing.T) {
	f := fakeWindowsScheduler(t)
	b, err := Render(windowsSpec)
	if err != nil {
		t.Fatal(err)
	}
	f.xml, f.state, f.queryDelay = string(b), 4, 250*time.Millisecond
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	started := time.Now()
	err = WaitStopped(ctx, windowsSpec)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("stalled query = %v", err)
	}
	if elapsed := time.Since(started); elapsed > 150*time.Millisecond {
		t.Fatalf("20ms deadline took %v while querying Task Scheduler", elapsed)
	}
}

func TestWindowsTaskOwnershipSurvivesOlderLauncherBytes(t *testing.T) {
	f := fakeWindowsScheduler(t)
	b, err := Render(windowsSpec)
	if err != nil {
		t.Fatal(err)
	}
	legacyArgs := "-NoLogo -NoProfile -NonInteractive -EncodedCommand " + encodePowerShell("# Previous launcher release\n"+windowsTaskScript(windowsSpec))
	f.xml = rewriteWindowsTaskLauncher(t, b, legacyArgs, launcherHash(legacyArgs))
	u, ok, err := Read(windowsSpec.Name)
	if err != nil || !ok || u.Program != windowsSpec.Program || !reflect.DeepEqual(u.Args, windowsSpec.Args) || !reflect.DeepEqual(u.Env, windowsSpec.Env) {
		t.Fatalf("older launcher was rejected: %+v ok=%v err=%v", u, ok, err)
	}
	updated := windowsSpec
	updated.Program = `C:\Users\Alex\Updated Berth\berth.exe`
	if _, err := Install(updated); err != nil {
		t.Fatalf("could not replace the owned older launcher: %v", err)
	}
	if !Installed(updated) {
		t.Fatal("updated launcher is not installed")
	}
}

func TestWindowsTaskLaunchesWithHiddenPowerShellWindow(t *testing.T) {
	fakeWindowsScheduler(t)
	b, err := Render(windowsSpec)
	if err != nil {
		t.Fatal(err)
	}
	var doc taskDocument
	if err := xml.Unmarshal(b, &doc); err != nil {
		t.Fatal(err)
	}
	want := "-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand " + encodePowerShell(windowsTaskScript(windowsSpec))
	if got := doc.Actions.Exec[0].Arguments; got != want {
		t.Fatal("PowerShell action differs from the exact hidden-window launcher")
	}
	if _, err := ownedWindowsTask(b, windowsSpec.Name); err != nil {
		t.Fatalf("new hidden action failed ownership validation: %v", err)
	}
}

func TestWindowsTaskOwnershipRejectsMalformedAndUnrecordedLaunchers(t *testing.T) {
	fakeWindowsScheduler(t)
	b, err := Render(windowsSpec)
	if err != nil {
		t.Fatal(err)
	}
	encoded := encodePowerShell("# Previous launcher release\n" + windowsTaskScript(windowsSpec))
	legacyPrefix := "-NoLogo -NoProfile -NonInteractive -EncodedCommand "
	hiddenPrefix := "-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand "
	for _, tt := range []struct {
		name string
		args string
		hash string
	}{
		{"visible style", strings.Replace(hiddenPrefix, "Hidden", "Normal", 1) + encoded, ""},
		{"missing style", strings.Replace(hiddenPrefix, " Hidden", "", 1) + encoded, ""},
		{"extra option", "-NoLogo -NoProfile -NonInteractive -NoExit -EncodedCommand " + encoded, ""},
		{"prefix whitespace", " " + legacyPrefix + encoded, ""},
		{"empty command", legacyPrefix, ""},
		{"invalid base64", legacyPrefix + "not-base64", ""},
		{"odd UTF16 bytes", legacyPrefix + base64.StdEncoding.EncodeToString([]byte{'x'}), ""},
		{"encoded whitespace", legacyPrefix + encoded + "\n", ""},
		{"trailing option", hiddenPrefix + encoded + " -NoExit", ""},
		{"legacy hash mismatch", legacyPrefix + encoded, launcherHash("different launcher")},
		{"hidden hash mismatch", hiddenPrefix + encoded, launcherHash("different launcher")},
	} {
		t.Run(tt.name, func(t *testing.T) {
			hash := tt.hash
			if hash == "" {
				hash = launcherHash(tt.args)
			}
			data := rewriteWindowsTaskLauncher(t, b, tt.args, hash)
			if _, err := ownedWindowsTask([]byte(data), windowsSpec.Name); err == nil {
				t.Fatal("accepted a malformed or unrecorded launcher")
			}
		})
	}
	legacyArgs := legacyPrefix + encoded
	legacy := rewriteWindowsTaskLauncher(t, b, legacyArgs, launcherHash(legacyArgs))
	for _, data := range []string{
		strings.Replace(legacy, "S-1-5-21-123-456-789-1001", "S-1-5-21-123-456-789-1002", -1),
		strings.Replace(legacy, "LeastPrivilege", "HighestAvailable", 1),
		strings.Replace(legacy, "<AllowHardTerminate>false</AllowHardTerminate>", "", 1),
		strings.Replace(legacy, esc(powershellPath()), esc(`C:\foreign.exe`), 1),
	} {
		if _, err := ownedWindowsTask([]byte(data), windowsSpec.Name); err == nil {
			t.Fatal("accepted a legacy launcher with a changed principal, action or settings")
		}
	}
	if _, err := ownedWindowsTask([]byte(legacy), "another-service"); err == nil {
		t.Fatal("accepted a legacy launcher with a different service identity")
	}
}

func rewriteWindowsTaskLauncher(t *testing.T, data []byte, arguments, hash string) string {
	t.Helper()
	var doc taskDocument
	if err := xml.Unmarshal(data, &doc); err != nil {
		t.Fatal(err)
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(doc.Registration.Source, taskSource))
	if err != nil {
		t.Fatal(err)
	}
	var metadata taskMetadata
	if err := json.Unmarshal(raw, &metadata); err != nil {
		t.Fatal(err)
	}
	metadata.LauncherSHA256 = hash
	raw, err = json.Marshal(metadata)
	if err != nil {
		t.Fatal(err)
	}
	updated := strings.Replace(string(data), esc(doc.Actions.Exec[0].Arguments), esc(arguments), 1)
	return strings.Replace(updated, doc.Registration.Source, taskSource+base64.StdEncoding.EncodeToString(raw), 1)
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
	script := decodePowerShell(t, strings.TrimPrefix(doc.Actions.Exec[0].Arguments, taskArgumentsPrefix))
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
		strings.Replace(string(b), "-EncodedCommand ", "-EncodedCommand changed", 1),
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

func TestWindowsSchedulerControlsHaveBoundedQueryDeadline(t *testing.T) {
	fakeWindowsScheduler(t)
	queried := false
	taskCommand = func(ctx context.Context, input []byte, args ...string) ([]byte, error) {
		queried = true
		deadline, ok := ctx.Deadline()
		if !ok || time.Until(deadline) > schedulerCommandTimeout {
			t.Fatal("scheduler query has no bounded deadline")
		}
		return []byte(`{"found":false}`), nil
	}
	if _, _, err := Read(windowsSpec.Name); err != nil || !queried {
		t.Fatalf("query=%v err=%v", queried, err)
	}
}
