package network

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"sort"
	"strings"
	"time"

	"tailscale.com/ipn/ipnstate"
)

// Peer is another machine on a tailnet, as a candidate box.
type Peer struct {
	Name    string `json:"name"`
	DNSName string `json:"dns_name,omitempty"`
	IP      string `json:"ip"`
	OS      string `json:"os"`
	Online  bool   `json:"online"`
	// SSH is set when the machine runs Tailscale SSH: the tailnet's SSH
	// rules decide who logs in, and no keys are needed.
	SSH bool `json:"ssh,omitempty"`
	// HostKeys are the SHA256 fingerprints of the SSH host keys the tailnet
	// reports for the machine (Tailscale SSH only). The coordination server
	// vouches for them, so a host key that matches one can be trusted.
	HostKeys []string `json:"host_keys,omitempty"`
}

// boxOS reports whether berthd can run on a peer with this OS.
func boxOS(os string) bool { return os == "linux" || os == "macOS" }

// peersFrom lists the peers of st that could be boxes, online ones first.
func peersFrom(st *ipnstate.Status) []Peer {
	var out []Peer
	for _, p := range st.Peer {
		if !boxOS(p.OS) || len(p.TailscaleIPs) == 0 {
			continue
		}
		ip := p.TailscaleIPs[0]
		for _, a := range p.TailscaleIPs {
			if a.Is4() {
				ip = a
				break
			}
		}
		name := strings.SplitN(strings.TrimSuffix(p.DNSName, "."), ".", 2)[0]
		if name == "" {
			name = p.HostName
		}
		peer := Peer{Name: name, DNSName: strings.TrimSuffix(p.DNSName, "."), IP: ip.String(), OS: p.OS, Online: p.Online}
		for _, k := range p.SSH_HostKeys {
			if fp := fingerprint(k); fp != "" {
				peer.HostKeys = append(peer.HostKeys, fp)
			}
		}
		// A node reports host keys only while it runs Tailscale SSH.
		peer.SSH = len(p.SSH_HostKeys) > 0
		out = append(out, peer)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Online != out[j].Online {
			return out[i].Online
		}
		return out[i].Name < out[j].Name
	})
	return out
}

// fingerprint is the SHA256 fingerprint of a public key in authorized_keys
// form ("ssh-ed25519 AAAA… comment"), as ssh-keygen -l prints it.
func fingerprint(key string) string {
	f := strings.Fields(key)
	if len(f) < 2 {
		return ""
	}
	blob, err := base64.StdEncoding.DecodeString(f[1])
	if err != nil || len(blob) == 0 {
		return ""
	}
	sum := sha256.Sum256(blob)
	return "SHA256:" + base64.RawStdEncoding.EncodeToString(sum[:])
}

// Peers lists the machines on the named network.
func (m *Manager) Peers(ctx context.Context, name string) ([]Peer, error) {
	s, err := m.server(name)
	if err != nil {
		return nil, err
	}
	if err := m.waitRunning(ctx, name); err != nil {
		return nil, err
	}
	lc, err := s.LocalClient()
	if err != nil {
		return nil, err
	}
	// A node that just started reports Running before its peers arrive.
	for {
		st, err := lc.Status(ctx)
		if err != nil {
			return nil, err
		}
		if st.BackendState != "Running" {
			return nil, ErrNeedsLogin
		}
		if len(st.Peer) > 0 || !m.warmingUp(name) {
			return peersFrom(st), nil
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(500 * time.Millisecond):
		}
	}
}

// systemTailscale finds the Tailscale CLI this computer's own tailnet uses.
func systemTailscale() string {
	if p, err := exec.LookPath("tailscale"); err == nil {
		return p
	}
	for _, p := range []string{"/Applications/Tailscale.app/Contents/MacOS/Tailscale", "/usr/local/bin/tailscale", "/opt/homebrew/bin/tailscale"} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

// SystemTailnet is this computer's own tailnet, through the Tailscale app.
type SystemTailnet struct {
	// State is "running", "stopped" (Tailscale is off or not answering),
	// "logged-out", or "missing" (Tailscale isn't installed).
	State string `json:"state"`
	// Name is the tailnet's name, as the admin console shows it.
	Name  string `json:"name,omitempty"`
	Peers []Peer `json:"-"`
}

// Tailscale's own words for each state, for the CLI.
func (t SystemTailnet) Err() error {
	switch t.State {
	case "running":
		return nil
	case "missing":
		return errors.New("Tailscale is not installed on this computer")
	case "logged-out":
		return errors.New("Tailscale on this computer is logged out")
	}
	return errors.New("Tailscale on this computer is not connected")
}

// systemState reads `tailscale status --json` output.
func systemState(out []byte) (SystemTailnet, error) {
	var st ipnstate.Status
	if err := json.Unmarshal(out, &st); err != nil {
		return SystemTailnet{}, err
	}
	t := SystemTailnet{State: "stopped"}
	switch st.BackendState {
	case "Running":
		t.State = "running"
	case "NeedsLogin", "NeedsMachineAuth":
		t.State = "logged-out"
	}
	if t.State != "running" {
		return t, nil
	}
	if st.CurrentTailnet != nil {
		t.Name = st.CurrentTailnet.Name
	}
	t.Peers = peersFrom(&st)
	return t, nil
}

// System reports this computer's tailnet and its machines. Tailscale not
// being installed, on, or signed in is a state, not an error.
func System(ctx context.Context) (SystemTailnet, error) {
	cli := systemTailscale()
	if cli == "" {
		return SystemTailnet{State: "missing"}, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	// stdout only: a client and daemon of different versions warn on stderr.
	out, err := exec.CommandContext(ctx, cli, "status", "--json").Output()
	if err != nil && len(out) == 0 {
		// The app isn't running, so nothing answers.
		return SystemTailnet{State: "stopped"}, nil
	}
	return systemState(out)
}
