package box

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/MylesMCook/burf/internal/agentpath"
	"github.com/MylesMCook/burf/internal/localchat"
)

const claudeFixtureHelp = `-p, --print --input-format stream-json --output-format stream-json --verbose
--permission-prompt-tool --permission-mode manual acceptEdits bypassPermissions plan
--allow-dangerously-skip-permissions --resume --mcp-config
  --model <model> alias 'sonnet' or 'opus'
  --next-option`

func init() {
	if os.Getenv("BURF_BOX_SYNTHETIC_CLAUDE") != "1" || len(os.Args) < 2 {
		return
	}
	if os.Args[1] == "--help" {
		if os.Getenv("BURF_BOX_CLAUDE_UNSUPPORTED") == "1" {
			fmt.Println("Old Claude CLI")
		} else {
			fmt.Println(claudeFixtureHelp)
		}
		os.Exit(0)
	}
	if os.Args[1] != "-p" {
		return
	}
	enc := json.NewEncoder(os.Stdout)
	_ = enc.Encode(map[string]any{"type": "system", "subtype": "init", "session_id": "claude-owned", "model": "synthetic"})
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		var line struct {
			Type string `json:"type"`
		}
		_ = json.Unmarshal(scanner.Bytes(), &line)
		if line.Type == "user" {
			_ = enc.Encode(map[string]any{"type": "assistant", "session_id": "claude-owned", "message": map[string]any{"content": []any{map[string]any{"type": "text", "text": "synthetic answer"}}}})
			_ = enc.Encode(map[string]any{"type": "result", "subtype": "success", "session_id": "claude-owned"})
		}
	}
	os.Exit(0)
}

func installSyntheticClaude(t *testing.T) string {
	t.Helper()
	t.Setenv("BURF_BOX_SYNTHETIC_CLAUDE", "1")
	t.Setenv("CLAUDE_CONFIG_DIR", t.TempDir())
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	bin := t.TempDir()
	target := filepath.Join(bin, "claude")
	if err := os.Symlink(exe, target); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	return target
}

func TestClaudeChatRoutesShareRegistryAndUpgradeGuard(t *testing.T) {
	b, h, _ := chatFixture(t)
	installSyntheticClaude(t)
	b.Chats = localchat.New("", localchat.StartProcess)
	w := chatRequest(h, "POST", "/v1/chats", `{"location":"project","agent":"claude"}`)
	if w.Code != 201 {
		t.Fatalf("Claude start: %d %s", w.Code, w.Body)
	}
	var s Chat
	if err := json.Unmarshal(w.Body.Bytes(), &s); err != nil {
		t.Fatal(err)
	}
	if s.Agent != "claude" || s.ThreadID != "claude-owned" || s.Location != "project" {
		t.Fatal(s)
	}
	if !strings.Contains(strings.Join(b.Capabilities(), ","), "chat.claude") {
		t.Fatal("Claude capability missing")
	}
	if err := b.beginChatUpgrade(); err == nil {
		t.Fatal("upgrade allowed live Claude chat")
	}
	if w := chatRequest(h, "POST", "/v1/chats/"+s.ID+"/messages", `{"text":"hello"}`); w.Code != 200 {
		t.Fatal(w.Code, w.Body)
	}
	for _, path := range []string{"/v1/chats", "/v1/chats/" + s.ID, "/v1/chats/" + s.ID + "/models", "/v1/chats/models?location=project&agent=claude"} {
		if w := chatRequest(h, "GET", path, ""); w.Code != 200 {
			t.Fatal(path, w.Code, w.Body)
		}
	}
	if w := chatRequest(h, "DELETE", "/v1/chats/"+s.ID, ""); w.Code != 200 {
		t.Fatal(w.Code, w.Body)
	}
	if err := b.beginChatUpgrade(); err != nil {
		t.Fatal(err)
	}
}
func TestClaudeChatWithoutSupportedCLIIsRefusedBeforeLaunch(t *testing.T) {
	b, h, count := chatFixture(t)
	installSyntheticClaude(t)
	t.Setenv("BURF_BOX_CLAUDE_UNSUPPORTED", "1")
	if strings.Contains(strings.Join(b.Capabilities(), ","), "chat.claude") {
		t.Fatal("unsupported CLI advertised")
	}
	w := chatRequest(h, "POST", "/v1/chats", `{"location":"project","agent":"claude"}`)
	if w.Code != 400 || !strings.Contains(w.Body.String(), "Claude") || count.Load() != 0 {
		t.Fatal(w.Code, w.Body, count.Load())
	}
}
func TestClaudeChatResolvesAccountAndRejectsCustomCommands(t *testing.T) {
	b, _, _ := chatFixture(t)
	installSyntheticClaude(t)
	b.EnvFile = filepath.Join(t.TempDir(), "env.json")
	boxAccount, projectAccount := t.TempDir(), t.TempDir()
	if err := saveBoxEnv(b.EnvFile, BoxEnv{Env: map[string]string{"CLAUDE_CONFIG_DIR": boxAccount}}); err != nil {
		t.Fatal(err)
	}
	if err := b.Locations.SetLocalConfig("project", RepoConfig{Env: map[string]string{"CLAUDE_CONFIG_DIR": projectAccount}}); err != nil {
		t.Fatal(err)
	}
	opts, err := b.chatOptionsFor(context.Background(), "project", "claude")
	if err != nil || opts.Agent != "claude" || !strings.Contains(strings.Join(opts.Env, "\n"), "CLAUDE_CONFIG_DIR="+projectAccount) {
		t.Fatal(opts, err)
	}
	if err := b.Locations.SetLocalConfig("project", RepoConfig{Env: map[string]string{"CLAUDE_CONFIG_DIR": "relative"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := b.chatOptionsFor(context.Background(), "project", "claude"); err == nil {
		t.Fatal("invalid account accepted")
	}
	if err := b.Locations.SetLocalConfig("project", RepoConfig{Agents: []AgentPreset{{ID: "claude", Command: "claude --custom"}}}); err != nil {
		t.Fatal(err)
	}
	if _, err := b.chatOptionsFor(context.Background(), "project", "claude"); err == nil {
		t.Fatal("custom command accepted")
	}
}

func TestClaudeChatWithoutInstalledCLIIsRefused(t *testing.T) {
	b, h, count := chatFixture(t)
	t.Setenv("PATH", t.TempDir())
	t.Setenv("HOME", t.TempDir())
	old := agentFinder
	t.Cleanup(func() { agentFinder = old })
	finder := &agentpath.Finder{Home: t.TempDir(), NoCache: true, NoVersion: true, NoNPM: true, SystemDirs: []string{}, LookPath: func(string) (string, error) { return "", os.ErrNotExist }}
	agentFinder = func() *agentpath.Finder { return finder }
	if strings.Contains(strings.Join(b.Capabilities(), ","), "chat.claude") {
		t.Fatal("missing CLI advertised")
	}
	w := chatRequest(h, "POST", "/v1/chats", `{"location":"project","agent":"claude"}`)
	if w.Code != 400 || !strings.Contains(w.Body.String(), "Claude Code is not installed") || count.Load() != 0 {
		t.Fatal(w.Code, w.Body, count.Load())
	}
}
