package network

import (
	"context"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"
	"time"
)

const sharingStatus = `{"BackendState":"Running","Self":{"TailscaleIPs":["fd7a:115c:a1e0::1","100.64.0.10"]}}`
const sharingConfig = `{"TCP":{"7445":{"TCPForward":"127.0.0.1:7445"}}}`

func TestExistingServeForwardRequiresExactPrivateTLSRawRouteAndSelfIP(t *testing.T) {
	addresses, err := tcpForwardAddresses([]byte(sharingStatus), []byte(sharingConfig), "127.0.0.1:7445")
	want := []string{"100.64.0.10:7445", "[fd7a:115c:a1e0::1]:7445"}
	if err != nil || !reflect.DeepEqual(addresses, want) {
		t.Fatalf("addresses=%v err=%v", addresses, err)
	}
	for name, config := range map[string]string{
		"wrong daemon port":   `{"TCP":{"7445":{"TCPForward":"127.0.0.1:7444"}}}`,
		"other loopback bind": `{"TCP":{"7445":{"TCPForward":"127.0.0.2:7445"}}}`,
		"ambiguous localhost": `{"TCP":{"7445":{"TCPForward":"localhost:7445"}}}`,
		"HTTPS":               `{"TCP":{"7445":{"HTTPS":true,"TCPForward":"127.0.0.1:7445"}}}`,
		"HTTP":                `{"TCP":{"7445":{"HTTP":true,"TCPForward":"127.0.0.1:7445"}}}`,
		"TLS termination":     `{"TCP":{"7445":{"TerminateTLS":"example.test","TCPForward":"127.0.0.1:7445"}}}`,
		"PROXY header":        `{"TCP":{"7445":{"ProxyProtocol":1,"TCPForward":"127.0.0.1:7445"}}}`,
		"Funnel":              `{"TCP":{"7445":{"TCPForward":"127.0.0.1:7445"}},"AllowFunnel":{"node.example.test:7445":true}}`,
		"foreground override": `{"TCP":{"7445":{"TCPForward":"127.0.0.1:7445"}},"Foreground":{"session":{"TCP":{"7445":{"TCPForward":"127.0.0.1:9999"}}}}}`,
		"foreground only":     `{"Foreground":{"session":{"TCP":{"7445":{"TCPForward":"127.0.0.1:7445"}}}}}`,
	} {
		t.Run(name, func(t *testing.T) {
			got, err := tcpForwardAddresses([]byte(sharingStatus), []byte(config), "127.0.0.1:7445")
			if err != nil || len(got) != 0 {
				t.Fatalf("unproven route advertised: %v err=%v", got, err)
			}
		})
	}
	for _, status := range []string{`{"BackendState":"Stopped","Self":{"TailscaleIPs":["100.64.0.10"]}}`, `{"BackendState":"Running","TailscaleIPs":["100.64.0.10"]}`, `{"BackendState":"Running","Self":{"TailscaleIPs":["127.0.0.1","0.0.0.0","203.0.113.10"]}}`} {
		got, err := tcpForwardAddresses([]byte(status), []byte(sharingConfig), "127.0.0.1:7445")
		if err != nil || len(got) != 0 {
			t.Fatalf("unproven self node advertised: %v err=%v", got, err)
		}
	}
}

func TestSystemForwardQueriesOnlyExistingStatusWithinOneDeadline(t *testing.T) {
	dir := t.TempDir()
	name := "tailscale"
	if runtime.GOOS == "windows" {
		name += ".exe"
		t.Setenv("PATHEXT", ".EXE")
	}
	if err := os.WriteFile(filepath.Join(dir, name), []byte("test fixture"), 0o700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir)
	old := serveCLIOutput
	t.Cleanup(func() { serveCLIOutput = old })
	var calls []string
	serveCLIOutput = func(ctx context.Context, cli string, args ...string) ([]byte, error) {
		deadline, ok := ctx.Deadline()
		if !ok || time.Until(deadline) > 5*time.Second {
			t.Fatal("sharing query has no bounded deadline")
		}
		calls = append(calls, strings.Join(args, " "))
		if args[0] == "status" {
			return []byte(sharingStatus), nil
		}
		return []byte(sharingConfig), nil
	}
	got, err := SystemTCPForward(context.Background(), "127.0.0.1:7445")
	if err != nil || len(got) != 2 || !reflect.DeepEqual(calls, []string{"status --json --peers=false", "serve status --json"}) {
		t.Fatalf("addresses=%v calls=%v err=%v", got, calls, err)
	}
	calls = nil
	if _, err := SystemTCPForward(context.Background(), "100.64.0.10:7445"); err != nil || len(calls) != 0 {
		t.Fatalf("a remote target read local sharing config: %v %v", calls, err)
	}
}

func TestServeStatusOutputIsBoundedWithoutKeepingPartialOversizedData(t *testing.T) {
	var output serveJSONOutput
	if _, err := output.Write([]byte(`{"TCP":`)); err != nil {
		t.Fatal(err)
	}
	before := output.Len()
	if _, err := output.Write(make([]byte, 1<<20)); err == nil || output.Len() != before {
		t.Fatal("oversized sharing status was retained")
	}
}
