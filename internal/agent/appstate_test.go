package agent

import (
	"strings"
	"testing"
)

func TestTheAppKeepsItsDocumentsOnTheLaptop(t *testing.T) {
	b := newBox(t)
	a := startAgent(t, b.pairLaptop())
	tok := uiToken(t, a)
	if _, body := uiSend(t, a, "GET", "/v1/app/projects", tok, ""); strings.TrimSpace(body) != "null" {
		t.Fatalf("an unset document = %s", body)
	}
	doc := `{"projects":[{"id":"cal","name":"Cal.com","default_box":"devl","group":"Work"}]}`
	if resp, _ := uiSend(t, a, "PUT", "/v1/app/projects", tok, doc); resp.StatusCode != 200 {
		t.Fatalf("put: %d", resp.StatusCode)
	}
	if _, body := uiSend(t, a, "GET", "/v1/app/projects", tok, ""); !strings.Contains(body, `"default_box":"devl"`) {
		t.Fatalf("get = %s", body)
	}
	for _, bad := range []struct{ path, body string }{{"/v1/app/projects", "not json"}, {"/v1/app/..%2fescape", "{}"}, {"/v1/app/Bad_Key", "{}"}} {
		if resp, _ := uiSend(t, a, "PUT", bad.path, tok, bad.body); resp.StatusCode == 200 {
			t.Errorf("%s with %q was accepted", bad.path, bad.body)
		}
	}
}
