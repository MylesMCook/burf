package agent

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/sean-brydon/berthd/internal/box"
)

// kitRepo makes a git repository holding a kit in kits/cal.
func kitRepo(t *testing.T, version string) string {
	t.Helper()
	repo := t.TempDir()
	dir := filepath.Join(repo, "kits", "cal")
	os.MkdirAll(filepath.Join(dir, "scripts"), 0o755)
	k := box.Kit{ID: "cal-dev", Name: "Cal.com dev", Version: version, Match: box.KitMatch{Slug: "calcom/cal"},
		Config: box.RepoConfig{Setup: "$BERTH_KIT_DIR/scripts/setup.sh"}}
	b, _ := json.Marshal(k)
	os.WriteFile(filepath.Join(dir, "kit.json"), b, 0o644)
	os.WriteFile(filepath.Join(dir, "scripts", "setup.sh"), []byte("#!/bin/sh\necho set up "+version+"\n"), 0o755)
	for _, args := range [][]string{{"init", "-q", "-b", "main"}, {"add", "."}, {"-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "kit"}} {
		if out, err := exec.Command("git", append([]string{"-C", repo}, args...)...).CombinedOutput(); err != nil {
			t.Fatalf("git %v: %s", args, out)
		}
	}
	return repo
}

func TestAKitIsFetchedFromALinkReviewedKeptAndApplied(t *testing.T) {
	b := newBox(t)
	var got box.KitInstall
	b.server.Handle("PUT /v1/locations/{name}/kit", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		json.Unmarshal(body, &got)
		json.NewEncoder(w).Encode(box.KitResult{Kit: box.InstalledKit{ID: got.Kit.ID, Hash: got.Hash}, Warnings: []string{}})
	}))
	b.server.Handle("GET /v1/kits", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode([]box.InstalledKitAt{{Location: "cal", Kit: box.InstalledKit{ID: "cal-dev", Hash: got.Hash}}})
	}))
	a := startAgent(t, b.pairLaptop())
	tok := uiToken(t, a)
	eventually(t, "box online", func() bool { return stateOf(t, a) == StateOnline })
	repo := kitRepo(t, "1.0.0")
	src := "file://" + repo + "#kits/cal"

	resp, body := uiSend(t, a, "POST", "/v1/kits/preview", tok, `{"src":"`+src+`"}`)
	if resp.StatusCode != 200 || !strings.Contains(body, `"cal-dev"`) || !strings.Contains(body, "echo set up 1.0.0") {
		t.Fatalf("preview: %d %s", resp.StatusCode, body)
	}
	if _, body := uiSend(t, a, "GET", "/v1/kits", tok, ""); strings.Contains(body, "cal-dev") {
		t.Fatal("a preview kept the kit")
	}
	if resp, body := uiSend(t, a, "POST", "/v1/kits/add", tok, `{"src":"`+src+`"}`); resp.StatusCode != 200 {
		t.Fatalf("add: %d %s", resp.StatusCode, body)
	}
	_, body = uiSend(t, a, "GET", "/v1/kits", tok, "")
	var kits []KitInfo
	json.Unmarshal([]byte(body), &kits)
	if len(kits) != 1 || kits[0].Source == nil || kits[0].Source.Commit == "" || kits[0].Origin != "user" {
		t.Fatalf("kits = %s", body)
	}

	_, body = uiSend(t, a, "POST", "/v1/kits/cal-dev/apply", tok, `{"targets":[{"box":"devbox","location":"cal"},{"box":"nobox","location":"cal"}]}`)
	if !strings.Contains(body, `"applied":1`) || !strings.Contains(body, "no paired box named nobox") {
		t.Fatalf("apply streamed %s", body)
	}
	script, _ := base64.StdEncoding.DecodeString(got.Files["scripts/setup.sh"])
	if got.Kit.ID != "cal-dev" || !strings.Contains(string(script), "set up 1.0.0") || got.Source != src || got.Hash != kits[0].Hash {
		t.Fatalf("the box got %+v", got)
	}

	// A new version upstream makes the installed one outdated once updated here.
	_, body = uiSend(t, a, "GET", "/v1/kits/installed", tok, "")
	if !strings.Contains(body, `"outdated":false`) {
		t.Fatalf("installed = %s", body)
	}
	os.WriteFile(filepath.Join(repo, "kits", "cal", "scripts", "setup.sh"), []byte("#!/bin/sh\necho set up 2\n"), 0o755)
	exec.Command("git", "-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qam", "v2").Run()
	if _, body := uiSend(t, a, "POST", "/v1/kits/cal-dev/update", tok, ""); !strings.Contains(body, `"changed":true`) {
		t.Fatalf("update = %s", body)
	}
	if _, body := uiSend(t, a, "GET", "/v1/kits/installed", tok, ""); !strings.Contains(body, `"outdated":true`) {
		t.Fatalf("after updating, installed = %s", body)
	}
}

func TestKitLinksMustPointAtAKit(t *testing.T) {
	b := newBox(t)
	a := startAgent(t, b.pairLaptop())
	tok := uiToken(t, a)
	empty := t.TempDir()
	for _, src := range []string{"", "--upload-pack=evil", empty, "file://" + kitRepo(t, "1") + "#nope"} {
		if resp, _ := uiSend(t, a, "POST", "/v1/kits/preview", tok, `{"src":"`+src+`"}`); resp.StatusCode != 400 {
			t.Errorf("%q: %d, want 400", src, resp.StatusCode)
		}
	}
}
