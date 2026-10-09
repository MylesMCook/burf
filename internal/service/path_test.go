//go:build !windows

package service

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// A berthd launchd starts sees only the plist's PATH: it carries the
// user's, with Homebrew's folders, so tmux, gh and claude are found.
func TestThePlistCarriesAPATH(t *testing.T) {
	old := goos
	goos = "darwin"
	t.Cleanup(func() { goos = old })
	path := ComposePATH("/Users/a/.nvm/bin:/usr/bin:/bin", "/Users/a")
	b, err := Render(Spec{Name: "dev.berth.berthd", Program: "/Users/a/.berth/bin/berthd", Args: []string{"serve"}, Env: map[string]string{"BERTH_HOME": "/Users/a/.berth", "PATH": path}})
	if err != nil {
		t.Fatal(err)
	}
	want := "<key>PATH</key><string>/Users/a/.nvm/bin:/usr/bin:/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/Users/a/.local/bin:/usr/sbin:/sbin</string>"
	if !strings.Contains(string(b), want) {
		t.Fatalf("plist lacks %s:\n%s", want, b)
	}
	// And it reads back, as the agent does to see whether it has one.
	if u, err := parsePlist(b); err != nil || u.Env["PATH"] != path {
		t.Fatalf("read back %q, %v", u.Env["PATH"], err)
	}
}

func TestComposePATHKeepsTheUsersOrderOnce(t *testing.T) {
	got := ComposePATH("/opt/homebrew/bin::relative:/usr/bin:/opt/homebrew/bin/", "/h")
	want := "/opt/homebrew/bin:/usr/bin:/opt/homebrew/sbin:/usr/local/bin:/h/.local/bin:/bin:/usr/sbin:/sbin"
	if got != want {
		t.Fatalf("got  %s\nwant %s", got, want)
	}
}

// The login shell's PATH is read past whatever its startup files print.
func TestLoginShellPATH(t *testing.T) {
	dir := t.TempDir()
	shell := filepath.Join(dir, "sh")
	os.WriteFile(shell, []byte("#!/bin/sh\necho 'Welcome!'\nPATH=/from/login:/usr/bin\nexport PATH\nshift\neval \"$1\"\necho bye\n"), 0o755)
	t.Setenv("SHELL", shell)
	got, err := LoginShellPATH(5 * time.Second)
	if err != nil || got != "/from/login:/usr/bin" {
		t.Fatalf("got %q, %v", got, err)
	}
	os.WriteFile(shell, []byte("#!/bin/sh\nexec sleep 10\n"), 0o755)
	start := time.Now()
	if _, err := LoginShellPATH(300 * time.Millisecond); err == nil || time.Since(start) > 3*time.Second {
		t.Fatalf("a hung shell: %v after %s", err, time.Since(start))
	}
}

// berthd started by an older plist adds the tool folders it lacks.
func TestAugmentPATHAddsMissingToolFolders(t *testing.T) {
	home := t.TempDir()
	os.MkdirAll(filepath.Join(home, ".local", "bin"), 0o755)
	t.Setenv("HOME", home)
	t.Setenv("PATH", "/usr/bin:/bin")
	got := AugmentPATH()
	if os.Getenv("PATH") != got || !strings.HasPrefix(got, "/usr/bin:/bin:") || !strings.Contains(got, filepath.Join(home, ".local", "bin")) {
		t.Fatalf("PATH = %s", got)
	}
	for _, d := range ToolDirs(home) {
		if _, err := os.Stat(d); err != nil && strings.Contains(got, d+":") {
			t.Fatalf("added %s, which isn't there", d)
		}
	}
	if again := AugmentPATH(); again != got {
		t.Fatalf("again: %s", again)
	}
}
