package agent

import (
	"encoding/json"
	"net/url"
	"strings"
	"testing"

	"github.com/MylesMCook/burf/internal/guided"
)

func TestGuidedInstallRefusesFlags(t *testing.T) {
	for _, q := range []url.Values{{"host": {"--help"}}, {"host": {"me@box"}, "agents": {"gemini"}}, {"host": {"me@box"}, "from": {"nope"}}, {}} {
		if _, err := readInstallRequest(q); err == nil {
			t.Errorf("%v was accepted", q)
		}
	}
	r, err := readInstallRequest(url.Values{"host": {"me@box"}, "agents": {""}})
	if err != nil || strings.Join(r.args(), " ") != "add ssh me@box --agents none" {
		t.Errorf("args = %v %v", r.args(), err)
	}
}

func TestInstallPlanBeforeConnecting(t *testing.T) {
	b := newBox(t)
	a := startAgent(t, b.pairLaptop())
	tok := uiToken(t, a)
	resp, body := uiSend(t, a, "GET", "/v1/ssh/install-plan?host=demo@box&agents=claude", tok, "")
	if resp.StatusCode != 200 {
		t.Fatalf("%d %s", resp.StatusCode, body)
	}
	var plan struct {
		Steps  []guided.Step `json:"steps"`
		Agents []struct {
			ID      string `json:"id"`
			Offered bool   `json:"offered"`
		} `json:"agents"`
	}
	if err := json.Unmarshal([]byte(body), &plan); err != nil {
		t.Fatal(err)
	}
	if len(plan.Steps) != 7 || plan.Steps[0].ID != "connect" || plan.Steps[4].Title != "Claude Code" || len(plan.Agents) < 4 {
		t.Errorf("plan = %s", body)
	}
}
