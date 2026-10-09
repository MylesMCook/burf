package hooks

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/MylesMCook/burf/internal/events"
)

func allow(t *testing.T, dir string) {
	t.Helper()
	h, err := PluginHash(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := AllowPlugin(dir, h); err != nil {
		t.Fatal(err)
	}
}

func plugin(t *testing.T, manifest, main string) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "plugins", "p")
	os.MkdirAll(filepath.Join(dir, "dist"), 0o700)
	os.WriteFile(filepath.Join(dir, PluginManifest), []byte(manifest), 0o600)
	if main != "" {
		os.WriteFile(filepath.Join(dir, "dist", "index.js"), []byte(main), 0o600)
	}
	return dir
}

func TestAnInstalledPluginIsNeverOnByDefault(t *testing.T) {
	for _, manifest := range []string{`{}`, `{"defaultEnabled": true}`, `{"main":"dist/index.js","defaultEnabled":true}`} {
		dir := plugin(t, manifest, "export default () => {}")
		if PluginEnabled(dir) {
			t.Fatalf("%s is on without being allowed", manifest)
		}
		// A plugin cannot allow itself by shipping the old marker file.
		os.WriteFile(filepath.Join(dir, "enabled"), nil, 0o600)
		if PluginEnabled(dir) {
			t.Fatalf("%s turned itself on with an enabled file", manifest)
		}
	}
}

func TestAllowingAPluginIsBoundToWhatWasReviewed(t *testing.T) {
	dir := plugin(t, `{"main":"dist/index.js"}`, "export default () => {}")
	if err := AllowPlugin(dir, "sha256:00"); err != ErrPluginChanged {
		t.Fatalf("allowing a hash that is not the plugin's: %v", err)
	}
	if PluginEnabled(dir) {
		t.Fatal("on after a refused allow")
	}
	allow(t, dir)
	st := PluginStatus(dir)
	if !st.Enabled || st.Changed || st.Allowed == "" {
		t.Fatalf("after allowing: %+v", st)
	}
	// The grant lives beside the plugins folder, not in the plugin's.
	if _, err := os.Stat(filepath.Join(filepath.Dir(filepath.Dir(dir)), "plugins.json")); err != nil {
		t.Fatalf("grants file: %v", err)
	}

	// Changing the code turns it off until it is allowed again.
	os.WriteFile(filepath.Join(dir, "dist", "index.js"), []byte("export default () => { steal() }"), 0o600)
	if st := PluginStatus(dir); st.Enabled || !st.Changed {
		t.Fatalf("after its code changed: %+v", st)
	}
	allow(t, dir)
	if !PluginEnabled(dir) {
		t.Fatal("allowing the new code did not turn it on")
	}
	// So does changing the manifest, which lists its hooks.
	os.WriteFile(filepath.Join(dir, PluginManifest), []byte(`{"main":"dist/index.js","hooks":[{"on":"*","run":"curl evil"}]}`), 0o600)
	if st := PluginStatus(dir); st.Enabled || !st.Changed {
		t.Fatalf("after its manifest changed: %+v", st)
	}
	allow(t, dir)

	// Turning it off forgets the grant, so turning it on asks again.
	if err := ForbidPlugin(dir); err != nil {
		t.Fatal(err)
	}
	if st := PluginStatus(dir); st.Enabled || st.Allowed != "" {
		t.Fatalf("after turning it off: %+v", st)
	}
}

func TestAPluginsChangedHooksDoNotRunUntilAllowedAgain(t *testing.T) {
	dir := plugin(t, `{"hooks":[{"on":"before:session.start","run":"exit 3"}]}`, "")
	allow(t, dir)
	r := &Runner{Path: filepath.Join(t.TempDir(), "missing.json"), PluginsDir: filepath.Dir(dir)}
	if err := r.Before(context.Background(), events.Event{Type: "session.start"}); err == nil {
		t.Fatal("the allowed hook did not run")
	}
	os.WriteFile(filepath.Join(dir, PluginManifest), []byte(`{"hooks":[{"on":"before:session.start","run":"exit 4"}]}`), 0o600)
	if err := r.Before(context.Background(), events.Event{Type: "session.start"}); err != nil {
		t.Fatalf("a changed hook ran without being allowed: %v", err)
	}
}

func TestPluginHashStaysInsideTheFolder(t *testing.T) {
	dir := plugin(t, `{"main":"../../../../etc/hosts"}`, "")
	if _, err := PluginHash(dir); err == nil {
		t.Fatal("hashed a main outside the plugin")
	}
	// The same bytes hash the same way the app computes it.
	dir = plugin(t, `{"main":"dist/index.js"}`, "x")
	h, err := PluginHash(dir)
	if err != nil || h != HashPluginFiles([]byte(`{"main":"dist/index.js"}`), []byte("x")) {
		t.Fatalf("hash %q %v", h, err)
	}
}

// The app hashes a plugin the same way before importing it
// (app/src/plugins/consent-core.ts; app/scripts/check-plugin-consent.mjs
// checks this same vector), so the two must agree byte for byte.
func TestPluginHashMatchesTheApp(t *testing.T) {
	got := HashPluginFiles([]byte(`{"id":"évil","main":"dist/index.js"}`), []byte("export default () => {}\n"))
	if want := "sha256:3e0cdbeb35f4f5a762f6c81c61162292d8498c56bf874bc3df21eaea4b2bac41"; got != want {
		t.Fatalf("hash = %s, want %s", got, want)
	}
}

func TestABoxPluginCanBeAllowedByHand(t *testing.T) {
	dir := plugin(t, `{"hooks":[{"on":"agent.finished","run":"true"}]}`, "")
	os.WriteFile(PluginGrantsPath(filepath.Dir(dir)), []byte(`{"plugins":{"p":{}}}`), 0o600)
	if !PluginEnabled(dir) {
		t.Fatal("a hand-written grant without a hash did not turn it on")
	}
	os.WriteFile(filepath.Join(dir, "disabled"), nil, 0o600)
	if PluginEnabled(dir) {
		t.Fatal("a disabled file must keep it off")
	}
}
