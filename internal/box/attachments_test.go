package box

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

var pngHeader = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00")

func TestSaveAttachment(t *testing.T) {
	dir := t.TempDir()
	if out, err := exec.Command("git", "-C", dir, "init", "-q").CombinedOutput(); err != nil {
		t.Skipf("git init: %v %s", err, out)
	}
	ctx := context.Background()

	a, err := SaveAttachment(ctx, dir, "../../Screen Shot 2026.png", pngHeader)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Dir(a.Path) != filepath.Join(dir, ".berth", "attachments") {
		t.Errorf("path %q is outside the worktree's attachments", a.Path)
	}
	if !strings.HasSuffix(a.Name, "-Screen-Shot-2026.png") || a.Type != "image/png" || a.Size != len(pngHeader) {
		t.Errorf("got %+v", a)
	}
	if fi, err := os.Stat(a.Path); err != nil || fi.Mode().Perm() != 0o600 {
		t.Errorf("file mode: %v %v", fi.Mode(), err)
	}

	// A second upload in the same second gets its own file.
	b, err := SaveAttachment(ctx, dir, "Screen Shot 2026.png", pngHeader)
	if err != nil || b.Path == a.Path {
		t.Errorf("second upload: %+v %v", b, err)
	}

	// The type comes from the bytes, not the name.
	if c, err := SaveAttachment(ctx, dir, "notes.png", []byte("hello\n")); err != nil || c.Type != "text/plain" || !strings.HasSuffix(c.Name, "-notes.txt") {
		t.Errorf("text named .png: %+v %v", c, err)
	}
	if c, err := SaveAttachment(ctx, dir, "main.go", []byte("package main\n")); err != nil || !strings.HasSuffix(c.Name, "-main.go") {
		t.Errorf("go file: %+v %v", c, err)
	}
	var he httpError
	if _, err := SaveAttachment(ctx, dir, "a.bin", []byte{0x7f, 'E', 'L', 'F', 0, 1, 2}); !errors.As(err, &he) || he.status != http.StatusUnsupportedMediaType {
		t.Errorf("binary: %v", err)
	}
	if _, err := SaveAttachment(ctx, dir, "big.txt", bytes.Repeat([]byte("a"), MaxAttachment+1)); !errors.As(err, &he) || he.status != http.StatusRequestEntityTooLarge {
		t.Errorf("too big: %v", err)
	}

	// git never sees them, and the exclude line is written once.
	ex, _ := os.ReadFile(filepath.Join(dir, ".git", "info", "exclude"))
	if strings.Count(string(ex), ".berth/attachments/\n") != 1 {
		t.Errorf("exclude: %q", ex)
	}
	if out, _ := exec.Command("git", "-C", dir, "status", "--porcelain").Output(); len(out) != 0 {
		t.Errorf("git sees attachments: %s", out)
	}
	if _, err := os.Stat(filepath.Join(dir, ".gitignore")); err == nil {
		t.Error("wrote a .gitignore")
	}
}

func TestReadAttachment(t *testing.T) {
	body := `{"name":"shot.png","data":"` + base64.StdEncoding.EncodeToString(pngHeader) + `"}`
	r := httptest.NewRequest("POST", "/v1/sessions/s/attachments", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	name, data, err := readAttachment(r)
	if err != nil || name != "shot.png" || !bytes.Equal(data, pngHeader) {
		t.Errorf("json: %q %v", name, err)
	}
	r = httptest.NewRequest("POST", "/v1/sessions/s/attachments?name=raw.png", bytes.NewReader(pngHeader))
	r.Header.Set("Content-Type", "image/png")
	name, data, err = readAttachment(r)
	if err != nil || name != "raw.png" || !bytes.Equal(data, pngHeader) {
		t.Errorf("raw: %q %v", name, err)
	}
}
