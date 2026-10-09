package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/MylesMCook/burf/internal/agent"
	"github.com/MylesMCook/burf/internal/sshconfig"
)

// sshConfigCommand shows, and with --write makes, the SSH hosts editors use
// to reach boxes: berth-<box>, through berth's network where needed.
func sshConfigCommand(l laptop, args []string) error {
	var write bool
	_, asJSON, err := flags("ssh-config", args, func(fs *flag.FlagSet) {
		fs.BoolVar(&write, "write", false, "write the changes shown")
	})
	if err != nil {
		return err
	}
	c, err := ensureAgent(l)
	if err != nil {
		return err
	}
	ctx, stop := signalContext()
	defer stop()
	var res struct {
		Dir     string             `json:"dir"`
		Hosts   []agent.SSHHost    `json:"hosts"`
		Changes []sshconfig.Change `json:"changes"`
	}
	method := "GET"
	if write {
		method = "POST"
	}
	if err := c.Call(ctx, method, "/v1/ssh-config", nil, &res); err != nil {
		return err
	}
	if asJSON {
		return json.NewEncoder(os.Stdout).Encode(res)
	}
	for _, h := range res.Hosts {
		switch {
		case h.Local:
			fmt.Printf("  %-10s this computer; editors open it directly\n", h.Box)
		case h.Ready:
			fmt.Printf("  %-10s ssh %s\n", h.Box, h.Host)
		default:
			fmt.Printf("  %-10s needs setting up\n", h.Box)
		}
	}
	if len(res.Changes) == 0 {
		if write {
			fmt.Println("\nWritten. Editors reach each box as berth-<box>.")
		} else {
			fmt.Println("\nEverything is set up.")
		}
		return nil
	}
	fmt.Printf("\nThese changes give editors an SSH host per box:\n")
	for _, ch := range res.Changes {
		fmt.Printf("\n%s %s\n%s", ch.Action, ch.Path, ch.Diff)
	}
	fmt.Println("\nRun again with --write to make them. ~/.ssh/config is backed up to config.berth-backup first.")
	return nil
}

// editCommand opens a worktree, or a file in it at a line, in an editor.
func editCommand(l laptop, args []string) error {
	var in string
	fs, asJSON, err := flags("edit", args, func(fs *flag.FlagSet) {
		fs.StringVar(&in, "in", "", "cursor, vscode, windsurf or zed (default: the first installed)")
	})
	if err != nil {
		return err
	}
	usage := errors.New("usage: berth edit BOX/PROJECT[/WORKTREE] [FILE[:LINE[:COL]]] [--in EDITOR]")
	if fs.NArg() < 1 || fs.NArg() > 2 {
		return usage
	}
	boxName, ref, ok := strings.Cut(fs.Arg(0), "/")
	if !ok || ref == "" {
		return usage
	}
	c, err := ensureAgent(l)
	if err != nil {
		return err
	}
	ctx, stop := signalContext()
	defer stop()
	if in == "" {
		var eds []agent.Editor
		if err := c.Call(ctx, "GET", "/v1/editors", nil, &eds); err != nil {
			return err
		}
		for _, e := range eds {
			if e.Installed {
				in = e.ID
				break
			}
		}
		if in == "" {
			return errors.New("no supported editor is installed (Cursor, VS Code, Windsurf or Zed)")
		}
	}
	req := agent.OpenRequest{Editor: in, Box: boxName, Location: ref}
	if fs.NArg() == 2 {
		file, line, col := splitPosition(fs.Arg(1))
		req.File, req.Line, req.Col = file, line, col
	}
	var res agent.OpenResult
	if err := c.Call(ctx, "POST", "/v1/editors/open", req, &res); err != nil {
		return err
	}
	if asJSON {
		return printJSON(res)
	}
	if res.Note != "" {
		fmt.Println(res.Note)
	}
	return nil
}

// splitPosition reads path:line:col.
func splitPosition(s string) (string, int, int) {
	parts := strings.Split(s, ":")
	nums := []int{}
	for len(parts) > 1 && len(nums) < 2 {
		n, err := strconv.Atoi(parts[len(parts)-1])
		if err != nil {
			break
		}
		nums = append([]int{n}, nums...)
		parts = parts[:len(parts)-1]
	}
	path := strings.Join(parts, ":")
	switch len(nums) {
	case 2:
		return path, nums[0], nums[1]
	case 1:
		return path, nums[0], 0
	}
	return path, 0, 0
}
