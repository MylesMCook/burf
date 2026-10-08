package network

import (
	"encoding/json"
	"net/netip"
	"testing"

	"tailscale.com/ipn/ipnstate"
)

func status(t *testing.T, peer string) *ipnstate.Status {
	t.Helper()
	var st ipnstate.Status
	err := json.Unmarshal([]byte(`{"BackendState":"Running","Self":{"Relay":"lhr"},"Peer":{
		"nodekey:1111111111111111111111111111111111111111111111111111111111111111":`+peer+`
	}}`), &st)
	if err != nil {
		t.Fatal(err)
	}
	return &st
}

func TestPathToSaysDirectRelayedOrUnknown(t *testing.T) {
	const box = `"HostName":"cal","DNSName":"cal.acme.ts.net.","OS":"linux","TailscaleIPs":["100.64.0.7","fd7a:115c:a1e0::7"]`
	cases := []struct {
		name, peer, host string
		ips              []netip.Addr
		want             Path
		ok               bool
	}{
		{"relayed, by IP", `{` + box + `,"Relay":"nyc","Active":true}`, "100.64.0.7", nil, Path{Via: "relay", Relay: "nyc", RelayName: "New York", Nearest: "London"}, true},
		{"relayed, by MagicDNS name", `{` + box + `,"Relay":"nyc","Active":true}`, "cal.acme.ts.net", nil, Path{Via: "relay", Relay: "nyc", RelayName: "New York", Nearest: "London"}, true},
		{"relayed, by short name", `{` + box + `,"Relay":"nyc","Active":true}`, "cal", nil, Path{Via: "relay", Relay: "nyc", RelayName: "New York", Nearest: "London"}, true},
		{"relayed, by what the name resolves to", `{` + box + `,"Relay":"nyc","Active":true}`, "box.example.com", []netip.Addr{netip.MustParseAddr("100.64.0.7")}, Path{Via: "relay", Relay: "nyc", RelayName: "New York", Nearest: "London"}, true},
		{"direct", `{` + box + `,"Relay":"nyc","CurAddr":"203.0.113.4:41641","Active":true}`, "100.64.0.7", nil, Path{Via: "direct", Endpoint: "203.0.113.4:41641", Nearest: "London"}, true},
		{"peer relay", `{` + box + `,"Relay":"nyc","PeerRelay":"198.51.100.2:40000:7","Active":true}`, "fd7a:115c:a1e0::7", nil, Path{Via: "peer-relay", Endpoint: "198.51.100.2:40000:7", Nearest: "London"}, true},
		{"idle: no path yet", `{` + box + `,"Relay":"nyc"}`, "100.64.0.7", nil, Path{}, false},
		{"another machine", `{` + box + `,"Relay":"nyc","Active":true}`, "100.64.0.8", nil, Path{}, false},
	}
	for _, c := range cases {
		got, ok := PathTo(status(t, c.peer), c.host, c.ips)
		if ok != c.ok || got != c.want {
			t.Errorf("%s: %+v, %v; want %+v, %v", c.name, got, ok, c.want, c.ok)
		}
	}
}

func TestTailscaleAddressesAndRegionNames(t *testing.T) {
	for ip, want := range map[string]bool{"100.64.0.7": true, "100.127.255.1": true, "100.128.0.1": false, "192.168.1.2": false, "fd7a:115c:a1e0::7": true, "::ffff:100.64.0.1": true} {
		if got := IsTailscaleIP(netip.MustParseAddr(ip)); got != want {
			t.Errorf("%s: %v", ip, got)
		}
	}
	if RegionName("nyc") != "New York" || RegionName("xyz") != "XYZ" {
		t.Fatal("region names")
	}
}
