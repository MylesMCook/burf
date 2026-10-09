package main

import (
	"strings"
	"testing"

	"github.com/MylesMCook/burf/internal/agent"
	"github.com/MylesMCook/burf/internal/doctor"
)

func TestDoctorListsABoxsRoutesAndBoxesNamesTheOneInUse(t *testing.T) {
	b := agent.BoxStatus{Name: "devl", Routes: []agent.RouteStatus{
		{ID: "paired", Kind: "tailscale", Label: "Tailscale", Detail: "100.64.0.4:7444", State: "up", LatencyMs: 140},
		{ID: "ssh", Kind: "ssh", Label: "SSH", Detail: "alex@devl", State: "up", LatencyMs: 24, Active: true},
		{ID: "direct:192.168.1.20:7444", Kind: "direct", Label: "Direct", Detail: "192.168.1.20:7444", State: "down", Error: "dial tcp: i/o timeout"},
		{ID: "ssh2", Kind: "ssh", Label: "SSH", Detail: "devl", State: "off", Suggested: true},
	}}
	if got := activeRoute(b); got != "SSH" {
		t.Fatalf("active route %q", got)
	}
	if got := activeRoute(agent.BoxStatus{}); got != "-" {
		t.Fatalf("no routes: %q", got)
	}
	checks := routeChecks(b)
	want := []struct {
		name   string
		status doctor.Status
		detail string
	}{
		{"Tailscale (100.64.0.4:7444)", doctor.OK, "140 ms"},
		{"SSH (alex@devl)", doctor.OK, "24 ms, in use"},
		{"Direct (192.168.1.20:7444)", doctor.Warn, "down, dial tcp: i/o timeout"},
		{"SSH (devl)", doctor.Info, "off, found in ~/.ssh/config"},
	}
	if len(checks) != len(want) {
		t.Fatalf("checks %+v", checks)
	}
	for i, w := range want {
		c := checks[i]
		if c.Area != "Routes to devl" || c.Name != w.name || c.Status != w.status || c.Detail != w.detail {
			t.Errorf("check %d = %+v, want %+v", i, c, w)
		}
	}
	if !strings.Contains(checks[3].Fix, "Settings › Boxes") {
		t.Errorf("a route that's off says how to turn it on: %q", checks[3].Fix)
	}
}

func TestAnSSHRouteReachesBerthdWhereItListens(t *testing.T) {
	for listen, want := range map[string]string{
		"":                  "",
		"0.0.0.0:7444":      "127.0.0.1:7444",
		"[::]:7444":         "127.0.0.1:7444",
		"100.64.0.4:7444":   "100.64.0.4:7444",
		"192.168.1.20:8000": "192.168.1.20:8000",
	} {
		if got := forwardFor(listen); got != want {
			t.Errorf("forwardFor(%q) = %q, want %q", listen, got, want)
		}
	}
}
