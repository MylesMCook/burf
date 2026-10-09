package box

import (
	"os"

	"github.com/MylesMCook/burf/internal/events"
	"github.com/MylesMCook/burf/internal/integrations"
)

// Agent accounts: a box can have several Claude Code and Codex logins, each
// in a folder of its own that CLAUDE_CONFIG_DIR or CODEX_HOME picks, set in
// the box's env.json or a project's box-local config (the Usage plugin's
// "Use for new sessions"). berth's hooks and skills go in every one of them
// (integrations/accounts.go).

// ConfiguredAccountDirs are the account folders the box's environment file
// and the projects' box-local configs at locationsFile pick, by agent, as
// written there (integrations.ExpandAccountDir resolves ~ and $HOME). A
// secret reference is no folder and is left out.
func ConfiguredAccountDirs(envFile, locationsFile string) map[string][]string {
	out := map[string][]string{}
	add := func(env map[string]string) {
		for agent, name := range integrations.AccountVars {
			if v := env[name]; v != "" && !IsSecretRef(v) {
				out[agent] = append(out[agent], v)
			}
		}
	}
	if e, err := loadBoxEnv(envFile); err == nil {
		add(e.Env)
	}
	if locationsFile != "" {
		saved, _ := NewLocations(locationsFile).read()
		for _, l := range saved {
			if l.Config != nil {
				add(l.Config.Env)
			}
		}
	}
	return out
}

// PrepareAccounts gives the account folders a new session's environment
// picks berth's integrations before its agent starts, when they lack them
// (integrations.EnsureAccounts: a file read when they are there). berthd
// sets it as its Sessions' Prepare.
func (b *Box) PrepareAccounts(env []string) {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}
	self, err := b.self()
	if err != nil {
		return
	}
	done, _ := integrations.EnsureAccounts(home, self, env)
	for _, a := range done {
		if b.Events != nil {
			b.Events.Publish(events.Event{Type: "integrations.installed", Box: b.Name, Origin: "berth", Data: map[string]any{"tool": a.Agent, "account": a.Dir}})
		}
	}
}
