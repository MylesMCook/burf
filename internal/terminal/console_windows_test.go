package terminal

import (
	"errors"
	"os"
	"os/exec"
	"testing"
)

func TestWindowsClientRefusesLocalProcessPTY(t *testing.T) {
	if _, err := Start(exec.Command("cmd.exe"), 80, 24); !errors.Is(err, errLocalPTY) {
		t.Fatalf("Start error = %v", err)
	}
}

func TestWindowsConsoleRejectsAFileHandle(t *testing.T) {
	f, err := os.CreateTemp(t.TempDir(), "output")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if IsTerminal(f.Fd()) {
		t.Fatal("ordinary file reported as a console")
	}
	if _, _, err := Size(f.Fd()); err == nil {
		t.Fatal("ordinary file has console dimensions")
	}
	if _, err := MakeRaw(f.Fd()); err == nil {
		t.Fatal("ordinary file accepted for raw console input")
	}
}
