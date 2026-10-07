package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/windows"
)

func TestWindowsPowerShellControlHonorsCallerDeadline(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	started := time.Now()
	_, err := powershellContext(ctx, nil, "Start-Sleep -Seconds 30")
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("control deadline = %v", err)
	}
	if time.Since(started) > 2*time.Second {
		t.Fatal("the cancelled control process did not exit promptly")
	}
}

func TestWindowsPowerShellJSONIsSeparateFromProgress(t *testing.T) {
	out, err := powershell(`$ProgressPreference='Continue'; Write-Progress -Activity 'test-only progress' -Status 'working'; [Console]::Out.Write('{"found":false}')`)
	if err != nil {
		t.Fatal(err)
	}
	var result struct{ Found bool }
	if err := json.Unmarshal(out, &result); err != nil || result.Found {
		t.Fatalf("structured stdout was contaminated: %q (%v)", out, err)
	}
}

func TestWindowsTaskXMLValidationCreatesNoTask(t *testing.T) {
	sid, err := windowsSID()
	if err != nil {
		t.Fatal(err)
	}
	s := Spec{Name: "berth-validation-only", Program: `C:\Berth\berth.exe`, Args: []string{"agent"}, Env: map[string]string{"BERTH_HOME": `C:\Berth\state`}}
	data, err := renderWindowsTask(s)
	if err != nil {
		t.Fatal(err)
	}
	path, err := windowsTaskName(s.Name)
	if err != nil {
		t.Fatal(err)
	}
	script := taskConnect + `$xml = [Console]::In.ReadToEnd()
try {
  $null = $folder.RegisterTask(` + psQuote(path) + `, $xml, 1, ` + psQuote(sid) + `, $null, 3, $null)
  $definition = $scheduler.NewTask(0)
  $definition.XmlText = $xml
  [Console]::Out.Write((@{xml=$definition.XmlText} | ConvertTo-Json -Compress))
} catch {
  $e = $_.Exception
  while ($e.InnerException) { $e = $e.InnerException }
  [Console]::Out.Write(('0x{0:X8} {1}' -f $e.HResult, $e.Message))
}
`
	out, err := powershellInput(script, data)
	var result struct{ XML string }
	if err != nil || json.Unmarshal(out, &result) != nil || result.XML == "" {
		t.Fatalf("validation-only failed: %s (%v)", out, err)
	}
	if _, err := ownedWindowsTask([]byte(result.XML), s.Name); err != nil {
		t.Fatalf("Task Scheduler's in-memory XML failed ownership validation: %v", err)
	}
}

// This test executes only a child process in a test-owned directory. It does
// not connect to Task Scheduler, register a task, or change login startup.
func TestWindowsTaskLauncherNativeArgumentsEnvironmentLogAndExit(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "Berth's quoted & space")
	if err := os.Mkdir(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	testExe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(testExe)
	if err != nil {
		t.Fatal(err)
	}
	program := filepath.Join(dir, "berth helper.exe")
	if err := os.WriteFile(program, b, 0o700); err != nil {
		t.Fatal(err)
	}
	want := []string{"", "two words", `literal"quote`, `slashes\"quote`, `C:\trailing space\`, "O'Brien & $HOME;`", "snowman \u2603"}
	for _, status := range []string{"0", "17"} {
		log := filepath.Join(dir, "agent "+status+".log")
		s := Spec{
			Program: program,
			Args:    append([]string{"-test.run=^TestWindowsTaskChildProcess$", "--"}, want...),
			Env:     map[string]string{"BERTH_TASK_CHILD": status, "BERTH_TASK_ODD": "O'Brien & $HOME\nsecond line"},
			LogPath: log,
		}
		out, err := powershell(windowsTaskScript(s))
		if status == "0" && err != nil || status != "0" && err == nil {
			t.Fatalf("exit %s: err=%v output=%s", status, err, out)
		}
		data, err := os.ReadFile(log)
		if err != nil {
			t.Fatal(err)
		}
		var got struct {
			Args []string
			Env  string
		}
		found := false
		for _, line := range strings.Split(string(data), "\n") {
			if strings.HasPrefix(line, "{") {
				if err := json.Unmarshal([]byte(line), &got); err != nil {
					t.Fatal(err)
				}
				found = true
			}
		}
		if !found || !reflect.DeepEqual(got.Args, want) || got.Env != s.Env["BERTH_TASK_ODD"] || !strings.Contains(string(data), "stderr from child") {
			t.Fatalf("native child args/env/log differ: %+v log=%s", got, data)
		}
	}
}

func TestWindowsTaskLoggingFailureStillDrainsAndWaitsForChild(t *testing.T) {
	dir := t.TempDir()
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	marker := filepath.Join(dir, "child-finished")
	s := Spec{Program: exe, Args: []string{"-test.run=^TestWindowsTaskLoggingChildProcess$"}, Env: map[string]string{"BERTH_LOG_CHILD": marker}, LogPath: filepath.Join(dir, "log")}
	script := windowsTaskScript(s)
	script = strings.Replace(script, taskProcessSource, taskProcessSource+failingLogStream, 1)
	broken := strings.Replace(script, "output = new FileStream(log, FileMode.Append, FileAccess.Write, FileShare.Read);", "output = new BerthFailingLog();", 1)
	if broken == script {
		t.Fatal("the failing writer fixture did not replace the log stream")
	}
	started := time.Now()
	out, err := powershell(broken)
	if err != nil {
		t.Fatalf("launcher changed the clean child exit status after a log failure: %v output=%s", err, out)
	}
	if _, err := os.Stat(marker); err != nil {
		t.Fatalf("launcher returned before the chatty child finished: %v output=%s", err, out)
	}
	if time.Since(started) < 200*time.Millisecond || !strings.Contains(string(out), "injected log failure") {
		t.Fatalf("logging failure was not reported after waiting: %s", out)
	}
}

func TestWindowsTaskLoggingChildProcess(t *testing.T) {
	marker := os.Getenv("BERTH_LOG_CHILD")
	if marker == "" {
		return
	}
	data := make([]byte, 32<<10)
	for i := 0; i < 32; i++ {
		os.Stdout.Write(data)
		os.Stderr.Write(data)
	}
	time.Sleep(200 * time.Millisecond)
	if err := os.WriteFile(marker, []byte("finished"), 0o600); err != nil {
		os.Exit(19)
	}
	os.Exit(0)
}

const failingLogStream = `
public sealed class BerthFailingLog : Stream {
  public override bool CanRead { get { return false; } }
  public override bool CanSeek { get { return false; } }
  public override bool CanWrite { get { return true; } }
  public override long Length { get { throw new NotSupportedException(); } }
  public override long Position { get { throw new NotSupportedException(); } set { throw new NotSupportedException(); } }
  public override void Flush() { throw new IOException("injected log failure"); }
  public override void Write(byte[] buffer, int offset, int count) { throw new IOException("injected log failure"); }
  public override int Read(byte[] buffer, int offset, int count) { throw new NotSupportedException(); }
  public override long Seek(long offset, SeekOrigin origin) { throw new NotSupportedException(); }
  public override void SetLength(long value) { throw new NotSupportedException(); }
}
`

func TestWindowsTaskChildProcess(t *testing.T) {
	status := os.Getenv("BERTH_TASK_CHILD")
	if status == "" {
		return
	}
	for i, a := range os.Args {
		if a == "--" {
			data, _ := json.Marshal(struct {
				Args []string
				Env  string
			}{os.Args[i+1:], os.Getenv("BERTH_TASK_ODD")})
			fmt.Println(string(data))
			fmt.Fprintln(os.Stderr, "stderr from child")
			if status == "0" {
				os.Exit(0)
			}
			os.Exit(17)
		}
	}
	os.Exit(18)
}

func TestWindowsArgumentsNativeParserMatchesLiteralValues(t *testing.T) {
	want := []string{"berth.exe", "", `literal"quote`, `slash\"quote`, `C:\two words\`, "line\nbreak", "O'Brien & $HOME"}
	quoted := make([]string, len(want))
	for i, a := range want {
		quoted[i] = windowsArgument(a)
	}
	got, err := windows.DecomposeCommandLine(strings.Join(quoted, " "))
	if err != nil || !reflect.DeepEqual(got, want) {
		t.Fatalf("argv=%q err=%v", got, err)
	}
}
