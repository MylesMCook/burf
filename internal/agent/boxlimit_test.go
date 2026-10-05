package agent

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBoxBodyLimit(t *testing.T) {
	for target, want := range map[string]int64{
		"/v1/sessions":               3 << 20,
		"/v1/sessions/s/attachments": 28 << 20,
		"/v1/locations/demo/worktrees/x/attachments?name=a": 28 << 20,
		"/v1/sessions/attachments-x/send":                   3 << 20,
	} {
		if got := boxBodyLimit(target); got != want {
			t.Errorf("%s: %d, want %d", target, got, want)
		}
	}
}

func TestLocalAttachment(t *testing.T) {
	dir := t.TempDir()
	shot := filepath.Join(dir, "Screen Shot.png")
	os.WriteFile(shot, []byte("\x89PNG\r\n\x1a\n"), 0o600)
	os.WriteFile(filepath.Join(dir, "a.zip"), []byte("PK"), 0o600)
	for _, p := range []string{shot, "file://" + strings.ReplaceAll(shot, " ", "%20"), "  " + shot + "\n"} {
		name, data, err := localAttachment(p)
		if err != nil || name != "Screen Shot.png" || len(data) != 8 {
			t.Errorf("%q: %q %d %v", p, name, len(data), err)
		}
	}
	for _, p := range []string{filepath.Join(dir, "a.zip"), filepath.Join(dir, "gone.png"), "relative.png", dir + "/"} {
		if _, _, err := localAttachment(p); err == nil {
			t.Errorf("%q: no error", p)
		}
	}
}
