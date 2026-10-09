package openurl

import (
	"reflect"
	"testing"
)

func TestPlatformURLCommandsPreserveTheURLArgument(t *testing.T) {
	url := "https://example.com/login?q=a%20b&next=%22quoted%22"
	for _, tc := range []struct {
		os   string
		want []string
	}{
		{"darwin", []string{"open", url}},
		{"linux", []string{"xdg-open", url}},
		{"windows", []string{"rundll32.exe", "url.dll,FileProtocolHandler", url}},
	} {
		if got := Command(tc.os, url); !reflect.DeepEqual(got, tc.want) {
			t.Errorf("%s: command = %q, want %q", tc.os, got, tc.want)
		}
	}
}
