package nativefeedback

import (
	"bufio"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"
)

func runtimeFixture(t *testing.T) (*Runtime, string) {
	t.Helper()
	base, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	directory := filepath.Join(base, "feedback")
	r, err := NewRuntime(RuntimeConfig{Directory: directory, Origin: "wails://localhost"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = r.Close() })
	return r, directory
}

func descriptorFixture(t *testing.T, directory string) runtimeDescriptor {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(directory, "session.json"))
	if err != nil {
		t.Fatal(err)
	}
	var descriptor runtimeDescriptor
	if err := json.Unmarshal(data, &descriptor); err != nil {
		t.Fatal(err)
	}
	return descriptor
}

func runtimeRequest(t *testing.T, endpoint, token, origin, method, path, body string) *http.Response {
	t.Helper()
	request, err := http.NewRequest(method, endpoint+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	if origin != "" {
		request.Header.Set("Origin", origin)
	}
	response, err := (&http.Client{Timeout: 2 * time.Second}).Do(request)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = response.Body.Close() })
	return response
}

func decodeRuntimeObject(t *testing.T, response *http.Response, code int) map[string]any {
	t.Helper()
	defer response.Body.Close()
	var object map[string]any
	if err := json.NewDecoder(response.Body).Decode(&object); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != code {
		t.Fatalf("HTTP %d: %v", response.StatusCode, object)
	}
	return object
}

func TestRuntimeDormantEvenWithInjectedEnvironment(t *testing.T) {
	t.Setenv("WAILS_FEEDBACK", "1")
	t.Setenv("BURF_FEEDBACK_COMPANION", "http://127.0.0.1:4747")
	r, directory := runtimeFixture(t)
	if status := r.Status(); status.Enabled || status.Endpoint != "" || status.Generation != 0 || !status.Available {
		t.Fatalf("not dormant: %+v", status)
	}
	if _, err := r.Disable(); err != nil {
		t.Fatal(err)
	}
	if err := r.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Lstat(directory); !os.IsNotExist(err) {
		t.Fatalf("startup touched state: %v", err)
	}
	if _, err := r.Enable(); err == nil {
		t.Fatal("closed controller enabled")
	}
}

func TestRuntimeEnablePersistDisableReenable(t *testing.T) {
	r, directory := runtimeFixture(t)
	status, err := r.Enable()
	if err != nil {
		t.Fatal(err)
	}
	descriptor := descriptorFixture(t, directory)
	if !status.Enabled || status.Endpoint == "" || descriptor.Version != 1 || descriptor.Mode != "runtime" ||
		!descriptor.Enabled || descriptor.PID != os.Getpid() || len(descriptor.RunID) != 32 ||
		len(descriptor.Token) != 64 || descriptor.CompanionURL == "" || descriptor.UpdatedAt == "" {
		t.Fatal("runtime was published before ready")
	}
	encoded, _ := json.Marshal(status)
	if strings.Contains(string(encoded), descriptor.Token) || strings.Contains(string(encoded), descriptor.CompanionURL) {
		t.Fatal("status exposed private backend credential")
	}
	second, err := r.Enable()
	if err != nil || second != status {
		t.Fatal("enable was not idempotent")
	}
	response := runtimeRequest(t, status.Endpoint, "", "wails://localhost", "GET", "/health", "")
	decodeRuntimeObject(t, response, 200)
	session := decodeRuntimeObject(t, runtimeRequest(t, descriptor.CompanionURL, descriptor.Token, "", "POST", "/sessions",
		`{"url":"wails://localhost"}`), 201)
	id := session["id"].(string)
	annotation := decodeRuntimeObject(t, runtimeRequest(t, status.Endpoint, "", "wails://localhost", "POST",
		"/sessions/"+id+"/annotations", `{"x":1,"y":2,"timestamp":123,"comment":"synthetic","element":"button","elementPath":"button"}`), 201)
	annotationID := annotation["id"].(string)
	for _, trial := range []struct {
		endpoint, token, origin, method, path, body string
		code                                        int
	}{
		{descriptor.CompanionURL, "", "", "GET", "/health", "", 401},
		{descriptor.CompanionURL, descriptor.Token, "wails://localhost", "GET", "/health", "", 403},
		{status.Endpoint, "", "http://wails.localhost", "GET", "/health", "", 403},
		{status.Endpoint, "", "", "GET", "/health", "", 403},
		{status.Endpoint, "", "wails://localhost", "GET", "/sessions", "", 405},
		{status.Endpoint, "", "wails://localhost", "GET", "/pending", "", 404},
		{status.Endpoint, "", "wails://localhost", "POST", "/annotations/" + annotationID + "/thread", "{}", 404},
		{status.Endpoint, "", "wails://localhost", "PATCH", "/annotations/" + annotationID, `{"status":"resolved"}`, 400},
	} {
		response := runtimeRequest(t, trial.endpoint, trial.token, trial.origin, trial.method, trial.path, trial.body)
		_ = response.Body.Close()
		if response.StatusCode != trial.code {
			t.Fatalf("%s %s returned %d", trial.method, trial.path, response.StatusCode)
		}
	}
	stream := runtimeRequest(t, descriptor.CompanionURL, descriptor.Token, "", "GET", "/sessions/"+id+"/events?agent=true", "")
	if stream.StatusCode != 200 {
		t.Fatal("SSE did not start")
	}
	if _, err := bufio.NewReader(stream.Body).ReadString('\n'); err != nil {
		t.Fatal(err)
	}
	if disabled, err := r.Disable(); err != nil || disabled.Enabled || disabled.Endpoint != "" {
		t.Fatalf("disable: %+v %v", disabled, err)
	}
	streamClosed := time.Now()
	_, _ = io.ReadAll(stream.Body) // Both clean EOF and socket-close EOF revoke the stream.
	if time.Since(streamClosed) >= time.Second {
		t.Fatal("SSE survived disable until the client timeout")
	}
	assertRuntimeRevoked(t, descriptor.CompanionURL+"/health", status.Endpoint+"/health")
	withdrawn := descriptorFixture(t, directory)
	if withdrawn.Enabled || withdrawn.Token != "" || withdrawn.CompanionURL != "" {
		t.Fatal("disabled descriptor retained credentials")
	}
	next, err := r.Enable()
	if err != nil {
		t.Fatal(err)
	}
	nextDescriptor := descriptorFixture(t, directory)
	if next.Generation != 2 || next.Endpoint == status.Endpoint || nextDescriptor.Token == descriptor.Token || nextDescriptor.RunID == descriptor.RunID {
		t.Fatal("new generation reused a capability")
	}
	restored := decodeRuntimeObject(t, runtimeRequest(t, nextDescriptor.CompanionURL, nextDescriptor.Token, "", "GET", "/sessions/"+id, ""), 200)
	annotations := restored["annotations"].([]any)
	if len(annotations) != 1 || annotations[0].(map[string]any)["id"] != annotationID {
		t.Fatal("comments were not preserved")
	}
	if err := r.Close(); err != nil {
		t.Fatal(err)
	}
	fresh, err := NewRuntime(RuntimeConfig{Directory: directory, Origin: "wails://localhost"})
	if err != nil {
		t.Fatal(err)
	}
	defer fresh.Close()
	if fresh.Status().Enabled {
		t.Fatal("restart auto-enabled")
	}
	if _, err := fresh.Enable(); err != nil {
		t.Fatal("owner lock did not release:", err)
	}
}

func assertRuntimeRevoked(t *testing.T, endpoints ...string) {
	t.Helper()
	for _, endpoint := range endpoints {
		response, err := (&http.Client{Timeout: time.Second}).Get(endpoint)
		if err == nil {
			_ = response.Body.Close()
			t.Fatal("revoked endpoint still listening")
		}
	}
}

func TestRuntimeOwnerLockSurvivesDisable(t *testing.T) {
	r, directory := runtimeFixture(t)
	if _, err := r.Enable(); err != nil {
		t.Fatal(err)
	}
	other, err := NewRuntime(RuntimeConfig{Directory: directory, Origin: "wails://localhost"})
	if err != nil {
		t.Fatal(err)
	}
	defer other.Close()
	if _, err := other.Enable(); err == nil {
		t.Fatal("second owner acquired state")
	}
	if _, err := r.Disable(); err != nil {
		t.Fatal(err)
	}
	if _, err := other.Enable(); err == nil {
		t.Fatal("disabled owner lost lifetime lock")
	}
	if err := r.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := other.Enable(); err != nil {
		t.Fatal(err)
	}
}

func TestRuntimeConcurrentLifecycleAndPermanentClose(t *testing.T) {
	r, directory := runtimeFixture(t)
	var workers sync.WaitGroup
	for range 12 {
		workers.Go(func() {
			for range 4 {
				_, _ = r.Enable()
				_ = r.Status()
				_, _ = r.Disable()
			}
		})
	}
	workers.Go(func() { _ = r.Close() })
	workers.Wait()
	if status := r.Status(); status.Enabled || status.Endpoint != "" {
		t.Fatal("concurrent close left feedback enabled")
	}
	if _, err := r.Enable(); err == nil {
		t.Fatal("shutdown permitted recreation")
	}
	if descriptor, err := os.ReadFile(filepath.Join(directory, "session.json")); err == nil && strings.Contains(string(descriptor), `"enabled":true`) {
		t.Fatal("shutdown published enabled descriptor")
	}
}

func TestRuntimePrivatePathsAndDescriptorFailureRevocation(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Unix permission/symlink assertions; ACL helpers are compiled separately")
	}
	r, directory := runtimeFixture(t)
	if err := os.MkdirAll(directory, 0o755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(directory, "session.json")
	if err := os.WriteFile(path, []byte("existing"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Enable(); err == nil {
		t.Fatal("accepted exposed descriptor")
	}
	data, _ := os.ReadFile(path)
	if string(data) != "existing" {
		t.Fatal("unsafe recovery state overwritten")
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(filepath.Dir(directory), "outside")
	if err := os.WriteFile(outside, []byte("outside"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, path); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Enable(); err == nil {
		t.Fatal("accepted descriptor symlink")
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	status, err := r.Enable()
	if err != nil {
		t.Fatal(err)
	}
	descriptor := descriptorFixture(t, directory)
	for _, privatePath := range []string{directory, path, filepath.Join(directory, "runtime.lock")} {
		info, err := os.Stat(privatePath)
		if err != nil || info.Mode().Perm()&0o077 != 0 {
			t.Fatalf("not private: %s %v", privatePath, err)
		}
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(path, 0o700); err != nil {
		t.Fatal(err)
	}
	disabled, err := r.Disable()
	if err == nil || disabled.Enabled || disabled.Endpoint != "" || disabled.Error == "" {
		t.Fatal("descriptor failure not reported after revocation")
	}
	assertRuntimeRevoked(t, descriptor.CompanionURL+"/health", status.Endpoint+"/health")
}

func TestRuntimeRejectsSymlinkAncestorAndInvalidConfig(t *testing.T) {
	base, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, origin := range []string{"https://example.com", "wails://localhost:80", "http://wails.localhost:01425", "wails://localhost/", "wails://localhost?"} {
		if _, err := NewRuntime(RuntimeConfig{Directory: base, Origin: origin}); err == nil {
			t.Fatalf("accepted origin %s", origin)
		}
	}
	if _, err := NewRuntime(RuntimeConfig{Directory: "relative", Origin: "wails://localhost"}); err == nil {
		t.Fatal("accepted relative state")
	}
	if runtime.GOOS == "windows" {
		return
	}
	link := filepath.Join(base, "linked")
	if err := os.Symlink(base, link); err != nil {
		t.Fatal(err)
	}
	r, err := NewRuntime(RuntimeConfig{Directory: filepath.Join(link, "feedback"), Origin: "wails://localhost"})
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	if _, err := r.Enable(); err == nil {
		t.Fatal("accepted symlink ancestor")
	}
}
