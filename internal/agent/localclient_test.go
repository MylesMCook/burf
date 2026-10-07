package agent

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/sean-brydon/berthd/internal/localagent"
	"github.com/sean-brydon/berthd/internal/localhistory"
)

func TestLocalRoutesRequireAuthAndLoopback(t *testing.T) {
	a := &Agent{}
	h := a.ui("local-test-token", "127.0.0.1:1378", http.NotFoundHandler())
	for _, endpoint := range [][2]string{{"GET", "/v1/local"}, {"GET", "/v1/local/conversations"}, {"GET", "/v1/local/sessions/foreign/output"}, {"POST", "/v1/local/conversations/foreign/fork"}} {
		for _, tc := range []struct {
			host, token string
			status      int
		}{{"localhost:1378", "", 401}, {"localhost:1378", "bad", 401}, {"evil.example:1378", "local-test-token", 403}} {
			r := httptest.NewRequest(endpoint[0], "http://"+tc.host+endpoint[1], nil)
			r.Header.Set("Authorization", "Bearer "+tc.token)
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if w.Code != tc.status {
				t.Fatalf("%s: %d", endpoint[1], w.Code)
			}
		}
	}
}

func TestLocalContinuationAPI(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("native local API is Windows only")
	}
	dir := t.TempDir()
	const sourceID = "12345678-1234-4321-8123-123456789abc"
	path := filepath.Join(dir, "sessions", "2026", "10", "07", "rollout-test.jsonl")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	meta, _ := json.Marshal(map[string]any{"type": "session_meta", "payload": map[string]any{"id": sourceID, "cwd": dir, "source": "cli"}})
	if err := os.WriteFile(path, append(meta, '\n'), 0600); err != nil {
		t.Fatal(err)
	}
	original, _ := os.ReadFile(path)
	a := &Agent{ctx: context.Background()}
	calls := 0
	a.localClient.once.Do(func() {
		a.localClient.commands = map[string]localagent.Command{"codex": {Program: "synthetic.exe", CanFork: true}}
		a.localClient.history = localhistory.New(localhistory.Config{CodexHome: dir, ClaudeHome: dir})
		a.localClient.manager = localagent.New(a.localClient.commands, func(_ string, args []string, cwd string, _ []string, _, _ int) (localagent.Process, error) {
			calls++
			if !reflect.DeepEqual(args, []string{"fork", sourceID}) || cwd != dir {
				t.Fatalf("unexpected launch: %q %q", args, cwd)
			}
			r, w := io.Pipe()
			return &localTestProcess{r: r, w: w}, nil
		})
	})
	defer a.localClient.manager.Close()
	h := a.ui("local-test-token", "127.0.0.1:1378", http.NotFoundHandler())
	call := func(method, path string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://localhost:1378"+path, nil)
		r.Header.Set("Authorization", "Bearer local-test-token")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	if w := call("POST", "/v1/local/conversations/"+sourceID+"/fork"); w.Code != 404 {
		t.Fatal(w.Code)
	}
	w := call("GET", "/v1/local/conversations")
	var list []localhistory.Conversation
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil || len(list) != 1 {
		t.Fatal("history discovery", err)
	}
	endpoint := "/v1/local/conversations/" + list[0].ID + "/fork"
	for i := 0; i < 2; i++ {
		if w := call("POST", endpoint); w.Code != 201 {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	if calls != 1 {
		t.Fatal("duplicate continuation", calls)
	}
	after, _ := os.ReadFile(path)
	if string(original) != string(after) {
		t.Fatal("source history changed")
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if w := call("POST", endpoint); w.Code != 404 {
		t.Fatal("missing source accepted", w.Code)
	}
}

type localTestProcess struct {
	r    *io.PipeReader
	w    *io.PipeWriter
	once sync.Once
}

func (p *localTestProcess) Read(b []byte) (int, error)  { return p.r.Read(b) }
func (p *localTestProcess) Write(b []byte) (int, error) { return p.w.Write(b) }
func (p *localTestProcess) Resize(int, int) error       { return nil }
func (p *localTestProcess) Wait() error                 { return nil }
func (p *localTestProcess) Close() error                { p.once.Do(func() { p.w.Close() }); return nil }

func TestLocalClientAPI(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("native local API is Windows only")
	}
	dir := t.TempDir()
	a := &Agent{ctx: context.Background()}
	a.localClient.once.Do(func() {
		a.localClient.commands = map[string]localagent.Command{"codex": {Program: "synthetic.exe"}}
		a.localClient.history = localhistory.New(localhistory.Config{CodexHome: dir, ClaudeHome: dir})
		a.localClient.manager = localagent.New(a.localClient.commands, func(string, []string, string, []string, int, int) (localagent.Process, error) {
			r, w := io.Pipe()
			return &localTestProcess{r: r, w: w}, nil
		})
	})
	defer a.localClient.manager.Close()
	h := a.ui("local-test-token", "127.0.0.1:1378", http.NotFoundHandler())
	call := func(method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, "http://localhost:1378"+path, strings.NewReader(body))
		r.Header.Set("Authorization", "Bearer local-test-token")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	if w := call("GET", "/v1/local", ""); w.Code != 200 || !strings.Contains(w.Body.String(), `"supported":true`) {
		t.Fatal(w.Code, w.Body.String())
	}
	if w := call("GET", "/v1/local/conversations", ""); w.Code != 200 || strings.TrimSpace(w.Body.String()) != "[]" {
		t.Fatal(w.Code, w.Body.String())
	}
	if w := call("GET", "/v1/local/conversations/foreign", ""); w.Code != 404 {
		t.Fatal(w.Code)
	}
	if w := call("POST", "/v1/local/sessions", `{"agent":"shell","cwd":"relative"}`); w.Code != 400 {
		t.Fatal(w.Code)
	}
	body, _ := json.Marshal(map[string]string{"agent": "codex", "cwd": dir})
	w := call("POST", "/v1/local/sessions", string(body))
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var s localagent.Session
	if err := json.Unmarshal(w.Body.Bytes(), &s); err != nil {
		t.Fatal(err)
	}
	base := "/v1/local/sessions/" + s.ID
	restart := http.NewServeMux()
	a.restartRoutes(restart, func() { t.Error("restart killed local session") })
	restartResult := httptest.NewRecorder()
	restart.ServeHTTP(restartResult, httptest.NewRequest("POST", "http://agent/v1/stop?drain=1", nil))
	if restartResult.Code != http.StatusConflict {
		t.Fatalf("restart with local session: %d", restartResult.Code)
	}
	if w := call("POST", base+"/input", `{"data":"native echo"}`); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	deadline := time.Now().Add(time.Second)
	for {
		w = call("GET", base+"/output?after=0", "")
		var o localagent.Output
		_ = json.Unmarshal(w.Body.Bytes(), &o)
		b, _ := base64.StdEncoding.DecodeString(o.Data)
		if string(b) == "native echo" {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal(w.Body.String())
		}
		time.Sleep(time.Millisecond)
	}
	if w := call("POST", base+"/resize", `{"cols":120,"rows":40}`); w.Code != 200 {
		t.Fatal(w.Code)
	}
	if w := call("GET", base+"/output?after=-1", ""); w.Code != 400 {
		t.Fatal(w.Code)
	}
	if w := call("DELETE", "/v1/local/sessions/foreign", ""); w.Code != 404 {
		t.Fatal(w.Code)
	}
	if w := call("DELETE", base, ""); w.Code != 200 {
		t.Fatal(w.Code)
	}
}
