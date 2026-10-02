// Package boxcmd implements the commands that act on a box's locations,
// worktrees, sessions, shares, and events. `berthd` runs them against its
// own box; `berth` runs them against a paired box after stripping the box
// name from the command line.
package boxcmd

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"strconv"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/sean-brydon/berthd/internal/box"
	"github.com/sean-brydon/berthd/internal/events"
)

// Usage lists the commands with box-relative references. prefix is "" on the
// box and "<box>/" on the laptop.
func Usage(cmd, prefix string) string {
	b := strings.TrimSuffix(prefix, "/")
	boxArg := ""
	if b != "" {
		boxArg = " " + b
	}
	return fmt.Sprintf(`Locations and worktrees
  %[1]s locations%[3]s [--json]                        List locations and their worktrees
  %[1]s location add %[2]sNAME PATH                     Register a repo or directory
  %[1]s location rm %[2]sNAME                           Forget a location (files are untouched)
  %[1]s location scripts %[2]sNAME [--setup CMD] [--archive CMD] [--clear]
                                                  Worktree setup/archive scripts (default: the repo's .berth/config.json)
  %[1]s location config %[2]sNAME [--json]             The repo's, the box's and the effective config
  %[1]s services%[3]s [--json]                          Which worktree each running server belongs to
  %[1]s service list|start|stop|restart|log %[2]sLOC/WORKTREE [SERVICE]
                                                  A worktree's services from the repo's config
  %[1]s preview %[2]s[LOC/WORKTREE] [PORT] [--path /x]  Open a worktree's page in the Berth app
  %[1]s worktree new %[2]sLOC/NAME [--branch B] [--base REF]
                                                  Create a git worktree and run its setup
  %[1]s worktree rm %[2]sLOC/NAME [--force]             Remove a worktree

Agent sessions
  %[1]s sessions%[3]s [--json]                          List sessions
  %[1]s task new %[2]sLOC/NAME [--agent ID] [--prompt TEXT] [--open split|tab] [--branch B] [--base REF]
                                                  A worktree with an agent running in it
  %[1]s agents%[3]s [--json]                            Agent CLIs this box can start
  %[1]s session new %[2]sLOC[/WORKTREE] [--name N] [--agent ID [--prompt TEXT]] [--open split|tab] [-- COMMAND...]
                                                  Start an agent or COMMAND (default: a shell) there
  %[1]s session screen %[2]sNAME [--history N]          Print what the session shows
  %[1]s session send %[2]sNAME TEXT [--no-enter] [--wait] Type a prompt into a session, and wait for its turn
  %[1]s session wait %[2]sNAME [--for finished,waiting] Wait for its agent's turn to end
  %[1]s exec %[2]sLOC[/WORKTREE] -- COMMAND...            Run a command there and print its output
  %[1]s loop %[2]sSESSION --check CMD [--prompt TEXT] [--max 5]
                                                  Prompt, wait, check, and feed failures back
  %[1]s session kill %[2]sNAME                          Stop a session

Ports and sharing
  %[1]s ports%[3]s [--json]                             What is listening on the box
  %[1]s stats%[3]s [--json]                             Memory, disk, load, and agents running or waiting
  %[1]s share%[3]s PORT                                 Make a port public (Cloudflare quick tunnel)
  %[1]s shares%[3]s [--json]                            List public shares
  %[1]s unshare%[3]s ID                                 Stop a share

Skills for agents
  %[1]s skills%[3]s [list|install|uninstall] [SKILL...] [--agent claude|codex|all]
         [--target user|project] [--location LOC] [--commit]
                                                  Teach Claude Code and Codex to use berth

Secrets
  %[1]s secret test%[3]s REF                            Check this box can resolve op://vault/item/field or env://NAME
                                                  (prints the value's length, never the value)

Events
  %[1]s emit%[3]s TYPE [key=value...] [--origin TOOL]   Announce an event, e.g. agent.finished
  %[1]s events%[3]s [--json]                            Stream the box's events
`, cmd, prefix, boxArg)
}

// Queue, when set, keeps a prompt that could not be sent for later: the
// laptop's berth sets it to hand the prompt to its agent, which types it in
// once the box is back. It returns the queued prompt's id, or cause itself
// when the send failed for another reason (the prompt may have arrived, or
// the box refused it). session send --queue uses it.
var Queue func(ctx context.Context, session, text string, enter bool, cause error) (id string, err error)

// Commands names every command this package handles and how many words it
// takes before its first argument.
var Commands = map[string]int{
	"locations": 1, "location": 2, "worktree": 2,
	"sessions": 1, "session": 2, "task": 2, "agents": 1, "exec": 1, "loop": 1,
	"services": 1, "info": 1, "stats": 1,
	"ports": 1, "share": 1, "shares": 1, "unshare": 1,
	"emit": 1, "events": 1,
	"skills": 1, "preview": 1, "service": 2,
	"units": 1, "unit": 2,
	"secret": 2,
}

// Run executes args, which start with the command words, against c.
func Run(ctx context.Context, c *box.Client, args []string, out io.Writer) error {
	if len(args) == 0 {
		return errors.New("missing command")
	}
	words := Commands[args[0]]
	if words == 0 || len(args) < words {
		return fmt.Errorf("unknown command %q", strings.Join(args, " "))
	}
	cmd := strings.Join(args[:words], " ")
	rest := args[words:]
	switch cmd {
	case "locations":
		return locations(ctx, c, rest, out)
	case "location add":
		fs, asJSON := flags(rest)
		pos, err := parse(fs, rest)
		if err != nil || len(pos) != 2 {
			return usageErr("location add NAME PATH")
		}
		loc, err := c.AddLocation(ctx, pos[0], pos[1])
		if err != nil {
			return err
		}
		return show(out, *asJSON, loc, func() {
			kind := "directory"
			if loc.Repo {
				kind = fmt.Sprintf("git repository, %d worktree(s)", len(loc.Worktrees))
			}
			fmt.Fprintf(out, "Added location %s → %s (%s)\n", loc.Name, loc.Path, kind)
		})
	case "location config":
		return locationConfig(ctx, c, rest, out)
	case "service list", "service start", "service stop", "service restart", "service log":
		return service(ctx, c, strings.TrimPrefix(cmd, "service "), rest, out)
	case "skills":
		return skills(ctx, c, rest, out)
	case "secret test":
		fs, asJSON := flags(rest)
		pos, err := parse(fs, rest)
		if err != nil || len(pos) != 1 {
			return usageErr("secret test REF")
		}
		res, err := c.TestSecret(ctx, pos[0])
		if err != nil {
			return err
		}
		if err := show(out, *asJSON, res, func() {
			if res.OK && res.Length != nil {
				fmt.Fprintf(out, "Resolved %s: %d characters\n", pos[0], *res.Length)
			}
		}); err != nil {
			return err
		}
		if !res.OK {
			return fmt.Errorf("could not resolve %s: %s", pos[0], res.Error)
		}
		return nil
	case "preview":
		return preview(ctx, c, rest, out)
	case "location scripts":
		fs, asJSON := flags(rest)
		setup := fs.String("setup", "", "command to run after a worktree is created")
		archive := fs.String("archive", "", "command to run before a worktree is removed")
		clear := fs.Bool("clear", false, "remove this location's own scripts and use the repository's")
		pos, err := parse(fs, rest)
		if err != nil || len(pos) != 1 {
			return usageErr("location scripts NAME [--setup CMD] [--archive CMD] [--clear]")
		}
		if *setup != "" || *archive != "" || *clear {
			if _, err := c.SetScripts(ctx, pos[0], *setup, *archive); err != nil {
				return err
			}
		}
		locs, err := c.Locations(ctx)
		if err != nil {
			return err
		}
		for _, l := range locs {
			if l.Name != pos[0] {
				continue
			}
			return show(out, *asJSON, l.Scripts, func() {
				if l.Scripts.Setup == "" && l.Scripts.Archive == "" {
					fmt.Fprintf(out, "%s has no lifecycle scripts (none set here, none in "+box.RepoConfigFile+").\n", l.Name)
					return
				}
				fmt.Fprintf(out, "%s scripts (from %s):\n  setup:   %s\n  archive: %s\n", l.Name, l.Scripts.From, l.Scripts.Setup, l.Scripts.Archive)
			})
		}
		return errors.New("no location with that name")
	case "services":
		fs, asJSON := flags(rest)
		parse(fs, rest)
		all, err := c.Services(ctx)
		if err != nil {
			return err
		}
		return show(out, *asJSON, all, func() {
			if len(all) == 0 {
				fmt.Fprintln(out, "No servers are running in any location.")
				return
			}
			w := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "LOCATION\tWORKTREE\tPORT\tPROCESS")
			for _, s := range all {
				fmt.Fprintf(w, "%s\t%s\t%d\t%s\n", s.Location, s.Worktree, s.Port, s.Process)
			}
			w.Flush()
		})
	case "info":
		fs, _ := flags(rest)
		parse(fs, rest)
		i, err := c.Info(ctx)
		if err != nil {
			return err
		}
		return show(out, true, i, func() {})
	case "stats":
		fs, asJSON := flags(rest)
		parse(fs, rest)
		st, err := c.Stats(ctx)
		if err != nil {
			return err
		}
		return show(out, *asJSON, st, func() {
			fmt.Fprintf(out, "%s  %d CPUs  load %v\n", st.Hostname, st.CPUs, st.Load)
			fmt.Fprintf(out, "memory  %s of %s\n", gib(st.Memory.Used), gib(st.Memory.Total))
			for _, d := range st.Disks {
				fmt.Fprintf(out, "disk %s  %s of %s\n", d.Mount, gib(d.Used), gib(d.Total))
			}
			waiting := 0
			for _, a := range st.Agents {
				if a.State == "waiting" {
					waiting++
				}
			}
			fmt.Fprintf(out, "agents  %d running, %d waiting for you\n", len(st.Agents), waiting)
		})
	case "location rm":
		if len(rest) != 1 {
			return usageErr("location rm NAME")
		}
		if err := c.RemoveLocation(ctx, rest[0]); err != nil {
			return err
		}
		fmt.Fprintf(out, "Removed location %s; its files are untouched.\n", rest[0])
		return nil
	case "worktree new":
		return worktreeNew(ctx, c, rest, out)
	case "worktree rm":
		fs, _ := flags(rest)
		force := fs.Bool("force", false, "remove even with uncommitted changes")
		pos, err := parse(fs, rest)
		if err != nil || len(pos) != 1 {
			return usageErr("worktree rm LOC/NAME [--force]")
		}
		loc, name, ok := strings.Cut(pos[0], "/")
		if !ok {
			return usageErr("worktree rm LOC/NAME [--force]")
		}
		archive, err := c.RemoveWorktree(ctx, loc, name, box.RemoveOptions{Force: *force})
		if err != nil {
			return err
		}
		if archive != "" {
			fmt.Fprintf(out, "Archiving %s/%s: running %s, then removing it if that succeeds. Watch with the events command.\n", loc, name, archive)
			return nil
		}
		fmt.Fprintf(out, "Removed worktree %s/%s\n", loc, name)
		return nil
	case "sessions":
		return sessions(ctx, c, rest, out)
	case "session new":
		return sessionNew(ctx, c, rest, out)
	case "task new":
		return taskNew(ctx, c, rest, out)
	case "session send":
		fs, asJSON := flags(rest)
		noEnter := fs.Bool("no-enter", false, "type the text without pressing Enter")
		wait := fs.Bool("wait", false, "then wait for the turn it starts to end (finished or waiting)")
		timeout := fs.Duration("timeout", 30*time.Minute, "with --wait, give up after this long")
		queue := fs.Bool("queue", false, "if the box cannot be reached, queue the prompt to send when it is back")
		pos, err := parse(fs, rest)
		if err != nil || len(pos) != 2 {
			return usageErr("session send NAME TEXT [--no-enter] [--wait [--timeout 30m]] [--queue]")
		}
		if *queue && Queue == nil {
			return errors.New("--queue is for the laptop: berth session send BOX/NAME TEXT --queue")
		}
		sent := time.Now()
		if err := c.Send(ctx, pos[0], pos[1], !*noEnter); err != nil {
			if !*queue {
				return err
			}
			id, qerr := Queue(ctx, pos[0], pos[1], !*noEnter, err)
			if qerr != nil {
				return qerr
			}
			return show(out, *asJSON, map[string]any{"queued": true, "id": id}, func() {
				fmt.Fprintf(out, "Could not reach the box (%v).\nQueued as %s: the berth agent types it into %s once the box is back. See berth queue.\n", err, id, pos[0])
			})
		}
		if !*wait {
			fmt.Fprintf(out, "Sent to %s\n", pos[0])
			return nil
		}
		// Only what the agent reports after the prompt counts, so the
		// previous turn's "finished" does not end the wait.
		res, err := waitFor(ctx, c, pos[0], []string{"finished", "waiting"}, sent, *timeout)
		if err != nil {
			return err
		}
		return show(out, *asJSON, res, func() {
			if res.TimedOut {
				fmt.Fprintf(out, "Still %s after %v\n", res.State, *timeout)
				return
			}
			fmt.Fprintln(out, res.State)
		})
	case "session wait":
		fs, asJSON := flags(rest)
		states := fs.String("for", "finished,waiting", "states that end the wait")
		timeout := fs.Duration("timeout", 30*time.Minute, "give up after this long")
		pos, err := parse(fs, rest)
		if err != nil || len(pos) != 1 {
			return usageErr("session wait NAME [--for finished,waiting] [--timeout 30m]")
		}
		// The agent's state now counts: waiting for an agent that is
		// already idle returns at once. To wait for the turn a prompt
		// starts, use session send --wait.
		res, err := waitFor(ctx, c, pos[0], strings.Split(*states, ","), time.Time{}, *timeout)
		if err != nil {
			return err
		}
		return show(out, *asJSON, res, func() {
			if res.TimedOut {
				fmt.Fprintf(out, "Still %s after %v\n", res.State, *timeout)
				return
			}
			fmt.Fprintln(out, res.State)
		})
	case "exec":
		return execCmd(ctx, c, rest, out)
	case "loop":
		return loop(ctx, c, rest, out)
	case "agents":
		fs, asJSON := flags(rest)
		parse(fs, rest)
		i, err := c.Info(ctx)
		if err != nil {
			return err
		}
		return show(out, *asJSON, i.Agents, func() {
			if len(i.Agents) == 0 {
				fmt.Fprintln(out, "No agent CLIs found on this box (claude, codex, opencode, gemini, cursor-agent).")
				return
			}
			w := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "ID\tNAME\tCOMMAND")
			for _, a := range i.Agents {
				fmt.Fprintf(w, "%s\t%s\t%s\n", a.ID, a.Name, a.Command)
			}
			w.Flush()
		})
	case "session screen":
		fs, _ := flags(rest)
		history := fs.Int("history", 0, "earlier lines to include")
		pos, err := parse(fs, rest)
		if err != nil || len(pos) != 1 {
			return usageErr("session screen NAME [--history N]")
		}
		text, err := c.Screen(ctx, pos[0], *history)
		if err != nil {
			return err
		}
		fmt.Fprint(out, text)
		return nil
	case "session kill":
		if len(rest) != 1 {
			return usageErr("session kill NAME")
		}
		if err := c.KillSession(ctx, rest[0]); err != nil {
			return err
		}
		fmt.Fprintf(out, "Stopped session %s\n", rest[0])
		return nil
	case "ports":
		return ports(ctx, c, rest, out)
	case "share":
		fs, asJSON := flags(rest)
		pos, err := parse(fs, rest)
		if err != nil || len(pos) != 1 {
			return usageErr("share PORT")
		}
		port, err := strconv.Atoi(pos[0])
		if err != nil {
			return usageErr("share PORT")
		}
		sh, err := c.AddShare(ctx, port)
		if err != nil {
			return err
		}
		return show(out, *asJSON, sh, func() {
			fmt.Fprintf(out, "Port %d is public at %s\nNew links take about 10 seconds to resolve. Anyone with the link can reach it; stop it with: unshare %s\n", sh.Port, sh.URL, sh.ID)
		})
	case "shares":
		fs, asJSON := flags(rest)
		parse(fs, rest)
		all, err := c.Shares(ctx)
		if err != nil {
			return err
		}
		return show(out, *asJSON, all, func() {
			if len(all) == 0 {
				fmt.Fprintln(out, "Nothing is shared publicly.")
				return
			}
			w := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "ID\tPORT\tURL\tSINCE")
			for _, s := range all {
				fmt.Fprintf(w, "%s\t%d\t%s\t%s\n", s.ID, s.Port, s.URL, s.Started.Local().Format("15:04"))
			}
			w.Flush()
		})
	case "units":
		fs, asJSON := flags(rest)
		parse(fs, rest)
		all, err := c.Units(ctx)
		if err != nil {
			return err
		}
		return show(out, *asJSON, all, func() {
			if len(all) == 0 {
				fmt.Fprintln(out, "No managed units.")
				return
			}
			w := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
			fmt.Fprintln(w, "NAME\tSTATE\tLOG")
			for _, u := range all {
				fmt.Fprintf(w, "%s\t%s\t%s\n", u.Name, u.State, u.LogPath)
			}
			w.Flush()
		})
	case "unit add":
		if len(rest) < 2 {
			return usageErr("unit add NAME -- COMMAND...")
		}
		name, command := rest[0], rest[1:]
		if command[0] == "--" {
			command = command[1:]
		}
		if len(command) == 0 {
			return usageErr("unit add NAME -- COMMAND...")
		}
		u, err := c.AddUnit(ctx, box.UnitRequest{Name: name, Program: command[0], Args: command[1:]})
		if err != nil {
			return err
		}
		fmt.Fprintf(out, "Unit %s is %s; its output goes to %s\n", u.Name, u.State, u.LogPath)
		return nil
	case "unit get":
		fs, asJSON := flags(rest)
		pos, err := parse(fs, rest)
		if err != nil || len(pos) != 1 {
			return usageErr("unit get NAME")
		}
		u, err := c.Unit(ctx, pos[0])
		if err != nil {
			return err
		}
		return show(out, *asJSON, u, func() {
			fmt.Fprintf(out, "%s is %s; its output goes to %s\n", u.Name, u.State, u.LogPath)
		})
	case "unit log":
		if len(rest) != 1 {
			return usageErr("unit log NAME")
		}
		// The whole reason a unit writes to a file berthd owns is so this
		// can read it: a unit that will not stay up explains itself here.
		log, err := c.UnitLog(ctx, rest[0], 1<<20)
		if err != nil {
			return err
		}
		if len(log) == 0 {
			fmt.Fprintf(out, "Unit %s has written nothing yet.\n", rest[0])
			return nil
		}
		out.Write(log)
		if log[len(log)-1] != '\n' {
			fmt.Fprintln(out)
		}
		return nil
	case "unit restart":
		if len(rest) != 1 {
			return usageErr("unit restart NAME")
		}
		u, err := c.RestartUnit(ctx, rest[0])
		if err != nil {
			return err
		}
		fmt.Fprintf(out, "Unit %s is %s; its output goes to %s\n", u.Name, u.State, u.LogPath)
		return nil
	case "unit rm":
		if len(rest) != 1 {
			return usageErr("unit rm NAME")
		}
		u, err := c.RemoveUnit(ctx, rest[0])
		if err != nil {
			return err
		}
		fmt.Fprintf(out, "Stopped and removed unit %s; its log is still at %s\n", u.Name, u.LogPath)
		return nil
	case "unshare":
		if len(rest) != 1 {
			return usageErr("unshare ID")
		}
		sh, err := c.RemoveShare(ctx, rest[0])
		if err != nil {
			return err
		}
		fmt.Fprintf(out, "Stopped sharing port %d; %s no longer works.\n", sh.Port, sh.URL)
		return nil
	case "emit":
		return emit(ctx, c, rest, out)
	case "events":
		fs, asJSON := flags(rest)
		parse(fs, rest)
		enc := json.NewEncoder(out)
		return c.Events(ctx, func(e events.Event) {
			if *asJSON {
				enc.Encode(e)
				return
			}
			fmt.Fprintln(out, Describe(e))
		})
	}
	return fmt.Errorf("unknown command %q", cmd)
}

// Describe renders an event as one human-readable line.
func Describe(e events.Event) string {
	line := e.Time.Local().Format("15:04:05") + "  " + e.Type
	if e.Box != "" {
		line += "  " + e.Box
	}
	for _, k := range []string{"location", "name", "path", "port", "url", "command", "variable", "ref"} {
		if v, ok := e.Data[k]; ok && fmt.Sprint(v) != "" {
			line += fmt.Sprintf("  %s=%v", k, v)
		}
	}
	if e.Origin != "" && e.Origin != "berth" {
		line += "  via " + e.Origin
	}
	if e.Error != "" {
		line += "  (" + e.Error + ")"
	}
	return line
}

func flags(args []string) (*flag.FlagSet, *bool) {
	fs := flag.NewFlagSet("", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	return fs, fs.Bool("json", false, "print JSON")
}

func usageErr(s string) error { return errors.New("usage: " + s) }

// parse accepts flags before, between, and after positional arguments, so
// the box reference can come first as in "worktree new devl/cal/x --base main".
func parse(fs *flag.FlagSet, args []string) ([]string, error) {
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

func show(out io.Writer, asJSON bool, v any, human func()) error {
	if asJSON {
		enc := json.NewEncoder(out)
		enc.SetIndent("", "  ")
		return enc.Encode(v)
	}
	human()
	return nil
}

func locations(ctx context.Context, c *box.Client, args []string, out io.Writer) error {
	fs, asJSON := flags(args)
	parse(fs, args)
	all, err := c.Locations(ctx)
	if err != nil {
		return err
	}
	return show(out, *asJSON, all, func() {
		if len(all) == 0 {
			fmt.Fprintln(out, "No locations. Add one with: location add NAME PATH")
			return
		}
		for _, l := range all {
			fmt.Fprintf(out, "%s  %s\n", l.Name, l.Path)
			for _, w := range l.Worktrees {
				if w.Main {
					continue
				}
				branch := w.Branch
				if branch == "" {
					branch = "detached " + w.Head
				}
				fmt.Fprintf(out, "  %s/%s  %s  (%s)\n", l.Name, w.Name, w.Path, branch)
			}
		}
	})
}

func worktreeNew(ctx context.Context, c *box.Client, args []string, out io.Writer) error {
	fs, asJSON := flags(args)
	var req box.WorktreeRequest
	fs.StringVar(&req.Branch, "branch", "", "branch to create (default: the worktree name)")
	fs.StringVar(&req.Base, "base", "", "ref to branch from")
	pos, err := parse(fs, args)
	if err != nil || len(pos) != 1 {
		return usageErr("worktree new LOC/NAME [--branch B] [--base REF]")
	}
	loc, name, ok := strings.Cut(pos[0], "/")
	if !ok || name == "" {
		return usageErr("worktree new LOC/NAME")
	}
	req.Name = name
	wt, err := c.AddWorktree(ctx, loc, req)
	if err != nil {
		return err
	}
	return show(out, *asJSON, wt, func() {
		fmt.Fprintf(out, "Created %s/%s at %s on %s\n", loc, wt.Name, wt.Path, wt.Branch)
	})
}

func sessions(ctx context.Context, c *box.Client, args []string, out io.Writer) error {
	fs, asJSON := flags(args)
	parse(fs, args)
	all, err := c.Sessions(ctx)
	if err != nil {
		return err
	}
	return show(out, *asJSON, all, func() {
		if len(all) == 0 {
			fmt.Fprintln(out, "No sessions. Start one with: session new LOC[/WORKTREE] -- COMMAND")
			return
		}
		w := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "NAME\tLOCATION\tCOMMAND\tSTATE\tSTARTED")
		for _, s := range all {
			state := "running"
			if s.Exited {
				state = "exited"
			} else if s.AgentState != "" {
				state = s.Agent + " " + s.AgentState
			}
			if s.Attached > 0 {
				state += ", attached"
			}
			cmd := s.Command
			if cmd == "" {
				cmd = "(shell)"
			}
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", s.Name, s.Location, cmd, state, s.Created.Local().Format("Jan 2 15:04"))
		}
		w.Flush()
	})
}

func sessionNew(ctx context.Context, c *box.Client, args []string, out io.Writer) error {
	var command []string
	for i, a := range args {
		if a == "--" {
			command = args[i+1:]
			args = args[:i]
			break
		}
	}
	fs, asJSON := flags(args)
	var req box.SessionRequest
	fs.StringVar(&req.Name, "name", "", "session name (default: location, command, and a suffix)")
	fs.StringVar(&req.Agent, "agent", "", "start this agent (see: agents) instead of a command")
	fs.StringVar(&req.Prompt, "prompt", "", "the agent's first prompt")
	fs.StringVar(&req.Open, "open", "", "show it in the Berth app: split (beside the current terminal) or tab")
	pos, err := parse(fs, args)
	if err != nil || len(pos) != 1 {
		return usageErr("session new LOC[/WORKTREE] [--name N] [--agent ID [--prompt TEXT]] [--open split|tab] [-- COMMAND...]")
	}
	req.Location, req.Command = pos[0], commandLine(command)
	sess, err := c.StartSession(ctx, req)
	if err != nil {
		return err
	}
	return show(out, *asJSON, sess, func() {
		fmt.Fprintf(out, "Started session %s in %s\n", sess.Name, sess.Dir)
	})
}

// commandLine turns the words after -- back into one shell command. A
// single word is taken as a command line already, so `-- "a && b"` works;
// several are quoted one by one, so `-- claude "fix it, don't stop"` gives
// claude one argument, apostrophe and all.
func commandLine(words []string) string {
	if len(words) == 1 {
		return words[0]
	}
	quoted := make([]string, len(words))
	for i, w := range words {
		quoted[i] = shellWord(w)
	}
	return strings.Join(quoted, " ")
}

func shellWord(w string) string {
	if w != "" && strings.Trim(w, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-./:=@%+,") == "" {
		return w
	}
	return "'" + strings.ReplaceAll(w, "'", `'\''`) + "'"
}

// waitFor waits in steps, since one long request could outlive a proxy or a
// network change between the laptop and the box.
func waitFor(ctx context.Context, c *box.Client, session string, states []string, after time.Time, timeout time.Duration) (box.WaitResult, error) {
	deadline := time.Now().Add(timeout)
	for {
		step := min(time.Until(deadline), 5*time.Minute)
		res, err := c.Wait(ctx, session, states, after, max(step, time.Second))
		if err != nil || !res.TimedOut || time.Now().After(deadline) {
			return res, err
		}
	}
}

func execCmd(ctx context.Context, c *box.Client, args []string, out io.Writer) error {
	var command []string
	for i, a := range args {
		if a == "--" {
			command, args = args[i+1:], args[:i]
			break
		}
	}
	fs, asJSON := flags(args)
	timeout := fs.String("timeout", "10m", "stop the command after this long")
	pos, err := parse(fs, args)
	if err != nil || len(pos) != 1 || len(command) == 0 {
		return usageErr("exec LOC[/WORKTREE] [--timeout 10m] -- COMMAND...")
	}
	res, err := c.Exec(ctx, box.ExecRequest{Location: pos[0], Command: commandLine(command), Timeout: *timeout})
	if err != nil {
		return err
	}
	if *asJSON {
		return show(out, true, res, nil)
	}
	fmt.Fprint(out, res.Output)
	if res.ExitCode != 0 {
		return fmt.Errorf("exited with %d", res.ExitCode)
	}
	return nil
}

// loop prompts an agent, waits for its turn to end, runs a check, and feeds
// failures back until the check passes or the rounds run out.
func loop(ctx context.Context, c *box.Client, args []string, out io.Writer) error {
	fs, _ := flags(args)
	prompt := fs.String("prompt", "", "the first prompt")
	check := fs.String("check", "", "command that passes when the work is done, e.g. pnpm test")
	rounds := fs.Int("max", 5, "most rounds to try")
	timeout := fs.Duration("turn-timeout", 30*time.Minute, "longest an agent's turn may take")
	pos, err := parse(fs, args)
	usage := "loop SESSION --check COMMAND [--prompt TEXT] [--max 5]"
	if err != nil || len(pos) != 1 || *check == "" {
		return usageErr(usage)
	}
	session := pos[0]
	all, err := c.Sessions(ctx)
	if err != nil {
		return err
	}
	where := ""
	for _, s := range all {
		if s.Name == session {
			where = s.Location
		}
	}
	if where == "" {
		return fmt.Errorf("no session named %s", session)
	}
	text := *prompt
	for round := 1; round <= *rounds; round++ {
		if text != "" {
			sent := time.Now()
			if err := c.Send(ctx, session, text, true); err != nil {
				return err
			}
			fmt.Fprintf(out, "Round %d: prompted %s, waiting for its turn to end…\n", round, session)
			res, err := waitFor(ctx, c, session, []string{"finished", "waiting"}, sent, *timeout)
			if err != nil {
				return err
			}
			switch {
			case res.TimedOut:
				return fmt.Errorf("%s was still %s after %v", session, res.State, *timeout)
			case res.State == "waiting":
				return fmt.Errorf("%s is waiting for you; answer it, then run the loop again", session)
			case res.State == "exited":
				return fmt.Errorf("%s has exited", session)
			}
		}
		fmt.Fprintf(out, "Round %d: checking with %q…\n", round, *check)
		res, err := c.Exec(ctx, box.ExecRequest{Location: where, Command: *check, Timeout: "30m"})
		if err != nil {
			return err
		}
		if res.ExitCode == 0 {
			fmt.Fprintf(out, "Passed after %d round(s).\n", round)
			return nil
		}
		tail := res.Output
		if len(tail) > 4000 {
			tail = "…" + tail[len(tail)-4000:]
		}
		text = fmt.Sprintf("The check `%s` failed (exit %d):\n\n%s\n\nFix it.", *check, res.ExitCode, strings.TrimSpace(tail))
	}
	return fmt.Errorf("the check still fails after %d rounds", *rounds)
}

func taskNew(ctx context.Context, c *box.Client, args []string, out io.Writer) error {
	var req box.TaskRequest
	for i, a := range args {
		if a == "--" {
			req.Command = commandLine(args[i+1:])
			args = args[:i]
			break
		}
	}
	fs, asJSON := flags(args)
	fs.StringVar(&req.Agent, "agent", "", "agent to start (see: agents)")
	fs.StringVar(&req.Prompt, "prompt", "", "the agent's first prompt")
	fs.StringVar(&req.Open, "open", "", "show it in the Berth app: split or tab")
	fs.StringVar(&req.Branch, "branch", "", "branch to create (default: the worktree name)")
	fs.StringVar(&req.Base, "base", "", "ref to branch from")
	pos, err := parse(fs, args)
	usage := "task new LOC/NAME [--agent ID] [--prompt TEXT] [--open split|tab] [--branch B] [--base REF] [-- COMMAND...]"
	if err != nil || len(pos) != 1 {
		return usageErr(usage)
	}
	loc, name, ok := strings.Cut(pos[0], "/")
	if !ok || name == "" {
		return usageErr(usage)
	}
	req.Location, req.Name = loc, name
	task, err := c.AddTask(ctx, req)
	if err != nil {
		return err
	}
	return show(out, *asJSON, task, func() {
		fmt.Fprintf(out, "Created %s/%s at %s on %s\n", loc, task.Worktree.Name, task.Worktree.Path, task.Worktree.Branch)
		fmt.Fprintf(out, "Started session %s\n", task.Session.Name)
	})
}

func ports(ctx context.Context, c *box.Client, args []string, out io.Writer) error {
	fs, asJSON := flags(args)
	parse(fs, args)
	all, err := c.Ports(ctx)
	if err != nil {
		return err
	}
	return show(out, *asJSON, all, func() {
		w := tabwriter.NewWriter(out, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "PORT\tADDRESS\tPROCESS\tCOMMAND")
		for _, p := range all {
			cmd := p.Command
			if len(cmd) > 60 {
				cmd = cmd[:60] + "…"
			}
			fmt.Fprintf(w, "%d\t%s\t%s\t%s\n", p.Port, p.Address, p.Process, cmd)
		}
		w.Flush()
	})
}

func emit(ctx context.Context, c *box.Client, args []string, out io.Writer) error {
	fs := flag.NewFlagSet("", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	origin := fs.String("origin", "", "tool the event comes from")
	positional, err := parse(fs, args)
	if err != nil || len(positional) == 0 {
		return usageErr("emit TYPE [key=value...] [--origin TOOL]")
	}
	data := map[string]any{}
	for _, kv := range positional[1:] {
		k, v, ok := strings.Cut(kv, "=")
		if !ok {
			return fmt.Errorf("expected key=value, got %q", kv)
		}
		data[k] = v
	}
	if *origin != "" {
		c.Origin = *origin
	}
	if err := c.Emit(ctx, positional[0], data); err != nil {
		return err
	}
	fmt.Fprintf(out, "Emitted %s at %s\n", positional[0], time.Now().Format("15:04:05"))
	return nil
}

func gib(b uint64) string { return fmt.Sprintf("%.1f GiB", float64(b)/(1<<30)) }
