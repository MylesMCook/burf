package sshsetup

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Config is what `ssh -G HOST` says ssh would do for a host: ~/.ssh/config
// applied, nothing connected.
type Config struct {
	User          string
	HostName      string
	Port          string
	IdentityAgent string
	IdentityFiles []string
	ProxyJump     string
	ProxyCommand  string
	HostKeyAlias  string
	KnownHosts    []string
	// StrictHostKeyChecking is "ask" unless the config says otherwise.
	StrictHostKeyChecking string
}

// ParseG reads `ssh -G` output.
func ParseG(out []byte) Config {
	var c Config
	sc := bufio.NewScanner(bytes.NewReader(out))
	for sc.Scan() {
		key, value, _ := strings.Cut(strings.TrimSpace(sc.Text()), " ")
		value = strings.TrimSpace(value)
		switch strings.ToLower(key) {
		case "user":
			c.User = value
		case "hostname":
			c.HostName = value
		case "port":
			c.Port = value
		case "identityagent":
			c.IdentityAgent = value
		case "identityfile":
			c.IdentityFiles = append(c.IdentityFiles, value)
		case "proxyjump":
			c.ProxyJump = value
		case "proxycommand":
			c.ProxyCommand = value
		case "hostkeyalias":
			c.HostKeyAlias = value
		case "stricthostkeychecking":
			c.StrictHostKeyChecking = strings.ToLower(value)
		case "userknownhostsfile":
			c.KnownHosts = strings.Fields(value)
		}
	}
	return c
}

// ReadConfig runs `ssh -G` for the target, with any extra ssh options berth
// will pass, so the answer is what the real connection will do.
func ReadConfig(ctx context.Context, sshArgs []string, target string) (Config, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	args := append(append([]string{"-G"}, sshArgs...), target)
	out, err := exec.CommandContext(ctx, "ssh", args...).Output()
	if err != nil {
		var stderr string
		if ee, ok := err.(*exec.ExitError); ok {
			stderr = strings.TrimSpace(string(ee.Stderr))
		}
		return Config{}, fmt.Errorf("ssh -G %s: %v %s", target, err, stderr)
	}
	return ParseG(out), nil
}

// Plan says, before connecting, how berth will log in to a host.
type Plan struct {
	Host     string `json:"host"`
	User     string `json:"user"`
	HostName string `json:"hostname"`
	Port     string `json:"port"`
	Agent    *Agent `json:"agent,omitempty"`
	// IdentityFiles are the key files ssh will offer that exist.
	IdentityFiles []string `json:"identity_files"`
	ProxyJump     string   `json:"proxy_jump,omitempty"`
	// Summary is one plain line: "Using 1Password's SSH agent".
	Summary string `json:"summary"`
	// Inject is the agent socket berth hands ssh itself, when ssh would not
	// find it alone.
	Inject string `json:"-"`
}

// MakePlan works out the plan from ssh -G's answer.
func (f Finder) MakePlan(host string, c Config, identity string) Plan {
	p := Plan{Host: host, User: c.User, HostName: c.HostName, Port: c.Port, ProxyJump: c.ProxyJump, IdentityFiles: []string{}}
	files := c.IdentityFiles
	if identity != "" {
		files = append([]string{identity}, files...)
	}
	seen := map[string]bool{}
	for _, file := range files {
		path := f.expand(file)
		if seen[path] {
			continue
		}
		seen[path] = true
		if st, err := os.Stat(path); err == nil && st.Mode().IsRegular() {
			p.IdentityFiles = append(p.IdentityFiles, f.tilde(path))
		}
	}
	agent, inject, missing := f.Find(c.IdentityAgent)
	p.Agent = agent
	if inject && agent != nil {
		p.Inject = agent.Socket
	}
	keys := ""
	if len(p.IdentityFiles) > 0 {
		names := make([]string, len(p.IdentityFiles))
		for i, file := range p.IdentityFiles {
			names[i] = filepath.Base(file)
		}
		keys = fmt.Sprintf("keys from %s (%s)", f.tilde(filepath.Dir(f.expand(p.IdentityFiles[0]))), strings.Join(names, ", "))
	}
	switch {
	case missing != "":
		p.Summary = fmt.Sprintf("~/.ssh/config sends this host to %s's agent at %s, but it isn't answering. Open and unlock %s, then try again.", AgentName(missing, f.Home), f.tilde(missing), AgentName(missing, f.Home))
	case agent != nil && keys != "":
		p.Summary = fmt.Sprintf("Using %s and %s", agentPhrase(agent.Name), keys)
	case agent != nil:
		p.Summary = "Using " + agentPhrase(agent.Name)
	case keys != "":
		p.Summary = "Using " + keys
	default:
		p.Summary = "No SSH agent or keys found. Open your key manager's SSH agent (1Password, Secretive, Bitwarden, Proton Pass), or choose a key file."
	}
	return p
}

func agentPhrase(name string) string {
	if name == "your SSH agent" {
		return name
	}
	return name + "'s SSH agent"
}

func (f Finder) tilde(path string) string {
	if f.Home != "" && (path == f.Home || strings.HasPrefix(path, f.Home+string(filepath.Separator))) {
		return "~" + strings.TrimPrefix(path, f.Home)
	}
	return path
}

// Hosts lists the hosts ~/.ssh/config names, for completing a host field:
// concrete names only (no patterns), its Includes followed, and berth's own
// berth-<box> hosts left out, since those boxes are paired already.
func Hosts(home string) []string {
	set := map[string]bool{}
	readHosts(filepath.Join(home, ".ssh", "config"), home, set, 0)
	out := make([]string, 0, len(set))
	for h := range set {
		out = append(out, h)
	}
	sort.Strings(out)
	return out
}

func readHosts(path, home string, set map[string]bool, depth int) {
	if depth > 8 {
		return
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		// "Host=a b" is allowed too.
		if i := strings.IndexAny(line, " \t="); i > 0 && line[i] == '=' {
			line = line[:i] + " " + line[i+1:]
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		key := strings.ToLower(fields[0])
		switch key {
		case "host":
			for _, h := range fields[1:] {
				h = strings.Trim(h, `"`)
				if h == "" || strings.ContainsAny(h, "*?!") || strings.HasPrefix(h, "berth-") {
					continue
				}
				set[h] = true
			}
		case "include":
			for _, pattern := range fields[1:] {
				pattern = strings.Trim(pattern, `"`)
				if strings.HasPrefix(pattern, "~/") {
					pattern = filepath.Join(home, pattern[2:])
				} else if !filepath.IsAbs(pattern) {
					pattern = filepath.Join(home, ".ssh", pattern)
				}
				matches, _ := filepath.Glob(pattern)
				for _, m := range matches {
					readHosts(m, home, set, depth+1)
				}
			}
		}
	}
}
