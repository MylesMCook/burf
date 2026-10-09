// Package sshroute reaches berthd through the person's own ssh: `ssh -W
// ADDR HOST` carries one connection to berthd's port on the box over SSH,
// with their ~/.ssh/config, agent and keys (1Password's agent included),
// exactly as `ssh HOST` in a terminal would. berth never reads, stores or
// asks for a key: ssh runs in batch mode, so anything that would need a
// person (a password, a passphrase, an unknown host key) fails instead.
//
// The connection is only a transport. berth's TLS, pinned to the box's key,
// runs over it as over any other route.
package sshroute

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/MylesMCook/burf/internal/backgroundcmd"
	"github.com/MylesMCook/burf/internal/sshsetup"
)

// Dialer opens connections to a box's berthd over SSH.
type Dialer struct {
	// SSH is the ssh program; "ssh" on the PATH by default.
	SSH string
	// Host is the SSH host as the person knows it: [user@]host, or a Host
	// from their ~/.ssh/config.
	Host string
	// Identity is a key file to log in with (ssh -i), when one was chosen
	// at setup. Only its path is passed on.
	Identity string
	// Forward is where berthd listens, as the box itself sees it.
	Forward string
	// ControlDir holds the shared connection's socket (ControlMaster), so
	// a new connection doesn't log in again; "" logs in each time.
	ControlDir string
	// Finder finds the SSH agent ssh should use when this process has none
	// (the agent runs under launchd); nil looks at this computer.
	Finder *sshsetup.Finder
}

var validHost = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9_.@%:\[\]-]{0,254}$`)

// ValidHost reports whether host can be handed to ssh as its destination:
// no spaces, nothing ssh would read as an option.
func ValidHost(host string) bool { return validHost.MatchString(host) }

// ValidForward reports whether addr is a host:port berthd could listen on.
func ValidForward(addr string) bool {
	h, p, err := net.SplitHostPort(addr)
	return err == nil && h != "" && p != "" && !strings.HasPrefix(h, "-") && validHost.MatchString(h)
}

func (d *Dialer) ssh() string {
	if d.SSH != "" {
		return d.SSH
	}
	return "ssh"
}

// controlPath is the shared connection's socket, or "" when the directory
// would make it longer than a Unix socket path may be.
func (d *Dialer) controlPath() string {
	if d.ControlDir == "" || len(d.ControlDir)+1+40 > 100 {
		return ""
	}
	return filepath.Join(d.ControlDir, "%C")
}

// Args are the ssh arguments that open one forwarded connection.
func (d *Dialer) Args() []string {
	args := []string{
		// Never ask anyone anything: this runs in the background.
		"-o", "BatchMode=yes",
		"-o", "ConnectTimeout=10",
		// A dead SSH link ends the connection, which ends the route.
		"-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=2",
		"-o", "ExitOnForwardFailure=yes",
	}
	if cp := d.controlPath(); cp != "" {
		args = append(args, "-o", "ControlMaster=auto", "-o", "ControlPath="+cp, "-o", "ControlPersist=300")
	}
	if d.Identity != "" {
		args = append(args, "-i", d.Identity)
	}
	return append(args, "-W", d.Forward, d.Host)
}

// Dial starts ssh and returns its standard input and output as the
// connection. ctx bounds only the check that the host answers; the
// connection lasts until it is closed. A failure to log in or to reach
// berthd shows on the first read, as a dial error with ssh's own words.
func (d *Dialer) Dial(ctx context.Context, _, _ string) (net.Conn, error) {
	if !ValidHost(d.Host) || !ValidForward(d.Forward) {
		return nil, dialErr(fmt.Errorf("can't SSH to %q for %q", d.Host, d.Forward))
	}
	env, err := d.check(ctx)
	if err != nil {
		return nil, dialErr(err)
	}
	if cp := d.controlPath(); cp != "" {
		os.MkdirAll(d.ControlDir, 0o700)
	}
	// ssh's stderr goes to a file, not a pipe: a shared connection's
	// master lives on in the background and would hold a pipe open.
	errFile, err := os.CreateTemp("", "berth-ssh-*.err")
	if err != nil {
		return nil, dialErr(err)
	}
	cmd := backgroundcmd.CommandContext(context.Background(), d.ssh(), d.Args()...)
	cmd.Env = env
	cmd.Stderr = errFile
	stdin, err := cmd.StdinPipe()
	if err != nil {
		errFile.Close()
		os.Remove(errFile.Name())
		return nil, dialErr(err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		errFile.Close()
		os.Remove(errFile.Name())
		return nil, dialErr(err)
	}
	if err := cmd.Start(); err != nil {
		errFile.Close()
		os.Remove(errFile.Name())
		return nil, dialErr(fmt.Errorf("starting ssh: %w", err))
	}
	c := &conn{cmd: cmd, stdin: stdin, stdout: stdout, errFile: errFile, host: d.Host, exited: make(chan struct{})}
	go func() {
		cmd.Wait()
		close(c.exited)
	}()
	return c, nil
}

// check asks ssh what it would do for the host (ssh -G: the config
// applied, nothing connected) and, unless it goes through a proxy, that
// the host answers at all, so a host that is gone costs a TCP connect
// rather than a login. It returns the environment ssh runs with: this
// one, plus the SSH agent ssh wouldn't find by itself.
func (d *Dialer) check(ctx context.Context) ([]string, error) {
	env := os.Environ()
	gctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	gargs := []string{"-G"}
	if d.Identity != "" {
		gargs = append(gargs, "-i", d.Identity)
	}
	out, err := backgroundcmd.CommandContext(gctx, d.ssh(), append(gargs, d.Host)...).Output()
	if err != nil {
		var ee *exec.ExitError
		if errors.As(err, &ee) {
			return nil, fmt.Errorf("ssh -G %s: %s", d.Host, firstLine(ee.Stderr))
		}
		return nil, fmt.Errorf("ssh -G %s: %w", d.Host, err)
	}
	cfg := sshsetup.ParseG(out)
	finder := sshsetup.DefaultFinder()
	if d.Finder != nil {
		finder = *d.Finder
	}
	if agent, inject, _ := finder.Find(cfg.IdentityAgent); inject && agent != nil {
		env = withEnv(env, "SSH_AUTH_SOCK", agent.Socket)
	}
	if cfg.HostName == "" || cfg.ProxyJump != "" || (cfg.ProxyCommand != "" && cfg.ProxyCommand != "none") {
		return env, nil
	}
	port := cfg.Port
	if port == "" {
		port = "22"
	}
	tcp, err := (&net.Dialer{Timeout: 3 * time.Second}).DialContext(ctx, "tcp", net.JoinHostPort(cfg.HostName, port))
	if err != nil {
		return nil, fmt.Errorf("SSH host %s doesn't answer", d.Host)
	}
	tcp.Close()
	return env, nil
}

// Close ends the shared connection, if there is one.
func (d *Dialer) Close() {
	cp := d.controlPath()
	if cp == "" {
		return
	}
	cmd := backgroundcmd.CommandContext(context.Background(), d.ssh(), "-o", "ControlPath="+cp, "-O", "exit", d.Host)
	cmd.Stdout, cmd.Stderr = io.Discard, io.Discard
	done := make(chan struct{})
	go func() {
		cmd.Run()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
	}
}

func dialErr(err error) error { return &net.OpError{Op: "dial", Net: "ssh", Err: err} }

func withEnv(env []string, key, value string) []string {
	out := make([]string, 0, len(env)+1)
	for _, kv := range env {
		if !strings.HasPrefix(kv, key+"=") {
			out = append(out, kv)
		}
	}
	return append(out, key+"="+value)
}

func firstLine(b []byte) string {
	s := strings.TrimSpace(string(b))
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = s[:i]
	}
	if s == "" {
		return "ssh failed"
	}
	return s
}

// conn is ssh's standard input and output.
type conn struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	stdout  io.ReadCloser
	errFile *os.File
	host    string
	exited  chan struct{}

	mu   sync.Mutex
	got  bool
	once sync.Once
}

func (c *conn) Read(b []byte) (int, error) {
	n, err := c.stdout.Read(b)
	c.mu.Lock()
	got := c.got || n > 0
	c.got = got
	c.mu.Unlock()
	if err != nil && !got {
		// Nothing ever came back: ssh couldn't log in or reach berthd.
		// That is a failure to connect, in ssh's words.
		return n, dialErr(fmt.Errorf("ssh %s: %s", c.host, c.reason()))
	}
	return n, err
}

// reason is the last thing ssh said, once it has exited.
func (c *conn) reason() string {
	select {
	case <-c.exited:
	case <-time.After(2 * time.Second):
	}
	b, _ := os.ReadFile(c.errFile.Name())
	lines := strings.Split(strings.TrimSpace(string(bytes.ReplaceAll(b, []byte("\r"), nil))), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		if l := strings.TrimSpace(lines[i]); l != "" {
			return l
		}
	}
	return "the connection closed"
}

func (c *conn) Write(b []byte) (int, error) { return c.stdin.Write(b) }

func (c *conn) Close() error {
	c.once.Do(func() {
		c.stdin.Close()
		// ssh -W exits when its input closes; one that doesn't is ended.
		select {
		case <-c.exited:
		case <-time.After(time.Second):
			c.cmd.Process.Kill()
			<-c.exited
		}
		c.errFile.Close()
		os.Remove(c.errFile.Name())
	})
	return nil
}

func (c *conn) LocalAddr() net.Addr  { return addr("ssh") }
func (c *conn) RemoteAddr() net.Addr { return addr("ssh:" + c.host) }

// Deadlines are not supported; HTTP/2's own pings and the route checks
// find a connection that stopped.
func (c *conn) SetDeadline(time.Time) error      { return nil }
func (c *conn) SetReadDeadline(time.Time) error  { return nil }
func (c *conn) SetWriteDeadline(time.Time) error { return nil }

type addr string

func (a addr) Network() string { return "ssh" }
func (a addr) String() string  { return string(a) }
