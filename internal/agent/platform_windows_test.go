package agent

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWindowsAgentAdvertisesItsClientCapabilities(t *testing.T) {
	b := newBox(t)
	a := startAgent(t, b.pairLaptop())
	status, err := a.client.Status(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if status.SSHSetupSupported {
		t.Fatal("Windows advertised interactive SSH setup")
	}
	resp, body := uiSend(t, a, "GET", "/v1/boxes/local", uiToken(t, a), "")
	var local LocalBoxStatus
	if resp.StatusCode != http.StatusOK || json.Unmarshal([]byte(body), &local) != nil {
		t.Fatalf("local box status = %d %s", resp.StatusCode, body)
	}
	if local.Supported || local.Available || !strings.Contains(local.Reason, "windows") {
		t.Fatalf("Windows native-box capability = %+v", local)
	}
}

func TestWindowsAgentRefusesNativeBoxAndInteractiveSSH(t *testing.T) {
	b := newBox(t)
	a := startAgent(t, b.pairLaptop())
	token := uiToken(t, a)
	resp, body := uiSend(t, a, "GET", "/v1/boxes/add-ssh/terminal?host=me@box", token, "")
	var refusal struct{ Error, Code string }
	if resp.StatusCode != http.StatusNotImplemented || json.Unmarshal([]byte(body), &refusal) != nil || refusal.Code != "unsupported_platform" || refusal.Error == "" {
		t.Fatalf("interactive SSH = %d %s", resp.StatusCode, body)
	}
	resp, body = uiSend(t, a, "POST", "/v1/boxes/local", token, "")
	var line StreamLine
	if resp.StatusCode != http.StatusOK || json.Unmarshal([]byte(body), &line) != nil || !line.Done || line.Box != "" || !strings.Contains(line.Error, "windows") {
		t.Fatalf("native box setup = %d %s", resp.StatusCode, body)
	}
	for _, path := range []string{filepath.Join(filepath.Dir(a.dir), "bin", "berthd"), filepath.Join(a.dir, "localbox.json")} {
		if _, err := os.Stat(path); !os.IsNotExist(err) {
			t.Fatalf("refused box setup left %s: %v", path, err)
		}
	}
}
