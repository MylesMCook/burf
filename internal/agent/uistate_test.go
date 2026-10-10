package agent

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"
)

func uiStateFixture() *ClientUIState {
	return &ClientUIState{Version: 1, Storage: map[string]string{
		"berth.prefs":      `{"density":"compact","customFonts":[{"id":"1ce41d9e-2536-436a-8eaf-d0de35cfc404","name":"Mono"}]}`,
		"berth.ui":         `{"themeId":"personal"}`,
		"berth.workspaces": `{"spaces":{"project":{"draft":"keep my unsent text"}}}`,
	}, Fonts: []ClientUIFont{{ID: "1ce41d9e-2536-436a-8eaf-d0de35cfc404", Name: "Mono", Bytes: base64.StdEncoding.EncodeToString([]byte("wOF2synthetic font"))}},
		Images: []ClientUIImage{{ID: "img-migration-0001", Name: "Background: mountain\nlake", Prompt: "mountain\nlake", W: 16, H: 12, Type: "image/jpeg", At: 1760050000000, Bytes: base64.StdEncoding.EncodeToString([]byte{255, 216, 255, 1})}}}
}

func uiStateHandler(t *testing.T) (*Agent, http.Handler) {
	t.Helper()
	a := &Agent{cfg: Config{Dir: uiStateTestDir(t)}}
	mux := http.NewServeMux()
	a.uiStateRoutes(mux)
	return a, a.ui("synthetic-ui-token", "127.0.0.1:1437", mux)
}

func uiStateRequest(handler http.Handler, method, token string, body []byte) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, "http://127.0.0.1:1437/v1/client/ui-state", bytes.NewReader(body))
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("Origin", "tauri://localhost")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestClientUIStateExportSurvivesAClientRestart(t *testing.T) {
	a, handler := uiStateHandler(t)
	if response := uiStateRequest(handler, "GET", "synthetic-ui-token", nil); response.Code != 200 || strings.TrimSpace(response.Body.String()) != "null" {
		t.Fatalf("uncaptured state: %d %s", response.Code, response.Body.String())
	}
	want := uiStateFixture()
	body, _ := json.Marshal(want)
	response := uiStateRequest(handler, "POST", "synthetic-ui-token", body)
	if response.Code != 200 || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("save: %d", response.Code)
	}
	got, err := LoadClientUIState(a.cfg.Dir)
	if err != nil || !reflect.DeepEqual(got, want) {
		t.Fatalf("restarted client did not recover complete state: %v", err)
	}
	info, err := os.Stat(filepath.Join(a.cfg.Dir, clientUIStateFile))
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Fatalf("state mode: %o", info.Mode().Perm())
	}
	response = uiStateRequest(handler, "GET", "synthetic-ui-token", nil)
	if response.Code != 200 || response.Header().Get("Access-Control-Allow-Origin") != "tauri://localhost" {
		t.Fatalf("read: %d", response.Code)
	}
	if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil || !reflect.DeepEqual(got, want) {
		t.Fatalf("GET changed state: %v", err)
	}
}

func TestClientUIStateUsesExistingLocalAuthenticationAndDrainGate(t *testing.T) {
	a, handler := uiStateHandler(t)
	body, _ := json.Marshal(uiStateFixture())
	for _, method := range []string{"GET", "POST"} {
		for _, token := range []string{"", "wrong"} {
			if response := uiStateRequest(handler, method, token, body); response.Code != 401 {
				t.Fatalf("%s accepted wrong token: %d", method, response.Code)
			}
		}
	}
	req := httptest.NewRequest("POST", "http://rebound.example:1437/v1/client/ui-state", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer synthetic-ui-token")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, req)
	if response.Code != 403 {
		t.Fatalf("accepted rebound host: %d", response.Code)
	}
	a.work.draining = true
	response = uiStateRequest(handler, "POST", "synthetic-ui-token", body)
	if response.Code != 503 || !strings.Contains(response.Body.String(), "agent_restarting") {
		t.Fatalf("save during restart: %d", response.Code)
	}
	if got, err := LoadClientUIState(a.cfg.Dir); got != nil || err != nil {
		t.Fatalf("rejected save touched state: %v", err)
	}
}

func TestClientUIStateRefusesUnsupportedOrOversizedDataWithoutReplacingTheSnapshot(t *testing.T) {
	a, handler := uiStateHandler(t)
	good, _ := json.Marshal(uiStateFixture())
	if response := uiStateRequest(handler, "POST", "synthetic-ui-token", good); response.Code != 200 {
		t.Fatal(response.Code)
	}
	for _, bad := range []string{
		`{"version":2,"storage":{},"fonts":[]}`,
		`{"version":1,"storage":{"berth.ui-token":"synthetic credential"},"fonts":[]}`,
		`{"version":1,"storage":{"berth.plugin.thirdParty.secret":"synthetic credential"},"fonts":[]}`,
		`{"version":1,"storage":{},"fonts":[],"provider":{}}`,
		`{"version":1,"storage":{},"fonts":[]} {}`,
		`{"version":1,"storage":{},"fonts":[{"id":"bad","name":"Mono","bytes":"d09GMg=="}]}`,
		`{"version":1,"storage":{},"fonts":[{"id":"1ce41d9e-2536-436a-8eaf-d0de35cfc404","name":"Mono","bytes":"bm90IGE gZm9udA=="}]}`,
		`{"version":1,"storage":{"berth.prefs":"` + strings.Repeat("x", maxUIStorageValue+1) + `"},"fonts":[]}`,
		`{"version":1,"storage":{},"fonts":[],"images":[{"id":"img-bad-0001","name":"Background","w":16,"h":12,"type":"image/svg+xml","at":0,"bytes":"PHN2Zz4="}]}`,
	} {
		response := uiStateRequest(handler, "POST", "synthetic-ui-token", []byte(bad))
		if response.Code != 400 {
			t.Fatalf("invalid state accepted: %d", response.Code)
		}
	}
	oversized := `{"version":1,"storage":{},"fonts":[]}` + strings.Repeat(" ", maxClientUIState)
	if response := uiStateRequest(handler, "POST", "synthetic-ui-token", []byte(oversized)); response.Code != 400 {
		t.Fatalf("accepted a body over 32 MB: %d", response.Code)
	}
	after, err := os.ReadFile(filepath.Join(a.cfg.Dir, clientUIStateFile))
	if err != nil || !bytes.Equal(after, good) {
		t.Fatalf("invalid export changed the previous snapshot: %v", err)
	}
}

func TestClientUIStateReadsEarlierFontOnlyExports(t *testing.T) {
	state, err := decodeClientUIState(strings.NewReader(`{"version":1,"storage":{},"fonts":[]}`))
	if err != nil || state == nil || state.Images == nil || len(state.Images) != 0 {
		t.Fatalf("earlier export did not load: %v", err)
	}
}

func TestClientUIStateRejectsLinkedAndNonRegularStateFiles(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symbolic-link creation requires Windows privileges")
	}
	dir := t.TempDir()
	outside := filepath.Join(t.TempDir(), "original.json")
	original, _ := json.Marshal(uiStateFixture())
	if err := os.WriteFile(outside, original, 0o600); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, clientUIStateFile)
	if err := os.Symlink(outside, path); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadClientUIState(dir); err == nil {
		t.Fatal("read through symlink")
	}
	if err := saveClientUIState(dir, uiStateFixture()); err == nil {
		t.Fatal("replaced symlink")
	}
	after, _ := os.ReadFile(outside)
	if !bytes.Equal(after, original) {
		t.Fatal("changed symlink target")
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(path, 0o700); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadClientUIState(dir); err == nil {
		t.Fatal("read directory as state")
	}
	if err := saveClientUIState(dir, uiStateFixture()); err == nil {
		t.Fatal("replaced directory")
	}
	linkedDir := filepath.Join(t.TempDir(), "client")
	if err := os.Symlink(dir, linkedDir); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadClientUIState(linkedDir); err == nil {
		t.Fatal("accepted linked client state directory")
	}
}

func TestClientUIStateRejectsNonPrivateAndOversizedFiles(t *testing.T) {
	dir := uiStateTestDir(t)
	path := filepath.Join(dir, clientUIStateFile)
	data, _ := json.Marshal(uiStateFixture())
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" {
		if err := os.Chmod(path, 0o644); err != nil {
			t.Fatal(err)
		}
		if _, err := LoadClientUIState(dir); err == nil {
			t.Fatal("read public state file")
		}
		if err := os.Chmod(path, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	file, err := os.OpenFile(path, os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	if err := file.Truncate(maxClientUIState + 1); err != nil {
		t.Fatal(err)
	}
	file.Close()
	if _, err := LoadClientUIState(dir); err == nil {
		t.Fatal("read oversized state file")
	}
}

func TestClientUIStateReadersAlwaysSeeACompleteSnapshot(t *testing.T) {
	dir := uiStateTestDir(t)
	state := uiStateFixture()
	if err := saveClientUIState(dir, state); err != nil {
		t.Fatal(err)
	}
	errors := make(chan error, 1)
	go func() {
		for range 20 {
			if _, err := LoadClientUIState(dir); err != nil {
				errors <- err
				return
			}
		}
		errors <- nil
	}()
	for n := range 20 {
		state.Storage["berth.ui"] = strings.Repeat("theme", n+1)
		if err := saveClientUIState(dir, state); err != nil {
			t.Fatal(err)
		}
	}
	if err := <-errors; err != nil {
		t.Fatalf("reader saw an incomplete snapshot: %v", err)
	}
}
