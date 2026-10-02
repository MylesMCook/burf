package box

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestAKitsScriptsAndConfigApplyToNewWorktrees(t *testing.T) {
	kits := t.TempDir()
	c, _ := servedBox(t, func(b *Box) { b.KitsDir = kits })
	repo := gitRepo(t)
	call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "cal", "path": repo}, nil)

	script := "#!/bin/sh\necho \"kit setup for $BERTH_WORKTREE_NAME with $GREETING\" > kit-ran\n"
	in := KitInstall{
		Kit: Kit{ID: "cal-dev", Name: "Cal.com dev", Version: "1.0.0",
			Requires: []KitRequirement{{Tool: "definitely-not-installed-tool", Hint: "brew install it"}},
			Config:   RepoConfig{Setup: "$BERTH_KIT_DIR/scripts/setup.sh", Env: map[string]string{"GREETING": "hello from the kit"}},
			Files:    map[string]string{"README.md": "# Cal kit\n"}},
		Files:  map[string]string{"scripts/setup.sh": base64.StdEncoding.EncodeToString([]byte(script))},
		Source: "https://github.com/acme/cal-kit", Hash: "abc123",
	}
	var res KitResult
	if status := call(t, c, "PUT", "/v1/locations/cal/kit", "", in, &res); status != 200 {
		t.Fatalf("install: %d", status)
	}
	if len(res.Warnings) != 1 || !strings.Contains(res.Warnings[0], "brew install it") {
		t.Fatalf("warnings = %v", res.Warnings)
	}
	if info, err := os.Stat(filepath.Join(res.Kit.Dir, "scripts", "setup.sh")); err != nil || info.Mode()&0o100 == 0 {
		t.Fatalf("the kit's script is not there and executable: %v", err)
	}
	var cfg Config
	call(t, c, "GET", "/v1/locations/cal/config", "", nil, &cfg)
	if cfg.Kit == nil || cfg.Kit.ID != "cal-dev" || cfg.Effective.Env["GREETING"] != "hello from the kit" {
		t.Fatalf("config = %+v", cfg)
	}

	// The box's own config still wins over the kit.
	call(t, c, "PUT", "/v1/locations/cal/config", "", map[string]any{"local": RepoConfig{Env: map[string]string{"GREETING": "hello from devl"}}}, nil)
	var wt Worktree
	call(t, c, "POST", "/v1/locations/cal/worktrees", "", WorktreeRequest{Name: "billing"}, &wt)
	deadline := time.Now().Add(10 * time.Second)
	for {
		b, err := os.ReadFile(filepath.Join(wt.Path, "kit-ran"))
		if err == nil {
			if got := strings.TrimSpace(string(b)); got != "kit setup for billing with hello from devl" {
				t.Fatalf("setup wrote %q", got)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the kit's setup script never ran")
		}
		time.Sleep(50 * time.Millisecond)
	}

	var listed []InstalledKitAt
	call(t, c, "GET", "/v1/kits", "", nil, &listed)
	if len(listed) != 1 || listed[0].Location != "cal" || listed[0].Kit.Hash != "abc123" {
		t.Fatalf("kits = %+v", listed)
	}
	if status := call(t, c, "DELETE", "/v1/locations/cal/kit", "", nil, nil); status != 200 {
		t.Fatalf("remove: %d", status)
	}
	if _, err := os.Stat(res.Kit.Dir); !os.IsNotExist(err) {
		t.Fatal("the kit's files were left behind")
	}
}

func TestAKitCannotWriteOutsideItsFolder(t *testing.T) {
	kits := t.TempDir()
	c, _ := servedBox(t, func(b *Box) { b.KitsDir = kits })
	repo := gitRepo(t)
	call(t, c, "POST", "/v1/locations", "", map[string]string{"name": "cal", "path": repo}, nil)
	for _, p := range []string{"../escape.sh", "/etc/evil", "a/../../escape"} {
		in := KitInstall{Kit: Kit{ID: "bad", Name: "Bad"}, Files: map[string]string{p: base64.StdEncoding.EncodeToString([]byte("x"))}}
		if status := call(t, c, "PUT", "/v1/locations/cal/kit", "", in, nil); status != 400 {
			t.Errorf("%s: status %d, want 400", p, status)
		}
	}
	if status := call(t, c, "PUT", "/v1/locations/cal/kit", "", KitInstall{Kit: Kit{ID: "Bad Id"}}, nil); status != 400 {
		t.Errorf("a bad id gave %d", status)
	}
}
