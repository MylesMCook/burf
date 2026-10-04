package box

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// detectCheck finds how a repository is tested, for a check's default when
// its config names none: package.json's test script run by the package
// manager its lockfile names, go test for a Go module, cargo test for a
// crate, or a Makefile's test target. It reads a few small files at the
// repository's root and never runs anything; "" when it finds nothing.
func detectCheck(dir string) string {
	exists := func(name string) bool {
		_, err := os.Stat(filepath.Join(dir, name))
		return err == nil
	}
	if b, err := readSmall(filepath.Join(dir, "package.json")); err == nil {
		var pkg struct {
			Scripts map[string]string `json:"scripts"`
		}
		// npm init's placeholder fails on purpose: it is not a test.
		if json.Unmarshal(b, &pkg) == nil {
			if t := pkg.Scripts["test"]; t != "" && !strings.Contains(t, "no test specified") {
				switch {
				case exists("pnpm-lock.yaml"):
					return "pnpm test"
				case exists("yarn.lock"):
					return "yarn test"
				case exists("bun.lockb"), exists("bun.lock"):
					return "bun run test"
				default:
					return "npm test"
				}
			}
		}
	}
	if exists("go.mod") {
		return "go test ./..."
	}
	if exists("Cargo.toml") {
		return "cargo test"
	}
	for _, name := range []string{"Makefile", "makefile", "GNUmakefile"} {
		f, err := os.Open(filepath.Join(dir, name))
		if err != nil {
			continue
		}
		s := bufio.NewScanner(f)
		for s.Scan() {
			if line := s.Text(); strings.HasPrefix(line, "test:") || strings.HasPrefix(line, "test ") && strings.Contains(line, ":") && !strings.Contains(line, "=") {
				f.Close()
				return "make test"
			}
		}
		f.Close()
	}
	return ""
}

// readSmall reads a file of at most 256 KB.
func readSmall(path string) ([]byte, error) {
	st, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if st.Size() > 256<<10 {
		return nil, os.ErrInvalid
	}
	return os.ReadFile(path)
}
