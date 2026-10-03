package main

import (
	"os"
	"path/filepath"
	"testing"
)

// berth on the PATH is often a link to the copy inside Berth.app
// (Settings → General → Command line); the daemons are in the app's
// Contents/Resources, beside the file the link points at.
func TestReadDaemonThroughALink(t *testing.T) {
	dir := t.TempDir()
	contents := filepath.Join(dir, "Berth.app", "Contents")
	for _, d := range []string{"MacOS", "Resources"} {
		if err := os.MkdirAll(filepath.Join(contents, d), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	cli := filepath.Join(contents, "MacOS", "berth-cli")
	if err := os.WriteFile(cli, []byte("cli"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(contents, "Resources", "berthd-linux-amd64"), []byte("daemon"), 0o644); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(dir, "bin", "berth")
	if err := os.MkdirAll(filepath.Dir(link), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(cli, link); err != nil {
		t.Fatal(err)
	}
	b, err := readDaemon(link, "berthd-linux-amd64")
	if err != nil || string(b) != "daemon" {
		t.Fatalf("readDaemon through a link = %q, %v", b, err)
	}
}
