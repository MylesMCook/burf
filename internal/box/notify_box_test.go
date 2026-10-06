package box

import (
	"context"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/sean-brydon/berthd/internal/events"
	"github.com/sean-brydon/berthd/internal/wire"
)

// The whole loop on a real box: an agent on the box sends work naming
// itself, the work's turn ends, and the box types a notification into the
// agent's session. A caller named from off the box is ignored.
func TestWorkStartedOnTheBoxReportsBackToItsCaller(t *testing.T) {
	ledger := &Turns{}
	var bx *Box
	c, bus := servedBox(t, func(b *Box) {
		b.Turns = ledger
		b.Reports = &Notifier{Path: filepath.Join(t.TempDir(), "notify.json")}
		bx = b
	})
	ledger.Attach(bus)
	repo := gitRepo(t)
	call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "cal", "path": repo}, nil)
	bin := t.TempDir()
	fake := filepath.Join(bin, "claude")
	os.WriteFile(fake, []byte("#!/bin/sh\nexec cat\n"), 0o755)
	for _, name := range []string{"lead", "worker"} {
		if status := call(t, c, "POST", "/v1/sessions", "", map[string]string{"location": "cal", "name": name, "command": fake}, nil); status != 200 {
			t.Fatalf("start %s: %d", name, status)
		}
		t.Cleanup(func() { bx.Sessions.Kill(context.Background(), name) })
	}

	sockDir, err := os.MkdirTemp("/tmp", "bnt")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(sockDir) })
	sock := filepath.Join(sockDir, "berthd.sock")
	ln, err := net.Listen("unix", sock)
	if err != nil {
		t.Fatal(err)
	}
	srv := &wire.Server{}
	bx.Mount(srv)
	ctx, stop := context.WithCancel(context.Background())
	t.Cleanup(stop)
	go srv.ServeLocal(ctx, ln)

	// Named from a paired laptop: no watch.
	resp, err := c.DoWithHeader(ctx, http.MethodPost, "/v1/sessions/worker/send", strings.NewReader(`{"text":"remote","when":"now"}`), http.Header{CallerHeader: {"lead"}})
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if n := len(bx.Reports.Watches()); n != 0 {
		t.Fatalf("a caller named from off the box made %d watches", n)
	}
	bus.Publish(events.Event{Type: "agent.finished", Data: map[string]any{"session": "worker"}})

	// An MCP server started with a bare environment (Codex) finds its
	// session from its agent's process: the pane's own, or one under it.
	local := NewClient(NewLocal(sock))
	out, _ := bx.Sessions.tmux(ctx, "display-message", "-p", "-t", "=lead:", "#{pane_pid}")
	pane, _ := strconv.Atoi(strings.TrimSpace(string(out)))
	under := waitChild(t, pane)
	for _, pid := range []int{pane, under} {
		if who, err := local.SessionOfPid(ctx, pid); err != nil || who != "lead" {
			t.Fatalf("pid %d is in %q (%v), want lead", pid, who, err)
		}
	}
	if who, _ := local.SessionOfPid(ctx, os.Getpid()); who != "" {
		t.Fatalf("the test itself is in session %q", who)
	}

	// Named on the box's own socket: watched.
	local = local.WithCaller("lead")
	res, err := local.Send(ctx, "worker", SendRequest{Text: "do the thing", When: "now"})
	if err != nil || res.Turn == "" {
		t.Fatalf("send: %+v %v", res, err)
	}
	ws := bx.Reports.Watches()
	if len(ws) != 1 || ws[0].Parent != "lead" || ws[0].Turn != res.Turn {
		t.Fatalf("watches = %+v, want lead on %s", ws, res.Turn)
	}
	go bx.Reports.Run(ctx, bx)
	// Its hooks say it started, then that it finished.
	bus.Publish(events.Event{Type: "agent.started", Data: map[string]any{"session": "worker"}})
	bus.Publish(events.Event{Type: "agent.finished", Data: map[string]any{"session": "worker"}})

	deadline := time.Now().Add(15 * time.Second)
	for {
		screen, _ := bx.Sessions.Screen(ctx, "lead", 200)
		if strings.Contains(screen, "</berth-notification>") {
			flat := strings.ReplaceAll(screen, "\n", "")
			if !strings.Contains(flat, `session="worker"`) || !strings.Contains(flat, `status="finished"`) {
				t.Fatalf("the notification lacks the facts:\n%s", screen)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("lead was never told:\n%s", screen)
		}
		time.Sleep(200 * time.Millisecond)
	}
	if n := len(bx.Reports.Watches()); n != 0 {
		t.Fatalf("%d watches left after the report", n)
	}
	// What lead was told made it a turn from berth, and no watch.
	for wait := time.Now().Add(3 * time.Second); ; time.Sleep(50 * time.Millisecond) {
		ts := ledger.List("lead", 5)
		if len(ts) > 0 && ts[len(ts)-1].Origin == "berth:report" {
			break
		}
		if time.Now().After(wait) {
			t.Fatalf("lead's turns: %+v", ts)
		}
	}
}

// waitChild is a process under pid (the fake agent's cat), or pid itself.
func waitChild(t *testing.T, pid int) int {
	t.Helper()
	for range 50 {
		out, _ := exec.Command("pgrep", "-P", strconv.Itoa(pid)).Output()
		if f := strings.Fields(string(out)); len(f) > 0 {
			n, _ := strconv.Atoi(f[0])
			return n
		}
		time.Sleep(50 * time.Millisecond)
	}
	return pid
}
