package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/MylesMCook/burf/internal/inventory"
)

const inventoryUsage = `Machine inventory
  burf machines list [--json]
  burf machines add --name NAME --ssh HOST [--os linux|darwin|windows] [--json]
  burf machines routes ID [--ssh HOST] [--paired BOX] [--json]
  burf machines refresh ID [--json]
  burf services list --machine ID [--json]
  burf services history SERVICE --machine ID [--after N] [--limit N] [--json]
External services are inspected only. SSH uses existing authentication and verified host keys.
`

type inventoryRequest struct {
	method, path, output string
	body                 any
	json                 bool
}

func parseInventoryRequest(kind string, args []string) (inventoryRequest, error) {
	r := inventoryRequest{method: "GET"}
	command := "list"
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		command = args[0]
		args = args[1:]
	}
	fs := flag.NewFlagSet(kind+" "+command, flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	jsonOut := fs.Bool("json", false, "JSON output")
	name := fs.String("name", "", "machine name")
	ssh := fs.String("ssh", "", "SSH target")
	paired := fs.String("paired", "", "paired box")
	goos := fs.String("os", "", "platform")
	machine := fs.String("machine", "", "machine ID")
	after := fs.Int64("after", 0, "history cursor")
	limit := fs.Int("limit", 100, "history limit")
	args, err := parseAnywhere(fs, args)
	if err != nil {
		return r, err
	}
	r.json = *jsonOut
	if kind == "machines" {
		switch command {
		case "list":
			if len(args) != 0 {
				return r, errors.New(inventoryUsage)
			}
			r.path = "/v1/machines"
			r.output = "machines"
		case "add":
			if len(args) != 0 || *name == "" || inventory.ValidateSSHTarget(*ssh) != nil || (*goos != "" && *goos != "linux" && *goos != "darwin" && *goos != "windows") {
				return r, errors.New(inventoryUsage)
			}
			r.method = "POST"
			r.path = "/v1/machines"
			r.output = "machine"
			// Registration accepts only user-set fields, not stored identity/timestamps.
			r.body = map[string]any{"name": *name, "os": *goos, "routes": []inventory.Route{{Kind: "ssh", Target: *ssh}}}
		case "routes":
			if len(args) != 1 || (*ssh == "" && *paired == "") {
				return r, errors.New(inventoryUsage)
			}
			routes := []inventory.Route{}
			if *ssh != "" {
				if inventory.ValidateSSHTarget(*ssh) != nil {
					return r, errors.New("invalid SSH target")
				}
				routes = append(routes, inventory.Route{Kind: "ssh", Target: *ssh})
			}
			if *paired != "" {
				routes = append(routes, inventory.Route{Kind: "paired", Target: *paired})
			}
			r.method = "PUT"
			r.path = "/v1/machines/" + url.PathEscape(args[0]) + "/routes"
			r.output = "machine"
			r.body = map[string]any{"routes": routes}
		case "refresh":
			if len(args) != 1 {
				return r, errors.New(inventoryUsage)
			}
			r.method = "POST"
			r.path = "/v1/machines/" + url.PathEscape(args[0]) + "/refresh"
			r.output = "snapshot"
			r.body = map[string]any{}
		default:
			return r, errors.New(inventoryUsage)
		}
	} else {
		if *machine == "" {
			return r, errors.New("choose a machine with --machine ID; see burf machines list")
		}
		r.path = "/v1/machines/" + url.PathEscape(*machine)
		switch command {
		case "list":
			if len(args) != 0 {
				return r, errors.New(inventoryUsage)
			}
			r.path += "/inventory"
			r.output = "snapshot"
		case "history":
			if len(args) != 1 || *after < 0 || *limit < 1 || *limit > 500 {
				return r, errors.New(inventoryUsage)
			}
			r.path += "/history?" + url.Values{"service": {args[0]}, "after": {fmt.Sprint(*after)}, "limit": {fmt.Sprint(*limit)}}.Encode()
			r.output = "history"
		default:
			return r, errors.New(inventoryUsage)
		}
	}
	return r, nil
}

func inventoryCommand(l laptop, kind string, args []string) error {
	r, err := parseInventoryRequest(kind, args)
	if err != nil {
		return err
	}
	c, err := ensureAgent(l)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Second)
	defer cancel()
	var raw json.RawMessage
	if err = c.Call(ctx, r.method, r.path, r.body, &raw); err != nil {
		return err
	}
	if r.json {
		_, err = fmt.Fprintln(os.Stdout, string(raw))
		return err
	}
	switch r.output {
	case "machines":
		var rows []inventory.Machine
		if err = json.Unmarshal(raw, &rows); err != nil {
			return err
		}
		for _, m := range rows {
			fmt.Printf("%s\t%s\t%s\n", m.ID, m.Name, m.OS)
		}
	case "machine":
		var m inventory.Machine
		if err = json.Unmarshal(raw, &m); err != nil {
			return err
		}
		fmt.Printf("%s\t%s\n", m.ID, m.Name)
	case "snapshot":
		var s inventory.Snapshot
		if err = json.Unmarshal(raw, &s); err != nil {
			return err
		}
		fmt.Printf("%s: last observation %s\n", s.Machine.Name, s.At.Format(time.RFC3339))
		for _, c := range s.Coverage {
			if c.State != "ok" {
				fmt.Printf("%s: %s %s\n", c.Source, c.State, c.Error)
			}
		}
		for _, v := range s.Services {
			fmt.Printf("%s\t%s\t%s\t%s\t%v\t%s/%s\t%s\n", v.ID, v.Name, v.Source, v.State, v.Ports, v.Location, v.Worktree, v.ObservedAt.Format(time.RFC3339))
		}
	case "history":
		var rows []inventory.Change
		if err = json.Unmarshal(raw, &rows); err != nil {
			return err
		}
		for _, v := range rows {
			before := "unobserved"
			if v.Before != nil {
				before = v.Before.State
			}
			gap := ""
			if v.Gap {
				gap = " (collection gap)"
			}
			fmt.Printf("%d\t%s\t%s -> %s%s\n", v.ID, v.At.Format(time.RFC3339), before, v.After.State, gap)
		}
	}
	return nil
}
