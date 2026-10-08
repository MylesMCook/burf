package main

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"reflect"
	"testing"
	"time"

	"golang.org/x/sys/windows"
)

func TestWindowsDetachedAgentHasNoInheritedConsole(t *testing.T) {
	cmd := exec.Command(`C:\Burf Apps\berth.exe`, "agent")
	detachAgentProcess(cmd)
	want := uint32(windows.DETACHED_PROCESS | windows.CREATE_NEW_PROCESS_GROUP)
	if cmd.SysProcAttr.CreationFlags != want || !cmd.SysProcAttr.HideWindow {
		t.Fatalf("attributes=%+v", cmd.SysProcAttr)
	}
}

func TestWindowsTerminalUsesExecutableAndLiteralArguments(t *testing.T) {
	program := `C:\Burf's Apps\berth.exe`
	args := []string{"attach", "box/session &' $(literal)"}
	old := createTerminalProcess
	t.Cleanup(func() { createTerminalProcess = old })
	called := false
	createTerminalProcess = func(app, line *uint16, procSecurity, threadSecurity *windows.SecurityAttributes, inherit bool, flags uint32, env, dir *uint16, startup *windows.StartupInfo, info *windows.ProcessInformation) error {
		called = true
		got, err := windows.DecomposeCommandLine(windows.UTF16PtrToString(line))
		if err != nil || windows.UTF16PtrToString(app) != program || !reflect.DeepEqual(got, append([]string{program}, args...)) || flags&windows.CREATE_NEW_CONSOLE == 0 || inherit || startup.Flags&windows.STARTF_USESTDHANDLES != 0 {
			t.Fatalf("terminal argv=%q err=%v flags=%d startup=%+v", got, err, flags, startup)
		}
		return nil
	}
	if err := openTerminalCommand(program, args); err != nil {
		t.Fatal(err)
	}
	if !called {
		t.Fatal("native terminal creation was not called")
	}
}

func TestWindowsProcessHandleWaitsUntilImageExits(t *testing.T) {
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command(exe, "-test.run=^TestWindowsProcessChild$")
	cmd.Env = append(os.Environ(), "BERTH_PROCESS_CHILD=1")
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	defer cmd.Wait()
	wait, closeProcess, err := openAgentProcess(cmd.Process.Pid)
	if err != nil {
		t.Fatal(err)
	}
	defer closeProcess()
	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
	defer cancel()
	if err := wait(ctx); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("early wait=%v", err)
	}
	ctx2, cancel2 := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel2()
	if err := wait(ctx2); err != nil {
		t.Fatal(err)
	}
}

func TestWindowsProcessChild(t *testing.T) {
	if os.Getenv("BERTH_PROCESS_CHILD") == "1" {
		time.Sleep(300 * time.Millisecond)
		os.Exit(0)
	}
}
