package agent

import "testing"

func TestEditorPathsStayAbsoluteOnTheRemoteUnixBox(t *testing.T) {
	for _, tc := range []struct {
		input, want string
		valid       bool
	}{
		{"/work/cal/../shop/file.ts", "/work/shop/file.ts", true},
		{"/work/a file.ts", "/work/a file.ts", true},
		{"", "", false},
		{"relative/file.ts", "", false},
		{"--help", "", false},
		{"/work/file\n--help", "", false},
		{"/work/file\x00", "", false},
	} {
		got, valid := cleanAbs(tc.input)
		if got != tc.want || valid != tc.valid {
			t.Errorf("cleanAbs(%q) = %q, %v; want %q, %v", tc.input, got, valid, tc.want, tc.valid)
		}
	}
}
