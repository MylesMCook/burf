package agent

import (
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/MylesMCook/burf/internal/openurl"
	"github.com/MylesMCook/burf/internal/sshconfig"
	"github.com/MylesMCook/burf/internal/trust"
)

func TestWindowsEditorBatchLaunchersUseFolderURLsAndNativeExecutablesKeepLines(t *testing.T) {
	for _, editor := range []struct{ id, command, scheme string }{
		{"cursor", "cursor", "cursor"},
		{"vscode", "code", "vscode"},
	} {
		for _, extension := range []string{".cmd", ".bat", ".CMD", ".BAT", ".exe", ".EXE"} {
			t.Run(editor.id+extension, func(t *testing.T) {
				dir := t.TempDir()
				cli := filepath.Join(dir, "Editor's tools & apps", editor.command+extension)
				writeFile(t, cli, "editor fixture", 0o700)
				t.Setenv("PATH", filepath.Dir(cli))
				t.Setenv("PATHEXT", ".COM;.EXE;.BAT;.CMD")
				var commands [][]string
				a := &Agent{
					cfg: Config{
						EditorRoots: []string{},
						SSHDir:      filepath.Join(dir, "ssh"),
						Run: func(command []string) error {
							commands = append(commands, append([]string(nil), command...))
							return nil
						},
					},
					boxes: trust.NewStore(filepath.Join(dir, "boxes.json")),
				}
				if err := a.boxes.Add(trust.Peer{Name: "devl", Address: "100.64.0.11:7444"}); err != nil {
					t.Fatal(err)
				}
				writeFile(t, filepath.Join(a.cfg.SSHDir, "config"), sshconfig.IncludeLine+"\n", 0o600)
				writeFile(t, filepath.Join(a.cfg.SSHDir, "berth", "devl.conf"), "Host berth-devl\n", 0o600)
				native := strings.EqualFold(extension, ".exe")
				var found Editor
				for _, e := range a.editors() {
					if e.ID == editor.id {
						found = e
					}
				}
				if !found.Installed || found.Lines != native || native && !strings.EqualFold(found.CLI, cli) || !native && found.CLI != "" {
					t.Fatalf("editor capability for %s = %+v", extension, found)
				}
				for _, file := range []string{"", "/work/a folder/file.ts"} {
					result, err := a.openCommand(t.Context(), OpenRequest{Editor: editor.id, Box: "devl", Path: "/work/a folder", File: file, Line: 12, Col: 3})
					if err != nil {
						t.Fatal(err)
					}
					want := openurl.Command("windows", editor.scheme+"://vscode-remote/ssh-remote+berth-devl/work/a%20folder")
					if native {
						want = []string{found.CLI, "--remote", "ssh-remote+berth-devl", "/work/a folder"}
						if file != "" {
							want = append(want, "-g", file+":12:3")
						}
					}
					if err := a.runOpen(result); err != nil {
						t.Fatal(err)
					}
					if !reflect.DeepEqual(commands[len(commands)-1], want) {
						t.Fatalf("editor launched %q, want %q", commands[len(commands)-1], want)
					}
					if !native && file != "" && (!strings.Contains(result.Note, "links open folders only") || !strings.Contains(result.Note, "native .exe")) {
						t.Fatalf("batch-only launcher did not explain its file/line fallback: %+v", result)
					}
				}
				if len(commands) != 2 {
					t.Fatalf("runner invoked %d times, want two opens", len(commands))
				}
			})
		}
	}
}
