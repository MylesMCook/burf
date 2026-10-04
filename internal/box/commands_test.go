package box

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/sean-brydon/berthd/internal/events"
)

func write(t *testing.T, path, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func byName(cat CommandCatalog) map[string]Command {
	m := map[string]Command{}
	for _, c := range cat.Commands {
		m[c.Name] = c
	}
	return m
}

func TestTheCatalogListsBuiltinsCustomCommandsSkillsAndPlugins(t *testing.T) {
	home, wt := t.TempDir(), t.TempDir()
	t.Setenv("CLAUDE_CONFIG_DIR", "")
	ch := filepath.Join(home, ".claude")
	write(t, filepath.Join(ch, "commands", "ship.md"), "---\ndescription: Ship it\nargument-hint: \"[branch]\"\n---\nShip $ARGUMENTS")
	write(t, filepath.Join(ch, "commands", "front", "test.md"), "# Run the frontend tests\n\nThen fix them.")
	write(t, filepath.Join(ch, "skills", "tidy", "SKILL.md"), "---\nname: tidy\ndescription: >\n  Tidy the code,\n  gently.\n---\nbody")
	write(t, filepath.Join(ch, "skills", "hidden", "SKILL.md"), "---\nname: hidden\nuser-invocable: false\n---\n")
	write(t, filepath.Join(wt, ".claude", "commands", "ship.md"), "---\ndescription: The repo's ship\n---\n")
	write(t, filepath.Join(wt, ".claude", "skills", "seed", "SKILL.md"), "---\nname: seed\ndescription: 'Seed the database'\n---\n")
	plug := filepath.Join(ch, "plugins", "cache", "official", "vercel", "1.0.0")
	write(t, filepath.Join(plug, "commands", "deploy.md"), "---\ndescription: Deploy to Vercel\n---\n")
	write(t, filepath.Join(plug, "skills", "env", "SKILL.md"), "---\nname: env\ndescription: Manage env vars\n---\n")
	write(t, filepath.Join(plug, "commands", "_conventions.md"), "Notes for the plugin's authors")
	off := filepath.Join(ch, "plugins", "cache", "official", "off", "1.0.0")
	write(t, filepath.Join(off, "commands", "nope.md"), "nope")
	write(t, filepath.Join(ch, "plugins", "installed_plugins.json"), `{"version":2,"plugins":{"vercel@official":[{"installPath":"`+plug+`"}],"off@official":[{"installPath":"`+off+`"}]}}`)
	write(t, filepath.Join(ch, "settings.json"), `{"enabledPlugins":{"vercel@official":true,"off@official":false}}`)

	cat := Catalog("claude", home, wt)
	m := byName(cat)
	if c := m["/model"]; c.Kind != "builtin" || !c.Local || !c.Screen {
		t.Errorf("/model = %+v", c)
	}
	if c := m["/usage"]; !reflect.DeepEqual(c.Aliases, []string{"/cost", "/stats"}) {
		t.Errorf("/usage aliases = %v", c.Aliases)
	}
	if c := m["/init"]; c.Local {
		t.Errorf("/init sends a prompt: %+v", c)
	}
	if c := m["/ship"]; c.Description != "The repo's ship" || c.Source != "project" || c.Kind != "custom" {
		t.Errorf("the repo's /ship wins: %+v", c)
	}
	if c := m["/front:test"]; c.Description != "Run the frontend tests" {
		t.Errorf("/front:test = %+v", c)
	}
	if c := m["/tidy"]; c.Kind != "skill" || c.Description != "Tidy the code, gently." {
		t.Errorf("/tidy = %+v", c)
	}
	if _, ok := m["/hidden"]; ok {
		t.Error("a skill that isn't user-invocable is listed")
	}
	if c := m["/seed"]; c.Source != "project" || c.Description != "Seed the database" {
		t.Errorf("/seed = %+v", c)
	}
	if c := m["/vercel:deploy"]; c.Kind != "plugin" || c.Source != "vercel" {
		t.Errorf("/vercel:deploy = %+v", c)
	}
	if c := m["/vercel:env"]; c.Kind != "plugin" {
		t.Errorf("/vercel:env = %+v", c)
	}
	if _, ok := m["/vercel:_conventions"]; ok {
		t.Error("a _file is listed")
	}
	if _, ok := m["/off:nope"]; ok {
		t.Error("a disabled plugin's command is listed")
	}
	if cat.Prefixes["!"] == "" || len(cat.Notes) == 0 {
		t.Errorf("prefixes %v, notes %v", cat.Prefixes, cat.Notes)
	}
}

func TestCodexListsItsPrompts(t *testing.T) {
	home := t.TempDir()
	t.Setenv("CODEX_HOME", "")
	write(t, filepath.Join(home, ".codex", "prompts", "fix.md"), "---\ndescription: Fix the build\n---\n")
	m := byName(Catalog("codex", home, ""))
	if c := m["/prompts:fix"]; c.Description != "Fix the build" {
		t.Errorf("/prompts:fix = %+v", c)
	}
	if c := m["/model"]; !c.Local {
		t.Errorf("/model = %+v", c)
	}
}

func TestTheCatalogIsCapped(t *testing.T) {
	home := t.TempDir()
	for i := 0; i < maxCommands+50; i++ {
		write(t, filepath.Join(home, ".claude", "commands", "c"+itoa3(i)+".md"), "x")
	}
	cat := Catalog("claude", home, "")
	if len(cat.Commands) > maxCommands || !cat.Truncated {
		t.Errorf("%d commands, truncated %v", len(cat.Commands), cat.Truncated)
	}
}

func itoa3(i int) string { return string(rune('a'+i/100%26)) + string(rune('a'+i/10%10)) + string(rune('a'+i%10)) + string(rune('a'+i/2600)) }

func TestLocalCommands(t *testing.T) {
	cases := []struct {
		agent, text, name string
		local             bool
	}{
		{"claude", "/cost", "/usage", true},
		{"claude", "/model opus", "/model", true},
		{"claude", "/compact keep the API notes", "/compact", true},
		{"claude", "/init", "/init", false},
		{"claude", "/simplify", "/simplify", false},
		{"claude", "/my-skill do it", "", false},
		{"claude", "/etc/hosts is wrong", "", false},
		{"claude", "fix /model", "", false},
		{"codex", "/status", "/status", true},
		{"codex", "/review", "/review", false},
		{"gemini", "/model", "", false},
	}
	for _, c := range cases {
		name, local := localCommand(c.agent, c.text)
		if name != c.name || local != c.local {
			t.Errorf("localCommand(%s, %q) = %q %v, want %q %v", c.agent, c.text, name, local, c.name, c.local)
		}
	}
}

// A local command typed into an agent starts no turn, so the next prompt's
// start is its own.
func TestALocalCommandStartsNoTurn(t *testing.T) {
	tr, bus := ledger(t, Session{Name: "s", Dir: "/srv/a", Agent: "claude"})
	hook(bus, "agent.ready", "s", "/srv/a", "claude")
	hook(bus, "agent.started", "s", "/srv/a", "claude", "signal", "prompt")
	hook(bus, "agent.finished", "s", "/srv/a", "claude")
	cmd := bus.Publish(events.Event{Type: "session.sent", Data: map[string]any{"name": "s", "command": "/usage"}})
	if _, ok := tr.ForSent("s", cmd.Seq); ok {
		t.Fatal("a command opened a turn")
	}
	sent := bus.Publish(events.Event{Type: "session.sent", Data: map[string]any{"name": "s"}})
	hook(bus, "agent.started", "s", "/srv/a", "claude", "signal", "prompt")
	mine, ok := tr.ForSent("s", sent.Seq)
	if !ok || turnState(t, tr, mine.ID) != "running" {
		t.Fatalf("the prompt's turn = %+v %v", mine, ok)
	}
}

func TestMatchFiles(t *testing.T) {
	all := []string{"README.md", "app/src/main.ts", "app/src/readme-view.tsx", "docs/guides/labs.mdx", "internal/box/commands.go"}
	if got := MatchFiles(all, "read", 10); !reflect.DeepEqual(got, []string{"README.md", "app/src/readme-view.tsx"}) {
		t.Errorf("read = %v", got)
	}
	if got := MatchFiles(all, "ibc", 10); !reflect.DeepEqual(got, []string{"internal/box/commands.go"}) {
		t.Errorf("ibc = %v", got)
	}
	if got := MatchFiles(all, "", 2); len(got) != 2 {
		t.Errorf("empty = %v", got)
	}
}

func TestCommandName(t *testing.T) {
	for in, want := range map[string]string{"/model": "model", " /model x": "model", "/vercel:deploy prod": "vercel:deploy", "/a/b": "", "//x": "", "hi": "", "/": ""} {
		if got := commandName(in); got != want {
			t.Errorf("commandName(%q) = %q, want %q", in, got, want)
		}
	}
}
