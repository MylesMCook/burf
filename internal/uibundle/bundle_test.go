package uibundle

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
)

func folder(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	write(t, dir, "index.html", []byte("<html><script type=importmap>{\"imports\":{}}</script></html>"))
	write(t, dir, "assets/nested/app.js", []byte("export default 'folder'"))
	manifest(t, dir, "1")
	return dir
}

func write(t *testing.T, dir, name string, data []byte) {
	t.Helper()
	file := filepath.Join(dir, filepath.FromSlash(name))
	if err := os.MkdirAll(filepath.Dir(file), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(file, data, 0o600); err != nil {
		t.Fatal(err)
	}
}

func manifest(t *testing.T, dir, shell string) {
	t.Helper()
	m := Manifest{Shell: shell, Version: "folder-version", Files: make(map[string]string)}
	for _, name := range []string{"index.html", "assets/nested/app.js"} {
		data, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(name)))
		if err != nil {
			t.Fatal(err)
		}
		sum := sha256.Sum256(data)
		m.Files[name] = hex.EncodeToString(sum[:])
	}
	data, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	write(t, dir, "manifest.json", data)
}

func builtin() fstest.MapFS {
	return fstest.MapFS{
		"index.html":           &fstest.MapFile{Data: []byte("built-in index")},
		"assets/nested/app.js": &fstest.MapFile{Data: []byte("built-in script")},
	}
}

func read(t *testing.T, assets fs.FS, name string) string {
	t.Helper()
	data, err := fs.ReadFile(assets, name)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func TestSelectedFolderKeepsVerifiedBytesAfterSourceChanges(t *testing.T) {
	dir := folder(t)
	assets, info, err := Select(builtin(), dir, false, "1", "built-in-version")
	if err != nil || info.Source != "folder" || info.Version != "folder-version" || info.Shell != "1" {
		t.Fatalf("select: %+v, %v", info, err)
	}
	if err := fstest.TestFS(assets, "index.html", "assets/nested/app.js"); err != nil {
		t.Fatal(err)
	}
	write(t, dir, "assets/nested/app.js", []byte("changed after verification"))
	if got := read(t, assets, "assets/nested/app.js"); got != "export default 'folder'" {
		t.Fatal(got)
	}
	data, err := fs.ReadFile(assets, "index.html")
	if err != nil {
		t.Fatal(err)
	}
	data[0] = '!'
	if !strings.HasPrefix(read(t, assets, "index.html"), "<html>") {
		t.Fatal("reader returned writable backing bytes")
	}
	file, err := assets.Open("index.html")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	if _, ok := file.(io.WriterTo); ok {
		t.Fatal("asset reader can pass its private backing bytes to an external writer")
	}
	if err := os.RemoveAll(dir); err != nil {
		t.Fatal(err)
	}
	if got := read(t, assets, "assets/nested/app.js"); got != "export default 'folder'" {
		t.Fatal(got)
	}
}

func TestSnapshotRejectsSpecialFileTypes(t *testing.T) {
	for _, mode := range []fs.FileMode{fs.ModeSymlink, fs.ModeNamedPipe, fs.ModeDevice, fs.ModeSocket} {
		input := fstest.MapFS{"special": &fstest.MapFile{Data: []byte("not regular"), Mode: mode}}
		if _, err := snapshotFS(input); err == nil {
			t.Errorf("accepted %s", mode)
		}
	}
}

func TestRejectedFolderFallsBackForEveryAsset(t *testing.T) {
	for _, damage := range []string{"changed", "missing", "extra", "manifest", "shell", "html", "override", "absent"} {
		t.Run(damage, func(t *testing.T) {
			dir := folder(t)
			switch damage {
			case "changed":
				write(t, dir, "assets/nested/app.js", []byte("changed"))
			case "missing":
				if err := os.Remove(filepath.Join(dir, "assets/nested/app.js")); err != nil {
					t.Fatal(err)
				}
			case "extra":
				write(t, dir, "extra.js", []byte("extra"))
			case "manifest":
				write(t, dir, "manifest.json", []byte("{bad json"))
			case "shell":
				manifest(t, dir, "2")
			case "html":
				write(t, dir, "index.html", []byte{0xff})
				manifest(t, dir, "1")
			case "absent":
				dir = filepath.Join(dir, "missing")
			}
			compiled := builtin()
			assets, info, err := Select(compiled, dir, damage == "override", "1", "built-in-version")
			if err != nil || info.Source != "built-in" || info.Version != "built-in-version" || info.Reason == "" {
				t.Fatalf("fallback: %+v, %v", info, err)
			}
			if damage == "override" && !strings.Contains(info.Reason, BuiltinEnv) {
				t.Fatal(info.Reason)
			}
			compiled["index.html"].Data = []byte("mutable built-in source changed")
			if read(t, assets, "index.html") != "built-in index" || read(t, assets, "assets/nested/app.js") != "built-in script" {
				t.Fatal("fallback mixed the built-in and folder bytes")
			}
			if _, err := fs.Stat(assets, "manifest.json"); !os.IsNotExist(err) {
				t.Fatalf("folder manifest leaked into fallback: %v", err)
			}
		})
	}
}

func TestVerifyReportsWholeBundleWithoutDecidingCompatibility(t *testing.T) {
	dir := folder(t)
	manifest(t, dir, "other-shell")
	assets, m, err := Verify(dir)
	if err != nil || m.Shell != "other-shell" || read(t, assets, "assets/nested/app.js") != "export default 'folder'" {
		t.Fatalf("verify: %+v, %v", m, err)
	}
	write(t, dir, "assets/nested/app.js", []byte("damage"))
	_, m, err = Verify(dir)
	if err == nil || !strings.Contains(err.Error(), "checksum") || m.Version != "folder-version" {
		t.Fatalf("damaged: %+v, %v", m, err)
	}
}

func TestInvalidNamesAndLinksAreRejected(t *testing.T) {
	for _, name := range []string{"", ".", "../index.html", "/index.html", "assets/../app.js", "assets//app.js", "C:/app.js", "assets\\app.js", string([]byte{0xff})} {
		if ValidPath(name) {
			t.Errorf("accepted %q", name)
		}
		if _, err := builtinSnapshot(t).Open(name); name != "." && err == nil {
			t.Errorf("opened %q", name)
		}
	}
	for _, location := range []string{"file", "parent", "root"} {
		t.Run(location, func(t *testing.T) {
			dir := folder(t)
			link := filepath.Join(dir, "linked")
			target := filepath.Join(dir, "index.html")
			if location == "parent" || location == "root" {
				target = dir
			}
			if location == "root" {
				link = filepath.Join(t.TempDir(), "linked")
			}
			if err := os.Symlink(target, link); err != nil {
				t.Skipf("symlinks unavailable: %v", err)
			}
			if location == "root" {
				dir = link
			}
			if _, err := Snapshot(dir); err == nil {
				t.Fatal("link accepted")
			}
		})
	}
}

func TestSnapshotRejectsOversizedAssetBeforeReadingItsBytes(t *testing.T) {
	dir := t.TempDir()
	write(t, dir, "large.js", nil)
	if err := os.Truncate(filepath.Join(dir, "large.js"), MaxBytes+1); err != nil {
		t.Fatal(err)
	}
	if _, err := Snapshot(dir); err == nil || !strings.Contains(err.Error(), "512 MiB") {
		t.Fatalf("oversized asset: %v", err)
	}
}

func builtinSnapshot(t *testing.T) fs.FS {
	t.Helper()
	assets, _, err := Select(builtin(), "missing", true, "1", "built-in-version")
	if err != nil {
		t.Fatal(err)
	}
	return assets
}

func TestSnapshotHTMLHashesFinalScriptsAndImportMaps(t *testing.T) {
	inline := "window.burf = 1;\n// trusted & raw\n"
	imports := `{"imports":{"x":"/x.js"}}`
	final := []byte("<html><head><script type=importmap>" + imports + "</script>" +
		"<script>window.burf = 1;\r\n// trusted & raw\r</script>" +
		"<script src='/assets/app.js'></script><script>frameworkInjected()</script></head></html>")
	policy, err := SnapshotHTML(final)
	if err != nil {
		t.Fatal(err)
	}
	for _, body := range []string{imports, inline, "frameworkInjected()"} {
		sum := sha256.Sum256([]byte(body))
		if !strings.Contains(policy, "'sha256-"+base64.StdEncoding.EncodeToString(sum[:])+"'") {
			t.Errorf("missing hash for %q: %s", body, policy)
		}
	}
	for _, forbidden := range []string{"script-src 'unsafe-inline'", "'unsafe-eval'", "ipc:"} {
		if strings.Contains(policy, forbidden) {
			t.Errorf("policy allows %q", forbidden)
		}
	}
	for _, directive := range strings.Split(policy, ";") {
		if (strings.HasPrefix(strings.TrimSpace(directive), "script-src ") || strings.HasPrefix(strings.TrimSpace(directive), "connect-src ")) && strings.Contains(directive, "https:") {
			t.Errorf("privileged app code or connections allow arbitrary HTTPS: %s", directive)
		}
	}
	for _, required := range []string{"default-src 'none'", "script-src 'self'", "http://127.0.0.1:*", "ws://127.0.0.1:*", "frame-src http://*.localhost:*", "object-src 'none'"} {
		if !strings.Contains(policy, required) {
			t.Errorf("policy misses %q", required)
		}
	}
	if _, err := SnapshotHTML([]byte{0xff}); err == nil {
		t.Fatal("invalid HTML accepted")
	}
}
