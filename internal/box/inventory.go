package box

import (
	"context"
	"net/http"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/MylesMCook/burf/internal/inventory"
	"github.com/MylesMCook/burf/internal/service"
	"github.com/MylesMCook/burf/internal/wire"
)

// StartInventory adds observation storage to the existing daemon lifecycle.
// Failure leaves all established chat and service APIs usable.
func (b *Box) StartInventory(ctx context.Context, dir string, logf func(string, ...any)) {
	s, err := inventory.Open(ctx, filepath.Join(dir, "inventory.db"))
	if err != nil {
		logf("inventory unavailable; preserve inventory.db and check state-directory access: %v", err)
		return
	}
	_, err = inventoryLocalMachine(ctx, s, b.Name)
	if err != nil {
		_ = s.Close()
		logf("inventory registration unavailable: %v", err)
		return
	}
	b.Inventory = inventory.NewEngine(ctx, s, func(ctx context.Context, _ inventory.Machine) ([]inventory.Collection, error) {
		return b.collectInventory(ctx), nil
	})
	b.Inventory.Start()
}

func inventoryLocalMachine(ctx context.Context, s *inventory.Store, name string) (inventory.Machine, error) {
	machines, err := s.Machines(ctx)
	if err != nil {
		return inventory.Machine{}, err
	}
	for _, m := range machines {
		for _, r := range m.Routes {
			if r.Kind == "local" {
				return m, nil
			}
		}
	}
	return s.Register(ctx, inventory.Machine{Name: name, OS: runtime.GOOS, Routes: []inventory.Route{{Kind: "local"}}})
}

func (b *Box) CloseInventory() {
	if b.Inventory != nil {
		b.Inventory.Close()
		_ = b.Inventory.Store.Close()
	}
}

func (b *Box) collectInventory(ctx context.Context) []inventory.Collection {
	all := inventory.Collect(ctx, runtime.GOOS, "")
	at := time.Now().UTC()
	sessions := inventory.Collection{Coverage: inventory.Coverage{Source: "burf-sessions", State: "ok", At: at}, Services: []inventory.Service{}}
	if b.Sessions != nil {
		rows, err := b.Sessions.List(ctx)
		if err != nil {
			sessions.State = "error"
			sessions.Error = "Burf sessions could not be inspected."
		} else {
			for _, s := range rows {
				state := "running"
				if s.Exited {
					state = "stopped"
				}
				name := "Terminal"
				if s.Agent != "" {
					name = s.Agent + " agent"
				}
				sessions.Services = append(sessions.Services, inventory.Service{Key: s.Name, Name: name, Source: sessions.Source, State: state, Location: s.Location, ProcessStarted: s.Created.UTC().Format(time.RFC3339Nano), Ports: []int{}})
			}
		}
	}
	all = append(all, sessions)
	chats := inventory.Collection{Coverage: inventory.Coverage{Source: "burf-chats", State: "ok", At: at}, Services: []inventory.Service{}}
	if b.Chats != nil {
		for _, s := range b.Chats.List() {
			state := "running"
			if s.State == "stopped" || s.State == "exited" {
				state = "stopped"
			}
			if s.State == "failed" {
				state = "failed"
			}
			chat := b.chatSnapshot(s)
			loc, wt, _ := strings.Cut(chat.Location, "/")
			chats.Services = append(chats.Services, inventory.Service{Key: s.ID, Name: s.Agent + " agent", Source: chats.Source, State: state, Location: loc, Worktree: wt, ProcessStarted: s.StartedAt.UTC().Format(time.RFC3339Nano), Ports: []int{}})
		}
	}
	all = append(all, chats)
	managed := inventory.Collection{Coverage: inventory.Coverage{Source: "burf-services", State: "ok", At: at}, Services: []inventory.Service{}}
	taskPrefix := ""
	if runtime.GOOS == "windows" {
		if key, err := service.UnitPath(service.Spec{Name: "inventory-probe"}); err == nil {
			taskPrefix = strings.TrimSuffix(key, "inventory-probe")
		}
	}
	if b.Locations != nil {
		locations, err := b.Locations.List(ctx)
		if err != nil {
			managed.State = "error"
			managed.Error = "Project services could not be inspected."
		} else {
			if runtime.GOOS != "windows" {
				if ports, err := ListPorts(ctx); err == nil {
					associateInventoryProjects(all, ports, locations)
				}
			}
			for _, loc := range locations {
				cfg, err := b.Locations.Config(ctx, loc.Name)
				if err != nil {
					managed.State = "partial"
					managed.Error = "Some project service configuration is unavailable."
					continue
				}
				for _, wt := range loc.Worktrees {
					for _, svc := range cfg.Effective.Services {
						unit := serviceUnit(loc.Name, wt.Name, svc.Name)
						row := inventory.Service{Key: unit, Source: managed.Source, Name: svc.Name, State: "unknown", Location: loc.Name, Worktree: wt.Name, Ports: []int{}}
						linked := false
						// The read-only platform snapshot supplies service truth; config only supplies ownership.
						for i := range all {
							for j := range all[i].Services {
								observed := all[i].Services[j]
								if matchesInventoryUnit(observed, unit, taskPrefix) {
									row.State, row.Health, row.PID, row.ProcessStarted, row.Ports = observed.State, observed.Health, observed.PID, observed.ProcessStarted, observed.Ports
									all[i].Services[j].Location, all[i].Services[j].Worktree = loc.Name, wt.Name
									linked = true
								}
							}
						}
						if svc.Terminal && b.Sessions != nil {
							for i := range all {
								if all[i].Source == "burf-sessions" {
									for j := range all[i].Services {
										if all[i].Services[j].Key == serviceSession(loc.Name, wt.Name, svc.Name) {
											all[i].Services[j].Name = svc.Name
											all[i].Services[j].Location = loc.Name
											all[i].Services[j].Worktree = wt.Name
											linked = true
										}
									}
								}
							}
							list, err := b.Sessions.List(ctx)
							if err == nil {
								row.State = terminalState(list, serviceSession(loc.Name, wt.Name, svc.Name))
							} else {
								managed.State = "partial"
							}
						}
						if !linked {
							managed.Services = append(managed.Services, row)
						}
					}
				}
				// Associate observed dev servers by the existing port-block and directory rules.
				for i := range all {
					for j := range all[i].Services {
						r := &all[i].Services[j]
						for _, wt := range loc.Worktrees {
							for _, port := range r.Ports {
								if wt.Port > 0 && port >= wt.Port && port < wt.Port+portBlock {
									r.Location, r.Worktree = loc.Name, wt.Name
								}
							}
						}
					}
				}
			}
		}
	}
	all = append(all, managed)
	return inventory.Correlate(all)
}

func matchesInventoryUnit(observed inventory.Service, unit, taskPrefix string) bool {
	switch observed.Source {
	case "systemd-user":
		return observed.Key == unit+".service"
	case "launchd-user":
		return observed.Key == unit
	case "windows-tasks":
		return taskPrefix != "" && observed.Key == taskPrefix+unit
	}
	return false
}

func associateInventoryProjects(all []inventory.Collection, ports []Port, locations []Location) {
	for _, port := range ports {
		linked := Services([]Port{port}, locations)
		if len(linked) == 0 {
			continue
		}
		for i := range all {
			for j := range all[i].Services {
				s := &all[i].Services[j]
				if s.PID == port.PID && s.PID > 0 && slices.Contains(s.Ports, port.Port) {
					s.Location, s.Worktree = linked[0].Location, linked[0].Worktree
				}
			}
		}
	}
}

func (b *Box) mountInventory(s *wire.Server) {
	serve := func(history bool) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if b.Inventory == nil {
				writeErr(w, httpError{http.StatusServiceUnavailable, "Inventory unavailable. Preserve inventory.db and check state-directory access."})
				return
			}
			machines, err := b.Inventory.Store.Machines(r.Context())
			if err != nil || len(machines) == 0 {
				writeErr(w, httpError{503, "Inventory records are unavailable."})
				return
			}
			if history {
				after, parseErr := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)
				if r.URL.Query().Get("after") == "" {
					after = 0
					parseErr = nil
				}
				limit := 100
				if v := r.URL.Query().Get("limit"); v != "" {
					limit, err = strconv.Atoi(v)
				}
				if parseErr != nil || err != nil || after < 0 || limit < 1 || limit > 500 {
					writeErr(w, badRequest("invalid history cursor or limit"))
					return
				}
				out, err := b.Inventory.Store.History(r.Context(), machines[0].ID, r.URL.Query().Get("service"), after, limit)
				if err != nil {
					writeErr(w, httpError{503, "Inventory history is unavailable."})
					return
				}
				writeJSON(w, out)
				return
			}
			out, err := b.Inventory.Store.Snapshot(r.Context(), machines[0].ID)
			if err == nil && r.URL.Query().Get("refresh") == "1" {
				out, err = b.Inventory.Refresh(r.Context(), machines[0].ID)
			}
			if err != nil {
				writeErr(w, httpError{503, "Inventory snapshot is unavailable."})
				return
			}
			writeJSON(w, out)
		}
	}
	s.Handle("GET /v1/inventory", serve(false))
	s.Handle("GET /v1/inventory/history", serve(true))
}
