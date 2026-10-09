package box

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/agentpath"
	"github.com/MylesMCook/burf/internal/events"
	"github.com/MylesMCook/burf/internal/hooks"
	"github.com/MylesMCook/burf/internal/identity"
	"github.com/MylesMCook/burf/internal/localchat"
	"github.com/MylesMCook/burf/internal/pairing"
	"github.com/MylesMCook/burf/internal/trust"
	"github.com/MylesMCook/burf/internal/wire"
)

func chatFixture(t *testing.T, actions ...*atomic.Int32) (*Box, http.Handler, *atomic.Int32) {
	t.Helper()
	dir := t.TempDir()
	bin := t.TempDir()
	if err := os.WriteFile(filepath.Join(bin, "codex"), []byte("#!/bin/sh\nprintf '%s' --listen\n"), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("CODEX_HOME", t.TempDir())
	b := &Box{Locations: NewLocations(filepath.Join(dir, "locations.json")), Events: &events.Bus{}}
	if _, err := b.Locations.Add(context.Background(), "project", t.TempDir()); err != nil {
		t.Fatal(err)
	}
	var launches atomic.Int32
	b.Chats = localchat.New("", func(opts localchat.LaunchOptions) (localchat.Process, error) {
		launches.Add(1)
		client, server := net.Pipe()
		go func() {
			defer server.Close()
			scan := bufio.NewScanner(server)
			for scan.Scan() {
				var p struct {
					ID     json.RawMessage
					Method string
					Params json.RawMessage
				}
				_ = json.Unmarshal(scan.Bytes(), &p)
				if p.Method != "initialize" && p.Method != "initialized" && p.Method != "thread/start" {
					for _, n := range actions {
						n.Add(1)
					}
				}
				result := any(map[string]any{})
				switch p.Method {
				case "initialized":
					continue
				case "thread/start":
					var params map[string]any
					_ = json.Unmarshal(p.Params, &params)
					if params["sandbox"] != "read-only" || params["approvalPolicy"] != "untrusted" {
						t.Error("unsafe permissions", params)
					}
					result = map[string]any{"thread": map[string]string{"id": "owned-thread"}}
				case "turn/start":
					result = map[string]any{"turn": map[string]string{"id": "owned-turn"}}
				case "model/list":
					result = map[string]any{"data": []any{map[string]any{"model": "synthetic", "displayName": "Synthetic"}}}
				}
				if len(p.ID) > 0 {
					data, _ := json.Marshal(map[string]any{"id": p.ID, "result": result})
					_, _ = server.Write(append(data, '\n'))
				}
			}
		}()
		return client, nil
	})
	t.Cleanup(b.CloseChats)
	mux := http.NewServeMux()
	b.mountChats(func(pattern string, h func(http.ResponseWriter, *http.Request) error) {
		mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
			if err := h(w, r); err != nil {
				writeErr(w, err)
			}
		})
	})
	return b, mux, &launches
}

func chatRequest(h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(method, path, strings.NewReader(body)))
	return w
}

func TestChatRoutesOwnSessionAndLocation(t *testing.T) {
	b, h, count := chatFixture(t)
	w := chatRequest(h, "POST", "/v1/chats", `{"location":"project"}`)
	var s Chat
	_ = json.Unmarshal(w.Body.Bytes(), &s)
	if w.Code != 201 || s.Location != "project" || s.ThreadID != "owned-thread" || count.Load() != 1 {
		t.Fatalf("start: %d %s", w.Code, w.Body)
	}
	if got := w.Result().Header.Get("Content-Type"); got != "application/json" {
		t.Fatalf("chat content type: %q", got)
	}
	for _, path := range []string{"/v1/chats", "/v1/chats/" + s.ID} {
		w = chatRequest(h, "GET", path, "")
		if w.Code != 200 || !strings.Contains(w.Body.String(), s.ID) {
			t.Fatalf("get: %d %s", w.Code, w.Body)
		}
	}
	if err := b.beginChatUpgrade(); err == nil {
		t.Fatal("allowed daemon replacement with active chat")
	}
	w = chatRequest(h, "POST", "/v1/chats/"+s.ID+"/messages", `{"text":"hello"}`)
	if w.Code != 200 {
		t.Fatal(w.Body)
	}
	w = chatRequest(h, "POST", "/v1/chats/"+s.ID+"/approvals", `{"id":"unknown","decision":"accept"}`)
	if w.Code != 409 {
		t.Fatalf("unknown approval: %d", w.Code)
	}
	w = chatRequest(h, "POST", "/v1/chats/"+s.ID+"/interrupt", "")
	if w.Code != 200 {
		t.Fatal(w.Body)
	}
	w = chatRequest(h, "DELETE", "/v1/chats/"+s.ID, "")
	if w.Code != 200 {
		t.Fatal(w.Body)
	}
	if err := b.beginChatUpgrade(); err != nil {
		t.Fatal(err)
	}
	w = chatRequest(h, "POST", "/v1/chats", `{"location":"project"}`)
	if w.Code != 409 {
		t.Fatalf("start during update: %d", w.Code)
	}
	b.endChatUpgrade()
	w = chatRequest(h, "POST", "/v1/chats", `{"location":"project"}`)
	if w.Code != 201 {
		t.Fatalf("failed update permanently closed registry: %s", w.Body)
	}
}

func TestChatRejectsUnregisteredAndCustomInputs(t *testing.T) {
	b, h, count := chatFixture(t)
	for _, body := range []string{`{"location":"/tmp"}`, `{"location":"project/../other"}`, `{"location":"project/"}`, `{"location":"project","cwd":"/tmp"}`, `{"location":"project","program":"sh"}`, `{"location":"project","agent":"unknown"}`, `{"location":"project"}{}`} {
		if w := chatRequest(h, "POST", "/v1/chats", body); w.Code != 400 {
			t.Fatalf("%s: %d", body, w.Code)
		}
	}
	if err := b.Locations.SetLocalConfig("project", RepoConfig{Agents: []AgentPreset{{ID: "codex", Command: "codex --dangerously-bypass-approvals-and-sandbox"}}}); err != nil {
		t.Fatal(err)
	}
	if w := chatRequest(h, "POST", "/v1/chats", `{"location":"project"}`); w.Code != 400 {
		t.Fatalf("custom command: %d", w.Code)
	}
	if count.Load() != 0 {
		t.Fatal("invalid request launched a provider")
	}
}

func TestChatResolvesProjectAccountAndFailsClosed(t *testing.T) {
	b, _, _ := chatFixture(t)
	b.EnvFile = filepath.Join(t.TempDir(), "env.json")
	boxHome, projectHome := t.TempDir(), t.TempDir()
	if err := saveBoxEnv(b.EnvFile, BoxEnv{Env: map[string]string{"CODEX_HOME": boxHome}}); err != nil {
		t.Fatal(err)
	}
	if err := b.Locations.SetLocalConfig("project", RepoConfig{Env: map[string]string{"CODEX_HOME": projectHome}}); err != nil {
		t.Fatal(err)
	}
	o, err := b.chatOptions(context.Background(), "project")
	if err != nil {
		t.Fatal(err)
	}
	seen := 0
	for _, kv := range o.Env {
		if strings.HasPrefix(kv, "CODEX_HOME=") {
			seen++
			if kv != "CODEX_HOME="+projectHome {
				t.Fatal("wrong account", kv)
			}
		}
	}
	if seen != 1 {
		t.Fatalf("account environment count: %d", seen)
	}
	if err := os.WriteFile(b.EnvFile, []byte("broken"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := b.chatOptions(context.Background(), "project"); err == nil {
		t.Fatal("corrupt box config silently fell back")
	}
	if err := saveBoxEnv(b.EnvFile, BoxEnv{}); err != nil {
		t.Fatal(err)
	}
	if err := b.Locations.SetLocalConfig("project", RepoConfig{Env: map[string]string{"CODEX_HOME": "missing-relative-account"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := b.chatOptions(context.Background(), "project"); err == nil {
		t.Fatal("invalid account silently fell back")
	}
	if err := b.Locations.SetLocalConfig("project", RepoConfig{Env: map[string]string{"CODEX_HOME": "env://BURF_TEST_MISSING_CHAT_ACCOUNT"}}); err != nil {
		t.Fatal(err)
	}
	t.Setenv("BURF_TEST_MISSING_CHAT_ACCOUNT", "")
	if _, err := b.chatOptions(context.Background(), "project"); err == nil {
		t.Fatal("missing secret silently fell back")
	}
	if err := b.Locations.SetLocalConfig("project", RepoConfig{}); err != nil {
		t.Fatal(err)
	}
	loc, err := b.Locations.Get(context.Background(), "project")
	if err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(loc.Path, RepoConfigFile)
	if err := os.MkdirAll(filepath.Dir(file), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(file, []byte("broken"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := b.chatOptions(context.Background(), "project"); err == nil {
		t.Fatal("corrupt project config silently fell back")
	}
}

func TestChatStartingProcessPreventsUpgradeRace(t *testing.T) {
	b, h, _ := chatFixture(t)
	entered, release := make(chan struct{}), make(chan struct{})
	b.Chats = localchat.New("", func(localchat.LaunchOptions) (localchat.Process, error) {
		close(entered)
		<-release
		return nil, errors.New("synthetic launch failed")
	})
	done := make(chan *httptest.ResponseRecorder, 1)
	go func() { done <- chatRequest(h, "POST", "/v1/chats", `{"location":"project"}`) }()
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		close(release)
		t.Fatal("start never reached runtime")
	}
	if err := b.beginChatUpgrade(); err == nil {
		close(release)
		t.Fatal("upgrade raced starting runtime")
	}
	close(release)
	select {
	case w := <-done:
		if w.Code != 409 {
			t.Fatalf("start result %d", w.Code)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("start did not return")
	}
	if err := b.beginChatUpgrade(); err != nil {
		t.Fatalf("failed start retained upgrade lock: %v", err)
	}
	b.endChatUpgrade()
}

func TestChatUnavailableRuntimeIsExplicit(t *testing.T) {
	b, h, _ := chatFixture(t)
	if caps := strings.Join(b.Capabilities(), " "); !strings.Contains(caps, "chat.codex") || !strings.Contains(caps, "chat.options") || !strings.Contains(caps, "chat.full-access") {
		t.Fatal("available chat runtime not advertised", caps)
	}
	b.Chats.Close()
	b.Chats = nil
	if w := chatRequest(h, "GET", "/v1/chats", ""); w.Code != 501 {
		t.Fatalf("unavailable runtime: %d", w.Code)
	}
	for _, cap := range b.Capabilities() {
		if strings.HasPrefix(cap, "chat.") {
			t.Fatal("advertised unavailable chat runtime")
		}
	}
}

func TestChatFailedHandshakeRetainsLocationForRefresh(t *testing.T) {
	b, h, _ := chatFixture(t)
	b.Chats = localchat.New("", func(localchat.LaunchOptions) (localchat.Process, error) {
		client, server := net.Pipe()
		go func() {
			defer server.Close()
			var p struct{ ID json.RawMessage }
			_ = json.NewDecoder(server).Decode(&p)
			_ = json.NewEncoder(server).Encode(map[string]any{"id": p.ID, "error": map[string]any{"code": -1, "message": "synthetic refusal"}})
		}()
		return client, nil
	})
	if w := chatRequest(h, "POST", "/v1/chats", `{"location":"project"}`); w.Code != 409 {
		t.Fatalf("start: %d %s", w.Code, w.Body)
	}
	w := chatRequest(h, "GET", "/v1/chats", "")
	var out struct {
		Chats []Chat `json:"chats"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	if len(out.Chats) != 1 || out.Chats[0].Location != "project" || out.Chats[0].State != "exited" {
		t.Fatalf("failed chat disappeared from project: %s", w.Body)
	}
}

func TestChatUnsupportedCodexFailsOwnedHandshake(t *testing.T) {
	b, h, _ := chatFixture(t)
	b.Chats.Close()
	b.Chats = localchat.New("", localchat.StartProcess)
	bin := t.TempDir()
	if err := os.WriteFile(filepath.Join(bin, "codex"), []byte("#!/bin/sh\necho old-version\n"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := b.Locations.SetLocalConfig("project", RepoConfig{Env: map[string]string{"PATH": bin}}); err != nil {
		t.Fatal(err)
	}
	w := chatRequest(h, "POST", "/v1/chats", `{"location":"project"}`)
	if w.Code != 409 {
		t.Fatalf("unsupported Codex: %d %s", w.Code, w.Body)
	}
	for _, chat := range b.Chats.List() {
		if chat.State != "exited" {
			t.Fatal("unsupported CLI left running", chat.State)
		}
	}
}

func TestChatStartGatePrecedesProviderProbeAndSecretResolution(t *testing.T) {
	for _, on := range []string{"before:*", "before:session.start"} {
		t.Run(on, func(t *testing.T) {
			b, h, count := chatFixture(t)
			dir := t.TempDir()
			probe := filepath.Join(dir, "probe-called")
			program := filepath.Join(dir, "codex")
			if err := os.WriteFile(program, []byte("#!/bin/sh\ntouch '"+probe+"'\nprintf '%s' --listen\n"), 0700); err != nil {
				t.Fatal(err)
			}
			op, calls := stubOpFile(t)
			b.Secrets = &Secrets{Op: op}
			if err := b.Locations.SetLocalConfig("project", RepoConfig{Env: map[string]string{"PATH": dir + ":" + os.Getenv("PATH"), "TEST_SECRET": "op://dev/db/password"}}); err != nil {
				t.Fatal(err)
			}
			cfg := filepath.Join(dir, "hooks.json")
			body, _ := json.Marshal(map[string]any{"hooks": []hooks.Hook{{On: on, Run: "echo launch denied; exit 1"}}})
			if err := os.WriteFile(cfg, body, 0600); err != nil {
				t.Fatal(err)
			}
			b.Hooks = &hooks.Runner{Path: cfg}
			w := chatRequest(h, "POST", "/v1/chats", `{"location":"project"}`)
			if w.Code != 403 || !strings.Contains(w.Body.String(), "launch denied") {
				t.Errorf("gate: %d %s", w.Code, w.Body)
			}
			if _, err := os.Stat(probe); !os.IsNotExist(err) {
				t.Error("vetoed start ran the Codex capability probe")
			}
			if n := opCalls(t, calls); n != 0 {
				t.Errorf("vetoed start resolved secrets %d times", n)
			}
			if count.Load() != 0 {
				t.Error("vetoed start launched the provider runtime")
			}
		})
	}
}

func TestChatMutationGatesPrecedeProviderActions(t *testing.T) {
	for _, scope := range []string{"box", "project"} {
		t.Run(scope, func(t *testing.T) {
			var actions atomic.Int32
			b, h, _ := chatFixture(t, &actions)
			w := chatRequest(h, "POST", "/v1/chats", `{"location":"project"}`)
			var s Chat
			_ = json.Unmarshal(w.Body.Bytes(), &s)
			if w.Code != 201 {
				t.Fatal(w.Body)
			}
			metadata := filepath.Join(t.TempDir(), "event.json")
			run := "cat > '" + metadata + "'; echo action denied; exit 1"
			gates := []hooks.Hook{{On: "before:session.send", Run: run}, {On: "before:session.stop", Run: run}}
			if scope == "box" {
				cfg := filepath.Join(t.TempDir(), "hooks.json")
				data, _ := json.Marshal(hooks.Config{Hooks: gates})
				if err := os.WriteFile(cfg, data, 0600); err != nil {
					t.Fatal(err)
				}
				b.Hooks = &hooks.Runner{Path: cfg}
			} else if err := b.Locations.SetLocalConfig("project", RepoConfig{Hooks: gates}); err != nil {
				t.Fatal(err)
			}
			for _, tc := range []struct{ method, suffix, body, event string }{
				{"POST", "/messages", `{"text":"private synthetic prompt"}`, "session.send"},
				{"POST", "/interrupt", "", "session.send"},
				{"POST", "/approvals", `{"id":"unknown","decision":"accept"}`, "session.send"},
				{"DELETE", "", "", "session.stop"},
			} {
				w = chatRequest(h, tc.method, "/v1/chats/"+s.ID+tc.suffix, tc.body)
				if w.Code != 403 || !strings.Contains(w.Body.String(), "action denied") {
					t.Errorf("%s: %d %s", tc.suffix, w.Code, w.Body)
				}
				data, err := os.ReadFile(metadata)
				if err != nil {
					t.Errorf("gate metadata absent: %v", err)
					continue
				}
				var e events.Event
				_ = json.Unmarshal(data, &e)
				if e.Type != tc.event || e.Data["location"] != "project" || e.Data["path"] != s.CWD {
					t.Errorf("incorrect gate scope: %+v", e)
				}
				if bytes.Contains(data, []byte("private synthetic prompt")) || e.Data["env"] != nil {
					t.Error("gate metadata leaked chat content or environment")
				}
				current, err := b.Chats.Get(s.ID)
				if err != nil || current.State != "idle" || len(current.Items) != 0 {
					t.Errorf("veto changed owned chat: %+v %v", current, err)
				}
			}
			if actions.Load() != 0 {
				t.Errorf("vetoed requests reached provider %d times", actions.Load())
			}
			b.CloseChats()
			ended, err := b.Chats.Get(s.ID)
			if err != nil || ended.State != "exited" {
				t.Fatalf("lifecycle cleanup was vetoed: %+v %v", ended, err)
			}
		})
	}
}

func TestChatUpgradeGuardProtectsStartingAndFailedInstall(t *testing.T) {
	b, h, _ := chatFixture(t)
	b.chatState.starting = 1
	if err := b.beginChatUpgrade(); err == nil {
		t.Fatal("upgrade ignored starting chat")
	}
	b.chatState.starting = 0
	exe := filepath.Join(t.TempDir(), "burfd")
	old := []byte("old")
	_ = os.WriteFile(exe, old, 0700)
	b.Update = &SelfUpdate{Executable: exe, Fingerprint: "test"}
	r := httptest.NewRequest("POST", "/v1/upgrade", bytes.NewBufferString("invalid executable"))
	if err := b.handleUpgrade(httptest.NewRecorder(), r); err == nil {
		t.Fatal("invalid build accepted")
	}
	got, _ := os.ReadFile(exe)
	if !bytes.Equal(got, old) {
		t.Fatal("failed upgrade changed executable")
	}
	if w := chatRequest(h, "POST", "/v1/chats", `{"location":"project"}`); w.Code != 201 {
		t.Fatal("failed upgrade blocked chat", w.Body)
	}
	if err := b.handleUpgrade(httptest.NewRecorder(), httptest.NewRequest("POST", "/v1/upgrade", bytes.NewBuffer(daemonScript("test")))); err == nil {
		t.Fatal("upgrade replaced daemon with active chat")
	}
	got, _ = os.ReadFile(exe)
	if !bytes.Equal(got, old) {
		t.Fatal("active chat did not protect executable")
	}
	b.CloseChats()
	for _, s := range b.Chats.List() {
		if s.State != "exited" {
			t.Fatal("shutdown left chat running")
		}
	}
}

func TestChatRoutesUsePairedWireServer(t *testing.T) {
	b, _, _ := chatFixture(t)
	c, _ := servedBox(t, func(dst *Box) { dst.Chats = b.Chats; dst.Locations = b.Locations })
	var out struct {
		Chats []Chat `json:"chats"`
	}
	if status := call(t, c, "GET", "/v1/chats", "", nil, &out); status != 200 {
		t.Fatalf("paired route: %d", status)
	}
	resp, err := c.Do(context.Background(), "POST", "/v1/chats", strings.NewReader(`{"location":"project"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 201 {
		t.Fatalf("paired start: %d %s", resp.StatusCode, body)
	}
}

func TestChatRoutesRejectUnpairedClients(t *testing.T) {
	b, _, count := chatFixture(t)
	dir := t.TempDir()
	id, err := identity.LoadOrCreate(filepath.Join(dir, "box.pem"))
	if err != nil {
		t.Fatal(err)
	}
	srv := &wire.Server{Identity: id, Clients: trust.NewStore(filepath.Join(dir, "clients.json")), Pending: pairing.NewPending(filepath.Join(dir, "pending.json"))}
	b.Mount(srv)
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go srv.Serve(ctx, ln)
	other, err := identity.LoadOrCreate(filepath.Join(dir, "other.pem"))
	if err != nil {
		t.Fatal(err)
	}
	c := wire.NewClient(other, trust.Peer{Name: "test", Address: ln.Addr().String(), Fingerprint: id.Fingerprint()})
	defer c.Reset()
	for _, method := range []string{"GET", "POST"} {
		resp, err := c.Do(context.Background(), method, "/v1/chats", strings.NewReader(`{"location":"project"}`))
		if err != nil && !errors.Is(err, wire.ErrUntrusted) {
			t.Fatalf("unpaired %s failed for unrelated reason: %v", method, err)
		}
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode != http.StatusUnauthorized && resp.StatusCode != http.StatusForbidden {
				t.Fatalf("unpaired %s: %d", method, resp.StatusCode)
			}
		}
	}
	if count.Load() != 0 {
		t.Fatal("unpaired client launched provider")
	}
}

func TestChatModelsAreListedForALocationWithoutStartingAChat(t *testing.T) {
	b, h, launches := chatFixture(t)
	w := chatRequest(h, "GET", "/v1/chats/models?location=project", "")
	var models []localchat.Model
	if err := json.Unmarshal(w.Body.Bytes(), &models); w.Code != 200 || err != nil || len(models) != 1 || models[0].Model != "synthetic" {
		t.Fatalf("models: %d %s", w.Code, w.Body)
	}
	if len(b.Chats.List()) != 0 || launches.Load() != 1 {
		t.Fatal("listing models opened a chat", launches.Load())
	}
	if w := chatRequest(h, "GET", "/v1/chats/models?location=unregistered", ""); w.Code != 400 {
		t.Fatalf("unregistered location: %d %s", w.Code, w.Body)
	}
	if w := chatRequest(h, "GET", "/v1/chats/models", ""); w.Code != 400 {
		t.Fatalf("missing location: %d %s", w.Code, w.Body)
	}
}

// A Codex installed with npm under a version manager is on no service's
// PATH. A terminal session finds it through the person's shell; a chat
// starts the same one, with the PATH it was found with so it finds node.
func TestChatFindsCodexWhereATerminalSessionWould(t *testing.T) {
	b, _, _ := chatFixture(t)
	npm := t.TempDir()
	codex := filepath.Join(npm, "codex")
	if err := os.WriteFile(codex, []byte("#!/bin/sh\n"), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", "/usr/bin:/bin")
	t.Setenv("HOME", t.TempDir())
	installed := true
	old := agentFinder
	t.Cleanup(func() { agentFinder = old })
	finder := &agentpath.Finder{Home: t.TempDir(), NoCache: true, NoVersion: true, NoNPM: true, SystemDirs: []string{}, LookPath: func(name string) (string, error) {
		if installed && name == "codex" {
			return codex, nil
		}
		return "", os.ErrNotExist
	}}
	agentFinder = func() *agentpath.Finder { return finder }
	o, err := b.chatOptions(context.Background(), "project")
	if err != nil {
		t.Fatal(err)
	}
	if o.Program != codex {
		t.Fatalf("program %q, want %q", o.Program, codex)
	}
	path := ""
	for _, kv := range o.Env {
		if v, ok := strings.CutPrefix(kv, "PATH="); ok {
			path = v
		}
	}
	if dirs := filepath.SplitList(path); len(dirs) < 3 || dirs[0] != npm || !strings.HasSuffix(path, "/usr/bin:/bin") {
		t.Fatalf("PATH %q: want the install's folder first, then the project's own", path)
	}
	installed = false
	if _, err := b.chatOptions(context.Background(), "project"); err == nil || !strings.Contains(err.Error(), "not installed") {
		t.Fatalf("no Codex anywhere: %v", err)
	}
}
