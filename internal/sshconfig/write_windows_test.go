package sshconfig

import (
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/sys/windows"
)

func TestSSHFilesDoNotInheritBroadWindowsPermissions(t *testing.T) {
	dir := t.TempDir()
	sd, err := windows.SecurityDescriptorFromString("D:(A;OICI;FA;;;WD)")
	if err != nil {
		t.Fatal(err)
	}
	dacl, _, err := sd.DACL()
	if err != nil {
		t.Fatal(err)
	}
	if err := windows.SetNamedSecurityInfo(dir, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION|windows.PROTECTED_DACL_SECURITY_INFORMATION, nil, nil, dacl, nil); err != nil {
		t.Fatal(err)
	}
	c := Config{Dir: dir}
	if err := os.WriteFile(filepath.Join(dir, "config"), []byte("Host existing\n  HostName example.invalid\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := c.Apply(mustPlan(t, c, hosts())); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"config", "config.berth-backup", "berth", "berth/cal.conf", "berth/devl.conf"} {
		path := filepath.Join(dir, name)
		sd, err := windows.GetNamedSecurityInfo(path, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION)
		if err != nil {
			t.Fatal(err)
		}
		control, _, err := sd.Control()
		if err != nil {
			t.Fatal(err)
		}
		if control&windows.SE_DACL_PROTECTED == 0 {
			t.Errorf("%s inherits permissions: %s", name, sd.String())
		}
		dacl, _, err := sd.DACL()
		if err != nil {
			t.Fatal(err)
		}
		if dacl.AceCount != 2 {
			t.Errorf("%s should grant only owner and SYSTEM: %s", name, sd.String())
		}
	}
}
