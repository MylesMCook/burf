package sshroute

import (
	"context"
	"errors"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/MylesMCook/burf/internal/sshroute/sshtest"
	"github.com/MylesMCook/burf/internal/sshsetup"
)

func TestMain(m *testing.M) {
	sshtest.MaybeRun()
	os.Exit(m.Run())
}

// noAgents finds no SSH agent: tests never hand ssh a real one.
var noAgents = &sshsetup.Finder{Getenv: func(string) string { return "" }, Alive: func(string) bool { return false }}

func fakeSSH(t *testing.T) (string, string) {
	t.Helper()
	log := filepath.Join(t.TempDir(), "ssh.log")
	for _, kv := range sshtest.Environ(log) {
		k, v, _ := strings.Cut(kv, "=")
		t.Setenv(k, v)
	}
	return os.Args[0], log
}

func echo(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ln.Close() })
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			go func() { io.Copy(c, c); c.Close() }()
		}
	}()
	return ln.Addr().String()
}

func TestAConnectionRunsThroughSSHsStandardInputAndOutput(t *testing.T) {
	bin, log := fakeSSH(t)
	d := &Dialer{SSH: bin, Host: "alex@devbox", Forward: echo(t), Identity: "/keys/id_ed25519", Finder: noAgents}
	c, err := d.Dial(context.Background(), "tcp", "ignored:1")
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	c.Write([]byte("over ssh"))
	buf := make([]byte, 8)
	if _, err := io.ReadFull(c, buf); err != nil || string(buf) != "over ssh" {
		t.Fatalf("echo %q %v", buf, err)
	}
	c.Close()
	b, _ := os.ReadFile(log)
	got := string(b)
	for _, want := range []string{"-G -i /keys/id_ed25519 alex@devbox", "BatchMode=yes", "-W " + d.Forward + " alex@devbox", "-i /keys/id_ed25519"} {
		if !strings.Contains(got, want) {
			t.Errorf("ssh was not run with %q:\n%s", want, got)
		}
	}
}

func TestAHostSSHCannotReachIsADialError(t *testing.T) {
	bin, _ := fakeSSH(t)
	d := &Dialer{SSH: bin, Host: sshtest.Unreachable, Forward: "127.0.0.1:7444", Finder: noAgents}
	c, err := d.Dial(context.Background(), "tcp", "x:1")
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	_, err = c.Read(make([]byte, 1))
	var op *net.OpError
	if !errors.As(err, &op) || op.Op != "dial" || !strings.Contains(err.Error(), "Could not resolve hostname") {
		t.Fatalf("read: %v", err)
	}
}

func TestAnInitialWriteAfterSSHExitsKeepsItsDiagnostic(t *testing.T) {
	bin, _ := fakeSSH(t)
	d := &Dialer{SSH: bin, Host: sshtest.Unreachable, Forward: "127.0.0.1:7444", Finder: noAgents}
	c, err := d.Dial(t.Context(), "tcp", "x:1")
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	select {
	case <-c.(*conn).exited:
	case <-ctx.Done():
		t.Fatal("synthetic SSH did not exit")
	}
	_, err = c.Write([]byte("TLS ClientHello"))
	var op *net.OpError
	if !errors.As(err, &op) || op.Op != "dial" || !strings.Contains(err.Error(), "Could not resolve hostname") {
		t.Fatalf("write: %v", err)
	}
}

func TestOnlyPlainHostsReachSSH(t *testing.T) {
	for _, h := range []string{"devbox", "alex@devbox", "alex@10.0.0.2", "box.example.com", "fd00::1"} {
		if !ValidHost(h) {
			t.Errorf("refused %q", h)
		}
	}
	for _, h := range []string{"", "-oProxyCommand=sh", "a b", "a\nb", "host;rm", "-v"} {
		if ValidHost(h) {
			t.Errorf("accepted %q", h)
		}
	}
	d := &Dialer{Host: "-oProxyCommand=touch /tmp/x", Forward: "127.0.0.1:7444"}
	if _, err := d.Dial(context.Background(), "tcp", "x:1"); err == nil {
		t.Fatal("dialed an option as a host")
	}
}

func TestTheSharedConnectionsSocketFitsAUnixPath(t *testing.T) {
	short := &Dialer{Host: "h", Forward: "127.0.0.1:1", ControlDir: "/tmp/b"}
	if !strings.Contains(strings.Join(short.Args(), " "), "ControlPath=/tmp/b/%C") {
		t.Fatalf("args %v", short.Args())
	}
	long := &Dialer{Host: "h", Forward: "127.0.0.1:1", ControlDir: "/" + strings.Repeat("x", 90)}
	if strings.Contains(strings.Join(long.Args(), " "), "ControlPath") {
		t.Fatalf("a socket path past the limit: %v", long.Args())
	}
}
