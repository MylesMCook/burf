package box

import (
	"context"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/sean-brydon/berthd/internal/events"
	"github.com/sean-brydon/berthd/internal/hooks"
	"github.com/sean-brydon/berthd/internal/wire"
)

// A gate scoped to a tool lets that tool's own actions through. Over the
// network the tool is whatever the caller claims, so a paired laptop's claim
// is not honoured for gates; the box's own socket (its user's tools) still
// is (security audit L-1).
func TestAGateCannotBeSkippedByClaimingItsTool(t *testing.T) {
	dir := t.TempDir()
	cfg := filepath.Join(dir, "hooks.json")
	os.WriteFile(cfg, []byte(`{"hooks":[{"on":"before:session.start","tool":"orca","run":"echo orca says no; exit 1"}]}`), 0o600)
	var bx *Box
	c, _ := servedBox(t, func(b *Box) { b.Hooks = &hooks.Runner{Path: cfg}; bx = b })
	repo := gitRepo(t)
	call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "cal", "path": repo}, nil)

	for _, origin := range []string{"", "orca"} {
		var resp struct{ Error string }
		if status := call(t, c, "POST", "/v1/sessions", origin, SessionRequest{Location: "cal", Name: "s-" + origin + "x", Command: "cat"}, &resp); status != 403 || !strings.Contains(resp.Error, "orca says no") {
			t.Fatalf("remote session with origin %q: %d %q, want refused", origin, status, resp.Error)
		}
	}

	// The same claim over the box's own socket is the box user's tool.
	sockDir, err := os.MkdirTemp("/tmp", "bgt")
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
	local := NewClient(NewLocal(sock))
	local.Origin = "orca"
	var sess Session
	if err := local.Call(ctx, http.MethodPost, "/v1/sessions", SessionRequest{Location: "cal", Name: "from-orca", Command: "cat"}, &sess); err != nil {
		t.Fatalf("orca on the box was refused by its own gate: %v", err)
	}
	t.Cleanup(func() { bx.Sessions.Kill(context.Background(), "from-orca") })
}

// Every route that changes something runs a gate, and the gates run before
// they can be replaced (security audit L-1: PUT /v1/hooks used to remove the
// gates themselves).
func TestEveryChangeRunsAGate(t *testing.T) {
	dir := t.TempDir()
	cfg := filepath.Join(dir, "hooks.json")
	const gates = `{"hooks":[{"on":"before:*","run":"case \"$BERTH_EVENT\" in location.add) exit 0;; esac; echo \"no $BERTH_EVENT\"; exit 1"}]}`
	os.WriteFile(cfg, []byte(gates), 0o600)
	c, _ := servedBox(t, func(b *Box) { b.Hooks = &hooks.Runner{Path: cfg}; b.Events = &events.Bus{} })
	repo := gitRepo(t)
	if status := call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "cal", "path": repo}, nil); status != 200 {
		t.Fatalf("add location: %d", status)
	}
	for _, tc := range []struct {
		method, path, gate string
		body               any
	}{
		{"PUT", "/v1/hooks", "hooks.change", HooksDoc{Hooks: []hooks.Hook{}}},
		{"POST", "/v1/units", "unit.start", UnitRequest{Name: "x", Program: "/bin/sleep", Args: []string{"1"}}},
		{"DELETE", "/v1/units/x", "unit.stop", nil},
		{"POST", "/v1/units/x/restart", "unit.restart", nil},
		{"POST", "/v1/shares", "share.start", map[string]int{"port": 3000}},
		{"DELETE", "/v1/shares/abc", "share.stop", nil},
		{"POST", "/v1/sessions/nope/attach", "session.attach", nil},
		{"POST", "/v1/events", "event.emit", map[string]any{"type": "deploy.finished"}},
		{"PUT", "/v1/locations/cal/scripts", "config.change", map[string]string{"setup": "echo hi"}},
		{"POST", "/v1/locations/cal/worktrees/main/services/web/start", "service.start", nil},
		{"DELETE", "/v1/locations/cal", "location.remove", nil},
	} {
		var resp struct{ Error string }
		if status := call(t, c, tc.method, tc.path, "", tc.body, &resp); status != 403 || !strings.Contains(resp.Error, "no "+tc.gate) {
			t.Errorf("%s %s: %d %q, want refused by before:%s", tc.method, tc.path, status, resp.Error, tc.gate)
		}
	}
	if b, _ := os.ReadFile(cfg); string(b) != gates {
		t.Fatalf("the gates were replaced: %s", b)
	}
}
