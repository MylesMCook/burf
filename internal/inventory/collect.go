package inventory

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"runtime"
	"slices"
	"strings"
	"time"

	"github.com/MylesMCook/burf/internal/backgroundcmd"
)

const maxCollectorOutput = 4 << 20
const collectorTimeout = 5 * time.Second

// Runner executes a bounded read-only query. Errors must not be persisted verbatim.
type Runner func(context.Context, string, ...string) ([]byte, error)

type collector struct {
	run    Runner
	goos   string
	target string
}

// Collect inspects the current account's accessible services. target is empty
// for local collection or an existing OpenSSH host alias or user@host route.
func Collect(ctx context.Context, goos, target string) []Collection {
	return CollectWithRunner(ctx, goos, target, runCollector)
}

// CollectWithRunner provides the same collectors with an injectable process boundary.
func CollectWithRunner(ctx context.Context, goos, target string, run Runner) []Collection {
	c := &collector{run: run, goos: goos, target: target}
	if run == nil {
		c.run = runCollector
	}
	if target != "" {
		if err := ValidateSSHTarget(target); err != nil {
			return []Collection{failure("ssh", "error", "Invalid SSH route; use a host alias or user@host.")}
		}
		if goos == "" {
			var err error
			c.goos, err = c.probeOS(ctx)
			if err != nil {
				return []Collection{failure("ssh", "error", safeQueryError(ctx, err, true))}
			}
		}
	} else if goos == "" {
		c.goos = runtime.GOOS
	}
	ctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	var result []Collection
	switch c.goos {
	case "linux", "darwin":
		processes, processPartial := c.processes(ctx)
		if c.goos == "linux" {
			for _, scope := range []string{"system", "user"} {
				args := []string{"--no-pager", "show", "--property=Id,Description,ActiveState,SubState,MainPID", "*.service"}
				if scope == "user" {
					args = append([]string{"--user"}, args...)
				}
				data, err := c.query(ctx, "systemctl", args...)
				entry := parseSystemd(data, "systemd-"+scope)
				result = append(result, c.finish(ctx, entry, err))
			}
		} else {
			uid, uidErr := c.query(ctx, "id", "-u")
			for _, scope := range []string{"system", "user"} {
				domain := "system"
				if scope == "user" {
					if uidErr != nil || !digits(strings.TrimSpace(string(uid))) {
						result = append(result, failure("launchd-user", "error", "Current user launchd domain unavailable."))
						continue
					}
					domain = "gui/" + strings.TrimSpace(string(uid))
				}
				data, err := c.query(ctx, "launchctl", "print", domain)
				result = append(result, c.finish(ctx, parseLaunchd(data, "launchd-"+scope), err))
			}
		}
		for i := range result {
			for j := range result[i].Services {
				s := &result[i].Services[j]
				if p, ok := processes[s.PID]; ok {
					s.ProcessStarted = p.started
				}
			}
		}
		var listeners Collection
		var err error
		if c.goos == "linux" {
			var data []byte
			data, err = c.query(ctx, "ss", "-H", "-lntp")
			listeners = parseSS(data, processes)
		} else {
			var data []byte
			data, err = c.query(ctx, "lsof", "-nP", "-a", "-iTCP", "-sTCP:LISTEN", "-Fpcn")
			listeners = parseLsof(data, processes)
			if len(data) == 0 && isExitCode(err, 1) {
				err = nil
			}
		}
		listeners = c.finish(ctx, listeners, err)
		if processPartial && listeners.State == "ok" {
			listeners.State = "partial"
			listeners.Error = "Some process identities were inaccessible; previous observations are retained."
		}
		result = append(result, listeners)
	case "windows":
		for _, q := range []struct{ source, script string }{{"windows-services", windowsServices}, {"windows-tasks", windowsTasks}, {"listeners", windowsListeners}} {
			data, err := c.powershell(ctx, q.script)
			result = append(result, c.finish(ctx, parseWindows(data, q.source), err))
		}
	default:
		return []Collection{failure("platform", "unavailable", "Service inventory is unavailable for this operating system.")}
	}
	result = append(result, c.docker(ctx))
	return Correlate(result)
}

func (c *collector) query(ctx context.Context, name string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, collectorTimeout)
	defer cancel()
	if c.target != "" {
		return c.run(ctx, "ssh", sshArgs(c.target, shellCommand(name, args))...)
	}
	return c.run(ctx, name, args...)
}

func (c *collector) finish(ctx context.Context, col Collection, err error) Collection {
	if err != nil {
		col.State = "error"
		if errors.Is(err, exec.ErrNotFound) || isExitCode(err, 127) {
			col.State = "unavailable"
		}
		if len(col.Services) > 0 {
			col.State = "partial"
		}
		col.Error = safeQueryError(ctx, err, c.target != "")
	}
	col.At = time.Now().UTC()
	for i := range col.Services {
		col.Services[i].ObservedAt = col.At
		col.Services[i].Source = col.Source
	}
	return col
}

func failure(source, state, message string) Collection {
	return Collection{Coverage: Coverage{Source: source, State: state, Error: message, At: time.Now().UTC()}, Services: []Service{}}
}
func safeQueryError(ctx context.Context, err error, ssh bool) string {
	if errors.Is(err, context.Canceled) || errors.Is(ctx.Err(), context.Canceled) {
		return "Collection was cancelled; previous observations are retained."
	}
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return "Collection timed out; previous observations are retained."
	}
	if errors.Is(err, errOutputLimit) {
		return "Collector output exceeded the size limit; previous observations are retained."
	}
	if errors.Is(err, exec.ErrNotFound) || isExitCode(err, 127) {
		return "Collector tool is unavailable for this account."
	}
	if ssh {
		return "SSH query failed; check the route, authentication, known host key, and tool permissions."
	}
	return "Collector query failed or access was denied; previous observations are retained."
}
func isExitCode(err error, code int) bool {
	var exit *exec.ExitError
	return errors.As(err, &exit) && exit.ExitCode() == code
}

var errOutputLimit = errors.New("collector output limit")

type cappedOutput struct {
	bytes.Buffer
	exceeded bool
}

func (b *cappedOutput) Write(p []byte) (int, error) {
	if b.Len()+len(p) > maxCollectorOutput {
		b.exceeded = true
		return 0, errOutputLimit
	}
	return b.Buffer.Write(p)
}
func runCollector(ctx context.Context, name string, args ...string) ([]byte, error) {
	cmd := backgroundcmd.CommandContext(ctx, name, args...)
	if name == "docker" && slices.Contains(args, "--host") {
		// Explicit local socket selection must win over case-insensitive Windows
		// environment keys, without a shell that could outlive cancellation.
		cmd.Env = make([]string, 0)
		for _, entry := range os.Environ() {
			key, _, _ := strings.Cut(entry, "=")
			if !strings.EqualFold(key, "DOCKER_CONTEXT") && !strings.EqualFold(key, "DOCKER_HOST") {
				cmd.Env = append(cmd.Env, entry)
			}
		}
	}
	cmd.WaitDelay = time.Second
	var out cappedOutput
	cmd.Stdout = &out
	cmd.Stderr = io.Discard
	err := cmd.Run()
	if ctx.Err() != nil {
		err = ctx.Err()
	}
	if out.exceeded {
		err = errOutputLimit
	}
	return out.Bytes(), err
}

// Correlate attaches listening ports to matching managed process identities.
// A PID without start evidence never hides a listener or proves process identity.
func Correlate(collections []Collection) []Collection {
	for i := range collections {
		if collections[i].Source != "listeners" {
			continue
		}
		kept := make([]Service, 0, len(collections[i].Services))
		for _, listener := range collections[i].Services {
			matched := false
			if listener.PID > 0 && listener.ProcessStarted != "" {
				for j := range collections {
					if i == j {
						continue
					}
					for k := range collections[j].Services {
						service := &collections[j].Services[k]
						if service.State == "running" && service.PID == listener.PID && service.ProcessStarted == listener.ProcessStarted {
							service.Ports = append(service.Ports, listener.Ports...)
							slices.Sort(service.Ports)
							service.Ports = slices.Compact(service.Ports)
							matched = true
						}
					}
				}
			}
			if !matched {
				kept = append(kept, listener)
			}
		}
		collections[i].Services = kept
	}
	return collections
}

func digits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
