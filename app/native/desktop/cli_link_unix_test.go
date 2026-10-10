//go:build !windows

package desktop

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCLIReplacementKeepsThePreviousCommand(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	link := filepath.Join(home, ".local/bin/burf")
	if err := os.MkdirAll(filepath.Dir(link), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(link, []byte("previous command"), 0755); err != nil {
		t.Fatal(err)
	}
	src := filepath.Join(home, "bundled-cli")
	if _, err := replaceCLILink(link, src); err != nil {
		t.Fatal(err)
	}
	if target, err := os.Readlink(link); err != nil || target != src {
		t.Fatalf("link = %q: %v", target, err)
	}
	previous, err := os.ReadFile(link + ".previous")
	if err != nil || string(previous) != "previous command" {
		t.Fatalf("previous = %q: %v", previous, err)
	}
}

func TestCLIReplacementDoesNotOverwriteRecovery(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	link := filepath.Join(home, "burf")
	if err := os.WriteFile(link, []byte("current"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(link+".previous", []byte("recovery"), 0755); err != nil {
		t.Fatal(err)
	}
	if _, err := replaceCLILink(link, filepath.Join(home, "bundled")); err == nil {
		t.Fatal("overwrote a retained command")
	}
	for path, want := range map[string]string{link: "current", link + ".previous": "recovery"} {
		got, err := os.ReadFile(path)
		if err != nil || string(got) != want {
			t.Fatalf("%s = %q: %v", path, got, err)
		}
	}
}

func TestPrivateStateCannotLinkTheDefaultCommand(t *testing.T) {
	t.Setenv("BERTH_HOME", t.TempDir())
	if privateStateReason() == nil {
		t.Fatal("isolated client was allowed to link the default command")
	}
}
