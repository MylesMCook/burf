package agent

import (
	"io"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/sean-brydon/berthd/internal/localpty"
)

func TestInstalledLocalAgentCommands(t *testing.T) {
	if os.Getenv("BERTH_TEST_INSTALLED_LOCAL_AGENTS") != "1" {
		t.Skip("opt-in installed CLI smoke")
	}
	commands := localAgentCommands()
	for _, id := range []string{"claude", "codex"} {
		t.Run(id, func(t *testing.T) {
			command, ok := commands[id]
			if !ok {
				t.Fatal("installed CLI not found")
			}
			p, err := localpty.Start(command.Program, []string{"--version"}, t.TempDir(), os.Environ(), 100, 30)
			if err != nil {
				t.Fatal(err)
			}
			defer p.Close()
			timer := time.AfterFunc(15*time.Second, func() { p.Close() })
			defer timer.Stop()
			out, err := io.ReadAll(io.LimitReader(p, 64<<10))
			if err != nil {
				t.Fatal(err)
			}
			if err := p.Wait(); err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(strings.ToLower(string(out)), id) {
				t.Fatalf("version output did not identify %s", id)
			}
		})
	}
}
