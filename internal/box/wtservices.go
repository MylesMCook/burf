package box

import (
	"bufio"
	"context"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/sean-brydon/berth/internal/events"
)

// A repository's services run in each worktree as managed units, so they
// survive the daemon restarting and come back if they crash, each with the
// worktree's environment and so its own $BERTH_PORT.

// ServiceStatus is one of a worktree's services.
type ServiceStatus struct {
	Name      string `json:"name"`
	Run       string `json:"run"`
	Autostart bool   `json:"autostart,omitempty"`
	// State is the unit's, or "stopped" when it is not installed.
	State string `json:"state"`
	Unit  string `json:"unit"`
	Port  int    `json:"port,omitempty"`
}

var ErrUnknownService = errors.New("no service with that name in this repository's config")

func eventf(b *Box, typ string, data map[string]any) events.Event {
	return events.Event{Type: typ, Box: b.Name, Origin: "berth", Data: data}
}

func serviceUnit(loc, wt, svc string) string {
	name := "svc-" + slug(loc, 30) + "-" + slug(wt, 60) + "-" + svc
	if len(name) > 128 {
		name = name[:128]
	}
	return strings.TrimRight(name, "-")
}

// loginShell is the user's shell, which a service runs through so the tools
// the user installed are on PATH even under systemd.
func loginShell() string {
	if s := os.Getenv("SHELL"); s != "" {
		return s
	}
	if f, err := os.Open("/etc/passwd"); err == nil {
		defer f.Close()
		me := strconv.Itoa(os.Getuid())
		sc := bufio.NewScanner(f)
		for sc.Scan() {
			fields := strings.Split(sc.Text(), ":")
			if len(fields) >= 7 && fields[2] == me && fields[6] != "" {
				return fields[6]
			}
		}
	}
	return "/bin/sh"
}

func (b *Box) worktreeRef(ctx context.Context, location, worktree string) (Location, Worktree, error) {
	loc, err := b.Locations.Get(ctx, location)
	if err != nil {
		return Location{}, Worktree{}, err
	}
	for _, w := range loc.Worktrees {
		if w.Name == worktree {
			return loc, w, nil
		}
	}
	return Location{}, Worktree{}, ErrUnknownWorktree
}

// WorktreeServices reports a worktree's services from the location's config.
func (b *Box) WorktreeServices(ctx context.Context, location, worktree string) ([]ServiceStatus, error) {
	loc, wt, err := b.worktreeRef(ctx, location, worktree)
	if err != nil {
		return nil, err
	}
	cfg, err := b.Locations.Config(ctx, loc.Name)
	if err != nil {
		return nil, err
	}
	out := []ServiceStatus{}
	for _, s := range cfg.Effective.Services {
		st := ServiceStatus{Name: s.Name, Run: s.Run, Autostart: s.Autostart, State: "stopped", Unit: serviceUnit(loc.Name, wt.Name, s.Name), Port: wt.Port}
		if b.Units != nil {
			if u, err := b.Units.Get(st.Unit); err == nil {
				st.State = u.State
			}
		}
		out = append(out, st)
	}
	return out, nil
}

// StartService (re)installs and starts one service of a worktree.
func (b *Box) StartService(ctx context.Context, location, worktree, name string) (ServiceStatus, error) {
	if b.Units == nil {
		return ServiceStatus{}, httpError{http.StatusNotImplemented, "this box cannot run managed units"}
	}
	loc, wt, err := b.worktreeRef(ctx, location, worktree)
	if err != nil {
		return ServiceStatus{}, err
	}
	cfg, err := b.Locations.Config(ctx, loc.Name)
	if err != nil {
		return ServiceStatus{}, err
	}
	var svc *WorktreeService
	for i := range cfg.Effective.Services {
		if cfg.Effective.Services[i].Name == name {
			svc = &cfg.Effective.Services[i]
		}
	}
	if svc == nil {
		return ServiceStatus{}, ErrUnknownService
	}
	env, err := b.WorktreeEnv(ctx, loc.Name, wt)
	if err != nil {
		return ServiceStatus{}, err
	}
	envMap := map[string]string{}
	for _, kv := range env {
		k, v, _ := strings.Cut(kv, "=")
		envMap[k] = v
	}
	// Many dev servers read PORT; give it the worktree's own.
	if _, ok := envMap["PORT"]; !ok && envMap["BERTH_PORT"] != "" {
		envMap["PORT"] = envMap["BERTH_PORT"]
	}
	unit := serviceUnit(loc.Name, wt.Name, name)
	if _, err := b.Units.Install(ctx, UnitRequest{
		Name:    unit,
		Program: loginShell(),
		Args:    []string{"-lc", "cd " + shellQuote(wt.Path) + " && " + svc.Run},
		Env:     envMap,
	}); err != nil {
		return ServiceStatus{}, err
	}
	b.Events.Publish(eventf(b, "service.started", map[string]any{"location": loc.Name, "name": wt.Name, "path": wt.Path, "service": name, "port": wt.Port}))
	return b.serviceStatus(ctx, location, worktree, name)
}

// StopService stops one service and removes its unit.
func (b *Box) StopService(ctx context.Context, location, worktree, name string) (ServiceStatus, error) {
	loc, wt, err := b.worktreeRef(ctx, location, worktree)
	if err != nil {
		return ServiceStatus{}, err
	}
	if b.Units != nil {
		if _, err := b.Units.Remove(serviceUnit(loc.Name, wt.Name, name)); err != nil && !errors.Is(err, ErrUnknownUnit) {
			return ServiceStatus{}, err
		}
	}
	b.Events.Publish(eventf(b, "service.stopped", map[string]any{"location": loc.Name, "name": wt.Name, "path": wt.Path, "service": name}))
	return b.serviceStatus(ctx, location, worktree, name)
}

func (b *Box) serviceStatus(ctx context.Context, location, worktree, name string) (ServiceStatus, error) {
	all, err := b.WorktreeServices(ctx, location, worktree)
	if err != nil {
		return ServiceStatus{}, err
	}
	for _, s := range all {
		if s.Name == name {
			return s, nil
		}
	}
	return ServiceStatus{}, ErrUnknownService
}

// startAutostart starts the services that start with every new worktree.
func (b *Box) startAutostart(location, worktree string) {
	ctx := context.Background()
	all, err := b.WorktreeServices(ctx, location, worktree)
	if err != nil {
		return
	}
	for _, s := range all {
		if s.Autostart {
			if _, err := b.StartService(ctx, location, worktree, s.Name); err != nil {
				b.Events.Publish(eventf(b, "service.failed", map[string]any{"location": location, "name": worktree, "service": s.Name, "error": err.Error()}))
			}
		}
	}
}

// stopServices stops every service of a worktree that is going away, before
// its archive script runs: a dev server holding the worktree's database
// would stop the script from dropping it.
func (b *Box) stopServices(location, worktree string) {
	all, err := b.WorktreeServices(context.Background(), location, worktree)
	if err != nil || b.Units == nil {
		return
	}
	for _, s := range all {
		b.Units.Remove(s.Unit)
	}
}

func (b *Box) listWorktreeServices(w http.ResponseWriter, r *http.Request) error {
	all, err := b.WorktreeServices(r.Context(), r.PathValue("name"), r.PathValue("worktree"))
	if err != nil {
		return err
	}
	writeJSON(w, all)
	return nil
}

func (b *Box) serviceAction(w http.ResponseWriter, r *http.Request) error {
	loc, wt, svc := r.PathValue("name"), r.PathValue("worktree"), r.PathValue("service")
	var (
		st  ServiceStatus
		err error
	)
	switch r.PathValue("action") {
	case "start":
		st, err = b.StartService(r.Context(), loc, wt, svc)
	case "stop":
		st, err = b.StopService(r.Context(), loc, wt, svc)
	case "restart":
		if _, err = b.StopService(r.Context(), loc, wt, svc); err == nil {
			st, err = b.StartService(r.Context(), loc, wt, svc)
		}
	default:
		return badRequest("use start, stop or restart")
	}
	if err != nil {
		return err
	}
	writeJSON(w, st)
	return nil
}

func (b *Box) serviceLog(w http.ResponseWriter, r *http.Request) error {
	if b.Units == nil {
		return httpError{http.StatusNotImplemented, "this box cannot run managed units"}
	}
	loc, wt, err := b.worktreeRef(r.Context(), r.PathValue("name"), r.PathValue("worktree"))
	if err != nil {
		return err
	}
	out, err := b.Units.Tail(serviceUnit(loc.Name, wt.Name, r.PathValue("service")), 256<<10)
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write(out)
	return nil
}
