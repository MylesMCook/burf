// Package sshconfig gives every paired box an SSH host, berth-<box>, so
// editors' remote SSH (VS Code, Cursor, Windsurf, Zed) and plain ssh reach
// the box the same way berth does: a box on another tailnet goes through
// berth's own network with `burf network proxy`.
//
// Nothing is written without being shown first: Plan says exactly which
// files change and how, and Apply writes that plan.
package sshconfig

import (
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/MylesMCook/burf/internal/statefile"
)

// Host is how SSH reaches one box.
type Host struct {
	Box string
	// Address is the box's address; any port is berth's, not SSH's.
	Address string
	User    string
	// Network is the burf network the box is reached through; empty means
	// this computer's own, which SSH reaches directly.
	Network string
	// Burf is the berth executable that carries a network's connection.
	Berth string
	// IdentityAgent, when set, is the SSH agent to log in with, such as
	// 1Password's, which the shell's default agent may not be.
	IdentityAgent string
}

// OnePasswordAgent is 1Password's SSH agent socket, when it is running.
func OnePasswordAgent() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	sock := filepath.Join(home, "Library", "Group Containers", "2BUA8C4S2C.com.1password", "t", "agent.sock")
	if st, err := os.Stat(sock); err == nil && st.Mode()&os.ModeSocket != 0 {
		return sock
	}
	return ""
}

// HostName is the SSH host berth writes for a box.
func HostName(box string) string { return "berth-" + box }

// header marks files berth wrote, so it only ever removes its own.
const header = "# Written by burf ssh-config for the box %s; berth rewrites it.\n"

// ValidUser reports whether name is a plain account name. The box reports
// its user, and a box is not trusted to write ssh_config: a newline in it
// would add directives (a ProxyCommand) that run on this computer.
func ValidUser(name string) bool { return validUser.MatchString(name) }

var (
	validUser = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$`)
	validHost = regexp.MustCompile(`^[A-Za-z0-9_.:%-]{1,253}$`)
	validBox  = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$`)
)

// check refuses a host whose values could break out of their line.
func (h Host) check() error {
	if !validBox.MatchString(h.Box) {
		return fmt.Errorf("%q is not a box name", h.Box)
	}
	if !validHost.MatchString(hostOnly(h.Address)) {
		return fmt.Errorf("box %s has an address that cannot go in ssh_config: %q", h.Box, h.Address)
	}
	if h.Network != "" && !validBox.MatchString(h.Network) {
		return fmt.Errorf("%q is not a network name", h.Network)
	}
	for _, v := range []string{h.Berth, h.IdentityAgent} {
		if strings.ContainsAny(v, "\x00\r\n\"") {
			return fmt.Errorf("box %s: a path cannot go in ssh_config: %q", h.Box, v)
		}
	}
	return nil
}

// Render is the box's file in ~/.ssh/berth/. A user that is not a plain
// account name is left out, so ssh falls back to the local one.
func (h Host) Render() string {
	var b strings.Builder
	fmt.Fprintf(&b, header, h.Box)
	fmt.Fprintf(&b, "Host %s\n  HostName %s\n", HostName(h.Box), hostOnly(h.Address))
	if h.User != "" && ValidUser(h.User) {
		fmt.Fprintf(&b, "  User %s\n", h.User)
	}
	if h.Network != "" {
		fmt.Fprintf(&b, "  ProxyCommand %s\n", ProxyCommand(h.Berth, h.Network))
	}
	if h.IdentityAgent != "" {
		fmt.Fprintf(&b, "  IdentityAgent \"%s\"\n", h.IdentityAgent)
	}
	return b.String()
}

func hostOnly(addr string) string {
	if h, _, err := net.SplitHostPort(addr); err == nil {
		return h
	}
	return addr
}

// Local reports whether a box is this computer, which editors open
// directly rather than over SSH.
func Local(addr string) bool {
	h := hostOnly(addr)
	if h == "localhost" {
		return true
	}
	ip := net.ParseIP(h)
	return ip != nil && ip.IsLoopback()
}

// IncludeLine is what ~/.ssh/config needs for the hosts to exist. OpenSSH
// takes the first value it reads, so it goes above every Host block.
const IncludeLine = "Include berth/*.conf"

const includeBlock = "# Added by berth: an SSH host per paired box, named berth-<box>.\n# It only works above any Host block.\n" + IncludeLine + "\n\n"

// Config is an SSH configuration directory, normally ~/.ssh.
type Config struct{ Dir string }

func Default() (Config, error) {
	home, err := os.UserHomeDir()
	return Config{Dir: filepath.Join(home, ".ssh")}, err
}

// Change is one file the plan writes or removes.
type Change struct {
	Path   string `json:"path"`
	Action string `json:"action"` // create, update, remove
	Old    string `json:"old,omitempty"`
	New    string `json:"new,omitempty"`
	// Diff shows the change line by line, - and + prefixed.
	Diff string `json:"diff"`
}

// Plan lists what Apply would change for hosts: each box's file, files for
// boxes no longer paired, and the Include in ~/.ssh/config.
func (c Config) Plan(hosts []Host) ([]Change, error) {
	var out []Change
	want := map[string]bool{}
	sort.Slice(hosts, func(i, j int) bool { return hosts[i].Box < hosts[j].Box })
	for _, h := range hosts {
		if err := h.check(); err != nil {
			return nil, err
		}
		path := filepath.Join(c.Dir, "berth", h.Box+".conf")
		want[path] = true
		next := h.Render()
		old, err := os.ReadFile(path)
		switch {
		case errors.Is(err, os.ErrNotExist):
			out = append(out, Change{Path: path, Action: "create", New: next, Diff: diff("", next)})
		case err != nil:
			return nil, err
		case string(old) != next:
			out = append(out, Change{Path: path, Action: "update", Old: string(old), New: next, Diff: diff(string(old), next)})
		}
	}
	files, _ := filepath.Glob(filepath.Join(c.Dir, "berth", "*.conf"))
	for _, f := range files {
		if want[f] {
			continue
		}
		b, err := os.ReadFile(f)
		if err != nil || !strings.HasPrefix(string(b), "# Written by burf ssh-config") {
			continue
		}
		out = append(out, Change{Path: f, Action: "remove", Old: string(b), Diff: diff(string(b), "")})
	}
	cfg := filepath.Join(c.Dir, "config")
	old, err := os.ReadFile(cfg)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	if !hasLine(string(old), IncludeLine) {
		action := "update"
		if errors.Is(err, os.ErrNotExist) {
			action = "create"
		}
		out = append(out, Change{Path: cfg, Action: action, Old: string(old), New: includeBlock + string(old), Diff: diff("", includeBlock) + "  (then the rest of the file, unchanged)\n"})
	}
	return out, nil
}

// Apply writes a plan. ~/.ssh/config is backed up to config.berth-backup
// before berth first changes it.
func (c Config) Apply(plan []Change) error {
	for _, ch := range plan {
		switch ch.Action {
		case "remove":
			if err := os.Remove(ch.Path); err != nil && !errors.Is(err, os.ErrNotExist) {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(ch.Path), 0o700); err != nil {
			return err
		}
		if filepath.Base(ch.Path) == "config" && filepath.Dir(ch.Path) == c.Dir {
			// Re-read: the file may have changed since the plan was made.
			old, err := os.ReadFile(ch.Path)
			if err != nil && !errors.Is(err, os.ErrNotExist) {
				return err
			}
			if hasLine(string(old), IncludeLine) {
				continue
			}
			if len(old) > 0 {
				if err := statefile.Write(ch.Path+".berth-backup", old); err != nil {
					return err
				}
			}
			if err := statefile.Write(ch.Path, append([]byte(includeBlock), old...)); err != nil {
				return err
			}
			continue
		}
		if err := statefile.Write(ch.Path, []byte(ch.New)); err != nil {
			return err
		}
	}
	return nil
}

// Ready reports whether box has its host and the Include is in place.
func (c Config) Ready(box string) bool {
	if _, err := os.Stat(filepath.Join(c.Dir, "berth", box+".conf")); err != nil {
		return false
	}
	b, err := os.ReadFile(filepath.Join(c.Dir, "config"))
	return err == nil && hasLine(string(b), IncludeLine)
}

func hasLine(s, line string) bool {
	for _, l := range strings.Split(s, "\n") {
		if strings.TrimSpace(l) == line {
			return true
		}
	}
	return false
}

// diff is a line diff good enough for small files: removed lines, then
// added ones, with unchanged lines shown once.
func diff(old, next string) string {
	ol, nl := lines(old), lines(next)
	inNew := map[string]bool{}
	for _, l := range nl {
		inNew[l] = true
	}
	inOld := map[string]bool{}
	for _, l := range ol {
		inOld[l] = true
	}
	var b strings.Builder
	for _, l := range ol {
		if !inNew[l] {
			b.WriteString("- " + l + "\n")
		}
	}
	for _, l := range nl {
		if inOld[l] {
			b.WriteString("  " + l + "\n")
		} else {
			b.WriteString("+ " + l + "\n")
		}
	}
	return b.String()
}

func lines(s string) []string {
	s = strings.TrimRight(s, "\n")
	if s == "" {
		return nil
	}
	return strings.Split(s, "\n")
}
