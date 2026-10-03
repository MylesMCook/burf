package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/sean-brydon/berthd/internal/pairing"
	"github.com/sean-brydon/berthd/internal/sshsetup"
	"github.com/sean-brydon/berthd/internal/trust"
	"github.com/sean-brydon/berthd/internal/wire"
)

// daemonFor maps `uname -sm` output to the berthd build for that box.
func daemonFor(uname string) (string, error) {
	f := strings.Fields(strings.ToLower(uname))
	if len(f) != 2 {
		return "", fmt.Errorf("could not read the box's platform from %q", uname)
	}
	arch := map[string]string{"x86_64": "amd64", "amd64": "amd64", "aarch64": "arm64", "arm64": "arm64"}[f[1]]
	if arch == "" || (f[0] != "linux" && f[0] != "darwin") {
		return "", fmt.Errorf("berthd does not support %s", uname)
	}
	return "berthd-" + f[0] + "-" + arch, nil
}

var linkPattern = regexp.MustCompile(`berth://\S+`)

// findLink pulls the pairing link out of `berthd pair` output.
func findLink(out []byte) (string, error) {
	link := linkPattern.Find(out)
	if link == nil {
		return "", errors.New("the box did not print a pairing link")
	}
	return strings.TrimRight(string(link), "'\""), nil
}

// addSSH installs berthd on a machine you can already SSH to and pairs
// with it. SSH is used for this one setup only; afterwards berth talks to
// the box directly and never needs your SSH agent again.
func addSSH(l laptop, args []string) error {
	err := addSSHSteps(l, args)
	var f *sshsetup.Failure
	if errors.As(err, &f) && os.Getenv(sshsetup.FailureEnv) == "1" {
		if data, jerr := json.Marshal(f); jerr == nil {
			fmt.Fprintln(os.Stderr, sshsetup.FailurePrefix+string(data))
		}
	}
	return err
}

const addSSHUsage = "usage: berth add ssh [user@]HOST [--name N] [--network NET] [--listen ADDR] [--address ADDR] [--identity FILE] [--trust-host-key SHA256:…] [--no-integrations] [-- SSH OPTIONS]"

func addSSHSteps(l laptop, args []string) error {
	var sshArgs []string
	for i, a := range args {
		if a == "--" {
			sshArgs = args[i+1:]
			args = args[:i]
			break
		}
	}
	fs := flag.NewFlagSet("add ssh", flag.ContinueOnError)
	name := fs.String("name", "", "local name for the box")
	listen := fs.String("listen", "", "where berthd listens (default: the box's tailnet address only)")
	address := fs.String("address", "", "address this laptop dials, when it differs from --listen")
	via := fs.String("network", "", "reach the box through this network, for SSH and afterwards")
	identity := fs.String("identity", "", "an SSH private key file to log in with (as ssh -i)")
	trustKey := fs.String("trust-host-key", "", "trust the box's host key if its fingerprint is this SHA256:… (a new box only; a changed key is never trusted)")
	noIntegrations := fs.Bool("no-integrations", false, "don't install hooks and skills for the agent CLIs on the box")
	pos, err := parseAnywhere(fs, args)
	if err != nil || len(pos) != 1 {
		return errors.New(addSSHUsage)
	}
	target := pos[0]
	if err := checkName(*name); err != nil {
		return err
	}
	if err := checkNetwork(*via); err != nil {
		return err
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	if *via != "" {
		// SSH to the box through the same network berth will use. ssh runs
		// ProxyCommand with a shell, so every word is quoted.
		sshArgs = append([]string{"-o", proxyCommand(exe, *via)}, sshArgs...)
	}
	if *identity != "" {
		path, err := expandHome(*identity)
		if err != nil {
			return err
		}
		if st, err := os.Stat(path); err != nil || !st.Mode().IsRegular() {
			return fmt.Errorf("no key file at %s", *identity)
		}
		sshArgs = append([]string{"-i", path}, sshArgs...)
	}
	// ConnectTimeout bounds reaching the box, not logging in: a key
	// manager's approval prompt can take as long as the person needs.
	if !hasOption(sshArgs, "ConnectTimeout") {
		sshArgs = append([]string{"-o", "ConnectTimeout=20"}, sshArgs...)
	}

	// What ssh will do, from ~/.ssh/config, and the agent berth hands it
	// when this process has none of its own (started by launchd or the app).
	finder := sshsetup.DefaultFinder()
	cfg, err := sshsetup.ReadConfig(context.Background(), sshArgs, target)
	if err != nil {
		return err
	}
	plan := finder.MakePlan(target, cfg, "")
	env := askpassEnv(exe)
	if plan.Inject != "" {
		env = withEnv(env, "SSH_AUTH_SOCK", plan.Inject)
	}
	fmt.Println(plan.Summary)
	// Failures name the host as it was typed, the way the person knows it.
	host := target[strings.LastIndex(target, "@")+1:]
	interactive := isTerminal(os.Stdin)
	if *trustKey != "" {
		hk, err := sshsetup.FetchHostKey(context.Background(), sshsetup.Exec, env, sshArgs, target)
		if err != nil {
			return err
		}
		if err := sshsetup.TrustHostKey(hk, *trustKey, finder.KnownHostsFile(cfg)); err != nil {
			return err
		}
		fmt.Printf("Trusted %s's host key (%s).\n", host, *trustKey)
	} else if !interactive && cfg.StrictHostKeyChecking == "ask" {
		// Without a terminal, an unknown host key comes back as a failure
		// with its fingerprint, for the app to ask about, not a dialog.
		sshArgs = append([]string{"-o", "StrictHostKeyChecking=yes"}, sshArgs...)
	}

	// The steps share one connection, so a password or host key question is
	// asked once. /tmp keeps the socket path under macOS's 104-byte limit.
	control, err := os.MkdirTemp("/tmp", "cpssh")
	if err != nil {
		return err
	}
	defer os.RemoveAll(control)
	sshArgs = append([]string{"-o", "ControlPath=" + filepath.Join(control, "%C")}, sshArgs...)
	fail := func(stderr string, agent *sshsetup.Agent) *sshsetup.Failure {
		f := sshsetup.Classify(stderr, host, cfg.Port, agent, plan.IdentityFiles)
		if f.Kind == "host-key-unknown" && f.Fingerprint == "" {
			if hk, err := sshsetup.FetchHostKey(context.Background(), sshsetup.Exec, env, sshArgs, target); err == nil {
				f.Fingerprint = hk.PickFingerprint(sshsetup.UnknownKeyType(stderr))
			}
			if f.Fingerprint != "" {
				f.Message += " Its fingerprint is " + f.Fingerprint + "; to trust it, run again with --trust-host-key " + f.Fingerprint + "."
			}
		}
		return f
	}
	if stderr, err := openMaster(sshArgs, target, env, control); err != nil {
		first := fail(stderr, plan.Agent)
		if first.Kind != "auth" || hasOption(sshArgs, "IdentityAgent") {
			return first
		}
		// Every key was refused. Keys kept in a key manager are only offered
		// where something names its agent; try the others that are running.
		tried := ""
		if plan.Agent != nil {
			tried = plan.Agent.Socket
		}
		ok := false
		offered := first.Tried
		for _, other := range finder.Others(tried) {
			fmt.Printf("Trying the keys in %s…\n", other.Name)
			retry := append([]string{"-o", "IdentityAgent=" + other.Socket}, sshArgs...)
			stderr, err := openMaster(retry, target, env, control)
			if err == nil {
				sshArgs, ok = retry, true
				break
			}
			if f := sshsetup.Classify(stderr, host, cfg.Port, &other, nil); f.Kind == "auth" {
				offered = append(offered, f.Tried...)
			}
		}
		if !ok {
			return sshsetup.AuthFailure(host, cfg.Port, offered, first.Detail)
		}
	}
	defer exec.Command("ssh", append(append([]string{}, sshArgs...), "-O", "exit", target)...).Run()
	ssh := func(stdin []byte, remote string) ([]byte, error) {
		cmd := exec.Command("ssh", append(append([]string{}, sshArgs...), target, remote)...)
		cmd.Env = env
		if stdin != nil {
			cmd.Stdin = bytes.NewReader(stdin)
		}
		var stderr bytes.Buffer
		cmd.Stderr = &stderr
		out, err := cmd.Output()
		if err != nil {
			var ee *exec.ExitError
			if errors.As(err, &ee) && ee.ExitCode() != 255 {
				// The remote command failed, not ssh: its own words say why.
				return out, fmt.Errorf("on %s, %s failed: %s", host, strings.Fields(remote)[0], strings.TrimSpace(stderr.String()))
			}
			return out, fail(stderr.String(), plan.Agent)
		}
		return out, nil
	}

	fmt.Printf("Checking %s…\n", target)
	uname, err := ssh(nil, "uname -sm")
	if err != nil {
		return err
	}
	daemon, err := daemonFor(string(uname))
	if err != nil {
		return err
	}
	binary, err := readDaemon(exe, daemon)
	if err != nil {
		return err
	}

	fmt.Printf("Installing %s (%d MB)…\n", daemon, len(binary)>>20)
	upload := "mkdir -p ~/.local/bin && cat > ~/.local/bin/berthd.new && chmod +x ~/.local/bin/berthd.new && mv ~/.local/bin/berthd.new ~/.local/bin/berthd"
	if _, err := ssh(binary, upload); err != nil {
		return err
	}
	install := "~/.local/bin/berthd install"
	if *listen != "" {
		install += " --listen " + shellQuote(*listen)
	}
	if *noIntegrations {
		install += " --no-integrations"
	}
	out, err := ssh(nil, install)
	if err != nil {
		return err
	}
	// berthd install ends with "Next: berthd pair", which this command does itself.
	fmt.Print(indent(strings.Replace(string(out), "Next: berthd pair\n", "", 1)))

	pair := "sleep 1; ~/.local/bin/berthd pair"
	if *address != "" {
		pair += " --address " + shellQuote(*address)
	}
	out, err = ssh(nil, pair)
	if err != nil {
		return err
	}
	link, err := findLink(out)
	if err != nil {
		return err
	}
	tok, err := pairing.ParseToken(link)
	if err != nil {
		return err
	}
	id, err := l.identity()
	if err != nil {
		return err
	}
	hostname, _ := os.Hostname()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	dial, err := networkDialer(l, *via)
	if err != nil {
		return err
	}
	reported, err := wire.PairVia(ctx, id, tok, trust.NameFromHostname(hostname, "laptop"), dial)
	if err != nil {
		return fmt.Errorf("berthd is installed but this laptop could not reach it at %s: %w\n"+
			"If the box is only reachable another way, rerun with --address", tok.Address, err)
	}
	peer := trust.Peer{Name: *name, Address: tok.Address, Network: *via, Fingerprint: tok.Fingerprint, PairedAt: time.Now().UTC()}
	if peer.Name == "" {
		peer.Name = trust.NameFromHostname(reported, "box")
		peer.Name, err = l.boxes().AddWithFreeName(peer)
	} else {
		err = l.boxes().Add(peer)
	}
	if err != nil {
		return err
	}
	if c := agentIfRunning(l); c != nil {
		c.Refresh(context.Background())
	}
	fmt.Printf("Paired with %s at %s. SSH is no longer needed for this box.\n", peer.Name, peer.Address)
	return nil
}

// checkName refuses a --name that cannot be a hostname before any work is
// done, suggesting one that can.
func checkName(name string) error {
	if name == "" || trust.ValidName(name) {
		return nil
	}
	return fmt.Errorf("%q cannot be a box name: it is part of URLs like 3000.NAME.localhost. Try --name %s", name, trust.NameFromHostname(name, "box"))
}

// checkNetwork refuses a --network that is not a network's name: it ends up
// in ssh's ProxyCommand and in the laptop's records.
func checkNetwork(network string) error {
	if network == "" || trust.ValidName(network) {
		return nil
	}
	return fmt.Errorf("%q is not a network name (see berth networks)", network)
}

// proxyCommand is the ssh option that reaches a box through a berth network.
// %h and %p are ssh's own tokens and stay outside the quotes.
func proxyCommand(exe, network string) string {
	return fmt.Sprintf("ProxyCommand=%s network proxy %s %%h %%p", shellQuote(exe), shellQuote(network))
}

// openMaster authenticates once and leaves a shared connection in the
// background, returning ssh's stderr when it fails. That goes to a file, not
// a pipe: the backgrounded ssh keeps it open, and waiting on a pipe would
// wait for that process to exit. -v adds the keys ssh offered, which an
// "every key was refused" failure names.
func openMaster(sshArgs []string, target string, env []string, dir string) (string, error) {
	errFile, err := os.Create(filepath.Join(dir, "stderr"))
	if err != nil {
		return "", err
	}
	defer errFile.Close()
	cmd := exec.Command("ssh", append(append([]string{"-v", "-o", "ControlMaster=yes", "-o", "ControlPersist=120", "-f", "-N"}, sshArgs...), target)...)
	cmd.Env = env
	cmd.Stderr = errFile
	if err := cmd.Run(); err != nil {
		stderr, _ := os.ReadFile(errFile.Name())
		return string(stderr), err
	}
	return "", nil
}

// hasOption reports whether ssh arguments set an -o option already; ssh
// keeps the first value it sees, so berth's defaults must not mask the
// person's own.
func hasOption(sshArgs []string, name string) bool {
	return slices.ContainsFunc(sshArgs, func(a string) bool {
		return strings.HasPrefix(strings.ToLower(a), strings.ToLower(name)+"=") || strings.HasPrefix(strings.ToLower(a), strings.ToLower(name)+" ")
	})
}

// withEnv sets one variable in an environment list, replacing any value.
func withEnv(env []string, key, value string) []string {
	out := make([]string, 0, len(env)+1)
	for _, kv := range env {
		if !strings.HasPrefix(kv, key+"=") {
			out = append(out, kv)
		}
	}
	return append(out, key+"="+value)
}

func expandHome(path string) (string, error) {
	if path == "~" || strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, strings.TrimPrefix(path, "~")), nil
	}
	return filepath.Abs(path)
}

func shellQuote(s string) string { return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'" }

func indent(s string) string {
	s = strings.TrimRight(s, "\n")
	if s == "" {
		return ""
	}
	return "  " + strings.ReplaceAll(s, "\n", "\n  ") + "\n"
}

// parseAnywhere accepts flags before and after positional arguments.
func parseAnywhere(fs *flag.FlagSet, args []string) ([]string, error) {
	var positional []string
	for {
		if err := fs.Parse(args); err != nil {
			return nil, err
		}
		rest := fs.Args()
		if len(rest) == 0 {
			return positional, nil
		}
		positional = append(positional, rest[0])
		args = rest[1:]
	}
}

// readDaemon finds the berthd build to upload: beside berth in a build
// directory, or in Contents/Resources when berth runs inside the macOS app.
// berth on the PATH is often a link to the app's copy (Settings → General
// → Command line), so look beside the file the link points at.
func readDaemon(exe, daemon string) ([]byte, error) {
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	dir := filepath.Dir(exe)
	for _, path := range []string{filepath.Join(dir, daemon), filepath.Join(dir, "..", "Resources", daemon)} {
		if b, err := os.ReadFile(path); err == nil {
			return b, nil
		}
	}
	return nil, fmt.Errorf("no %s next to berth (%s); build it with `make daemons`", daemon, dir)
}
