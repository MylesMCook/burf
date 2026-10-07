package service

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"golang.org/x/sys/windows"
)

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
