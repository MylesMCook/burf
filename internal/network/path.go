package network

import (
	"context"
	"encoding/json"
	"errors"
	"net/netip"
	"strings"
	"time"

	"github.com/MylesMCook/burf/internal/backgroundcmd"

	"tailscale.com/ipn/ipnstate"
)

// Path is how this computer's traffic reaches a machine on a tailnet: a
// direct connection, or relayed through one of Tailscale's relay (DERP)
// servers because the two couldn't connect directly, or through a peer relay.
type Path struct {
	// Via is "direct", "relay" (a Tailscale DERP server) or "peer-relay".
	Via string `json:"via"`
	// Relay is the DERP region the traffic goes through ("nyc"), and
	// RelayName its city ("New York"), when Via is "relay".
	Relay     string `json:"relay,omitempty"`
	RelayName string `json:"relay_name,omitempty"`
	// Nearest is this computer's own home relay region's city ("London"):
	// relayed traffic goes through the box's region, which may be far from it.
	Nearest string `json:"nearest,omitempty"`
	// Endpoint is the address a direct connection (or the peer relay) uses.
	Endpoint string `json:"endpoint,omitempty"`
	// Tailnet is the network the box is reached on: an agent network's name,
	// or "" for this computer's own Tailscale.
	Tailnet string `json:"tailnet,omitempty"`
}

// Relayed reports whether traffic goes through a relay rather than directly.
func (p Path) Relayed() bool { return p.Via == "relay" || p.Via == "peer-relay" }

// tailscale's address ranges: 100.64.0.0/10 and fd7a:115c:a1e0::/48.
var (
	tsV4 = netip.MustParsePrefix("100.64.0.0/10")
	tsV6 = netip.MustParsePrefix("fd7a:115c:a1e0::/48")
)

// IsTailscaleIP reports whether ip is in Tailscale's address ranges.
func IsTailscaleIP(ip netip.Addr) bool {
	ip = ip.Unmap()
	return tsV4.Contains(ip) || tsV6.Contains(ip)
}

// PathTo finds how st's node reaches host (an IP or a name, as a box's
// address has it; ips are what the name resolves to), and whether it could
// tell: a peer that isn't on this tailnet, or that has been idle (no path
// worked out yet), says nothing.
func PathTo(st *ipnstate.Status, host string, ips []netip.Addr) (Path, bool) {
	if st == nil {
		return Path{}, false
	}
	if ip, err := netip.ParseAddr(host); err == nil {
		ips = append(ips, ip)
	}
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	for _, p := range st.Peer {
		if p == nil || !peerIs(p, host, ips) {
			continue
		}
		path := Path{Endpoint: p.CurAddr}
		switch {
		case p.CurAddr != "":
			path.Via = "direct"
		case p.PeerRelay != "":
			path.Via, path.Endpoint = "peer-relay", p.PeerRelay
		case p.Relay != "" && p.Active:
			path.Via, path.Relay, path.RelayName = "relay", p.Relay, RegionName(p.Relay)
		default:
			return Path{}, false
		}
		if st.Self != nil && st.Self.Relay != "" {
			path.Nearest = RegionName(st.Self.Relay)
		}
		return path, true
	}
	return Path{}, false
}

func peerIs(p *ipnstate.PeerStatus, host string, ips []netip.Addr) bool {
	for _, a := range p.TailscaleIPs {
		for _, ip := range ips {
			if a == ip.Unmap() {
				return true
			}
		}
	}
	if host == "" {
		return false
	}
	dns := strings.ToLower(strings.TrimSuffix(p.DNSName, "."))
	short, _, _ := strings.Cut(dns, ".")
	return host == dns || host == short || host == strings.ToLower(p.HostName)
}

// regions are the cities of Tailscale's relay (DERP) regions, by code.
var regions = map[string]string{
	"nyc": "New York", "sfo": "San Francisco", "sin": "Singapore", "fra": "Frankfurt",
	"syd": "Sydney", "blr": "Bangalore", "tok": "Tokyo", "lhr": "London",
	"dfw": "Dallas", "sea": "Seattle", "sao": "São Paulo", "ord": "Chicago",
	"den": "Denver", "ams": "Amsterdam", "jnb": "Johannesburg", "mia": "Miami",
	"lax": "Los Angeles", "par": "Paris", "mad": "Madrid", "hkg": "Hong Kong",
	"tor": "Toronto", "waw": "Warsaw", "dbi": "Dubai", "hnl": "Honolulu",
	"nai": "Nairobi", "nue": "Nuremberg", "hel": "Helsinki", "ash": "Ashburn",
	"iad": "Ashburn", "atl": "Atlanta", "sjc": "San Jose", "mel": "Melbourne",
}

// RegionName is a relay region's city, or its code in capitals when this
// list doesn't know it (a custom or new region).
func RegionName(code string) string {
	if n, ok := regions[strings.ToLower(code)]; ok {
		return n
	}
	return strings.ToUpper(code)
}

// Status is the named network's own view of its tailnet: its peers and how
// it reaches each.
func (m *Manager) Status(ctx context.Context, name string) (*ipnstate.Status, error) {
	m.mu.Lock()
	s := m.servers[name]
	m.mu.Unlock()
	// A network that isn't running yet has no paths to report; asking must
	// not start it.
	if s == nil {
		return nil, errors.New("network " + name + " isn't running")
	}
	lc, err := s.LocalClient()
	if err != nil {
		return nil, err
	}
	return lc.Status(ctx)
}

// SystemStatus is `tailscale status --json` from this computer's own
// Tailscale, or an error when it isn't installed or isn't answering. It only
// reads.
func SystemStatus(ctx context.Context) (*ipnstate.Status, error) {
	cli := systemTailscale()
	if cli == "" {
		return nil, errors.New("Tailscale is not installed on this computer")
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	out, err := backgroundcmd.CommandContext(ctx, cli, "status", "--json").Output()
	if err != nil && len(out) == 0 {
		return nil, err
	}
	var st ipnstate.Status
	if err := json.Unmarshal(out, &st); err != nil {
		return nil, err
	}
	return &st, nil
}
