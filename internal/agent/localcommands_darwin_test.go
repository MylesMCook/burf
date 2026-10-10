package agent

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/MylesMCook/burf/internal/agentpath"
	"github.com/MylesMCook/burf/internal/identity"
	"github.com/MylesMCook/burf/internal/localagent"
	"github.com/MylesMCook/burf/internal/localchat"
	"github.com/MylesMCook/burf/internal/localhistory"
)

func TestDarwinLocalCommandsUseInstalledPathsAndVerifiedCapabilities(t *testing.T) {
	dir := t.TempDir()
	paths := make(map[string]string)
	for _, id := range []string{"claude", "codex"} {
		paths[id] = filepath.Join(dir, id)
		if err := os.WriteFile(paths[id], []byte("synthetic executable"), 0700); err != nil {
			t.Fatal(err)
		}
	}
	launchPATH := filepath.Join(dir, "node") + ":/usr/bin"
	commands := localDarwinCommands(func(id string) (agentpath.Found, bool) {
		return agentpath.Found{Path: paths[id], PATH: launchPATH}, true
	}, func(found agentpath.Found, args ...string) string {
		if found.PATH != launchPATH {
			t.Error("CLI discovery discarded its launch PATH")
		}
		if found.Path == paths["claude"] {
			return "--print --input-format --output-format stream-json --verbose --permission-prompt-tool --permission-mode manual acceptEdits bypassPermissions plan --allow-dangerously-skip-permissions --model --resume --mcp-config --fork-session"
		}
		switch strings.Join(args, " ") {
		case "--help":
			return "--no-daemon"
		case "fork --help":
			return "fork [SESSION_ID]"
		case "app-server --help":
			return "--listen"
		default:
			t.Errorf("unexpected capability probe: %q", args)
			return ""
		}
	})
	for id, path := range paths {
		got := commands[id]
		if got.Program != path || got.PATH != launchPATH || !got.CanChat || !got.CanFork {
			t.Fatalf("%s: %+v", id, got)
		}
	}
	if !reflect.DeepEqual(commands["codex"].Args, []string{"--no-daemon"}) || len(commands["claude"].Args) != 0 {
		t.Fatal("terminal compatibility arguments changed")
	}
}

func TestDarwinLocalCommandsDoNotProbeInvalidExecutables(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "non-executable")
	if err := os.WriteFile(file, []byte("fixture"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"relative", dir, file, filepath.Join(dir, "missing")} {
		commands := localDarwinCommands(func(string) (agentpath.Found, bool) {
			return agentpath.Found{Path: path}, true
		}, func(agentpath.Found, ...string) string {
			t.Fatal("probed an invalid executable")
			return ""
		})
		if len(commands) != 0 {
			t.Fatal("invalid executable advertised", path)
		}
	}
}

func TestDarwinLegacyCLIStaysInstalledWithoutClaimingMessageSupport(t *testing.T) {
	path := filepath.Join(t.TempDir(), "legacy")
	if err := os.WriteFile(path, []byte("fixture"), 0700); err != nil {
		t.Fatal(err)
	}
	commands := localDarwinCommands(func(string) (agentpath.Found, bool) {
		return agentpath.Found{Path: path}, true
	}, func(agentpath.Found, ...string) string { return "fork [SESSION_ID] --resume --fork-session" })
	for id, command := range commands {
		if command.Program != path || command.CanChat || command.CanFork {
			t.Fatalf("legacy %s advertised unsupported message continuation: %+v", id, command)
		}
	}
}

func TestDarwinLocalLaunchKeepsAccountEnvironment(t *testing.T) {
	env := []string{"CODEX_HOME=/synthetic/codex", "CLAUDE_CONFIG_DIR=/synthetic/claude", "HOME=/synthetic/home", "PATH=/old", "PATH=/duplicate", "OTHER=value"}
	original := append([]string(nil), env...)
	got := withLocalPATH(env, "/synthetic/node:/usr/bin")
	want := []string{"CODEX_HOME=/synthetic/codex", "CLAUDE_CONFIG_DIR=/synthetic/claude", "HOME=/synthetic/home", "OTHER=value", "PATH=/synthetic/node:/usr/bin"}
	if !reflect.DeepEqual(got, want) || !reflect.DeepEqual(env, original) {
		t.Fatal("launch environment was changed outside PATH")
	}
}

func TestDarwinLocalHelpExecutesOnlyResolvedCLIWithItsPATH(t *testing.T) {
	path := filepath.Join(t.TempDir(), "synthetic-cli")
	if err := os.WriteFile(path, []byte("#!/bin/sh\nprintf '%s %s' \"$PATH\" \"$*\"\n"), 0700); err != nil {
		t.Fatal(err)
	}
	got := localDarwinHelp(agentpath.Found{Path: path, PATH: "/synthetic/node:/usr/bin"}, "app-server", "--help")
	if got != "/synthetic/node:/usr/bin app-server --help" {
		t.Fatal("resolved CLI did not receive its own PATH and exact arguments")
	}
}

func TestDarwinLocalMessagesRequireAnOrdinaryMatchingAccount(t *testing.T) {
	for _, tc := range []struct {
		uid, effective int
		allowed        bool
	}{{501, 501, true}, {0, 0, false}, {501, 0, false}, {501, 502, false}} {
		if got := localDarwinAccount(tc.uid, tc.effective); got != tc.allowed {
			t.Fatalf("account %d/%d: %v", tc.uid, tc.effective, got)
		}
	}
	if localTerminalSupported() {
		t.Fatal("macOS must not advertise the Windows-only local terminal")
	}
}

func TestDarwinLocalMessagesRunInClientWithoutABox(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("CODEX_HOME", dir)
	const launchPATH = "/synthetic/node:/usr/bin"
	a := &Agent{ctx: context.Background()}
	var err error
	a.id, err = identity.LoadOrCreate(filepath.Join(t.TempDir(), "synthetic-identity.pem"))
	if err != nil {
		t.Fatal(err)
	}
	a.localClient.once.Do(func() {
		a.localClient.commands = map[string]localagent.Command{"codex": {Program: "synthetic", PATH: launchPATH, CanChat: true, CanFork: true}}
		a.localClient.manager = localagent.New(a.localClient.commands, nil)
		a.localClient.history = localhistory.New(localhistory.Config{CodexHome: dir, ClaudeHome: dir})
		a.localClient.chats = localchat.New("synthetic", func(options localchat.LaunchOptions) (localchat.Process, error) {
			if options.CWD != dir {
				t.Error("local message started outside selected folder")
			}
			if !strings.Contains(strings.Join(options.Env, "\n"), "PATH="+launchPATH) || !strings.Contains(strings.Join(options.Env, "\n"), "CODEX_HOME="+dir) {
				t.Error("local message lost its runtime PATH or account environment")
			}
			client, peer := net.Pipe()
			go func() {
				defer peer.Close()
				encoder := json.NewEncoder(peer)
				scanner := bufio.NewScanner(peer)
				for scanner.Scan() {
					var request struct {
						ID     json.RawMessage `json:"id"`
						Method string          `json:"method"`
					}
					_ = json.Unmarshal(scanner.Bytes(), &request)
					if len(request.ID) == 0 {
						continue
					}
					result := any(map[string]any{})
					if request.Method == "thread/start" {
						result = map[string]any{"thread": map[string]string{"id": "owned-local-thread"}}
					}
					_ = encoder.Encode(map[string]any{"id": request.ID, "result": result})
				}
			}()
			return client, nil
		})
	})
	t.Cleanup(a.localClient.chats.Close)
	handler := a.ui("local-synthetic-token", "127.0.0.1:1438", http.NotFoundHandler())
	call := func(method, path, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://localhost:1438"+path, strings.NewReader(body))
		r.Header.Set("Authorization", "Bearer local-synthetic-token")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	status := call("GET", "/v1/local", "")
	var computer struct {
		Supported   bool   `json:"supported"`
		Name        string `json:"name"`
		Home        string `json:"home"`
		ClientScope string `json:"client_scope"`
		Agents      []struct {
			ID          string `json:"id"`
			Available   bool   `json:"available"`
			CanChat     bool   `json:"can_chat"`
			CanTerminal bool   `json:"can_terminal"`
		} `json:"agents"`
		Sessions []localchat.Session `json:"sessions"`
	}
	if status.Code != 200 || json.Unmarshal(status.Body.Bytes(), &computer) != nil || !computer.Supported || computer.Name == "" || computer.Home == "" {
		t.Fatal("Mac client did not advertise its own identity", status.Code)
	}
	if computer.ClientScope != a.id.Fingerprint().String() {
		t.Fatal("local draft scope was not the public installation identity")
	}
	if len(computer.Agents) != 2 {
		t.Fatal("provider capabilities missing")
	}
	for _, capability := range computer.Agents {
		if capability.CanTerminal {
			t.Fatal("Mac advertised Windows terminals")
		}
		if capability.ID == "codex" && (!capability.Available || !capability.CanChat) {
			t.Fatal("installed message provider was not available")
		}
	}
	body, _ := json.Marshal(map[string]string{"cwd": dir})
	started := call("POST", "/v1/local/chats", string(body))
	var chat localchat.Session
	if started.Code != 201 || json.Unmarshal(started.Body.Bytes(), &chat) != nil || chat.ThreadID != "owned-local-thread" || chat.Mode != "chat" {
		t.Fatal("Mac did not open an owned local message session", started.Code, started.Body.String())
	}
	status = call("GET", "/v1/local", "")
	if json.Unmarshal(status.Body.Bytes(), &computer) != nil || len(computer.Sessions) != 1 || computer.Sessions[0].ID != chat.ID {
		t.Fatal("local message session was not recoverable from the client")
	}
	restart := http.NewServeMux()
	a.restartRoutes(restart, func() { t.Error("restart abandoned a local message session") })
	w := httptest.NewRecorder()
	restart.ServeHTTP(w, httptest.NewRequest("POST", "/v1/stop?drain=1", nil))
	if w.Code != http.StatusConflict {
		t.Fatal("Mac restart failed to guard its owned chat", w.Code)
	}
	if stopped := call("DELETE", "/v1/local/chats/"+chat.ID, ""); stopped.Code != 200 {
		t.Fatal("local chat could not stop", stopped.Code)
	}
	if a.boxes != nil {
		t.Fatal("local messaging created a paired box")
	}
}
