package box

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

// Outbound requests the box makes on someone's behalf — a flow's webhook,
// a phone push — go only to public addresses. Where they are pointed can
// come from a repository's committed config or from event data (a PR's
// title, a branch), so without a check a flow could make the box reach its
// own loopback services, the cloud's metadata endpoint, or the private
// network it sits on. The check is made on the address actually dialled,
// after DNS, on every connection including redirects, so a name that
// resolves (or re-resolves) to a private address is refused too.
//
// The box's owner can allow destinations in ~/.berth/network.json on the
// box, which only someone on the box can write:
//
//	{ "allow_outbound": ["10.0.0.0/8", "192.168.1.20", "ntfy.home.lan"] }
//
// An entry is an IP address, a CIDR prefix, or a host name; a host name is
// trusted whatever it resolves to.

// NetworkFile is the owner's outbound allowlist, beside flows.json.
const NetworkFile = "network.json"

// outboundPolicy is what an outbound request may reach.
type outboundPolicy struct {
	prefixes []netip.Prefix
	hosts    map[string]bool
	// tailnet lets 100.64.0.0/10 through: the phone's own ntfy server
	// commonly lives on the tailnet.
	tailnet bool
}

// parseAllow reads allowlist entries, skipping ones that make no sense.
func parseAllow(entries []string) outboundPolicy {
	p := outboundPolicy{hosts: map[string]bool{}}
	for _, e := range entries {
		e = strings.TrimSpace(e)
		if e == "" {
			continue
		}
		if pre, err := netip.ParsePrefix(e); err == nil {
			p.prefixes = append(p.prefixes, pre.Masked())
			continue
		}
		if ip, err := netip.ParseAddr(strings.Trim(e, "[]")); err == nil {
			p.prefixes = append(p.prefixes, netip.PrefixFrom(ip.Unmap(), ip.Unmap().BitLen()))
			continue
		}
		p.hosts[normHost(e)] = true
	}
	return p
}

func normHost(h string) string {
	return strings.TrimSuffix(strings.ToLower(strings.Trim(h, "[]")), ".")
}

// loadAllow reads the owner's allowlist from dir/network.json, plus extra.
func loadAllow(dir string, extra []string) outboundPolicy {
	entries := append([]string{}, extra...)
	if dir != "" {
		if b, err := os.ReadFile(filepath.Join(dir, NetworkFile)); err == nil {
			var doc struct {
				AllowOutbound []string `json:"allow_outbound"`
			}
			if json.Unmarshal(b, &doc) == nil {
				entries = append(entries, doc.AllowOutbound...)
			}
		}
	}
	return parseAllow(entries)
}

// outboundPolicy is the box's allowlist for its flows' webhooks and phone
// pushes.
func (b *Box) outboundPolicy() outboundPolicy {
	if b.Flows == nil {
		return parseAllow(nil)
	}
	dir := ""
	if b.Flows.Path != "" {
		dir = filepath.Dir(b.Flows.Path)
	}
	return loadAllow(dir, b.Flows.AllowOutbound)
}

var (
	carrierNAT = netip.MustParsePrefix("100.64.0.0/10")
	nat64      = netip.MustParsePrefix("64:ff9b::/96")
	// Ranges that are never someone's public service.
	blockedRanges = []netip.Prefix{
		netip.MustParsePrefix("0.0.0.0/8"),
		netip.MustParsePrefix("192.0.0.0/24"),    // IETF protocol assignments (incl. 192.0.0.192 metadata)
		netip.MustParsePrefix("192.0.2.0/24"),    // documentation
		netip.MustParsePrefix("198.18.0.0/15"),   // benchmarking
		netip.MustParsePrefix("198.51.100.0/24"), // documentation
		netip.MustParsePrefix("203.0.113.0/24"),  // documentation
		netip.MustParsePrefix("240.0.0.0/4"),     // reserved, incl. broadcast
		netip.MustParsePrefix("100::/64"),        // discard
		netip.MustParsePrefix("2001:db8::/32"),   // documentation
	}
)

// errBlockedAddress is why a request was refused.
var errBlockedAddress = errors.New("refusing to connect to a private, loopback, link-local or metadata address; allow it in ~/.berth/network.json on the box if you mean it")

// allowedIP says whether ip, the address about to be dialled, may be.
func (p outboundPolicy) allowedIP(ip netip.Addr) bool {
	ip = ip.Unmap()
	for _, pre := range p.prefixes {
		if pre.Contains(ip) {
			return true
		}
	}
	// An IPv6 address carrying an IPv4 one is judged by that.
	if nat64.Contains(ip) {
		b := ip.As16()
		ip = netip.AddrFrom4([4]byte{b[12], b[13], b[14], b[15]})
		for _, pre := range p.prefixes {
			if pre.Contains(ip) {
				return true
			}
		}
	}
	if !ip.IsValid() || ip.IsUnspecified() || ip.IsLoopback() || ip.IsPrivate() || ip.IsMulticast() ||
		ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsInterfaceLocalMulticast() {
		return false
	}
	if carrierNAT.Contains(ip) {
		return p.tailnet
	}
	for _, pre := range blockedRanges {
		if pre.Contains(ip) {
			return false
		}
	}
	return true
}

// client is an HTTP client that dials only what the policy allows, ignores
// proxy settings (a proxy would dial for it, unchecked), and follows at
// most a few redirects, each dialled through the same check.
func (p outboundPolicy) client(timeout time.Duration) *http.Client {
	check := func(network, address string, _ syscall.RawConn) error {
		host, _, err := net.SplitHostPort(address)
		if err != nil {
			return err
		}
		ip, err := netip.ParseAddr(host)
		if err != nil || !p.allowedIP(ip) {
			return fmt.Errorf("%s: %w", host, errBlockedAddress)
		}
		return nil
	}
	guarded := &net.Dialer{Timeout: 10 * time.Second, Control: check}
	open := &net.Dialer{Timeout: 10 * time.Second}
	dial := func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, _, err := net.SplitHostPort(addr)
		if err != nil {
			return nil, err
		}
		if p.hosts[normHost(host)] {
			return open.DialContext(ctx, network, addr)
		}
		return guarded.DialContext(ctx, network, addr)
	}
	return &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			Proxy:                 nil,
			DialContext:           dial,
			TLSHandshakeTimeout:   10 * time.Second,
			ResponseHeaderTimeout: timeout,
			MaxIdleConns:          1,
			DisableKeepAlives:     true,
		},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return errors.New("too many redirects")
			}
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return errors.New("redirect to a non-http URL")
			}
			return nil
		},
	}
}
