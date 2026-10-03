package network

import (
	"encoding/json"
	"testing"

	"tailscale.com/ipn/ipnstate"
)

func TestPeersKeepBoxesOnlineFirst(t *testing.T) {
	var st ipnstate.Status
	err := json.Unmarshal([]byte(`{"BackendState":"Running","Peer":{
		"nodekey:1111111111111111111111111111111111111111111111111111111111111111":{"HostName":"phone","DNSName":"phone.example.ts.net.","OS":"iOS","Online":true,"TailscaleIPs":["100.64.0.9"]},
		"nodekey:2222222222222222222222222222222222222222222222222222222222222222":{"HostName":"devbox","DNSName":"dev-alex.example.ts.net.","OS":"linux","Online":false,"TailscaleIPs":["fd7a::1","100.64.0.2"]},
		"nodekey:3333333333333333333333333333333333333333333333333333333333333333":{"HostName":"build","DNSName":"build.example.ts.net.","OS":"linux","Online":true,"TailscaleIPs":["100.64.0.3"]}
	}}`), &st)
	if err != nil {
		t.Fatal(err)
	}
	got := peersFrom(&st)
	if len(got) != 2 || got[0].Name != "build" || got[1].Name != "dev-alex" {
		t.Fatalf("peers = %+v; want build (online) then dev-alex, and no phone", got)
	}
	if got[1].IP != "100.64.0.2" || got[1].DNSName != "dev-alex.example.ts.net" {
		t.Fatalf("dev-alex = %+v; want its IPv4 and DNS name without the dot", got[1])
	}
}

func TestPeersReportTailscaleSSH(t *testing.T) {
	var st ipnstate.Status
	// An invented key; its fingerprint is what ssh-keygen -lf prints for it.
	err := json.Unmarshal([]byte(`{"BackendState":"Running","Peer":{
		"nodekey:1111111111111111111111111111111111111111111111111111111111111111":{"HostName":"build","DNSName":"build.example.ts.net.","OS":"linux","Online":true,"TailscaleIPs":["100.64.0.3"],
			"sshHostKeys":["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl root@build"]},
		"nodekey:2222222222222222222222222222222222222222222222222222222222222222":{"HostName":"plain","DNSName":"plain.example.ts.net.","OS":"linux","Online":true,"TailscaleIPs":["100.64.0.4"]}
	}}`), &st)
	if err != nil {
		t.Fatal(err)
	}
	got := peersFrom(&st)
	if len(got) != 2 || !got[0].SSH || got[1].SSH {
		t.Fatalf("peers = %+v; want build with Tailscale SSH and plain without", got)
	}
	if len(got[0].HostKeys) != 1 || got[0].HostKeys[0] != "SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU" {
		t.Fatalf("host keys = %v", got[0].HostKeys)
	}
}

func TestSystemStates(t *testing.T) {
	for in, want := range map[string]string{
		`{"BackendState":"Running","CurrentTailnet":{"Name":"example.com"}}`: "running",
		`{"BackendState":"NeedsLogin"}`:                                      "logged-out",
		`{"BackendState":"Stopped"}`:                                         "stopped",
		`{"BackendState":"Starting"}`:                                        "stopped",
	} {
		got, err := systemState([]byte(in))
		if err != nil || got.State != want {
			t.Errorf("systemState(%s) = %+v, %v; want %s", in, got, err, want)
		}
		if (got.Err() == nil) != (want == "running") {
			t.Errorf("%s: Err() = %v", want, got.Err())
		}
	}
	if got, _ := systemState([]byte(`{"BackendState":"Running","CurrentTailnet":{"Name":"example.com"}}`)); got.Name != "example.com" {
		t.Errorf("tailnet name = %q", got.Name)
	}
}
