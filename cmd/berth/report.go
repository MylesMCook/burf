package main

import (
	"context"
	"encoding/json"
	"os"
	"sync"
	"time"

	"github.com/sean-brydon/berthd/internal/agent"
	box "github.com/sean-brydon/berthd/internal/boxclient"
	"github.com/sean-brydon/berthd/internal/doctor"
	"github.com/sean-brydon/berthd/internal/version"
)

// gatherDiagnostics is `berth doctor --report`: the same report as the
// app's Copy diagnostics (internal/doctor.FormatReport). Each part that
// can't be read says so on its own line; none stops the rest.
func gatherDiagnostics(ctx context.Context, l laptop) doctor.Diagnostics {
	home, _ := os.UserHomeDir()
	d := doctor.Diagnostics{Generated: time.Now().UTC().Format(time.RFC3339), Home: home, Boxes: []doctor.BoxInfo{}}
	c := agent.NewClient(l.socket())
	if !c.Running(ctx) {
		d.Agent = doctor.AgentInfo{State: "not running", Version: version.Version}
		d.Doctor = laptopChecks(ctx, l)
		return d
	}
	d.Agent.State = "running"
	// The agent's own answer has its version and runs the checks there; an
	// older agent has no /v1/doctor, so they run here.
	var rep agent.DoctorReport
	if err := c.Call(ctx, "GET", "/v1/doctor", nil, &rep); err == nil {
		d.Agent.Version, d.Agent.Build, d.Doctor = rep.Version, rep.Build, rep.Checks
	} else {
		d.Agent.Error = "an older agent (no /v1/doctor)"
		d.Doctor = laptopChecks(ctx, l)
	}
	var app json.RawMessage
	if c.Call(ctx, "GET", "/v1/app/diagnostics", nil, &app) == nil && string(app) != "null" {
		var a doctor.AppInfo
		if json.Unmarshal(app, &a) == nil {
			d.App = &a
		}
	}
	status, err := c.Status(ctx)
	if err != nil {
		d.Agent.Error = err.Error()
		return d
	}
	d.Boxes = make([]doctor.BoxInfo, len(status.Boxes))
	var wg sync.WaitGroup
	for i, b := range status.Boxes {
		d.Boxes[i] = doctor.BoxInfo{Name: b.Name, State: b.State, Error: b.Error}
		if b.Local {
			d.LocalBox = &doctor.LocalBoxInfo{Name: b.Name, State: b.State, Error: b.Error}
		}
		if b.State != agent.StateOnline {
			continue
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			info, checks, err := askBox(ctx, l, b.Name, b.Local)
			if err != nil {
				d.Boxes[i].Error = err.Error()
				return
			}
			d.Boxes[i].Build, d.Boxes[i].Capabilities = info.Build, info.Capabilities
			if b.Local {
				d.LocalBox.Version = info.Build
				if err := checks.err; err != nil {
					d.LocalBox.Error = "doctor: " + err.Error()
				}
				d.LocalBox.Checks = checks.list
			}
		}()
	}
	wg.Wait()
	return d
}

type boxChecks struct {
	list []doctor.Check
	err  error
}

// askBox reads a box's build and capabilities, and for the local box its
// doctor checks too, each within a few seconds.
func askBox(ctx context.Context, l laptop, name string, local bool) (box.Info, boxChecks, error) {
	wc, err := l.boxClient(name)
	if err != nil {
		return box.Info{}, boxChecks{}, err
	}
	defer wc.Reset()
	bc := box.NewClient(wc)
	ictx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	info, err := bc.Info(ictx)
	if err != nil {
		return info, boxChecks{}, err
	}
	var checks boxChecks
	if local {
		dctx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		checks.list, checks.err = bc.Doctor(dctx)
	}
	return info, checks, nil
}
