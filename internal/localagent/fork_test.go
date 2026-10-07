package localagent

import (
	"reflect"
	"testing"
)

func TestForkPreservesOriginalAndReusesRunningSession(t *testing.T) {
	const id = "12345678-1234-4321-8123-123456789abc"
	for _, agent := range []string{"codex", "claude"} {
		t.Run(agent, func(t *testing.T) {
			calls := 0
			dir := t.TempDir()
			command := Command{Program: "native.exe", CanFork: true}
			want := []string{"--resume", id, "--fork-session"}
			if agent == "codex" {
				command.Args = []string{"--no-daemon"}
				want = []string{"--no-daemon", "fork", id}
			}
			m := New(map[string]Command{agent: command}, func(program string, args []string, cwd string, _ []string, _, _ int) (Process, error) {
				calls++
				if program != command.Program || cwd != dir || !reflect.DeepEqual(args, want) {
					t.Fatalf("unsafe continuation command: %q %q", program, args)
				}
				return fake(), nil
			})
			defer m.Close()
			s, err := m.Fork(agent, dir, id)
			if err != nil {
				t.Fatal(err)
			}
			again, err := m.Fork(agent, dir, id)
			if err != nil || again.ID != s.ID || calls != 1 {
				t.Fatalf("duplicate launch: %v, calls %d", err, calls)
			}
			if err := m.Stop(s.ID); err != nil {
				t.Fatal(err)
			}
			waitFor(t, func() bool { return m.List()[0].State == "exited" })
			if _, err := m.Fork(agent, dir, id); err != nil || calls != 2 {
				t.Fatalf("retry after stop: %v", err)
			}
		})
	}
}

func TestForkRejectsInvalidOrUnsupportedSource(t *testing.T) {
	m := New(map[string]Command{"codex": {Program: "codex.exe", CanFork: true}, "claude": {Program: "claude.exe"}}, func(string, []string, string, []string, int, int) (Process, error) {
		t.Fatal("invalid fork launched")
		return nil, nil
	})
	defer m.Close()
	for _, tc := range [][3]string{
		{"codex", t.TempDir(), "--last"},
		{"codex", t.TempDir(), "session-name"},
		{"codex", "relative", "12345678-1234-4321-8123-123456789abc"},
		{"claude", t.TempDir(), "12345678-1234-4321-8123-123456789abc"},
		{"shell", t.TempDir(), "12345678-1234-4321-8123-123456789abc"},
	} {
		if _, err := m.Fork(tc[0], tc[1], tc[2]); err == nil {
			t.Fatalf("accepted %q", tc)
		}
	}
}
