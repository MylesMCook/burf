package agent

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/sshconfig"
	"github.com/MylesMCook/burf/internal/trust"
)

var ran struct {
	sync.Mutex
	commands [][]string
}

// recordRun stands in for starting an editor: tests read what would run.
func recordRun(cmd []string) error {
	ran.Lock()
	ran.commands = append(ran.commands, cmd)
	ran.Unlock()
	return nil
}

func lastRun() []string {
	ran.Lock()
	defer ran.Unlock()
	if len(ran.commands) == 0 {
		return nil
	}
	return ran.commands[len(ran.commands)-1]
}

// fakeCursor installs a Cursor app with its CLI in the agent's apps folder.
func fakeCursor(t *testing.T, a *runningAgent) string {
	t.Helper()
	cli := filepath.Join(a.dir, "apps", "Cursor.app", "Contents", "Resources", "app", "bin", "cursor")
	os.MkdirAll(filepath.Dir(cli), 0o755)
	os.WriteFile(cli, []byte("#!/bin/sh\n"), 0o755)
	return cli
}

func TestEditorsOpenLocalBoxesDirectlyAndRemoteOnesOverSSH(t *testing.T) {
	b := newBox(t)
	dir := b.pairLaptop()
	// A second box, on another tailnet; it is offline in this test.
	trust.NewStore(filepath.Join(dir, "boxes.json")).Add(trust.Peer{Name: "devl", Address: "100.64.0.11:7444", Network: "personal", PairedAt: time.Now()})
	a := startAgent(t, dir)
	tok := uiToken(t, a)
	cli := fakeCursor(t, a)
	eventually(t, "devbox online", func() bool {
		st, err := a.client.Status(t.Context())
		if err != nil {
			return false
		}
		for _, b := range st.Boxes {
			if b.Name == "devbox" {
				return b.State == StateOnline
			}
		}
		return false
	})

	_, body := uiSend(t, a, "GET", "/v1/editors", tok, "")
	var eds []Editor
	json.Unmarshal([]byte(body), &eds)
	if eds[0].ID != "cursor" || !eds[0].Installed || eds[0].CLI != cli || !eds[0].Lines {
		t.Fatalf("editors = %s", body)
	}

	// The test box is at 127.0.0.1: this computer, opened directly.
	_, body = uiSend(t, a, "POST", "/v1/editors/open", tok, `{"editor":"cursor","box":"devbox","path":"/w/cal-billing","file":"/w/cal-billing/src/a.ts","line":12,"col":3}`)
	if got := strings.Join(lastRun(), " "); got != cli+" /w/cal-billing -g /w/cal-billing/src/a.ts:12:3" {
		t.Fatalf("ran %q (%s)", got, body)
	}

	// devl needs its SSH host first.
	resp, body := uiSend(t, a, "POST", "/v1/editors/open", tok, `{"editor":"cursor","box":"devl","path":"/home/sean/work/cal"}`)
	if resp.StatusCode != 409 || !strings.Contains(body, `"code":"ssh_setup"`) {
		t.Fatalf("before setup: %d %s", resp.StatusCode, body)
	}
	_, body = uiSend(t, a, "GET", "/v1/ssh-config", tok, "")
	if !strings.Contains(body, "berth/devl.conf") || !strings.Contains(body, "network proxy personal %h %p") || !strings.Contains(body, sshconfig.IncludeLine) {
		t.Fatalf("plan = %s", body)
	}
	if _, err := os.Stat(filepath.Join(a.dir, "ssh", "berth")); !os.IsNotExist(err) {
		t.Fatal("showing the plan wrote files")
	}
	if _, body := uiSend(t, a, "POST", "/v1/ssh-config", tok, ""); !strings.Contains(body, `"changes":[]`) || !strings.Contains(body, `"ready":true`) {
		t.Fatalf("after writing: %s", body)
	}
	uiSend(t, a, "POST", "/v1/editors/open", tok, `{"editor":"cursor","box":"devl","path":"/home/sean/work/cal","file":"/home/sean/work/cal/README.md","line":4}`)
	if got := strings.Join(lastRun(), " "); got != cli+" --remote ssh-remote+berth-devl /home/sean/work/cal -g /home/sean/work/cal/README.md:4" {
		t.Fatalf("ran %q", got)
	}

	for _, bad := range []string{
		`{"editor":"emacs","box":"devl","path":"/x"}`,
		`{"editor":"cursor","box":"devl","path":"relative/x"}`,
		`{"editor":"cursor","box":"nobox","path":"/x"}`,
	} {
		if resp, _ := uiSend(t, a, "POST", "/v1/editors/open", tok, bad); resp.StatusCode != 400 {
			t.Errorf("%s: %d, want 400", bad, resp.StatusCode)
		}
	}
}
