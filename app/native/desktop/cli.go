package desktop

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

type agentBinary struct {
	Path   string `json:"path"`
	Source string `json:"source"`
}

// Development is set only by the development build tag. Environment variables
// cannot enable executable discovery in a packaged app.
func findCLI() *agentBinary {
	if development {
		if override := os.Getenv("BERTH_CLI"); override != "" {
			if filepath.IsAbs(override) && executable(override) {
				return &agentBinary{override, "installed"}
			}
			return nil
		}
	}
	if path := bundledCLI(); path != "" {
		return &agentBinary{path, "bundled"}
	}
	if development {
		_, file, _, ok := runtime.Caller(0)
		if ok {
			p := filepath.Clean(filepath.Join(filepath.Dir(file), "../../../bin", cliName()))
			if executable(p) {
				return &agentBinary{p, "repository"}
			}
		}
		if runtime.GOOS != "windows" {
			home, _ := os.UserHomeDir()
			for _, p := range []string{filepath.Join(home, ".local/bin/burf"), "/opt/homebrew/bin/burf", "/usr/local/bin/burf"} {
				if executable(p) {
					return &agentBinary{p, "installed"}
				}
			}
		}
	}
	return nil
}

func cliName() string {
	if runtime.GOOS == "windows" {
		return "burf.exe"
	}
	return "burf"
}

func bundledCLI() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	dir := filepath.Dir(exe)
	if runtime.GOOS == "darwin" && !development && !strings.HasSuffix(dir, "/Contents/MacOS") {
		return ""
	}
	name := "burf-cli"
	if runtime.GOOS == "windows" {
		name = "berth-cli.exe"
	}
	p := filepath.Join(dir, name)
	if !executable(p) || (!development && !signedLike(exe, p)) {
		return ""
	}
	return p
}

func executable(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular() && (runtime.GOOS == "windows" || info.Mode().Perm()&0111 != 0)
}

type boundedOutput struct{ bytes.Buffer }

func (b *boundedOutput) Write(p []byte) (int, error) {
	n := len(p)
	if left := (1 << 20) - b.Len(); left > 0 {
		if len(p) > left {
			p = p[:left]
		}
		_, _ = b.Buffer.Write(p)
	}
	return n, nil
}

func runCLI(ctx context.Context, args ...string) (string, error) {
	if err := ordinaryUser(); err != nil {
		return "", err
	}
	bin := findCLI()
	if bin == nil {
		return "", errors.New("Burf could not find its bundled burf command")
	}
	ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, bin.Path, args...)
	backgroundCommand(command)
	var stdout, stderr boundedOutput
	command.Stdout, command.Stderr = &stdout, &stderr
	if err := command.Run(); err != nil {
		if ctx.Err() != nil {
			return "", fmt.Errorf("burf command did not finish: %w; check agent status before retrying", ctx.Err())
		}
		if message := strings.TrimSpace(stderr.String()); message != "" {
			return "", errors.New(message)
		}
		if message := strings.TrimSpace(stdout.String()); message != "" {
			return "", errors.New(message)
		}
		return "", fmt.Errorf("burf %s: %w", strings.Join(args, " "), err)
	}
	return strings.TrimSpace(stdout.String()), nil
}
