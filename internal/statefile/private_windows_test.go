package statefile

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/windows"
)

func assertPrivate(t *testing.T, path string) {
	t.Helper()
	sd, err := windows.GetNamedSecurityInfo(path, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION)
	if err != nil {
		t.Fatal(err)
	}
	want, err := privateDescriptor(false)
	if err != nil {
		t.Fatal(err)
	}
	if got := sd.String(); strings.Replace(got, "D:PAI", "D:P", 1) != want.String() {
		t.Fatalf("state ACL = %q, want protected owner/System ACL %q", got, want.String())
	}
}

func TestWriteWaitsForAShortLivedWindowsReader(t *testing.T) {
	path := filepath.Join(t.TempDir(), "state.json")
	if err := Write(path, []byte("old")); err != nil {
		t.Fatal(err)
	}
	reader, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { reader.Close() })
	closed := make(chan struct{})
	go func() {
		time.Sleep(50 * time.Millisecond)
		reader.Close()
		close(closed)
	}()
	if err := Write(path, []byte("new")); err != nil {
		t.Fatalf("a brief overlapping reader prevented a state save: %v", err)
	}
	<-closed
	if got, err := os.ReadFile(path); err != nil || string(got) != "new" {
		t.Fatalf("saved state = %q, %v", got, err)
	}
}

func TestFailedWindowsReplacementPreservesThePreviousState(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "state.json")
	if err := Write(path, []byte("original")); err != nil {
		t.Fatal(err)
	}
	reader, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	if err := Write(path, []byte("replacement")); err == nil {
		t.Fatal("replaced a destination that is still held without delete sharing")
	}
	if got, err := os.ReadFile(path); err != nil || string(got) != "original" {
		t.Fatalf("failed save changed the prior state: %q, %v", got, err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) != 1 {
		t.Fatalf("failed save left temporary files: %v, %v", entries, err)
	}
}

func TestEnsurePrivateDirRestrictsAnOwnedDirectory(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "state with spaces")
	if err := EnsurePrivateDir(dir); err != nil {
		t.Fatal(err)
	}
	sd, err := windows.GetNamedSecurityInfo(dir, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION)
	if err != nil {
		t.Fatal(err)
	}
	want, err := privateDescriptor(true)
	if err != nil {
		t.Fatal(err)
	}
	// Windows records auto-inheritance processing even on a protected DACL.
	if got := sd.String(); strings.Replace(got, "D:PAI", "D:P", 1) != want.String() {
		t.Fatalf("directory ACL = %q, want %q", got, want.String())
	}
}
