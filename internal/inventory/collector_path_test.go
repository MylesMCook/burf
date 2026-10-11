package inventory

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestDockerCollectorUnderLaunchdPath(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("macOS launchd tool discovery")
	}
	dir := t.TempDir()
	program := filepath.Join(dir, "docker")
	peer := "#!/bin/sh\nprintf '%s\\n' \"${DOCKER_HOST-unset}\" \"${DOCKER_CONTEXT-unset}\" \"$@\"\n"
	if err := os.WriteFile(program, []byte(peer), 0o700); err != nil {
		t.Fatal(err)
	}
	previous := dockerSearchDirs
	dockerSearchDirs = []string{dir}
	t.Cleanup(func() { dockerSearchDirs = previous })
	t.Setenv("PATH", t.TempDir())
	t.Setenv("DOCKER_HOST", "ssh://synthetic-remote")
	t.Setenv("DOCKER_CONTEXT", "synthetic-remote")
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	out, err := runCollector(ctx, "docker", "--host", "unix:///synthetic-local.sock", "ps")
	if err != nil {
		t.Fatalf("installed Docker must remain discoverable under launchd: %v", err)
	}
	if got := strings.TrimSpace(string(out)); got != "unset\nunset\n--host\nunix:///synthetic-local.sock\nps" {
		t.Fatalf("local endpoint/environment protection changed: %q", got)
	}
}

func TestDockerScanUnderLaunchdPath(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("macOS launchd tool discovery")
	}
	dir := t.TempDir()
	peer := `#!/bin/sh
if [ "$1" = context ]; then printf 'unix:///synthetic-local.sock\n'; exit 0; fi
[ "$1" = --host ] && [ "$2" = unix:///synthetic-local.sock ] || exit 42
[ -z "$DOCKER_HOST" ] && [ -z "$DOCKER_CONTEXT" ] || exit 43
exit 0
`
	if err := os.WriteFile(filepath.Join(dir, "docker"), []byte(peer), 0o700); err != nil {
		t.Fatal(err)
	}
	previous := dockerSearchDirs
	dockerSearchDirs = []string{dir}
	t.Cleanup(func() { dockerSearchDirs = previous })
	t.Setenv("PATH", t.TempDir())
	t.Setenv("DOCKER_HOST", "ssh://synthetic-remote")
	t.Setenv("DOCKER_CONTEXT", "synthetic-remote")
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	result := (&collector{run: runCollector, goos: "darwin"}).docker(ctx)
	if result.State != "ok" || len(result.Services) != 0 {
		t.Fatalf("full local Docker scan under launchd: %+v", result.Coverage)
	}
}
