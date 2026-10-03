// Package sshsetup is what berth needs to SSH into a box once, to install
// berthd: which key agent ssh will use, what ~/.ssh/config says about a host,
// the hosts it names, and what an ssh failure means in plain words.
//
// berth always runs the system ssh, so ~/.ssh/config (IdentityAgent, Host
// blocks, ProxyJump, User) applies as it does in a terminal. The one gap is a
// process started by launchd or a GUI, which has no SSH_AUTH_SOCK: then berth
// finds the agent the person's shell would have used.
package sshsetup

import (
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// Agent is an SSH agent's socket, and how berth found it.
type Agent struct {
	// Name says whose agent it is: "1Password", "Secretive", "your SSH agent".
	Name   string `json:"name"`
	Socket string `json:"socket"`
	// Source is "ssh-config" (IdentityAgent), "environment" (SSH_AUTH_SOCK),
	// "launchd" (launchctl getenv) or "discovered" (a key manager's socket).
	Source string `json:"source"`
}

// known is a key manager's agent socket, relative to home unless absolute.
type known struct {
	name string
	path string
	goos string // "" for any
}

// knownAgents lists key managers' agent sockets, most likely first. Each is
// used only when something is listening on it.
func knownAgents(home, goos string) []known {
	k := []known{
		{"1Password", "Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock", "darwin"},
		{"1Password", ".1password/agent.sock", "linux"},
		{"Secretive", "Library/Containers/com.maxgoedjen.Secretive.SecretAgent/Data/socket.ssh", "darwin"},
		{"Bitwarden", ".bitwarden-ssh-agent.sock", ""},
		{"Bitwarden", "Library/Containers/com.bitwarden.desktop/Data/.bitwarden-ssh-agent.sock", "darwin"},
		{"Bitwarden", "snap/bitwarden/current/.bitwarden-ssh-agent.sock", "linux"},
		{"Bitwarden", ".var/app/com.bitwarden.desktop/data/.bitwarden-ssh-agent.sock", "linux"},
		// Proton Pass's agent is opt-in and its socket is wherever its setup
		// command put it; these are the places it is usually found.
		{"Proton Pass", ".ssh/proton-pass-agent.sock", ""},
	}
	if goos == "linux" {
		if dir := os.Getenv("XDG_RUNTIME_DIR"); dir != "" {
			k = append(k, known{"Proton Pass", filepath.Join(dir, "proton-pass-agent"), "linux"})
		}
	}
	if goos == "darwin" {
		k = append(k, known{"Proton Pass", filepath.Join(os.TempDir(), "proton-pass-agent"), "darwin"})
	}
	out := k[:0]
	for _, a := range k {
		if a.goos != "" && a.goos != goos {
			continue
		}
		if !filepath.IsAbs(a.path) {
			a.path = filepath.Join(home, a.path)
		}
		out = append(out, a)
	}
	return out
}

// AgentName says whose agent a socket is, for a person to recognise.
func AgentName(socket, home string) string {
	for _, goos := range []string{"darwin", "linux"} {
		for _, k := range knownAgents(home, goos) {
			if filepath.Clean(k.path) == filepath.Clean(socket) {
				return k.name
			}
		}
	}
	switch s := strings.ToLower(socket); {
	case strings.Contains(s, "1password"):
		return "1Password"
	case strings.Contains(s, "secretive"):
		return "Secretive"
	case strings.Contains(s, "bitwarden"):
		return "Bitwarden"
	case strings.Contains(s, "proton"):
		return "Proton Pass"
	case strings.Contains(s, "gpg-agent") || strings.Contains(s, "gnupg"):
		return "gpg-agent"
	}
	return "your SSH agent"
}

// Alive reports whether an agent answers on the socket.
func Alive(socket string) bool {
	st, err := os.Stat(socket)
	if err != nil || st.Mode()&os.ModeSocket == 0 {
		return false
	}
	c, err := net.DialTimeout("unix", socket, time.Second)
	if err != nil {
		return false
	}
	c.Close()
	return true
}

// Finder finds the agent ssh will use for a host. Its fields are the
// outside world, replaced in tests.
type Finder struct {
	Home string
	GOOS string
	// Getenv reads this process's environment.
	Getenv func(string) string
	// Launchd returns `launchctl getenv SSH_AUTH_SOCK`, on macOS.
	Launchd func() string
	// Alive reports whether an agent answers on a socket.
	Alive func(string) bool
}

// DefaultFinder looks at this computer.
func DefaultFinder() Finder {
	home, _ := os.UserHomeDir()
	return Finder{Home: home, GOOS: runtime.GOOS, Getenv: os.Getenv, Launchd: launchdAuthSock, Alive: Alive}
}

// Find is the agent ssh will use given what ~/.ssh/config says for the host
// (identityAgent is ssh -G's identityagent, "" when unset), and whether
// berth has to hand it to ssh (inject): ssh finds an agent named in its
// config or in SSH_AUTH_SOCK itself, but not one berth discovered.
func (f Finder) Find(identityAgent string) (agent *Agent, inject bool, missing string) {
	switch identityAgent {
	case "none":
		return nil, false, ""
	case "", "SSH_AUTH_SOCK", "$SSH_AUTH_SOCK":
	default:
		sock := f.expand(identityAgent)
		if f.Alive(sock) {
			return &Agent{Name: AgentName(sock, f.Home), Socket: sock, Source: "ssh-config"}, false, ""
		}
		// The config names an agent that is not running: say so rather than
		// quietly using another.
		return nil, false, sock
	}
	if sock := f.Getenv("SSH_AUTH_SOCK"); sock != "" && f.Alive(sock) {
		return &Agent{Name: AgentName(sock, f.Home), Socket: sock, Source: "environment"}, false, ""
	}
	if f.GOOS == "darwin" && f.Launchd != nil {
		if sock := f.Launchd(); sock != "" && f.Alive(sock) {
			return &Agent{Name: AgentName(sock, f.Home), Socket: sock, Source: "launchd"}, true, ""
		}
	}
	for _, k := range knownAgents(f.Home, f.GOOS) {
		if f.Alive(k.path) {
			return &Agent{Name: k.name, Socket: k.path, Source: "discovered"}, true, ""
		}
	}
	return nil, false, ""
}

// Others are the live key-manager agents besides the one already tried, for
// a second attempt when every key was refused.
func (f Finder) Others(tried string) []Agent {
	var out []Agent
	seen := map[string]bool{filepath.Clean(tried): true}
	for _, k := range knownAgents(f.Home, f.GOOS) {
		if seen[filepath.Clean(k.path)] || !f.Alive(k.path) {
			continue
		}
		seen[filepath.Clean(k.path)] = true
		out = append(out, Agent{Name: k.name, Socket: k.path, Source: "discovered"})
	}
	return out
}

// expand resolves ~ and environment variables the way ssh does in
// IdentityAgent.
func (f Finder) expand(p string) string {
	p = strings.Trim(p, `"`)
	if p == "~" || strings.HasPrefix(p, "~/") {
		p = filepath.Join(f.Home, strings.TrimPrefix(p, "~"))
	}
	return os.Expand(p, f.Getenv)
}
