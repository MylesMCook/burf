package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/MylesMCook/burf/internal/agent"
)

const kitUsage = `berth kit — set projects up the same way on every box

  berth kit list [--json]                      Kits on this laptop, and where each is installed
  berth kit add LINK [--yes]                   Fetch a kit (git repo, …/tree/REF/DIR, gist, kit.json URL
                                               or folder), show what it does, and keep it
  berth kit show ID                            Everything a kit does and every file it carries
  berth kit apply ID BOX/PROJECT...            Install it on projects
  berth kit update ID                          Fetch it again from its link
  berth kit rm ID                              Forget a kit on this laptop
  berth kit remove BOX/PROJECT                 Uninstall a project's kit
  berth kit save BOX/PROJECT ID [--name N]     Make a kit of how a project is set up on a box
`

func kitCommand(l laptop, args []string) error {
	if len(args) == 0 || args[0] == "help" {
		fmt.Print(kitUsage)
		return nil
	}
	c, err := ensureAgent(l)
	if err != nil {
		return err
	}
	ctx, stop := signalContext()
	defer stop()
	switch args[0] {
	case "list":
		var kits []agent.KitInfo
		if err := c.Call(ctx, "GET", "/v1/kits", nil, &kits); err != nil {
			return err
		}
		var installed []agent.InstalledKitOn
		c.Call(ctx, "GET", "/v1/kits/installed", nil, &installed)
		if len(args) > 1 && args[1] == "--json" {
			return printJSON(map[string]any{"kits": kits, "installed": installed})
		}
		if len(kits) == 0 {
			fmt.Println("No kits yet. Add one with: berth kit add LINK")
		}
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "ID\tNAME\tVERSION\tFROM\tINSTALLED ON")
		for _, k := range kits {
			var on []string
			for _, i := range installed {
				if i.Kit.ID == k.ID {
					s := i.Box + "/" + i.Location
					if i.Outdated {
						s += " (outdated)"
					}
					on = append(on, s)
				}
			}
			from := k.Origin
			if k.Source != nil && k.Source.Src != "" {
				from = k.Source.Src
			}
			fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", k.ID, k.Name, k.Version, from, strings.Join(on, ", "))
		}
		return w.Flush()
	case "add":
		fs := flag.NewFlagSet("kit add", flag.ContinueOnError)
		yes := fs.Bool("yes", false, "keep it without asking")
		if err := fs.Parse(reorder(args[1:])); err != nil || fs.NArg() != 1 {
			return errors.New("usage: berth kit add LINK [--yes]")
		}
		var preview struct {
			Kit      agent.KitInfo `json:"kit"`
			Replaces bool          `json:"replaces"`
		}
		if err := c.Call(ctx, "POST", "/v1/kits/preview", map[string]string{"src": fs.Arg(0)}, &preview); err != nil {
			return err
		}
		describeKit(preview.Kit)
		if !*yes {
			// A kit's scripts will run on your boxes; say so before keeping it.
			verb := "Keep this kit"
			if preview.Replaces {
				verb = "Replace your kit " + preview.Kit.ID + " with this one"
			}
			fmt.Printf("\nIts scripts run on the boxes you apply it to. %s? [y/N] ", verb)
			answer, _ := bufio.NewReader(os.Stdin).ReadString('\n')
			if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(answer)), "y") {
				return errors.New("not added")
			}
		}
		var k agent.KitInfo
		// The hash shown is the kit kept: one changed since is refused.
		if err := c.Call(ctx, "POST", "/v1/kits/add", map[string]string{"src": fs.Arg(0), "hash": preview.Kit.Hash}, &k); err != nil {
			return err
		}
		fmt.Printf("Added %s. Apply it with: berth kit apply %s BOX/PROJECT\n", k.ID, k.ID)
		return nil
	case "show":
		if len(args) != 2 {
			return errors.New("usage: berth kit show ID")
		}
		var k agent.KitInfo
		if err := c.Call(ctx, "GET", "/v1/kits/"+args[1], nil, &k); err != nil {
			return err
		}
		describeKit(k)
		for _, f := range k.FileList {
			if f.Text != "" {
				fmt.Printf("\n── %s\n%s", f.Path, f.Text)
			}
		}
		return nil
	case "apply":
		if len(args) < 3 {
			return errors.New("usage: berth kit apply ID BOX/PROJECT...")
		}
		var targets []agent.KitTarget
		for _, ref := range args[2:] {
			box, loc, ok := strings.Cut(ref, "/")
			if !ok || box == "" || loc == "" {
				return fmt.Errorf("%q is not BOX/PROJECT", ref)
			}
			targets = append(targets, agent.KitTarget{Box: box, Location: loc})
		}
		var failed error
		err := c.Stream(ctx, "POST", "/v1/kits/"+args[1]+"/apply", map[string]any{"targets": targets}, func(raw json.RawMessage) {
			var line struct {
				Box, Location, Error string
				Warnings             []string
				Done                 bool
			}
			json.Unmarshal(raw, &line)
			switch {
			case line.Done:
				if line.Error != "" {
					failed = errors.New(line.Error)
				}
			case line.Error != "":
				fmt.Printf("✗ %s/%s: %s\n", line.Box, line.Location, line.Error)
			default:
				fmt.Printf("✓ %s/%s\n", line.Box, line.Location)
				for _, w := range line.Warnings {
					fmt.Printf("    ! %s\n", w)
				}
			}
		})
		if err != nil {
			return err
		}
		return failed
	case "update":
		if len(args) != 2 {
			return errors.New("usage: berth kit update ID")
		}
		var res struct {
			Kit     agent.KitInfo `json:"kit"`
			Changed bool          `json:"changed"`
		}
		if err := c.Call(ctx, "POST", "/v1/kits/"+args[1]+"/update", nil, &res); err != nil {
			return err
		}
		if !res.Changed {
			fmt.Printf("%s is already the latest.\n", args[1])
			return nil
		}
		fmt.Printf("Updated %s. Apply it again to update the projects using it: berth kit list\n", args[1])
		return nil
	case "rm":
		if len(args) != 2 {
			return errors.New("usage: berth kit rm ID")
		}
		return c.Call(ctx, "DELETE", "/v1/kits/"+args[1], nil, nil)
	case "remove":
		if len(args) != 2 {
			return errors.New("usage: berth kit remove BOX/PROJECT")
		}
		box, loc, _ := strings.Cut(args[1], "/")
		if err := c.Call(ctx, "POST", "/v1/kits/remove", agent.KitTarget{Box: box, Location: loc}, nil); err != nil {
			return err
		}
		fmt.Printf("Removed the kit from %s.\n", args[1])
		return nil
	case "save":
		fs := flag.NewFlagSet("kit save", flag.ContinueOnError)
		name := fs.String("name", "", "the kit's name")
		if err := fs.Parse(reorder(args[1:])); err != nil || fs.NArg() != 2 {
			return errors.New("usage: berth kit save BOX/PROJECT ID [--name N]")
		}
		box, loc, _ := strings.Cut(fs.Arg(0), "/")
		var k agent.KitInfo
		req := map[string]string{"box": box, "location": loc, "id": fs.Arg(1), "name": *name}
		if err := c.Call(ctx, "POST", "/v1/kits/save", req, &k); err != nil {
			return err
		}
		fmt.Printf("Saved %s in %s. Share it by putting that folder in a git repository.\n", k.ID, k.Path)
		return nil
	}
	return fmt.Errorf("unknown kit command %q; see berth kit help", args[0])
}

// reorder puts flags first, so `kit add LINK --yes` parses like `--yes LINK`.
func reorder(args []string) []string {
	var flags, rest []string
	for i := 0; i < len(args); i++ {
		if strings.HasPrefix(args[i], "--") {
			flags = append(flags, args[i])
			if !strings.Contains(args[i], "=") && args[i] != "--yes" && i+1 < len(args) {
				flags = append(flags, args[i+1])
				i++
			}
			continue
		}
		rest = append(rest, args[i])
	}
	return append(flags, rest...)
}

// describeKit prints what a kit does, plainly, before anyone runs it.
func describeKit(k agent.KitInfo) {
	fmt.Printf("%s (%s)", k.Name, k.ID)
	if k.Version != "" {
		fmt.Printf(" %s", k.Version)
	}
	fmt.Println()
	if k.Description != "" {
		fmt.Println(k.Description)
	}
	if k.Source != nil && k.Source.Src != "" {
		fmt.Printf("from %s", k.Source.Src)
		if k.Source.Commit != "" {
			fmt.Printf(" at %.12s", k.Source.Commit)
		}
		fmt.Println()
	}
	if k.Match.Slug != "" {
		fmt.Printf("for %s\n", k.Match.Slug)
	}
	cfg := k.Config
	row := func(label, value string) {
		if value != "" {
			fmt.Printf("  %-10s %s\n", label, value)
		}
	}
	fmt.Println()
	row("setup", cfg.Setup)
	row("teardown", cfg.Archive)
	if cfg.Ports > 0 {
		row("ports", fmt.Sprintf("%d per worktree", cfg.Ports))
	}
	for k, v := range cfg.Env {
		row("env", k+"="+v)
	}
	for _, s := range cfg.Services {
		row("service", s.Name+": "+s.Run)
	}
	for _, h := range cfg.Hooks {
		row("hook", h.On+": "+h.Run)
	}
	for _, f := range cfg.Flows {
		when := "on " + f.Trigger.Event
		switch {
		case f.Trigger.Schedule != "":
			when = "every " + f.Trigger.Schedule
		case f.Trigger.GitHub != nil:
			when = "on GitHub " + f.Trigger.GitHub.On
		}
		row("flow", f.Name+" ("+when+")")
	}
	for _, a := range cfg.Agents {
		row("agent", a.ID+": "+a.Command)
	}
	for _, r := range k.Requires {
		row("needs", r.Tool)
	}
	for _, f := range k.FileList {
		row("file", fmt.Sprintf("%s (%d bytes)", f.Path, f.Size))
	}
}
