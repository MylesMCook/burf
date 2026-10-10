package agent

import (
	"testing"

	"golang.org/x/sys/windows"
)

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
