package box

import (
	"os"
	"path/filepath"
	"testing"
)

func TestTheCheckDefaultsToHowTheRepositoryTests(t *testing.T) {
	for _, c := range []struct {
		files map[string]string
		want  string
	}{
		{map[string]string{"package.json": `{"scripts":{"test":"vitest run"}}`, "pnpm-lock.yaml": ""}, "pnpm test"},
		{map[string]string{"package.json": `{"scripts":{"test":"jest"}}`, "yarn.lock": ""}, "yarn test"},
		{map[string]string{"package.json": `{"scripts":{"test":"jest"}}`, "bun.lock": ""}, "bun run test"},
		{map[string]string{"package.json": `{"scripts":{"test":"jest"}}`}, "npm test"},
		{map[string]string{"package.json": `{"scripts":{"test":"echo \"Error: no test specified\" && exit 1"}}`}, ""},
		{map[string]string{"go.mod": "module x"}, "go test ./..."},
		{map[string]string{"Cargo.toml": "[package]"}, "cargo test"},
		{map[string]string{"Makefile": "build:\n\tgo build\ntest: build\n\tgo test\n"}, "make test"},
		{map[string]string{"Makefile": "TEST := 1\nbuild:\n"}, ""},
		{map[string]string{"README.md": "hi"}, ""},
	} {
		dir := t.TempDir()
		for name, body := range c.files {
			os.WriteFile(filepath.Join(dir, name), []byte(body), 0o600)
		}
		if got := detectCheck(dir); got != c.want {
			t.Errorf("%v: check = %q, want %q", c.files, got, c.want)
		}
	}
}
