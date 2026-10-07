package statefile

import (
	"path/filepath"
	"strings"
	"testing"

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
