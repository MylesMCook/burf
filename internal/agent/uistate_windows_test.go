package agent

import (
	"testing"

	"golang.org/x/sys/windows"
)

func uiStateTestDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	user, err := windows.GetCurrentProcessToken().GetTokenUser()
	if err != nil {
		t.Fatal(err)
	}
	sd, err := windows.GetNamedSecurityInfo(dir, windows.SE_FILE_OBJECT, windows.OWNER_SECURITY_INFORMATION)
	if err != nil {
		t.Fatal(err)
	}
	if sd == nil {
		t.Fatal("test directory has no security descriptor")
	}
	owner, _, err := sd.Owner()
	if err != nil {
		t.Fatal(err)
	}
	if owner.Equals(user.User.Sid) {
		return dir
	}
	// Elevated CI can give temporary directories a group owner. The fixture
	// models the account-owned client directory required by the state reader.
	if err := windows.SetNamedSecurityInfo(dir, windows.SE_FILE_OBJECT, windows.OWNER_SECURITY_INFORMATION, user.User.Sid, nil, nil, nil); err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestClientUIStateWindowsACLRefusesOtherAccounts(t *testing.T) {
	user, err := windows.GetCurrentProcessToken().GetTokenUser()
	if err != nil {
		t.Fatal(err)
	}
	for _, policy := range []struct {
		sddl    string
		private bool
	}{
		{"D:P(A;;FA;;;SY)(A;;FA;;;" + user.User.Sid.String() + ")", true},
		{"D:P(A;;FA;;;" + user.User.Sid.String() + ")(A;;FR;;;WD)", false},
		{"D:P(A;;FA;;;" + user.User.Sid.String() + ")(A;;FW;;;BU)", false},
		{"D:NO_ACCESS_CONTROL", false},
	} {
		sd, err := windows.SecurityDescriptorFromString(policy.sddl)
		if err != nil {
			t.Fatal(err)
		}
		if err := clientUIPrivateACL(sd, user.User.Sid); (err == nil) != policy.private {
			t.Fatalf("private=%t, got %v", policy.private, err)
		}
	}
}
