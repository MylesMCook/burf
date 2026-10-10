//go:build darwin

package desktop

import "testing"

func TestSignatureTeamMatchesCodesignOutput(t *testing.T) {
	for description, want := range map[string]string{
		"Authority=Developer ID\nTeamIdentifier=ABCDE12345\n": "ABCDE12345",
		"Signature=adhoc\nTeamIdentifier=not set\n":           "",
		"code object is not signed at all":                    "",
	} {
		if got := signatureTeam(description); got != want {
			t.Fatalf("team = %q, want %q", got, want)
		}
	}
}
