package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"time"
	"unicode/utf16"

	"github.com/sean-brydon/berthd/internal/statefile"
)

const taskSource = "berth-task-v1:"
const taskNamespace = "http://schemas.microsoft.com/windows/2004/02/mit/task"
const taskArgumentsPrefix = "-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand "
const legacyTaskArgumentsPrefix = "-NoLogo -NoProfile -NonInteractive -EncodedCommand "
const schedulerCommandTimeout = 15 * time.Second

var windowsSID = currentWindowsSID

var taskCommand = func(ctx context.Context, input []byte, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, powershellPath(), args...)
	configureCommand(cmd)
	if input != nil {
		cmd.Stdin = bytes.NewReader(input)
	}
	cmd.WaitDelay = time.Second
	// PowerShell emits CLIXML progress on stderr, separately from JSON stdout.
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	err := cmd.Run()
	out := stdout.Bytes()
	if ctx.Err() != nil {
		return out, ctx.Err()
	}
	if err != nil || len(out) == 0 {
		out = append(out, stderr.Bytes()...)
	}
	return out, err
}

// Launcher bytes evolve independently from the service identity. The hash
// detects edits to the stored action; the OS namespace and SID own the task.
type taskMetadata struct {
	Spec           Spec   `json:"spec"`
	LauncherSHA256 string `json:"launcher_sha256"`
}

func launcherHash(arguments string) string {
	hash := sha256.Sum256([]byte(arguments))
	return hex.EncodeToString(hash[:])
}

// Windows tasks run only in the current user's interactive session. Their
// names include the SID so two users cannot replace each other's agent.
func windowsTaskName(name string) (string, error) {
	if name == "" || strings.IndexFunc(name, func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || strings.ContainsRune("._-", r))
	}) >= 0 {
		return "", errors.New("Windows service name must contain only letters, numbers, dot, underscore or hyphen")
	}
	sid, err := windowsSID()
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256([]byte(sid))
	return fmt.Sprintf(`\Berth-%x-%s`, hash[:6], name), nil
}

func powershellPath() string {
	root := os.Getenv("SystemRoot")
	if root == "" {
		root = `C:\Windows`
	}
	return strings.TrimRight(root, `\/`) + `\System32\WindowsPowerShell\v1.0\powershell.exe`
}

func powershell(script string) ([]byte, error) {
	return powershellContext(context.Background(), nil, script)
}

func powershellInput(script string, input []byte) ([]byte, error) {
	return powershellContext(context.Background(), input, script)
}

func powershellContext(ctx context.Context, input []byte, script string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, schedulerCommandTimeout)
	defer cancel()
	return taskCommand(ctx, input, "-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encodePowerShell(script))
}

func encodePowerShell(s string) string {
	words := utf16.Encode([]rune(s))
	b := make([]byte, 2*len(words))
	for i, w := range words {
		binary.LittleEndian.PutUint16(b[2*i:], w)
	}
	return base64.StdEncoding.EncodeToString(b)
}

func psQuote(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }

const taskConnect = `$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$scheduler = New-Object -ComObject 'Schedule.Service'
$scheduler.Connect()
$folder = $scheduler.GetFolder('\')
`

// GetTask has no locale-dependent text output. Only its missing-file HRESULT
// means absent; permission and scheduler failures must never permit replacement.
func taskLookup(name string) string {
	return taskConnect + `$task = $null
try { $task = $folder.GetTask(` + psQuote(name) + `) } catch {
  $e = $_.Exception
  while ($e.InnerException) { $e = $e.InnerException }
  if ($e.HResult -ne -2147024894) { throw }
}
`
}

func windowsPreflight() error {
	if _, err := windowsSID(); err != nil {
		return fmt.Errorf("finding the Windows login user: %w", err)
	}
	if _, err := powershell(taskConnect); err != nil {
		return fmt.Errorf("Windows Task Scheduler is unavailable for this user: %w", err)
	}
	return nil
}

type windowsTask struct {
	Found bool   `json:"found"`
	XML   string `json:"xml"`
	State int    `json:"state"`
}

type taskDocument struct {
	XMLName      xml.Name `xml:"Task"`
	Version      string   `xml:"version,attr"`
	Registration struct {
		Source      string `xml:"Source"`
		Description string `xml:"Description"`
	} `xml:"RegistrationInfo"`
	Triggers []struct {
		Enabled            *bool  `xml:"Enabled"`
		ExecutionTimeLimit string `xml:"ExecutionTimeLimit"`
		StartBoundary      string `xml:"StartBoundary"`
		EndBoundary        string `xml:"EndBoundary"`
		Delay              string `xml:"Delay"`
		UserID             string `xml:"UserId"`
	} `xml:"Triggers>LogonTrigger"`
	Principals []struct {
		ID        string `xml:"id,attr"`
		UserID    string `xml:"UserId"`
		LogonType string `xml:"LogonType"`
		RunLevel  string `xml:"RunLevel"`
	} `xml:"Principals>Principal"`
	Settings struct {
		MultipleInstancesPolicy    string `xml:"MultipleInstancesPolicy"`
		DisallowStartIfOnBatteries *bool  `xml:"DisallowStartIfOnBatteries"`
		StopIfGoingOnBatteries     *bool  `xml:"StopIfGoingOnBatteries"`
		AllowHardTerminate         *bool  `xml:"AllowHardTerminate"`
		StartWhenAvailable         *bool  `xml:"StartWhenAvailable"`
		RunOnlyIfNetworkAvailable  *bool  `xml:"RunOnlyIfNetworkAvailable"`
		RunOnlyIfIdle              *bool  `xml:"RunOnlyIfIdle"`
		AllowStartOnDemand         *bool  `xml:"AllowStartOnDemand"`
		Enabled                    *bool  `xml:"Enabled"`
		Hidden                     *bool  `xml:"Hidden"`
		ExecutionTimeLimit         string `xml:"ExecutionTimeLimit"`
		Priority                   int    `xml:"Priority"`
		RestartOnFailure           struct {
			Interval string `xml:"Interval"`
			Count    int    `xml:"Count"`
		} `xml:"RestartOnFailure"`
	} `xml:"Settings"`
	Actions struct {
		Context string `xml:"Context,attr"`
		Exec    []struct {
			Command   string `xml:"Command"`
			Arguments string `xml:"Arguments"`
		} `xml:"Exec"`
	} `xml:"Actions"`
}

func renderWindowsTask(s Spec) ([]byte, error) {
	if _, err := windowsTaskName(s.Name); err != nil {
		return nil, err
	}
	if !windowsAbsolute(s.Program) {
		return nil, fmt.Errorf("service program must be an absolute Windows path, got %s", s.Program)
	}
	if s.LogPath != "" && !windowsAbsolute(s.LogPath) {
		return nil, errors.New("Windows service log must be an absolute path")
	}
	for _, a := range s.Args {
		if strings.ContainsRune(a, 0) {
			return nil, errors.New("Windows service arguments cannot contain NUL")
		}
	}
	seenEnv := map[string]bool{}
	for key, value := range s.Env {
		if key == "" || strings.ContainsAny(key, "=\x00") || strings.ContainsRune(value, 0) {
			return nil, errors.New("invalid Windows service environment")
		}
		if seenEnv[strings.ToUpper(key)] {
			return nil, errors.New("Windows service environment names must be unique ignoring case")
		}
		seenEnv[strings.ToUpper(key)] = true
	}
	sid, err := windowsSID()
	if err != nil {
		return nil, err
	}
	arguments := taskArgumentsPrefix + encodePowerShell(windowsTaskScript(s))
	if len(arguments) > 30000 {
		return nil, errors.New("Windows service arguments exceed the process command-line limit")
	}
	metadata, err := json.Marshal(taskMetadata{Spec: s, LauncherSHA256: launcherHash(arguments)})
	if err != nil {
		return nil, err
	}
	return []byte(fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<Task version="1.2" xmlns="%s">
  <RegistrationInfo><Description>%s</Description><Source>%s</Source></RegistrationInfo>
  <Triggers><LogonTrigger><Enabled>true</Enabled><ExecutionTimeLimit>PT0S</ExecutionTimeLimit><UserId>%s</UserId></LogonTrigger></Triggers>
  <Principals><Principal id="BerthUser"><UserId>%s</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>false</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <AllowStartOnDemand>true</AllowStartOnDemand><Enabled>true</Enabled><Hidden>true</Hidden>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit><Priority>7</Priority>
    <RestartOnFailure><Interval>PT1M</Interval><Count>255</Count></RestartOnFailure>
  </Settings>
  <Actions Context="BerthUser"><Exec><Command>%s</Command><Arguments>%s</Arguments></Exec></Actions>
</Task>
`, taskNamespace, esc(s.Description), taskSource+base64.StdEncoding.EncodeToString(metadata), esc(sid), esc(sid), esc(powershellPath()), esc(arguments))), nil
}

func windowsAbsolute(path string) bool {
	if strings.ContainsRune(path, 0) {
		return false
	}
	if len(path) >= 3 && (path[0] >= 'A' && path[0] <= 'Z' || path[0] >= 'a' && path[0] <= 'z') && path[1] == ':' && (path[2] == '\\' || path[2] == '/') {
		return true
	}
	parts := strings.Split(strings.TrimPrefix(path, `\\`), `\`)
	return strings.HasPrefix(path, `\\`) && len(parts) >= 2 && parts[0] != "" && parts[1] != ""
}

func readWindowsTask(name string) (windowsTask, Spec, error) {
	return readWindowsTaskContext(context.Background(), name)
}

func readWindowsTaskContext(ctx context.Context, name string) (windowsTask, Spec, error) {
	if err := ctx.Err(); err != nil {
		return windowsTask{}, Spec{}, err
	}
	path, err := windowsTaskName(name)
	if err != nil {
		return windowsTask{}, Spec{}, err
	}
	out, err := powershellContext(ctx, nil, taskLookup(path)+`if ($task) {
  [Console]::Out.Write((@{found=$true;xml=$task.Xml;state=[int]$task.State} | ConvertTo-Json -Compress))
} else { [Console]::Out.Write('{"found":false}') }
`)
	if err != nil {
		return windowsTask{}, Spec{}, fmt.Errorf("querying Windows task %s: %w", path, err)
	}
	var task windowsTask
	if err := json.Unmarshal(out, &task); err != nil {
		return task, Spec{}, fmt.Errorf("reading Windows task query: %w", err)
	}
	if !task.Found {
		return task, Spec{}, nil
	}
	s, err := ownedWindowsTask([]byte(task.XML), name)
	return task, s, err
}

// The principal and action must both belong to Berth. A matching task name
// alone is never enough to overwrite, run or remove somebody else's task.
func ownedWindowsTask(data []byte, name string) (Spec, error) {
	if err := validateWindowsTaskActions(data); err != nil {
		return Spec{}, err
	}
	var doc taskDocument
	if err := xml.Unmarshal(data, &doc); err != nil {
		return Spec{}, err
	}
	if doc.XMLName.Space != taskNamespace || !strings.HasPrefix(doc.Registration.Source, taskSource) {
		return Spec{}, errors.New("the Windows task is not owned by Berth")
	}
	b, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(doc.Registration.Source, taskSource))
	if err != nil {
		return Spec{}, err
	}
	var metadata taskMetadata
	if err := json.Unmarshal(b, &metadata); err != nil {
		return Spec{}, err
	}
	s := metadata.Spec
	if s.Name != name {
		return Spec{}, errors.New("the Windows task has a different service identity")
	}
	if len(doc.Actions.Exec) != 1 || !validWindowsTaskArguments(doc.Actions.Exec[0].Arguments) || metadata.LauncherSHA256 != launcherHash(doc.Actions.Exec[0].Arguments) {
		return Spec{}, errors.New("the Windows task launcher differs from its recorded configuration")
	}
	want, err := renderWindowsTask(s)
	if err != nil {
		return Spec{}, err
	}
	var expected taskDocument
	if err := xml.Unmarshal(want, &expected); err != nil {
		return Spec{}, err
	}
	// Keep checking the SID, executable, Spec and settings without requiring
	// an older owned task's launcher to equal this release's implementation.
	expected.Registration.Source = doc.Registration.Source
	expected.Actions.Exec[0].Arguments = doc.Actions.Exec[0].Arguments
	if !reflect.DeepEqual(doc, expected) {
		return Spec{}, errors.New("the Windows task principal or action differs from its Berth configuration")
	}
	return s, nil
}

func validWindowsTaskArguments(arguments string) bool {
	encoded, ok := strings.CutPrefix(arguments, taskArgumentsPrefix)
	if !ok {
		encoded, ok = strings.CutPrefix(arguments, legacyTaskArgumentsPrefix)
	}
	if !ok {
		return false
	}
	// Require one canonical base64 argument containing UTF-16LE bytes.
	command, err := base64.StdEncoding.DecodeString(encoded)
	return err == nil && len(command) > 0 && len(command)%2 == 0 && base64.StdEncoding.EncodeToString(command) == encoded
}

func validateWindowsTaskActions(data []byte) error {
	d := xml.NewDecoder(strings.NewReader(string(data)))
	var parents []string
	for {
		token, err := d.Token()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		switch t := token.(type) {
		case xml.StartElement:
			if len(parents) > 0 {
				parent := parents[len(parents)-1]
				if parent == "Actions" && t.Name.Local != "Exec" || parent == "Triggers" && t.Name.Local != "LogonTrigger" || parent == "Exec" && t.Name.Local != "Command" && t.Name.Local != "Arguments" {
					return errors.New("the Windows task contains actions or triggers Berth did not install")
				}
			}
			parents = append(parents, t.Name.Local)
		case xml.EndElement:
			parents = parents[:len(parents)-1]
		}
	}
}

func windowsRead(name string) (Unit, bool, error) {
	task, s, err := readWindowsTask(name)
	if err != nil || !task.Found {
		return Unit{}, false, err
	}
	path, err := windowsTaskName(name)
	return Unit{Path: path, Program: s.Program, Args: s.Args, Env: s.Env}, true, err
}

func windowsInstalled(s Spec) bool {
	task, have, err := readWindowsTask(s.Name)
	return err == nil && task.Found && reflect.DeepEqual(have, s)
}

// Each mutation rechecks the queried XML to avoid replacing a task that
// changed after its ownership was checked. Task Scheduler exposes no CAS.
func taskGuard(path string, task windowsTask) string {
	script := taskLookup(path)
	if task.Found {
		hash := sha256.Sum256([]byte(task.XML))
		script += "if (!$task) { throw 'The Windows task disappeared' }\n" +
			"$hash = [Convert]::ToBase64String([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($task.Xml)))\n" +
			"if ($hash -cne " + psQuote(base64.StdEncoding.EncodeToString(hash[:])) + ") { throw 'The Windows task changed; retry after inspecting it' }\n"
	} else {
		script += "if ($task) { throw 'A Windows task already exists with this identity' }\n"
	}
	return script
}

func windowsInstall(s Spec) (string, error) {
	data, err := renderWindowsTask(s)
	if err != nil {
		return "", err
	}
	program := strings.ToLower(strings.ReplaceAll(s.Program, `\`, "/"))
	tmp := strings.ToLower(strings.ReplaceAll(os.TempDir(), `\`, "/"))
	if strings.HasPrefix(program, strings.TrimRight(tmp, "/")+"/") || strings.Contains(program, "/go-build") {
		return "", fmt.Errorf("refusing to install a temporary binary %s; build it to a stable path first", s.Program)
	}
	task, have, err := readWindowsTask(s.Name)
	if err != nil {
		return "", err
	}
	if task.Found && !sameWindowsHome(have.Env["BERTH_HOME"], s.Env["BERTH_HOME"]) {
		return "", errors.New("the Windows task belongs to another Berth home")
	}
	if task.Found && (task.State == 4 || task.State == 2) {
		return "", errors.New("stop the Windows service cleanly before replacing its task")
	}
	if s.LogPath != "" {
		if err := statefile.EnsurePrivateDir(filepath.Dir(s.LogPath)); err != nil {
			return "", err
		}
	}
	path, _ := windowsTaskName(s.Name)
	sid, _ := windowsSID()
	script := taskGuard(path, task) + "if ($task -and ($task.State -eq 4 -or $task.State -eq 2)) { throw 'Stop the Windows service cleanly before replacing its task' }\n" +
		"$xml = [Console]::In.ReadToEnd()\n$registered = $folder.RegisterTask(" + psQuote(path) + ", $xml, 6, " + psQuote(sid) + ", $null, 3, $null)\n$null = $registered.Run($null)\n"
	if _, err := powershellInput(script, data); err != nil {
		return "", fmt.Errorf("installing Windows task %s: %w", path, err)
	}
	return path, nil
}

func sameWindowsHome(a, b string) bool {
	return strings.EqualFold(strings.TrimRight(strings.ReplaceAll(a, "/", `\`), `\`), strings.TrimRight(strings.ReplaceAll(b, "/", `\`), `\`))
}

func windowsUninstall(s Spec) (string, error) {
	task, have, err := readWindowsTask(s.Name)
	if err != nil || !task.Found {
		return "", err
	}
	if !sameWindowsHome(have.Env["BERTH_HOME"], s.Env["BERTH_HOME"]) {
		return "", errors.New("the Windows task belongs to another Berth home")
	}
	if !sameWindowsHome(have.Program, s.Program) {
		return "", errors.New("the Windows task belongs to another Berth executable")
	}
	if task.State == 4 || task.State == 2 {
		return "", errors.New("stop the Windows service cleanly before removing its task")
	}
	path, _ := windowsTaskName(s.Name)
	script := taskGuard(path, task) + "if ($task.State -eq 4 -or $task.State -eq 2) { throw 'Stop the Windows service cleanly before removing its task' }\n$folder.DeleteTask(" + psQuote(path) + ", 0)\n"
	if _, err := powershell(script); err != nil {
		return "", fmt.Errorf("removing Windows task %s: %w", path, err)
	}
	return path, nil
}

// WaitStopped waits for Windows' launcher to finish after the agent process
// has exited. Other supervisors run the agent directly and need no such wait.
func WaitStopped(ctx context.Context, s Spec) error {
	if goos != "windows" {
		return nil
	}
	for {
		task, _, err := readWindowsTaskContext(ctx, s.Name)
		if err != nil {
			return err
		}
		if !task.Found || task.State != 4 && task.State != 2 {
			return nil
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("the Windows agent task did not stop: %w", ctx.Err())
		case <-time.After(100 * time.Millisecond):
		}
	}
}

func windowsStart(s Spec) error {
	task, have, err := readWindowsTask(s.Name)
	if err != nil {
		return err
	}
	if !task.Found || !reflect.DeepEqual(have, s) {
		return errors.New("the Windows service is not installed for this Berth configuration")
	}
	path, _ := windowsTaskName(s.Name)
	if _, err := powershell(taskGuard(path, task) + "$null = $task.Run($null)\n"); err != nil {
		return fmt.Errorf("starting Windows task %s: %w", path, err)
	}
	return nil
}

// Windows CRT argv quoting, also used by Go's Windows exec implementation.
// PowerShell's native argument marshalling would lose empty/literal-quote args.
func windowsArgument(s string) string {
	if s != "" && !strings.ContainsAny(s, " \t\n\r\"") {
		return s
	}
	var b strings.Builder
	b.WriteByte('"')
	slashes := 0
	for _, c := range s {
		if c == '\\' {
			slashes++
			continue
		}
		if c == '"' {
			b.WriteString(strings.Repeat(`\`, slashes*2+1))
		} else {
			b.WriteString(strings.Repeat(`\`, slashes))
		}
		slashes = 0
		b.WriteRune(c)
	}
	b.WriteString(strings.Repeat(`\`, slashes*2))
	b.WriteByte('"')
	return b.String()
}

func windowsTaskScript(s Spec) string {
	args := make([]string, len(s.Args))
	for i, a := range s.Args {
		args[i] = windowsArgument(a)
	}
	keys := make([]string, 0, len(s.Env))
	for k := range s.Env {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	values := make([]string, len(keys))
	for i, k := range keys {
		values[i], keys[i] = psQuote(s.Env[k]), psQuote(k)
	}
	restart := "$false"
	if s.RestartAlways {
		restart = "$true"
	}
	script := "$ErrorActionPreference = 'Stop'\ntry {\nAdd-Type -TypeDefinition @'\n" + taskProcessSource + "\n'@\n" +
		"exit ([BerthTaskProcess]::Run(" + psQuote(s.Program) + ", " + psQuote(strings.Join(args, " ")) + ", [string[]]@(" + strings.Join(keys, ",") + "), [string[]]@(" + strings.Join(values, ",") + "), " + psQuote(s.LogPath) + ", " + restart + "))\n} catch {\n"
	if s.LogPath != "" {
		script += "[IO.File]::AppendAllText(" + psQuote(s.LogPath) + ", $_.Exception.ToString() + [Environment]::NewLine)\n"
	}
	return script + "exit 1\n}\n"
}

// The OS-owned PowerShell launcher releases Berth's image after the child
// exits. It forwards the actual exit status to Task Scheduler. Both output
// streams append their original bytes to the log and finish before it returns.
const taskProcessSource = `using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
public static class BerthTaskProcess {
  private static void ReportLogFailure(Exception error) {
    try { Console.Error.WriteLine("Berth could not write the service log: " + error.Message); } catch { }
  }
  private static void Copy(Stream source, Stream output, Action<Exception> failed) {
    var buffer = new byte[8192];
    int count;
    bool writable = true;
    try {
      while ((count = source.Read(buffer, 0, buffer.Length)) > 0) {
        if (!writable) continue;
        try { lock (output) { output.Write(buffer, 0, count); output.Flush(); } }
        catch (Exception error) { writable = false; failed(error); }
      }
    } catch (Exception error) { failed(error); }
  }
  public static int Run(string program, string arguments, string[] keys, string[] values, string log, bool restartAlways) {
    do {
      using (var p = new Process()) {
        p.StartInfo.FileName = program;
        p.StartInfo.Arguments = arguments;
        p.StartInfo.UseShellExecute = false;
        p.StartInfo.CreateNoWindow = true;
        for (int i = 0; i < keys.Length; i++) p.StartInfo.EnvironmentVariables[keys[i]] = values[i];
        Stream output = null;
        Thread stdout = null, stderr = null;
        Exception logFailure = null;
        var failureLock = new object();
        Action<Exception> failed = error => { lock (failureLock) { if (logFailure == null) logFailure = error; } };
        try {
          if (log.Length > 0) {
            output = new FileStream(log, FileMode.Append, FileAccess.Write, FileShare.Read);
            p.StartInfo.RedirectStandardOutput = true;
            p.StartInfo.RedirectStandardError = true;
          }
          p.Start();
          if (output != null) {
            stdout = new Thread(() => Copy(p.StandardOutput.BaseStream, output, failed));
            stderr = new Thread(() => Copy(p.StandardError.BaseStream, output, failed));
            stdout.Start(); stderr.Start();
          }
          p.WaitForExit();
          if (stdout != null) { stdout.Join(); stderr.Join(); }
          if (logFailure != null) ReportLogFailure(logFailure);
          if (!restartAlways) return p.ExitCode;
        } finally {
          if (output != null) {
            try { output.Dispose(); } catch (Exception error) { ReportLogFailure(error); }
          }
        }
      }
      Thread.Sleep(5000);
    } while (restartAlways);
    return 0;
  }
}`
