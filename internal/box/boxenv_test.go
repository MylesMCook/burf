package box

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"github.com/cosscom/shipyard/internal/events"
)

func TestTheBoxEnvironmentReachesWorktreesUnderTheProjects(t *testing.T) {
	ctx := context.Background()
	repo := gitRepo(t)
	dir := t.TempDir()
	b := &Box{Name: "devbox", Locations: NewLocations(filepath.Join(dir, "locations.json")), Events: &events.Bus{}, EnvFile: filepath.Join(dir, "env.json")}
	b.Locations.Add(ctx, "cal", repo)
	wt, _ := b.Locations.CreateWorktree(ctx, "cal", "billing", "", "")
	if err := saveBoxEnv(b.EnvFile, BoxEnv{Env: map[string]string{"CLAUDE_CONFIG_DIR": "/home/me/.berth/accounts/claude/work", "CODEX_HOME": "/home/me/.codex-personal", "WHERE": "$BERTH_WORKTREE_NAME"}}); err != nil {
		t.Fatal(err)
	}
	if err := b.Locations.SetLocalConfig("cal", RepoConfig{Env: map[string]string{"CODEX_HOME": "/home/me/.berth/accounts/codex/client"}}); err != nil {
		t.Fatal(err)
	}
	env, err := b.WorktreeEnv(ctx, "cal", wt)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]string{}
	for _, kv := range env {
		k, v, _ := strings.Cut(kv, "=")
		got[k] = v
	}
	if got["CLAUDE_CONFIG_DIR"] != "/home/me/.berth/accounts/claude/work" || got["CODEX_HOME"] != "/home/me/.berth/accounts/codex/client" || got["WHERE"] != "billing" {
		t.Fatalf("env = %v", got)
	}
	if err := saveBoxEnv(b.EnvFile, BoxEnv{Env: map[string]string{"NOT A NAME": "x"}}); err == nil {
		t.Fatal("an invalid variable name was saved")
	}
}

func TestTheBoxEnvironmentIsReadAndWrittenOverTheAPI(t *testing.T) {
	path := filepath.Join(t.TempDir(), "env.json")
	c, _ := servedBox(t, func(b *Box) { b.EnvFile = path })
	var doc boxEnvDoc
	if status := call(t, c, "GET", "/v1/env", "", nil, &doc); status != 200 || doc.Path != path || len(doc.Env) != 0 {
		t.Fatalf("empty env: %d %+v", status, doc)
	}
	call(t, c, "PUT", "/v1/env", "", boxEnvDoc{Env: map[string]string{"CODEX_HOME": "/x"}}, &doc)
	if doc.Env["CODEX_HOME"] != "/x" {
		t.Fatalf("env = %+v", doc)
	}
	if status := call(t, c, "PUT", "/v1/env", "", boxEnvDoc{Env: map[string]string{"1BAD": "x"}}, nil); status != 400 {
		t.Fatalf("an invalid name gave %d", status)
	}
}
