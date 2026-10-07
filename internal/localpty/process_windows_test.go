package localpty

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
	"unicode/utf16"

	"golang.org/x/sys/windows"
)

func TestEnvironmentBlock(t *testing.T) {
	block, err := environmentBlock([]string{"z=last", "A=first", "a=replaced", "=C:=C:\\work", "EMPTY="})
	if err != nil {
		t.Fatal(err)
	}
	if got := string(utf16.Decode(block)); got != "=C:=C:\\work\x00a=replaced\x00EMPTY=\x00z=last\x00\x00" {
		t.Fatalf("block %q", got)
	}
	for _, invalid := range []string{"missing", "=", "=C:", "NUL=\x00"} {
		if _, err := environmentBlock([]string{invalid}); err == nil {
			t.Errorf("accepted %q", invalid)
		}
	}
	if block, err := environmentBlock([]string{}); err != nil || !reflect.DeepEqual(block, []uint16{0, 0}) {
		t.Fatalf("empty: %v %v", block, err)
	}
}

func TestPTYRejectsInvalidStart(t *testing.T) {
	for _, path := range []string{"cmd.exe", `C:\bad"name.exe`, "C:\\bad\x00.exe"} {
		if p, err := Start(path, nil, "", nil, 80, 24); err == nil {
			p.Close()
			t.Fatalf("accepted %q", path)
		}
	}
	if p, err := Start(filepath.Join(t.TempDir(), "missing.exe"), nil, "", nil, 80, 24); err == nil {
		p.Close()
		t.Fatal("missing executable started")
	}
}

func helper(t *testing.T, mode string, extra ...string) (*Process, string) {
	t.Helper()
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	env := append(os.Environ(), "BERTH_LOCALPTY_HELPER="+mode, "BERTH_LOCALPTY_RESULT="+filepath.Join(dir, "result.json"))
	p, err := Start(exe, append([]string{"-test.run=^TestPTYHelper$", "--"}, extra...), dir, env, 80, 24)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { bounded(t, p.Close) })
	return p, dir
}

func bounded(t *testing.T, fn func() error) error {
	t.Helper()
	done := make(chan error, 1)
	go func() { done <- fn() }()
	select {
	case err := <-done:
		return err
	case <-time.After(15 * time.Second):
		t.Fatal("terminal operation exceeded 15 seconds")
		return nil
	}
}

func TestPTYNativeArgumentsEnvironmentAndDirectory(t *testing.T) {
	args := []string{"plain", "two words", `quote"value`, `C:\trailing slash\`, "", "literal&%value", "caf\u00e9"}
	p, dir := helper(t, "metadata", args...)
	var output []byte
	if err := bounded(t, func() error { var err error; output, err = io.ReadAll(p); return err }); err != nil {
		t.Fatal(err)
	}
	if err := bounded(t, p.Wait); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(output), "LOCALPTY-OK") {
		t.Fatalf("missing terminal output: %q", output)
	}
	data, err := os.ReadFile(filepath.Join(dir, "result.json"))
	if err != nil {
		t.Fatal(err)
	}
	var got struct {
		Args     []string
		Dir, Env string
	}
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got.Args, args) || got.Dir != dir || got.Env != "metadata" {
		t.Fatalf("metadata mismatch: %+v", got)
	}
}

func TestPTYInputResizeAndExit(t *testing.T) {
	p, _ := helper(t, "echo")
	if p.PID() <= 0 {
		t.Fatal("missing PID")
	}
	if err := p.Resize(100, 30); err != nil {
		t.Fatal(err)
	}
	if err := p.Resize(0, 30); err == nil {
		t.Fatal("accepted invalid resize")
	}
	if _, err := p.Write([]byte("hello-localpty\r")); err != nil {
		t.Fatal(err)
	}
	var output []byte
	if err := bounded(t, func() error { var err error; output, err = io.ReadAll(p); return err }); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(output), "RECEIVED:hello-localpty") {
		t.Fatalf("input not received: %q", output)
	}
	if err := bounded(t, p.Wait); err != nil {
		t.Fatal(err)
	}
	if err := p.Resize(80, 24); !errors.Is(err, os.ErrClosed) {
		t.Fatalf("resize after exit: %v", err)
	}
}

func TestPTYExitStatus(t *testing.T) {
	p, _ := helper(t, "exit")
	if err := bounded(t, p.Wait); err == nil {
		t.Fatal("nonzero exit reported success")
	} else {
		var exit *ExitError
		if !errors.As(err, &exit) || exit.Code != 7 {
			t.Fatalf("exit error: %v", err)
		}
	}
}

func TestPTYConcurrentCloseStopsTreeWithoutReader(t *testing.T) {
	p, dir := helper(t, "tree")
	var childPID int
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if data, err := os.ReadFile(filepath.Join(dir, "result.json")); err == nil {
			childPID, _ = strconv.Atoi(string(data))
			if childPID > 0 {
				break
			}
		}
		time.Sleep(20 * time.Millisecond)
	}
	if childPID == 0 {
		t.Fatal("child did not start")
	}
	child, err := windows.OpenProcess(windows.SYNCHRONIZE, false, uint32(childPID))
	if err != nil {
		t.Fatal(err)
	}
	defer windows.CloseHandle(child)
	if err := bounded(t, func() error {
		var wg sync.WaitGroup
		for range 8 {
			wg.Add(1)
			go func() { defer wg.Done(); p.Close() }()
		}
		wg.Wait()
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	status, err := windows.WaitForSingleObject(child, 5000)
	if err != nil || status != windows.WAIT_OBJECT_0 {
		t.Fatalf("descendant survived close: %d %v", status, err)
	}
	if _, err := p.Write([]byte("x")); err == nil {
		t.Fatal("write after close succeeded")
	}
	bounded(t, p.Wait)
}

func TestPTYUnreadOverflowStopsOwnedProcess(t *testing.T) {
	p, _ := helper(t, "flood")
	if err := bounded(t, p.Wait); !errors.Is(err, ErrOutputOverflow) {
		t.Fatalf("overflow should stop process and report its cause: %v", err)
	}
	_, err := io.Copy(io.Discard, p)
	if !errors.Is(err, ErrOutputOverflow) {
		t.Fatalf("overflow: %v", err)
	}
}

func TestPTYCloseInterruptsBlockedWrite(t *testing.T) {
	p, dir := helper(t, "no-input")
	deadline := time.Now().Add(5 * time.Second)
	for {
		if _, err := os.Stat(filepath.Join(dir, "result.json")); err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("non-reading helper did not become ready")
		}
		time.Sleep(20 * time.Millisecond)
	}
	written := make(chan error, 1)
	go func() {
		_, err := p.Write([]byte(strings.Repeat("a", 8*1024*1024)))
		written <- err
	}()
	select {
	case err := <-written:
		t.Fatalf("write finished before close, blocked-write condition not established: %v", err)
	case <-time.After(100 * time.Millisecond):
	}
	if err := bounded(t, p.Close); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-written:
		if err == nil {
			t.Fatal("interrupted write reported success")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("close did not interrupt blocked input writer")
	}
	bounded(t, p.Wait)
}

func TestPTYCmd(t *testing.T) {
	program := filepath.Join(os.Getenv("SystemRoot"), "System32", "cmd.exe")
	p, err := Start(program, []string{"/d", "/q", "/c", "echo LOCALPTY-CMD"}, t.TempDir(), nil, 80, 24)
	if err != nil {
		t.Fatal(err)
	}
	defer p.Close()
	var output []byte
	if err := bounded(t, func() error { var err error; output, err = io.ReadAll(p); return err }); err != nil {
		t.Fatal(err)
	}
	if err := bounded(t, p.Wait); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(output), "LOCALPTY-CMD") {
		t.Fatalf("output %q", output)
	}
}

func TestPTYHelper(t *testing.T) {
	mode := os.Getenv("BERTH_LOCALPTY_HELPER")
	if mode == "" {
		return
	}
	time.AfterFunc(10*time.Second, func() { os.Exit(97) })
	switch mode {
	case "metadata":
		cwd, _ := os.Getwd()
		data, _ := json.Marshal(struct {
			Args     []string
			Dir, Env string
		}{os.Args[3:], cwd, mode})
		if os.WriteFile(os.Getenv("BERTH_LOCALPTY_RESULT"), data, 0600) != nil {
			os.Exit(2)
		}
		fmt.Println("LOCALPTY-OK")
	case "echo":
		line, err := bufio.NewReader(os.Stdin).ReadString('\n')
		if err != nil {
			os.Exit(2)
		}
		fmt.Println("RECEIVED:" + strings.TrimSpace(line))
	case "exit":
		os.Exit(7)
	case "tree":
		cmd := exec.Command(os.Args[0], "-test.run=^TestPTYHelper$")
		cmd.Env = append(os.Environ(), "BERTH_LOCALPTY_HELPER=idle")
		if cmd.Start() != nil {
			os.Exit(2)
		}
		if os.WriteFile(os.Getenv("BERTH_LOCALPTY_RESULT"), []byte(strconv.Itoa(cmd.Process.Pid)), 0600) != nil {
			os.Exit(2)
		}
		for {
			time.Sleep(time.Hour)
		}
	case "idle":
		for {
			time.Sleep(time.Hour)
		}
	case "no-input":
		if os.WriteFile(os.Getenv("BERTH_LOCALPTY_RESULT"), []byte("ready"), 0600) != nil {
			os.Exit(2)
		}
		for {
			time.Sleep(time.Hour)
		}
	case "flood":
		var consoleMode uint32
		if windows.GetConsoleMode(windows.Handle(os.Stdout.Fd()), &consoleMode) != nil {
			os.Exit(4)
		}
		for range 4096 {
			fmt.Println(strings.Repeat("output-", 100))
		}
		os.Exit(9)
	default:
		os.Exit(3)
	}
	os.Exit(0)
}
