package network

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/netip"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/sean-brydon/berthd/internal/backgroundcmd"
	"tailscale.com/ipn"
	"tailscale.com/ipn/ipnstate"
)

var tailnetIPv4 = netip.MustParsePrefix("100.64.0.0/10")

type serveJSONOutput struct{ bytes.Buffer }

func (b *serveJSONOutput) Write(p []byte) (int, error) {
	if len(p) > 1<<20-b.Len() {
		return 0, errors.New("Tailscale sharing status exceeded 1 MiB")
	}
	return b.Buffer.Write(p)
}

var serveCLIOutput = func(ctx context.Context, cli string, args ...string) ([]byte, error) {
	cmd := backgroundcmd.CommandContext(ctx, cli, args...)
	cmd.Env = append(os.Environ(), "TAILSCALE_BE_CLI=1")
	cmd.WaitDelay = time.Second
	var out serveJSONOutput
	cmd.Stdout = &out
	err := cmd.Run()
	return out.Bytes(), err
}

// SystemTCPForward advertises only an existing persistent, private TCP
// forward for this exact loopback target on the system Tailscale node.
// It never changes Serve configuration or guesses a hostname or interface IP.
func SystemTCPForward(ctx context.Context, target string) ([]string, error) {
	host, _, err := net.SplitHostPort(target)
	if err != nil {
		return nil, nil
	}
	ip, err := netip.ParseAddr(host)
	if err != nil || !ip.Unmap().IsLoopback() {
		return nil, nil
	}
	cli := systemTailscale()
	if cli == "" {
		return nil, nil
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	status, err := serveCLIOutput(ctx, cli, "status", "--json", "--peers=false")
	if err != nil {
		return nil, err
	}
	config, err := serveCLIOutput(ctx, cli, "serve", "status", "--json")
	if err != nil {
		return nil, err
	}
	return tcpForwardAddresses(status, config, target)
}

func tcpForwardAddresses(status, config []byte, target string) ([]string, error) {
	var st ipnstate.Status
	var sc ipn.ServeConfig
	if err := json.Unmarshal(status, &st); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(config, &sc); err != nil {
		return nil, err
	}
	if st.BackendState != "Running" || st.Self == nil {
		return nil, nil
	}
	var ips []netip.Addr
	for _, ip := range st.Self.TailscaleIPs {
		ip = ip.Unmap()
		if ip.IsValid() && !ip.IsLoopback() && !ip.IsUnspecified() && ip.Zone() == "" && (ip.IsPrivate() || tailnetIPv4.Contains(ip)) {
			ips = append(ips, ip)
		}
	}
	// Prefer IPv4 when both Tailscale address families are available.
	slices.SortFunc(ips, func(a, b netip.Addr) int {
		if a.Is4() != b.Is4() {
			if a.Is4() {
				return -1
			}
			return 1
		}
		return a.Compare(b)
	})
	var ports []uint16
	for port, handler := range sc.TCP {
		if port == 0 || handler == nil || handler.HTTP || handler.HTTPS || handler.TerminateTLS != "" || handler.ProxyProtocol != 0 || !sameTCPAddress(handler.TCPForward, target) {
			continue
		}
		private := true
		for hp, enabled := range sc.AllowFunnel {
			if enabled {
				p, err := hp.Port()
				if err != nil || p == port {
					private = false
				}
			}
		}
		for _, foreground := range sc.Foreground {
			if foreground != nil && foreground.TCP[port] != nil {
				private = false
			}
		}
		if private {
			ports = append(ports, port)
		}
	}
	slices.Sort(ports)
	var out []string
	for _, port := range ports {
		for _, ip := range ips {
			out = append(out, net.JoinHostPort(ip.String(), strconv.Itoa(int(port))))
			if len(out) == 4 {
				return out, nil
			}
		}
	}
	return out, nil
}

func sameTCPAddress(a, b string) bool {
	ah, ap, ae := net.SplitHostPort(a)
	bh, bp, be := net.SplitHostPort(b)
	if ae != nil || be != nil || ap != bp {
		return false
	}
	ai, ae := netip.ParseAddr(ah)
	bi, be := netip.ParseAddr(bh)
	if ae == nil && be == nil {
		return ai.Unmap() == bi.Unmap()
	}
	return strings.EqualFold(ah, bh)
}
