package agent

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"

	"github.com/MylesMCook/burf/internal/sshroute/sshtest"
	"time"
)

type cliFixture struct {
	Mode, Count, Release, Status, Image, Args string
}

// TestMain lets copies of this test executable stand in for delegated CLIs.
func TestMain(m *testing.M) {
	// Upstream route tests use this executable as an isolated SSH peer.
	sshtest.MaybeRun()
	name := strings.TrimSuffix(filepath.Base(os.Args[0]), ".exe")
	if name == "fake-berth" || name == "codex" {
		data, err := os.ReadFile(os.Args[0] + ".json")
		var fixture cliFixture
		if err == nil {
			err = json.Unmarshal(data, &fixture)
		}
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
		os.Exit(runFixture(fixture, os.Args[1:]))
	}
	os.Exit(m.Run())
}

func cliFixturePath(dir, name string) string {
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	return filepath.Join(dir, name)
}

func installCLI(t *testing.T, path string, fixture cliFixture) {
	t.Helper()
	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	// Each fixture has its own executable name and configuration.
	if err := os.Link(exe, path); err != nil {
		if _, statErr := os.Stat(path); statErr == nil {
			t.Fatalf("CLI fixture already exists: %s", path)
		}
		data, err := os.ReadFile(exe)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, data, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	data, err := json.Marshal(fixture)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path+".json", data, 0o600); err != nil {
		t.Fatal(err)
	}
}

func runFixture(f cliFixture, args []string) int {
	joined := strings.Join(args, " ")
	switch f.Mode {
	case "manage":
		if len(args) > 2 {
			switch args[2] {
			case "fail.example":
				fmt.Println("Checking fail.example")
				fmt.Fprintln(os.Stderr, "berth: ssh: could not resolve fail.example")
				return 1
			case "refused.example":
				fmt.Println("Using your SSH agent")
				if os.Getenv("BERTH_FAILURE_JSON") == "1" {
					fmt.Fprintln(os.Stderr, `berth-failure: {"kind":"refused","host":"refused.example","port":"22","message":"Nothing is accepting SSH on refused.example (port 22)."}`)
				}
				fmt.Fprintln(os.Stderr, "berth: Nothing is accepting SSH on refused.example (port 22).")
				return 1
			}
		}
		if len(args) > 0 && args[0] == "pair" {
			json.NewEncoder(os.Stdout).Encode(map[string]string{"name": "devl", "args": joined, "home": os.Getenv("BERTH_HOME")})
		} else {
			fmt.Println("step one")
			fmt.Println("ran " + joined)
		}
	case "join":
		input, err := io.ReadAll(os.Stdin)
		if err != nil {
			return 1
		}
		json.NewEncoder(os.Stdout).Encode(map[string]string{"args": joined, "stdin": strings.TrimRight(string(input), "\r\n")})
	case "outdated":
		file, err := os.OpenFile(f.Count, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
		if err != nil {
			return 1
		}
		fmt.Fprintln(file, "x")
		file.Close()
		if len(args) >= 4 && args[0] == "upgrade" && args[2] == "--check" && args[3] == "--json" {
			json.NewEncoder(os.Stdout).Encode(OutdatedBox{Box: args[1], Current: "aaa", Available: "bbb", Outdated: true})
		} else {
			fmt.Println("ran " + joined)
		}
	case "restart":
		fmt.Println("started")
		for {
			if _, err := os.Stat(f.Release); err == nil {
				break
			}
			time.Sleep(50 * time.Millisecond)
		}
		fmt.Println("ran " + joined)
	case "codex":
		if len(args) > 0 && args[0] == "login" {
			fmt.Println(f.Status)
			if !strings.HasPrefix(f.Status, "Logged") {
				return 1
			}
			return 0
		}
		if err := os.WriteFile(f.Args, []byte(strings.Join(args, "\n")+"\n"), 0o600); err != nil {
			return 1
		}
		if f.Image != "" {
			data, err := os.ReadFile(f.Image)
			if err != nil {
				return 1
			}
			dir := filepath.Join(os.Getenv("CODEX_HOME"), "generated_images", "th-1")
			if os.MkdirAll(dir, 0o755) != nil || os.WriteFile(filepath.Join(dir, "exec-1.png"), data, 0o644) != nil {
				return 1
			}
		}
		fmt.Println(`{"type":"thread.started","thread_id":"th-1"}`)
		fmt.Println(`{"type":"item.completed","item":{"id":"i","type":"agent_message","text":"I cannot do that"}}`)
	default:
		fmt.Fprintln(os.Stderr, "unknown fixture mode: "+f.Mode)
		return 2
	}
	return 0
}

func writeFile(t *testing.T, path, content string, mode os.FileMode) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), mode); err != nil {
		t.Fatal(err)
	}
}

var ran struct {
	sync.Mutex
	commands [][]string
}

func recordRun(cmd []string) error {
	ran.Lock()
	ran.commands = append(ran.commands, cmd)
	ran.Unlock()
	return nil
}

func lastRun() []string {
	ran.Lock()
	defer ran.Unlock()
	if len(ran.commands) == 0 {
		return nil
	}
	return ran.commands[len(ran.commands)-1]
}
