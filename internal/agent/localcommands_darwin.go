package agent

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/MylesMCook/burf/internal/agentpath"
	"github.com/MylesMCook/burf/internal/backgroundcmd"
	"github.com/MylesMCook/burf/internal/localagent"
	"github.com/MylesMCook/burf/internal/localchat"
)

// Resolve the installed CLIs as this account's terminal does. Discovery skips
// versions and npm probes; only help for the two message providers is needed.
var localDarwinFinder = sync.OnceValue(func() *agentpath.Finder {
	f := agentpath.Default()
	return &agentpath.Finder{Home: f.Home, Shell: f.Shell, Timeout: 3 * time.Second, NoVersion: true, NoNPM: true}
})

func localClientSupported() bool                    { return localDarwinAccount(os.Getuid(), os.Geteuid()) }
func localDarwinAccount(uid, effectiveUID int) bool { return uid > 0 && uid == effectiveUID }
func localTerminalSupported() bool                  { return false }

func localAgentCommands() map[string]localagent.Command {
	if !localClientSupported() {
		return map[string]localagent.Command{}
	}
	return localDarwinCommands(localDarwinFinder().Find, localDarwinHelp)
}

func localDarwinCommands(find func(string) (agentpath.Found, bool), help func(agentpath.Found, ...string) string) map[string]localagent.Command {
	out := make(map[string]localagent.Command)
	for _, id := range []string{"claude", "codex"} {
		found, ok := find(id)
		if !ok || !localDarwinExecutable(found.Path) {
			continue
		}
		command := localagent.Command{Program: found.Path, PATH: found.PATH}
		if id == "claude" {
			text := help(found, "--help")
			command.CanChat = localchat.ClaudeHelpSupportsChat(text)
			command.CanFork = command.CanChat && strings.Contains(text, "--fork-session") && strings.Contains(text, "--resume")
		} else {
			var texts [3]string
			var wg sync.WaitGroup
			for i, args := range [][]string{{"--help"}, {"fork", "--help"}, {"app-server", "--help"}} {
				wg.Add(1)
				go func() { defer wg.Done(); texts[i] = help(found, args...) }()
			}
			wg.Wait()
			if strings.Contains(texts[0], "--no-daemon") {
				command.Args = []string{"--no-daemon"}
			}
			command.CanChat = strings.Contains(texts[2], "--listen")
			command.CanFork = command.CanChat && strings.Contains(texts[1], "[SESSION_ID]")
		}
		out[id] = command
	}
	return out
}

func localDarwinExecutable(path string) bool {
	if !filepath.IsAbs(path) {
		return false
	}
	st, err := os.Stat(path)
	return err == nil && st.Mode().IsRegular() && st.Mode().Perm()&0111 != 0
}

func localDarwinHelp(found agentpath.Found, args ...string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	cmd := backgroundcmd.CommandContext(ctx, found.Path, args...)
	cmd.Env = withLocalPATH(os.Environ(), found.PATH)
	cmd.WaitDelay = 100 * time.Millisecond
	text, err := cmd.Output()
	if err != nil {
		return ""
	}
	return string(text)
}
