package terminal

import (
	"bytes"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestWindowsClientRefusesLocalProcessPTY(t *testing.T) {
	if _, err := Start(exec.Command("cmd.exe"), 80, 24); !errors.Is(err, errLocalPTY) {
		t.Fatalf("Start error = %v", err)
	}
}

func TestWindowsRawReaderPreservesCtrlZAndUTF8(t *testing.T) {
	data := []byte{0x1a, 'x', 0xe2, 0x82, 0xac, 0x03}
	path := filepath.Join(t.TempDir(), "control-input")
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	buf := make([]byte, 32)
	n, err := readConsoleInput(f, buf)
	if err != nil || !bytes.Equal(buf[:n], data) {
		t.Fatalf("raw input = %x, %v; want %x", buf[:n], err, data)
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
