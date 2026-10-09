package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWindowsInstalledCLIFindsItsBundledLinuxDaemon(t *testing.T) {
	dir := t.TempDir()
	cli := filepath.Join(dir, "cli", "berth.exe")
	if err := os.MkdirAll(filepath.Dir(cli), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "berthd-linux-amd64"), []byte("bundled daemon"), 0o600); err != nil {
		t.Fatal(err)
	}
	got, err := readDaemon(cli, "berthd-linux-amd64")
	if err != nil || string(got) != "bundled daemon" {
		t.Fatalf("bundled daemon = %q, %v", got, err)
	}
}
