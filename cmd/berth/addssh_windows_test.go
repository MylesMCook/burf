package main

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/windows"
)

// The native OpenSSH client must pass the entire network as one literal
// argument to a native executable, including shell metacharacters.
func TestNetworkNameCannotInjectIntoProxyCommand(t *testing.T) {
	system, err := windows.GetSystemDirectory()
	if err != nil {
		t.Fatal(err)
	}
	ssh := filepath.Join(system, "OpenSSH", "ssh.exe")
	if _, err := os.Stat(ssh); os.IsNotExist(err) {
		t.Skip("native Windows OpenSSH is not installed")
	} else if err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join(t.TempDir(), "Berth's & (%h) install")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	exe := filepath.Join(dir, "proxy helper.exe")
	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Link(self, exe); err != nil {
		data, err := os.ReadFile(self)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(exe, data, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	marker := filepath.Join(t.TempDir(), "proxycmd-ran")
	for _, network := range []string{"personal", "work net", "x&echo injected>" + marker, "x|echo injected>" + marker, `x" y\`, "%h%p", "$(touch " + marker + ")", "`touch " + marker + "`"} {
		t.Run(network, func(t *testing.T) {
			result := filepath.Join(t.TempDir(), "args.json")
			command := strings.TrimPrefix(proxyCommand(exe, network), "ProxyCommand=")
			command = strings.Replace(command, " network proxy ", " -test.run=^TestSSHProxyProcessHelper$ -- network proxy ", 1)
			ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
			defer cancel()
			cmd := exec.CommandContext(ctx, ssh, "-F", os.DevNull,
				"-o", "ProxyCommand="+command, "-o", "BatchMode=yes",
				"-o", "IdentityFile=none", "-o", "IdentityAgent=none", "-o", "IdentitiesOnly=yes",
				"-o", "UserKnownHostsFile="+os.DevNull, "-o", "GlobalKnownHostsFile="+os.DevNull,
				"-o", "ConnectTimeout=5", "127.0.0.1")
			cmd.Env = append(os.Environ(), "BERTH_TEST_PROXY_HELPER=1", "BERTH_TEST_PROXY_RESULT="+result)
			out, _ := cmd.CombinedOutput() // The helper closes before an SSH handshake.
			if ctx.Err() != nil {
				t.Fatalf("native OpenSSH probe did not exit: %v\n%s", ctx.Err(), out)
			}
			data, err := os.ReadFile(result)
			if err != nil {
				t.Fatalf("OpenSSH did not launch the proxy helper: %v\n%s", err, out)
			}
			var args []string
			if err := json.Unmarshal(data, &args); err != nil {
				t.Fatal(err)
			}
			want := []string{"network", "proxy", network, "127.0.0.1", "22"}
			if !reflect.DeepEqual(args, want) {
				t.Fatalf("native proxy arguments = %#v, want %#v\n%s", args, want, out)
			}
			if _, err := os.Stat(marker); !os.IsNotExist(err) {
				t.Fatalf("network name %q ran a command: %v", network, err)
			}
		})
	}
}

func TestSSHProxyProcessHelper(t *testing.T) {
	if os.Getenv("BERTH_TEST_PROXY_HELPER") != "1" {
		return
	}
	for i, arg := range os.Args {
		if arg == "--" {
			data, err := json.Marshal(os.Args[i+1:])
			if err == nil {
				err = os.WriteFile(os.Getenv("BERTH_TEST_PROXY_RESULT"), data, 0o600)
			}
			if err != nil {
				os.Exit(1)
			}
			os.Exit(0)
		}
	}
	os.Exit(2)
}

func TestWindowsAddSSHRefusesBeforeInspectingAnIdentity(t *testing.T) {
	missing := filepath.Join(t.TempDir(), "identity-that-does-not-exist")
	err := addSSHSteps(laptop{}, []string{"user@127.0.0.1", "--identity", missing})
	if err == nil || !strings.Contains(err.Error(), "SSH provisioning from Windows is not supported") {
		t.Fatalf("Windows add ssh = %v, want the platform refusal before key inspection", err)
	}
	if !strings.Contains(err.Error(), "berth pair") {
		t.Fatalf("the refusal omitted the supported pairing path: %v", err)
	}
}
