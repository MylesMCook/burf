package agent

import (
	"encoding/json"
	"testing"
)

// The app's Copy diagnostics reads the laptop's checks from the agent; an
// agent run without them (tests, a bare Config) answers with none.
func TestTheAppReadsTheDoctorFromTheAgent(t *testing.T) {
	b := newBox(t)
	a := startAgent(t, b.pairLaptop())
	resp, body := uiSend(t, a, "GET", "/v1/doctor", uiToken(t, a), "")
	if resp.StatusCode != 200 {
		t.Fatalf("GET /v1/doctor: %d %s", resp.StatusCode, body)
	}
	var rep DoctorReport
	if err := json.Unmarshal([]byte(body), &rep); err != nil {
		t.Fatal(err)
	}
	if rep.Version == "" || rep.OS == "" || rep.Checks == nil || len(rep.Checks) != 0 {
		t.Fatalf("report = %+v", rep)
	}
}
