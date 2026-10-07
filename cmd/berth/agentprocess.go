package main

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/sean-brydon/berthd/internal/agent"
	"github.com/sean-brydon/berthd/internal/doctor"
	"github.com/sean-brydon/berthd/internal/service"
	"github.com/sean-brydon/berthd/internal/statefile"
	"github.com/sean-brydon/berthd/internal/version"
)

func agentService(l laptop) (service.Spec, error) {
	exe, err := os.Executable()
	if err != nil {
		return service.Spec{}, err
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	home, err := filepath.Abs(filepath.Dir(l.dir))
	if err != nil {
		return service.Spec{}, err
	}
	name := "berth-agent"
	if runtime.GOOS == "darwin" {
		name = "dev.berth.agent"
	} else if runtime.GOOS == "windows" {
		// Separate BERTH_HOME values have independent agents and login tasks.
		hash := sha256.Sum256([]byte(strings.ToLower(filepath.Clean(home))))
		name += fmt.Sprintf("-%x", hash[:6])
	}
	return service.Spec{
		Name:        name,
		Description: "berth agent",
		Program:     exe,
		Args:        []string{"agent"},
		Env:         map[string]string{"BERTH_HOME": home},
		LogPath:     filepath.Join(l.dir, "agent.log"),
	}, nil
}

// ensureAgent returns a client for a running agent, starting one if needed:
// through the supervisor when installed, otherwise as a detached process.
func ensureAgent(l laptop) (*agent.Client, error) {
	c := agent.NewClient(l.socket())
	if c.Running(context.Background()) {
		return c, nil
	}
	spec, err := agentService(l)
	if err != nil {
		return nil, err
	}
	if service.Installed(spec) {
		if err := service.Start(spec); err != nil {
			return nil, err
		}
	} else if err := spawnAgent(l, spec.Program); err != nil {
		return nil, err
	}
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if c.Running(context.Background()) {
			return c, nil
		}
		time.Sleep(50 * time.Millisecond)
	}
	return nil, fmt.Errorf("the berth agent did not start; see %s", filepath.Join(l.dir, "agent.log"))
}

func spawnAgent(l laptop, exe string) error {
	if err := statefile.EnsurePrivateDir(l.dir); err != nil {
		return err
	}
	logFile, err := os.OpenFile(filepath.Join(l.dir, "agent.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer logFile.Close()
	if err := statefile.Private(logFile.Name()); err != nil {
		return err
	}
	cmd := exec.Command(exe, "agent")
	cmd.Env = append(os.Environ(), "BERTH_HOME="+filepath.Dir(l.dir))
	cmd.Stdout, cmd.Stderr = logFile, logFile
	detachAgentProcess(cmd)
	if err := cmd.Start(); err != nil {
		return err
	}
	return cmd.Process.Release()
}

// runAgent is `berth agent`: the agent in the foreground, as a supervisor
// runs it. Losing the singleton race exits cleanly so it is not restarted.
func runAgent(l laptop) error {
	ctx, stop := signalContext()
	defer stop()
	cfg := agent.Config{Dir: l.dir, Socket: l.socket()}
	// The app's Copy diagnostics shows what `berth doctor` would (GET /v1/doctor).
	cfg.Doctor = func(ctx context.Context) []doctor.Check { return laptopChecks(ctx, l) }
	// A second agent (a test, a throwaway home) needs its own ports.
	if a := os.Getenv("BERTH_PROXY_ADDR"); a != "" {
		cfg.ProxyAddrs = strings.Split(a, ",")
	}
	if a := os.Getenv("BERTH_UI_ADDR"); a != "" {
		cfg.UIAddr = a
	}
	err := agent.Run(ctx, cfg)
	if errors.Is(err, agent.ErrAlreadyRunning) {
		fmt.Fprintln(os.Stderr, "berth: an agent is already running for this home; exiting")
		return nil
	}
	return err
}

func agentCommand(l laptop, args []string) error {
	if len(args) == 0 {
		return runAgent(l)
	}
	spec, err := agentService(l)
	if err != nil {
		return err
	}
	switch args[0] {
	case "start":
		// What the desktop app runs when the agent is not running: through
		// the service when one is installed, otherwise detached from the
		// caller, so it outlives the app.
		if _, err := ensureAgent(l); err != nil {
			return err
		}
		fmt.Println("The berth agent is running.")
		return nil
	case "install":
		if runtime.GOOS == "windows" {
			unit, installed, err := service.Read(spec.Name)
			if err != nil {
				return err
			}
			if installed && !strings.EqualFold(filepath.Clean(unit.Env["BERTH_HOME"]), filepath.Clean(spec.Env["BERTH_HOME"])) {
				return errors.New("the Windows login task belongs to another Berth home")
			}
		}
		// The supervisor starts its own agent; a running one would hold the lock.
		if _, err := stopAgent(l, true); err != nil {
			return err
		}
		if err := waitAgentService(spec); err != nil {
			return err
		}
		path, err := service.Install(spec)
		if err != nil {
			return err
		}
		fmt.Printf("Installed %s\nThe agent now starts at login and restarts after a crash; berth stop still stops it.\n", path)
		return nil
	case "restart":
		// What the app runs as it starts (--if-stale): an agent older than
		// this berth (the app was updated under it) is stopped once its
		// work under way is done, and started again from this one.
		ifStale, asJSON := false, false
		for _, a := range args[1:] {
			switch a {
			case "--if-stale":
				ifStale = true
			case "--json":
				asJSON = true
			default:
				return errors.New("usage: berth agent restart [--if-stale] [--json]")
			}
		}
		res, err := restartAgent(l, spec, ifStale)
		if err != nil {
			return err
		}
		if asJSON {
			return printJSON(res)
		}
		fmt.Println(res.Message)
		return nil
	case "stop":
		drain := false
		for _, a := range args[1:] {
			if a != "--drain" {
				return errors.New("usage: berth agent stop [--drain]")
			}
			drain = true
		}
		stopped, err := stopAgent(l, drain)
		if err != nil {
			return err
		}
		if stopped {
			fmt.Println("Stopped the berth agent.")
		} else {
			fmt.Println("The berth agent is not running.")
		}
		return nil
	case "uninstall":
		if runtime.GOOS == "windows" {
			unit, installed, err := service.Read(spec.Name)
			if err != nil {
				return err
			}
			if !installed {
				fmt.Println("The agent service is not installed.")
				return nil
			}
			if !strings.EqualFold(filepath.Clean(unit.Program), filepath.Clean(spec.Program)) || !strings.EqualFold(filepath.Clean(unit.Env["BERTH_HOME"]), filepath.Clean(spec.Env["BERTH_HOME"])) {
				return errors.New("the Windows login task belongs to another Berth executable or home")
			}
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			c := agent.NewClient(l.socket())
			running := c.Running(ctx)
			owned := ownsRunningAgent(ctx, c, spec.Program)
			cancel()
			if running && !owned {
				return errors.New("another Berth executable is running for this home; its process and login task were left unchanged")
			}
			if _, err := stopAgent(l, true); err != nil {
				return err
			}
			if err := waitAgentService(spec); err != nil {
				return err
			}
		}
		path, err := service.Uninstall(spec)
		if err != nil {
			return err
		}
		if path == "" {
			fmt.Println("The agent service is not installed.")
			return nil
		}
		fmt.Printf("Removed %s\n", path)
		return nil
	case "status":
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		c := agent.NewClient(l.socket())
		running := c.Running(ctx)
		if len(args) > 1 && args[1] == "--json" {
			return printJSON(map[string]bool{"installed": service.Installed(spec), "running": running, "owned_running": running && ownsRunningAgent(ctx, c, spec.Program)})
		}
		fmt.Printf("service installed: %v\nagent running: %v\n", service.Installed(spec), running)
		return nil
	}
	return errors.New("usage: berth agent [start|stop|restart|install|uninstall|status]")
}

type agentIdentityClient interface {
	Info(context.Context) (agent.AgentInfo, error)
}

func ownsRunningAgent(ctx context.Context, c agentIdentityClient, program string) bool {
	info, err := c.Info(ctx)
	if err != nil || info.Exe == "" {
		return false
	}
	actual, expected := filepath.Clean(info.Exe), filepath.Clean(program)
	if runtime.GOOS == "windows" {
		return strings.EqualFold(actual, expected)
	}
	return actual == expected
}

type agentStopClient interface {
	Running(context.Context) bool
	Info(context.Context) (agent.AgentInfo, error)
	Stop(context.Context) error
	StopDrained(context.Context) error
	WaitStopped(context.Context, string) error
}

var agentProcessWaiter = openAgentProcess

func stopAgent(l laptop, drain bool) (bool, error) {
	return stopAgentClient(context.Background(), agent.NewClient(l.socket()), l.dir, drain)
}

func waitAgentService(spec service.Spec) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return service.WaitStopped(ctx, spec)
}

// Capture the Windows process handle while the authenticated agent answers.
// Lock release happens before process exit and alone cannot permit an update.
func stopAgentClient(ctx context.Context, c agentStopClient, dir string, drain bool) (bool, error) {
	if !c.Running(ctx) {
		return false, nil
	}
	ictx, cancel := context.WithTimeout(ctx, 5*time.Second)
	info, _ := c.Info(ictx)
	cancel()
	wait, closeProcess, err := agentProcessWaiter(info.PID)
	if err != nil {
		return false, fmt.Errorf("waiting for the berth agent process: %w", err)
	}
	defer closeProcess()
	wctx, cancel := context.WithTimeout(ctx, agentDrainWait)
	defer cancel()
	if drain {
		err = c.StopDrained(wctx)
	} else {
		err = c.Stop(wctx)
	}
	if err != nil {
		return false, fmt.Errorf("stopping the berth agent: %w", err)
	}
	if err := c.WaitStopped(wctx, dir); err != nil {
		return false, err
	}
	if err := wait(wctx); err != nil {
		return false, fmt.Errorf("the berth agent process did not exit: %w", err)
	}
	return true, nil
}

// RestartResult is what `berth agent restart --json` reports.
type RestartResult struct {
	Restarted bool `json:"restarted"`
	// Running: an agent runs now (false: none was running, with --if-stale).
	Running bool   `json:"running"`
	Reason  string `json:"reason,omitempty"`
	From    string `json:"from,omitempty"`
	To      string `json:"to,omitempty"`
	// Service: it runs as the login service (berth agent install).
	Service bool   `json:"service,omitempty"`
	Message string `json:"message"`
}

// restartAgent stops the running agent, letting it finish its work under
// way, and starts this berth's: through the login service when that is
// installed for this berth, otherwise detached, as berth agent start does.
// With ifStale, only an agent older than this berth is restarted.
func restartAgent(l laptop, spec service.Spec, ifStale bool) (RestartResult, error) {
	ctx := context.Background()
	c := agent.NewClient(l.socket())
	if !c.Running(ctx) {
		if ifStale {
			return RestartResult{Message: "The berth agent is not running."}, nil
		}
		if _, err := ensureAgent(l); err != nil {
			return RestartResult{}, err
		}
		return RestartResult{Restarted: true, Running: true, To: version.Version, Message: "Started the berth agent."}, nil
	}
	ictx, cancel := context.WithTimeout(ctx, 5*time.Second)
	info, infoErr := c.Info(ictx)
	cancel()
	build := ""
	if b, err := os.ReadFile(spec.Program); err == nil {
		build = version.BuildID(b)
	}
	stale, why := agent.Stale(info, infoErr, spec.Program, build, version.Version)
	if ifStale && !stale {
		return RestartResult{Running: true, From: info.Version, Message: "The berth agent is up to date."}, nil
	}
	from := info.Version
	if errors.Is(infoErr, agent.ErrNoAgentInfo) {
		from = "an older release"
	}
	if _, err := stopAgentClient(ctx, c, l.dir, true); err != nil {
		return RestartResult{}, err
	}
	asService := false
	if u, ok, _ := service.Read(spec.Name); ok && u.Program == spec.Program && u.Env["BERTH_HOME"] == spec.Env["BERTH_HOME"] {
		// Installed for this berth: installing it again (as it is, or as
		// this berth writes it now) starts it.
		if err := waitAgentService(spec); err != nil {
			return RestartResult{}, err
		}
		if _, err := service.Install(spec); err != nil {
			return RestartResult{}, err
		}
		asService = true
	} else if err := spawnAgent(l, spec.Program); err != nil {
		return RestartResult{}, err
	}
	deadline := time.Now().Add(10 * time.Second)
	for !c.Running(ctx) {
		if time.Now().After(deadline) {
			return RestartResult{}, fmt.Errorf("the berth agent did not start again; see %s", filepath.Join(l.dir, "agent.log"))
		}
		time.Sleep(50 * time.Millisecond)
	}
	msg := "Restarted the berth agent"
	if why != "" {
		msg += ": " + why
	}
	return RestartResult{Restarted: true, Running: true, Reason: why, From: from, To: version.Version, Service: asService, Message: msg + "."}, nil
}

// How long a restart waits for the agent to finish its work under way and
// stop: its own limit, and a little more.
const agentDrainWait = 2*time.Minute + 30*time.Second
