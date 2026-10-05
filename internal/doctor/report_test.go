package doctor

import (
	"encoding/json"
	"flag"
	"os"
	"strings"
	"testing"
)

var update = flag.Bool("update", false, "rewrite testdata/diagnostics.golden")

// The report is the same text from the CLI and the app: both are held to
// testdata/diagnostics.golden (app/src/lib/diagnostics.test.ts reads it
// too).
func TestReportMatchesTheGolden(t *testing.T) {
	raw, err := os.ReadFile("testdata/diagnostics.json")
	if err != nil {
		t.Fatal(err)
	}
	var d Diagnostics
	if err := json.Unmarshal(raw, &d); err != nil {
		t.Fatal(err)
	}
	got := FormatReport(d)
	if *update {
		if err := os.WriteFile("testdata/diagnostics.golden", []byte(got), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	want, err := os.ReadFile("testdata/diagnostics.golden")
	if err != nil {
		t.Fatal(err)
	}
	if got != string(want) {
		t.Fatalf("report differs from the golden (go test ./internal/doctor -update rewrites it):\n%s", got)
	}
	for _, secret := range []string{"alex", "/home/other", "example.com", "op://Private", "ghp_", "sk-ant", "eyJhbGci"} {
		if strings.Contains(got, secret) {
			t.Errorf("the report still has %q", secret)
		}
	}
	if n := strings.Count(got, "\n"); n > 60 {
		t.Errorf("the report is %d lines; it should paste into a chat (about 60)", n)
	}
}

func TestRedact(t *testing.T) {
	for _, tc := range []struct{ in, home, want string }{
		{"/Users/sean/.local/bin/claude", "/Users/sean", "~/.local/bin/claude"},
		{"PATH=/Users/sean/bin:/home/me/bin:/usr/bin", "", "PATH=~/bin:~/bin:/usr/bin"},
		{`C:\Users\Sean\bin`, "", `~\bin`},
		{"key op://Private/OpenAI/credential here", "", "key op://[redacted] here"},
		{"signed out as sean@cal.com.", "", "signed out as [email]."},
		{"git clone https://sean:s3cret@github.com/acme/shop.git", "", "git clone https://[redacted]@github.com/acme/shop.git"},
		{"http://127.0.0.1:1378/?token=4f9a2b&agent=x", "", "http://127.0.0.1:1378/?token=[redacted]&agent=x"},
		{`{"token":"abc123","name":"x"}`, "", `{"token":"[redacted]","name":"x"}`},
		{"API_KEY: hunter2", "", "API_KEY: [redacted]"},
		{"Authorization: Bearer eyJhbGciOi.payload.sig", "", "Authorization: Bearer [redacted]"},
		{"ghp_abcdefghijklmnopqrstuvwxyz0123456789 leaked", "", "[redacted] leaked"},
		// Kept: build hashes, short fingerprints, long words without digits,
		// paths split by "/", and numbers alone.
		{"build b9758a308077 · sha256:9f2c…", "", "build b9758a308077 · sha256:9f2c…"},
		{"node_modules/.bin/agent-browser-linux-x64/daemon", "", "node_modules/.bin/agent-browser-linux-x64/daemon"},
		{"internationalization-and-localization-settings", "", "internationalization-and-localization-settings"},
		{"12345678901234567890123456789012345", "", "12345678901234567890123456789012345"},
		{"7.1k tokens · berth ui-token", "", "7.1k tokens · berth ui-token"},
	} {
		if got := Redact(tc.in, tc.home); got != tc.want {
			t.Errorf("Redact(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
