//go:build darwin || linux

package localchat

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"
)

type nativeReport struct {
	Provider int
	Child    int
	CWD      string
	Value    string
}

func TestMain(m *testing.M) {
	if os.Getenv("BURF_SYNTHETIC_APP_SERVER") == "1" && len(os.Args) > 1 {
		switch os.Args[1] {
		case "synthetic-child":
			for {
				time.Sleep(time.Hour)
			}
		case "synthetic-owner":
			p, err := StartProcess(LaunchOptions{Program: os.Args[0], CWD: os.Getenv("BURF_TEST_CWD")})
			if err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(2)
			}
			sc := bufio.NewScanner(p)
			if !sc.Scan() {
				os.Exit(3)
			}
			fmt.Println(sc.Text())
			for {
				time.Sleep(time.Hour)
			}
		case "app-server":
			child := exec.Command(os.Args[0], "synthetic-child")
			if err := child.Start(); err != nil {
				os.Exit(4)
			}
			cwd, _ := os.Getwd()
			_ = json.NewEncoder(os.Stdout).Encode(nativeReport{os.Getpid(), child.Process.Pid, cwd, os.Getenv("BURF_TEST_VALUE")})
			if os.Getenv("BURF_TEST_BLOCK_INPUT") == "1" {
				for {
					time.Sleep(time.Hour)
				}
			}
			sc := bufio.NewScanner(os.Stdin)
			for sc.Scan() {
				fmt.Println(sc.Text())
			}
			os.Exit(0)
		}
	}
	os.Exit(m.Run())
}

func readNativeReport(t *testing.T, r io.Reader) nativeReport {
	t.Helper()
	var result struct {
		report nativeReport
		err    error
	}
	done := make(chan struct{})
	go func() { result.err = json.NewDecoder(r).Decode(&result.report); close(done) }()
	select {
	case <-done:
		if result.err != nil {
			t.Fatal(result.err)
		}
		return result.report
	case <-time.After(5 * time.Second):
		t.Fatal("provider did not report startup")
		return nativeReport{}
	}
}

func requireStopped(t *testing.T, pids ...int) {
	t.Helper()
	for _, pid := range pids {
		deadline := time.Now().Add(5 * time.Second)
		for {
			out, err := exec.Command("ps", "-o", "stat=", "-p", strconv.Itoa(pid)).Output()
			if err != nil || strings.TrimSpace(string(out)) == "" || strings.HasPrefix(strings.TrimSpace(string(out)), "Z") {
				break
			}
			if time.Now().After(deadline) {
				t.Fatalf("owned PID %d survived: %s", pid, out)
			}
			time.Sleep(20 * time.Millisecond)
		}
	}
}

func TestNativeStdioOwnsDescendantsAndPipes(t *testing.T) {
	t.Setenv("BURF_SYNTHETIC_APP_SERVER", "1")
	t.Setenv("BURF_TEST_VALUE", "wrong-inherited-account")
	exe, _ := os.Executable()
	cwd := t.TempDir()
	p, err := StartProcess(LaunchOptions{Program: exe, CWD: cwd, Env: []string{"BURF_SYNTHETIC_APP_SERVER=1", "BURF_TEST_VALUE=specific-project-account"}})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { p.Close() })
	report := readNativeReport(t, p)
	if report.Value != "specific-project-account" {
		t.Fatal("environment lost", report)
	}
	wantCWD, _ := filepath.EvalSymlinks(cwd)
	if report.CWD != wantCWD {
		t.Fatal("wrong project directory", report.CWD, wantCWD)
	}
	if _, err := p.Write([]byte("synthetic-json-line\n")); err != nil {
		t.Fatal(err)
	}
	sc := bufio.NewScanner(p)
	if !sc.Scan() || sc.Text() != "synthetic-json-line" {
		t.Fatal("stdio modified", sc.Text(), sc.Err())
	}
	if err := p.Close(); err != nil {
		t.Fatal(err)
	}
	requireStopped(t, report.Provider, report.Child)
}

func TestNativeCloseUnblocksPipesAndPreservesOtherProcesses(t *testing.T) {
	exe, _ := os.Executable()
	unrelated := exec.Command(exe, "synthetic-child")
	unrelated.Env = append(os.Environ(), "BURF_SYNTHETIC_APP_SERVER=1")
	if err := unrelated.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { unrelated.Process.Kill(); unrelated.Wait() })
	p, err := StartProcess(LaunchOptions{Program: exe, CWD: t.TempDir(), Env: []string{"BURF_SYNTHETIC_APP_SERVER=1", "BURF_TEST_BLOCK_INPUT=1"}})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { p.Close() })
	report := readNativeReport(t, p)
	readDone, writeDone, closeDone := make(chan error, 1), make(chan error, 1), make(chan error, 1)
	go func() { _, err := p.Read(make([]byte, 1)); readDone <- err }()
	go func() { _, err := p.Write(make([]byte, 4<<20)); writeDone <- err }()
	select {
	case <-writeDone:
		t.Fatal("synthetic blocked writer did not block")
	case <-time.After(50 * time.Millisecond):
	}
	go func() { closeDone <- p.Close() }()
	for name, ch := range map[string]<-chan error{"read": readDone, "write": writeDone, "close": closeDone} {
		select {
		case err := <-ch:
			if name != "close" && err == nil {
				t.Fatal(name, "unexpected success")
			}
		case <-time.After(5 * time.Second):
			t.Fatal(name, "did not unblock")
		}
	}
	requireStopped(t, report.Provider, report.Child)
	if err := unrelated.Process.Signal(syscall.Signal(0)); err != nil {
		t.Fatal("unrelated process stopped", err)
	}
}

func TestNativeParentDeathCleansOwnedProcesses(t *testing.T) {
	exe, _ := os.Executable()
	owner := exec.Command(exe, "synthetic-owner")
	owner.Env = append(os.Environ(), "BURF_SYNTHETIC_APP_SERVER=1", "BURF_TEST_CWD="+t.TempDir())
	out, _ := owner.StdoutPipe()
	owner.Stderr = os.Stderr
	if err := owner.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { owner.Process.Kill() })
	report := readNativeReport(t, out)
	if err := owner.Process.Kill(); err != nil {
		t.Fatal(err)
	}
	_ = owner.Wait()
	requireStopped(t, report.Provider, report.Child)
}

func TestNativeProviderExitCleansDescendants(t *testing.T) {
	exe, _ := os.Executable()
	p, err := StartProcess(LaunchOptions{Program: exe, CWD: t.TempDir(), Env: []string{"BURF_SYNTHETIC_APP_SERVER=1"}})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { p.Close() })
	report := readNativeReport(t, p)
	process := p.(*stdioProcess)
	process.input.Close()
	select {
	case <-process.done:
	case <-time.After(5 * time.Second):
		t.Fatal("provider exit did not clean up")
	}
	requireStopped(t, report.Provider, report.Child)
}
