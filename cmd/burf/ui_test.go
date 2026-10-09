package main

import (
	"archive/zip"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func uiBuild(t *testing.T, body string) string {
	t.Helper()
	dir := t.TempDir()
	for name, data := range map[string]string{"index.html": "<html>" + body + "</html>", "assets/nested/app.js": body} {
		if err := writeUIFile(dir, name, []byte(data)); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func uiRead(t *testing.T, dir, name string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(dir, name))
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func uiZip(t *testing.T, entries map[string]string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "ui.zip")
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	w := zip.NewWriter(f)
	for name, body := range entries {
		entry, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := entry.Write([]byte(body)); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestUIInstallSwapRollbackAndRemove(t *testing.T) {
	home := t.TempDir()
	dir := filepath.Join(home, "ui")
	first := uiBuild(t, "first")
	if err := uiCommand(home, []string{"install", first}); err != nil {
		t.Fatal(err)
	}
	current := filepath.Join(dir, "current")
	s := inspectUI(current)
	if !s.Installed || !s.Whole || !s.Compatible || s.Version != "unversioned" {
		t.Fatalf("status: %+v", s)
	}
	if _, err := os.Stat(filepath.Join(first, "manifest.json")); !os.IsNotExist(err) {
		t.Fatal("install changed source folder")
	}
	if err := uiCommand(home, []string{"install", uiBuild(t, "second")}); err != nil {
		t.Fatal(err)
	}
	if got := uiRead(t, dir, "previous/assets/nested/app.js"); got != "first" {
		t.Fatal(got)
	}
	if got := uiRead(t, dir, "current/assets/nested/app.js"); got != "second" {
		t.Fatal(got)
	}
	if err := uiCommand(home, []string{"rollback"}); err != nil {
		t.Fatal(err)
	}
	if got := uiRead(t, dir, "current/assets/nested/app.js"); got != "first" {
		t.Fatal(got)
	}
	if got := uiRead(t, dir, "previous/assets/nested/app.js"); got != "second" {
		t.Fatal(got)
	}
	if err := uiCommand(home, []string{"remove"}); err != nil {
		t.Fatal(err)
	}
	if inspectUI(current).Installed {
		t.Fatal("current remains")
	}
	if !inspectUI(filepath.Join(dir, "previous")).Whole {
		t.Fatal("remove lost recovery copy")
	}
	if err := uiCommand(home, []string{"rollback"}); err != nil {
		t.Fatal(err)
	}
	if got := uiRead(t, dir, "current/assets/nested/app.js"); got != "second" {
		t.Fatal(got)
	}
}

func TestUIInstallZipLayouts(t *testing.T) {
	for _, prefix := range []string{"", "dist/"} {
		t.Run(prefix, func(t *testing.T) {
			dir := t.TempDir()
			z := uiZip(t, map[string]string{prefix + "index.html": "<html>zip</html>", prefix + "assets/app.js": "zip"})
			if err := installUI(dir, z); err != nil {
				t.Fatal(err)
			}
			if got := uiRead(t, dir, "current/assets/app.js"); got != "zip" {
				t.Fatal(got)
			}
			if !inspectUI(filepath.Join(dir, "current")).Whole {
				t.Fatal("zip is not whole")
			}
		})
	}
}

func TestUIRefusesDamageAndWrongShellWithoutChangingCurrent(t *testing.T) {
	dir := t.TempDir()
	if err := installUI(dir, uiBuild(t, "good")); err != nil {
		t.Fatal(err)
	}
	current := filepath.Join(dir, "current")
	m, err := checkUI(current)
	if err != nil {
		t.Fatal(err)
	}
	bad := uiBuild(t, "good")
	m.Shell = "wrong"
	data, _ := json.Marshal(m)
	if err := writeUIFile(bad, "manifest.json", data); err != nil {
		t.Fatal(err)
	}
	if err := installUI(dir, bad); err == nil {
		t.Fatal("wrong shell accepted")
	}
	if got := uiRead(t, current, "assets/nested/app.js"); got != "good" {
		t.Fatal(got)
	}
	m.Shell = inspectUI(current).Shell
	data, _ = json.Marshal(m)
	if err := os.WriteFile(filepath.Join(bad, "manifest.json"), data, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(bad, "assets/nested/app.js"), []byte("damaged"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := installUI(dir, bad); err == nil {
		t.Fatal("damaged build accepted")
	}
	if err := os.WriteFile(filepath.Join(current, "assets/nested/app.js"), []byte("damaged"), 0o600); err != nil {
		t.Fatal(err)
	}
	s := inspectUI(current)
	if !s.Installed || s.Whole || !strings.Contains(s.Reason, "checksum") || s.Version == "" {
		t.Fatalf("status: %+v", s)
	}
	if err := os.Remove(filepath.Join(current, "assets/nested/app.js")); err != nil {
		t.Fatal(err)
	}
	if inspectUI(current).Whole {
		t.Fatal("missing asset accepted")
	}
}

func TestUIRefusesZipSlipAndLinks(t *testing.T) {
	for _, path := range []string{"../outside", "/tmp/outside", "assets/../../outside", "C:/outside", "assets\\outside"} {
		t.Run(path, func(t *testing.T) {
			dir := t.TempDir()
			if err := installUI(dir, uiZip(t, map[string]string{"index.html": "ok", path: "bad"})); err == nil {
				t.Fatal("unsafe zip accepted")
			}
			if inspectUI(filepath.Join(dir, "current")).Installed {
				t.Fatal("failed install replaced current")
			}
		})
	}
	build := uiBuild(t, "source")
	if err := os.Symlink(filepath.Join(build, "index.html"), filepath.Join(build, "link")); err != nil {
		t.Skipf("symlink unavailable: %v", err)
	}
	if err := installUI(t.TempDir(), build); err == nil {
		t.Fatal("source link accepted")
	}
}

func TestUIFailedSwapRestoresBothVersions(t *testing.T) {
	dir := t.TempDir()
	if err := installUI(dir, uiBuild(t, "first")); err != nil {
		t.Fatal(err)
	}
	if err := installUI(dir, uiBuild(t, "second")); err != nil {
		t.Fatal(err)
	}
	if err := swapUI(dir, filepath.Join(dir, "missing-stage")); err == nil {
		t.Fatal("missing stage accepted")
	}
	if got := uiRead(t, dir, "current/assets/nested/app.js"); got != "second" {
		t.Fatal(got)
	}
	if got := uiRead(t, dir, "previous/assets/nested/app.js"); got != "first" {
		t.Fatal(got)
	}
}

func TestUICommandArgumentsAndStatus(t *testing.T) {
	home := t.TempDir()
	for _, args := range [][]string{nil, {"install"}, {"remove", "extra"}, {"rollback", "extra"}, {"status", "bad"}, {"bad"}} {
		if err := uiCommand(home, args); err == nil {
			t.Fatalf("accepted %v", args)
		}
	}
	if err := uiCommand(home, []string{"status", "--json"}); err != nil {
		t.Fatal(err)
	}
	if err := uiCommand(home, []string{"rollback"}); err == nil {
		t.Fatal("rollback without previous succeeded")
	}
}
