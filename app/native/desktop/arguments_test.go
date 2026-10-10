package desktop

import (
	"encoding/json"
	"testing"
)

func TestCommandArgumentsCannotSelectExecutables(t *testing.T) {
	var p struct {
		AtLogin bool `json:"atLogin"`
	}
	if err := decode(json.RawMessage(`{"atLogin":true}`), &p); err != nil || !p.AtLogin {
		t.Fatalf("accepted argument: %v %v", p, err)
	}
	for _, raw := range []string{
		`{"atLogin":true,"path":"/tmp/untrusted"}`,
		`{"atLogin":"true"}`,
		`{"atLogin":true} {}`,
		`[]`,
	} {
		if err := decode(json.RawMessage(raw), &p); err == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
}

func TestExternalLinksStayWebLinks(t *testing.T) {
	for _, raw := range []string{"https://example.test/page", "http://127.0.0.1:1435/"} {
		if err := externalURL(raw); err != nil {
			t.Fatal(err)
		}
	}
	for _, raw := range []string{"file:///tmp/private", "javascript:alert(1)", "https://user:password@example.test/", "relative/path", "https:///missing"} {
		if err := externalURL(raw); err == nil {
			t.Fatalf("accepted %q", raw)
		}
	}
}

func TestDeepLinksKeepOnlyTheLegacyScheme(t *testing.T) {
	links := deepLinks([]string{"/Applications/Burf.app", "berth://pair/example", "https://example.test", "burf://pair/example", "berth://user:password@pair/example"})
	if len(links) != 1 || links[0] != "berth://pair/example" {
		t.Fatalf("links = %#v", links)
	}
}
