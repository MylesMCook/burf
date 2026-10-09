package integrations

import (
	"os"
	"path/filepath"
	"testing"
)

func TestStrictAccountSettingsCanBeAbsentOrRead(t *testing.T) {
	root := t.TempDir()
	f := files{root: root, strict: true}
	if _, err := f.read("settings.json"); !os.IsNotExist(err) {
		t.Fatalf("optional missing settings must report not-exist: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "settings.json"), []byte("{}"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got, err := f.read("settings.json"); err != nil || string(got) != "{}" {
		t.Fatalf("strict settings read = %q, %v", got, err)
	}
}
