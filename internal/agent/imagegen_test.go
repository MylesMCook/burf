package agent

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

// fakeCodex writes a codex CLI that answers `login status` with status, and
// for `exec` records its arguments and, when makes is true, saves a PNG
// where Codex keeps the images it generates.
func fakeCodex(t *testing.T, status string, makes bool) (imageGen, string) {
	t.Helper()
	dir := t.TempDir()
	home := filepath.Join(dir, "codex-home")
	pic := filepath.Join(dir, "pic.png")
	var buf bytes.Buffer
	png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, 4, 3)))
	os.WriteFile(pic, buf.Bytes(), 0o644)
	args := filepath.Join(dir, "args")
	bin := cliFixturePath(dir, "codex")
	fixture := cliFixture{Mode: "codex", Status: status, Args: args}
	if makes {
		fixture.Image = pic
	}
	installCLI(t, bin, fixture)
	return imageGen{codex: bin, home: home, busy: &sync.Mutex{}}, args
}

func serveImageGen(g imageGen) *httptest.Server {
	mux := http.NewServeMux()
	g.routes(mux)
	return httptest.NewServer(mux)
}

func TestImageGenListsCodexAndWhetherItCanRun(t *testing.T) {
	for _, tc := range []struct {
		name, status string
		missing      bool
		signedIn     bool
		note         string
	}{
		{name: "signed in", status: "Logged in using ChatGPT", signedIn: true},
		{name: "signed out", status: "Not logged in", note: "codex login"},
		{name: "missing", missing: true, note: "brew install codex"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			g, _ := fakeCodex(t, tc.status, true)
			if tc.missing {
				g.codex = filepath.Join(t.TempDir(), "nope")
			}
			srv := serveImageGen(g)
			defer srv.Close()
			res, err := http.Get(srv.URL + "/v1/imagegen")
			if err != nil {
				t.Fatal(err)
			}
			var got struct{ Generators []ImageGenerator }
			json.NewDecoder(res.Body).Decode(&got)
			if len(got.Generators) != 1 {
				t.Fatalf("generators = %+v", got.Generators)
			}
			c := got.Generators[0]
			if c.ID != "codex" || c.Installed == tc.missing || c.SignedIn != tc.signedIn || !strings.Contains(c.Note, tc.note) {
				t.Fatalf("codex = %+v", c)
			}
			// The command shown is the one that runs: read-only, in an empty folder.
			cmd := strings.Join(c.Command, " ")
			if !strings.Contains(cmd, "exec --ephemeral --skip-git-repo-check --json --sandbox read-only") || !strings.HasSuffix(cmd, "{prompt}") {
				t.Fatalf("command = %q", cmd)
			}
		})
	}
}

func TestImageGenReturnsTheImageCodexSaved(t *testing.T) {
	g, args := fakeCodex(t, "Logged in using ChatGPT", true)
	srv := serveImageGen(g)
	defer srv.Close()
	res, err := http.Post(srv.URL+"/v1/imagegen", "application/json", strings.NewReader(`{"generator":"codex","prompt":"  a harbour at dawn "}`))
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status %d", res.StatusCode)
	}
	var img GeneratedImage
	json.NewDecoder(res.Body).Decode(&img)
	b, _ := base64.StdEncoding.DecodeString(img.Data)
	if img.Mime != "image/png" || img.Prompt != "a harbour at dawn" || !bytes.HasPrefix(b, []byte("\x89PNG")) {
		t.Fatalf("image = %s %q %d bytes", img.Mime, img.Prompt, len(b))
	}
	ran, _ := os.ReadFile(args)
	lines := strings.Split(strings.TrimSpace(string(ran)), "\n")
	if lines[0] != "exec" || !strings.Contains(string(ran), "read-only") || !strings.HasSuffix(lines[len(lines)-1], "The picture: a harbour at dawn") {
		t.Fatalf("ran %q", ran)
	}
}

func TestImageGenSaysWhyThereIsNoImage(t *testing.T) {
	g, _ := fakeCodex(t, "Logged in using ChatGPT", false)
	srv := serveImageGen(g)
	defer srv.Close()
	for _, tc := range []struct {
		body   string
		status int
		want   string
	}{
		{`{"prompt":""}`, http.StatusBadRequest, "describe the picture"},
		{`{"generator":"dall-e","prompt":"x"}`, http.StatusBadRequest, "unknown image generator"},
		{`{"prompt":"a boat"}`, http.StatusBadGateway, "I cannot do that"},
	} {
		res, err := http.Post(srv.URL+"/v1/imagegen", "application/json", strings.NewReader(tc.body))
		if err != nil {
			t.Fatal(err)
		}
		var e struct{ Error, Code string }
		json.NewDecoder(res.Body).Decode(&e)
		if res.StatusCode != tc.status || !strings.Contains(e.Error, tc.want) {
			t.Fatalf("%s: %d %+v", tc.body, res.StatusCode, e)
		}
	}
	g.codex = filepath.Join(t.TempDir(), "nope")
	srv2 := serveImageGen(g)
	defer srv2.Close()
	res, _ := http.Post(srv2.URL+"/v1/imagegen", "application/json", strings.NewReader(`{"prompt":"a boat"}`))
	var e struct{ Error, Code string }
	json.NewDecoder(res.Body).Decode(&e)
	if res.StatusCode != http.StatusNotFound || e.Code != "imagegen_missing" {
		t.Fatalf("missing: %d %+v", res.StatusCode, e)
	}
}

func TestImageGenRunsOneAtATime(t *testing.T) {
	g, _ := fakeCodex(t, "Logged in using ChatGPT", true)
	g.busy.Lock()
	defer g.busy.Unlock()
	srv := serveImageGen(g)
	defer srv.Close()
	res, _ := http.Post(srv.URL+"/v1/imagegen", "application/json", strings.NewReader(`{"prompt":"a boat"}`))
	if res.StatusCode != http.StatusConflict {
		t.Fatalf("status %d", res.StatusCode)
	}
}

func TestFindImageStaysInsideCodexImages(t *testing.T) {
	g, _ := fakeCodex(t, "", false)
	secret := filepath.Join(t.TempDir(), "secret.png")
	os.WriteFile(secret, []byte("x"), 0o644)
	if got := g.findImage("../..", t.TempDir(), []string{secret}); got != "" {
		t.Fatalf("found %q outside generated_images", got)
	}
}
