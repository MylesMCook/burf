package agent

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestWindowsLongHomeHasPrivateShortStableSocket(t *testing.T) {
	cache, err := os.MkdirTemp("", "bi-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(cache) })
	t.Setenv("LOCALAPPDATA", cache)
	dir := filepath.Join(t.TempDir(), strings.Repeat("long state folder-", 3), "client")
	socket := SocketPath(dir)
	if len(socket) > 100 || socket == filepath.Join(dir, "agent.sock") || socket != SocketPath(strings.ToUpper(dir)) || socket == SocketPath(dir+"-other") {
		t.Fatalf("unsafe or unstable long-home socket: %q", socket)
	}
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() {
		done <- Run(ctx, Config{Dir: dir, UserDir: filepath.Join(dir, "user"), ProxyAddrs: []string{}, UIAddr: "off"})
	}()
	t.Cleanup(func() { cancel(); <-done })
	client := NewClient(socket)
	deadline := time.Now().Add(5 * time.Second)
	for !client.Running(t.Context()) {
		select {
		case err := <-done:
			done <- err
			t.Fatalf("long-home agent failed: %v", err)
		default:
		}
		if time.Now().After(deadline) {
			t.Fatal("long-home agent did not start")
		}
		time.Sleep(20 * time.Millisecond)
	}
	if _, err := client.Status(t.Context()); err != nil {
		t.Fatal(err)
	}
	short := filepath.Join(cache, "client")
	if SocketPath(short) != filepath.Join(short, "agent.sock") {
		t.Fatal("short-home socket changed")
	}
}
