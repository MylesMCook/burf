package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/netip"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/sean-brydon/berthd/internal/service"
	"github.com/sean-brydon/berthd/internal/version"
)

func daemonService(b boxHome, listen string) service.Spec {
	exe, _ := os.Executable()
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	name := "berthd"
	if runtime.GOOS == "darwin" {
		name = "dev.berth.berthd"
	}
	args := []string{"serve"}
	if listen != "" {
		args = append(args, "--listen", listen)
	}
	return service.Spec{
		Name:         name,
		Description:  "berth box daemon",
		Program:      exe,
		Args:         args,
		Env:          map[string]string{"BERTH_HOME": filepath.Dir(b.dir)},
		LogPath:      filepath.Join(b.dir, "berthd.log"),
		KeepChildren: true,
	}
}

// install runs berthd serve as a user service: a systemd user unit on Linux,
// a launchd agent on macOS. `berth add ssh` runs it over SSH and the install
// script (berthd.app/install) runs it on the box, so a box is set up the same
// way whichever path it came by.
func install(b boxHome, args []string) error {
	fs := flag.NewFlagSet("install", flag.ContinueOnError)
	listen := fs.String("listen", "", "address to listen on (default: this box's tailnet address only)")
	keep := fs.Bool("keep-listen", false, "keep the address an installed berthd listens on, unless it was a tailnet address (for upgrades in place)")
	dryRun := fs.Bool("dry-run", false, "check this box can run berthd as a service and print what install would do")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if fs.NArg() > 0 {
		return errors.New("usage: berthd install [--listen ADDR] [--keep-listen] [--dry-run]")
	}
	if err := service.Preflight(); err != nil {
		return err
	}
	current := ""
	if path, err := service.UnitPath(daemonService(b, "")); err == nil {
		if unit, err := os.ReadFile(path); err == nil {
			current = unitListen(unit)
		}
	}
	addr, err := chooseListen(*listen, *keep, current, interfaceIPs())
	if *dryRun {
		return printPlan(os.Stdout, b, addr, current, err)
	}
	if err != nil {
		return err
	}
	spec := daemonService(b, addr)
	started := time.Now()
	path, err := service.Install(spec)
	if err != nil {
		return err
	}
	if err := waitServing(b, started, 20*time.Second); err != nil {
		return fmt.Errorf("installed %s, but berthd did not start: %w%s", path, err, logTail(spec.LogPath, 8))
	}
	fmt.Printf("Installed %s; berthd is serving on %s.\n", path, addr)
	if runtime.GOOS == "linux" && !lingering() {
		fmt.Println("Warning: user lingering is off, so berthd stops when you log out.")
		fmt.Println("Enable it once with: sudo loginctl enable-linger " + currentUser())
	}
	fmt.Println("Next: berthd pair")
	return nil
}

// chooseListen is where the service will listen: --listen when given; with
// --keep-listen, the address an installed unit already names, unless that is
// a tailnet address (the box may have a new one); otherwise the tailnet
// address. An address on every interface is only ever used when asked for.
func chooseListen(flagListen string, keep bool, current string, ips []net.IP) (string, error) {
	if flagListen != "" {
		return flagListen, nil
	}
	if keep && current != "" && !onTailnet(current) {
		return current, nil
	}
	return defaultListen(ips)
}

func onTailnet(hostport string) bool {
	host, _, err := net.SplitHostPort(hostport)
	if err != nil {
		return false
	}
	addr, err := netip.ParseAddr(host)
	return err == nil && carrierGradeNAT.Contains(addr.Unmap())
}

// unitListen reads the --listen an installed systemd unit or launchd plist
// starts berthd with.
var listenArg = regexp.MustCompile(`--listen(?:</string>\s*<string>|\s+)"?([^\s<"]+)`)

func unitListen(unit []byte) string {
	if m := listenArg.FindSubmatch(unit); m != nil {
		return string(m[1])
	}
	return ""
}

// printPlan is `berthd install --dry-run`: one "key value" line each, which
// the install script reads. "listen none" means there is no address to pick
// without --listen; the reason follows it.
func printPlan(w io.Writer, b boxHome, addr, current string, listenErr error) error {
	path, err := service.UnitPath(daemonService(b, addr))
	if err != nil {
		return err
	}
	fmt.Fprintf(w, "version %s\n", version.Version)
	fmt.Fprintf(w, "unit %s\n", path)
	if current != "" {
		fmt.Fprintf(w, "current %s\n", current)
	}
	if listenErr != nil {
		fmt.Fprintf(w, "listen none (%v)\n", listenErr)
	} else {
		fmt.Fprintf(w, "listen %s\n", addr)
	}
	return nil
}

// waitServing waits for the service to answer on its local socket, started
// after the install began: a socket left by the build it replaced does not
// count. `berthd pair` straight after then advertises where it listens.
func waitServing(b boxHome, since time.Time, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for {
		if st, err := os.Stat(filepath.Join(b.dir, "listen")); err == nil && !st.ModTime().Before(since.Truncate(time.Second)) {
			if c, err := net.DialTimeout("unix", b.socket(), time.Second); err == nil {
				c.Close()
				return nil
			}
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("it did not answer within %s", timeout)
		}
		time.Sleep(200 * time.Millisecond)
	}
}

// logTail is the end of the daemon's log, to show why it did not start.
func logTail(path string, n int) string {
	data, err := os.ReadFile(path)
	if err != nil || len(data) == 0 {
		return ""
	}
	lines := strings.Split(strings.TrimRight(string(data), "\n"), "\n")
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return "\nThe end of " + path + ":\n  " + strings.Join(lines, "\n  ")
}

func lingering() bool {
	out, err := exec.Command("loginctl", "show-user", currentUser(), "-p", "Linger").Output()
	return err == nil && strings.TrimSpace(string(out)) == "Linger=yes"
}

func currentUser() string {
	if u, err := user.Current(); err == nil {
		return u.Username
	}
	return os.Getenv("USER")
}
