package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/MylesMCook/burf/internal/boxclient"
	"github.com/MylesMCook/burf/internal/inventory"
)

type machineInventory struct {
	store   *inventory.Store
	engine  *inventory.Engine
	collect func(context.Context, string, string) []inventory.Collection
}

func (a *Agent) startInventory(ctx context.Context) {
	s, err := inventory.Open(ctx, filepath.Join(a.cfg.Dir, "inventory.db"))
	if err != nil {
		a.cfg.Log.Printf("inventory unavailable; preserve inventory.db and check state-directory access: %v", err)
		return
	}
	a.inventory = &machineInventory{store: s}
	if err = a.ensureInventoryMachines(ctx); err != nil {
		a.cfg.Log.Printf("inventory machine registration unavailable: %v", err)
	}
	a.inventory.engine = inventory.NewEngine(ctx, s, a.collectMachine)
	a.inventory.engine.Prepare = a.ensureInventoryMachines
	a.inventory.engine.Start()
}

func (a *Agent) closeInventory() {
	if a.inventory != nil {
		a.inventory.engine.Close()
		_ = a.inventory.store.Close()
	}
}

func (a *Agent) ensureInventoryMachines(ctx context.Context) error {
	rows, err := a.inventory.store.Machines(ctx)
	if err != nil {
		return err
	}
	has := func(route inventory.Route) bool {
		return slices.ContainsFunc(rows, func(m inventory.Machine) bool { return slices.Contains(m.Routes, route) })
	}
	if !has(inventory.Route{Kind: "local"}) {
		name, _ := os.Hostname()
		if name == "" {
			name = "This computer"
		}
		_, err = a.inventory.store.Register(ctx, inventory.Machine{Name: name, OS: runtime.GOOS, Routes: []inventory.Route{{Kind: "local"}}})
		if err != nil {
			return err
		}
	}
	if a.boxes == nil {
		return nil
	}
	peers, err := a.boxes.List()
	if err != nil {
		return err
	}
	for _, p := range peers {
		route := inventory.Route{Kind: "paired", Target: p.Fingerprint.String()}
		if !has(route) {
			if _, err = a.inventory.store.Register(ctx, inventory.Machine{Name: p.Name, Routes: []inventory.Route{route}}); err != nil {
				return err
			}
		}
	}
	return nil
}

func (a *Agent) pairedInventoryClient(m inventory.Machine) (*boxclient.Client, string, error) {
	if a.boxes == nil {
		return nil, "", errors.New("no paired machine")
	}
	peers, err := a.boxes.List()
	if err != nil {
		return nil, "", err
	}
	for _, route := range m.Routes {
		if route.Kind != "paired" {
			continue
		}
		for _, p := range peers {
			if route.Target == p.Fingerprint.String() {
				wc, ok := a.client(p.Name)
				if !ok {
					return nil, "", errors.New("paired machine connection unavailable")
				}
				return boxclient.NewClient(wc), route.Target, nil
			}
		}
	}
	return nil, "", errors.New("no paired machine")
}

func (a *Agent) collectMachine(ctx context.Context, m inventory.Machine) ([]inventory.Collection, error) {
	if slices.ContainsFunc(m.Routes, func(r inventory.Route) bool { return r.Kind == "paired" }) {
		c, origin, err := a.pairedInventoryClient(m)
		if err == nil {
			if info, err := c.Info(ctx); err == nil && slices.Contains(info.Capabilities, "inventory.v1") {
				if err := a.importMachineInventory(ctx, m, c, origin); err == nil {
					return nil, nil
				}
			}
		}
		// An older paired daemon may be inspected over an explicitly attached SSH route.
	}
	for _, r := range m.Routes {
		if r.Kind == "ssh" {
			collections := a.inventorySources(ctx, m.OS, r.Target)
			for _, c := range collections {
				if c.Source == "ssh" && c.State == "error" {
					return nil, errors.New("SSH inventory connection unavailable")
				}
			}
			if slices.ContainsFunc(m.Routes, func(r inventory.Route) bool { return r.Kind == "paired" }) {
				if previous, err := a.inventory.store.Snapshot(ctx, m.ID); err == nil {
					for _, c := range previous.Coverage {
						if strings.HasPrefix(c.Source, "burf-") {
							collections = append(collections, inventory.Collection{Coverage: inventory.Coverage{Source: c.Source, State: "unavailable", Error: "The daemon is unavailable; SSH cannot inspect Burf sessions.", At: time.Now().UTC()}})
						}
					}
				}
			}
			if m.OS == "" {
				for _, c := range collections {
					switch c.Source {
					case "systemd-user", "systemd-system":
						m.OS = "linux"
					case "launchd-user", "launchd-system":
						m.OS = "darwin"
					case "windows-services", "windows-tasks":
						m.OS = "windows"
					}
				}
				if m.OS != "" {
					if _, err := a.inventory.store.Register(ctx, m); err != nil {
						return nil, err
					}
				}
			}
			return collections, nil
		}
	}
	for _, r := range m.Routes {
		if r.Kind == "local" {
			return a.collectLocalInventory(ctx), nil
		}
	}
	return nil, errors.New("this machine does not advertise inventory; attach an SSH route or update its daemon")
}

func (a *Agent) importMachineInventory(ctx context.Context, m inventory.Machine, c *boxclient.Client, origin string) error {
	var snapshot inventory.Snapshot
	if err := c.Call(ctx, "GET", "/v1/inventory?refresh=1", nil, &snapshot); err != nil {
		return errors.New("machine inventory unavailable")
	}
	if snapshot.At.IsZero() {
		return errors.New("machine has not completed its first inventory scan")
	}
	cursor, err := a.inventory.store.Cursor(ctx, m.ID, origin)
	if err != nil {
		return err
	}
	base := slices.DeleteFunc(snapshot.Coverage, func(c inventory.Coverage) bool { return c.Source == "connection" || c.Source == "history" })
	for page := 0; page < 20; page++ {
		var batch []inventory.Change
		if err = c.Call(ctx, "GET", fmt.Sprintf("/v1/inventory/history?after=%d&limit=500", cursor), nil, &batch); err != nil {
			return errors.New("machine history unavailable")
		}
		if len(batch) > 0 && batch[0].ID > cursor+1 {
			batch[0].Gap = true
		}
		snapshot.Coverage = append(slices.Clone(base), inventory.Coverage{Source: "connection", State: "ok", At: time.Now().UTC()})
		history := inventory.Coverage{Source: "history", State: "ok", At: time.Now().UTC()}
		if page == 19 && len(batch) == 500 {
			history.State = "partial"
			history.Error = "Older history is still being synchronized; the next refresh will continue."
		}
		snapshot.Coverage = append(snapshot.Coverage, history)
		// Commit each bounded page so reconnecting clients always make progress.
		if err = a.inventory.store.Import(ctx, m.ID, origin, snapshot, batch); err != nil {
			return err
		}
		if len(batch) < 500 {
			return nil
		}
		if batch[len(batch)-1].ID <= cursor {
			return errors.New("machine history cursor did not advance")
		}
		cursor = batch[len(batch)-1].ID
	}
	return nil
}

func (a *Agent) collectLocalInventory(ctx context.Context) []inventory.Collection {
	all := a.inventorySources(ctx, runtime.GOOS, "")
	rows := inventory.Collection{Coverage: inventory.Coverage{Source: "burf-agents", State: "ok", At: time.Now().UTC()}, Services: []inventory.Service{}}
	if localClientSupported() {
		a.initLocalClient()
		appendRow := func(id, provider, state string, started time.Time) {
			switch state {
			case "stopped", "exited":
				state = "stopped"
			case "failed":
				state = "failed"
			default:
				state = "running"
			}
			rows.Services = append(rows.Services, inventory.Service{Key: id, Source: rows.Source, Name: provider + " agent", State: state, ProcessStarted: started.UTC().Format(time.RFC3339Nano), Ports: []int{}})
		}
		for _, s := range a.localClient.manager.List() {
			appendRow(s.ID, s.Agent, s.State, s.StartedAt)
		}
		for _, s := range a.localClient.chats.List() {
			appendRow(s.ID, s.Agent, s.State, s.StartedAt)
		}
	}
	return append(all, rows)
}

func (a *Agent) inventorySources(ctx context.Context, goos, target string) []inventory.Collection {
	if a.inventory.collect != nil {
		return a.inventory.collect(ctx, goos, target)
	}
	return inventory.Collect(ctx, goos, target)
}

func (a *Agent) inventoryRoutes(mux *http.ServeMux) {
	available := func(w http.ResponseWriter) bool {
		if a.inventory == nil {
			writeError(w, 503, "Inventory unavailable. Preserve inventory.db and check state-directory access.")
			return false
		}
		return true
	}
	fail := func(w http.ResponseWriter, err error) {
		code := 503
		if errors.Is(err, inventory.ErrNotFound) {
			code = 404
		}
		writeError(w, code, "Inventory records are unavailable.")
	}
	mux.HandleFunc("GET /v1/machines", func(w http.ResponseWriter, r *http.Request) {
		if !available(w) {
			return
		}
		if err := a.ensureInventoryMachines(r.Context()); err != nil {
			fail(w, err)
			return
		}
		rows, err := a.inventory.store.Machines(r.Context())
		if err != nil {
			fail(w, err)
			return
		}
		if r.URL.Query().Get("local") == "1" {
			rows = slices.DeleteFunc(rows, func(m inventory.Machine) bool { return !slices.Contains(m.Routes, inventory.Route{Kind: "local"}) })
		}
		if name := r.URL.Query().Get("box"); name != "" {
			peer, ok, err := a.boxes.ByName(name)
			if err != nil {
				fail(w, err)
				return
			}
			if !ok {
				writeJSON(w, 200, []inventory.Machine{})
				return
			}
			rows = slices.DeleteFunc(rows, func(m inventory.Machine) bool {
				return !slices.Contains(m.Routes, inventory.Route{Kind: "paired", Target: peer.Fingerprint.String()})
			})
		}
		writeJSON(w, 200, rows)
	})
	decode := func(w http.ResponseWriter, r *http.Request, out any) bool {
		d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
		d.DisallowUnknownFields()
		if d.Decode(out) != nil {
			writeError(w, 400, "Invalid machine request.")
			return false
		}
		return true
	}
	resolveRoutes := func(routes []inventory.Route) ([]inventory.Route, error) {
		if len(routes) == 0 {
			return nil, errors.New("a machine needs a connection route")
		}
		for i, r := range routes {
			if r.Kind == "local" {
				return nil, errors.New("the local machine route is managed by Burf")
			}
			if r.Kind == "paired" {
				if a.boxes == nil {
					return nil, errors.New("pair this machine first")
				}
				peers, err := a.boxes.List()
				if err != nil {
					return nil, err
				}
				found := false
				for _, p := range peers {
					if r.Target == p.Name || r.Target == p.Fingerprint.String() {
						routes[i].Target = p.Fingerprint.String()
						found = true
						break
					}
				}
				if !found {
					return nil, errors.New("pair this machine first")
				}
			}
		}
		return routes, nil
	}
	mux.HandleFunc("POST /v1/machines", func(w http.ResponseWriter, r *http.Request) {
		if !available(w) {
			return
		}
		var req struct {
			Name   string            `json:"name"`
			OS     string            `json:"os"`
			Routes []inventory.Route `json:"routes"`
		}
		if !decode(w, r, &req) {
			return
		}
		routes, err := resolveRoutes(req.Routes)
		if err != nil {
			writeError(w, 400, err.Error())
			return
		}
		m, err := a.inventory.store.Register(r.Context(), inventory.Machine{Name: req.Name, OS: req.OS, Routes: routes})
		if err != nil {
			writeError(w, 400, "Invalid machine name, platform or route. Use an SSH alias or user@host.")
			return
		}
		writeJSON(w, 200, m)
	})
	mux.HandleFunc("PUT /v1/machines/{id}/routes", func(w http.ResponseWriter, r *http.Request) {
		if !available(w) {
			return
		}
		var req struct {
			Routes []inventory.Route `json:"routes"`
		}
		if !decode(w, r, &req) {
			return
		}
		m, err := a.inventory.store.Machine(r.Context(), r.PathValue("id"))
		if err != nil {
			fail(w, err)
			return
		}
		additions := slices.DeleteFunc(req.Routes, func(route inventory.Route) bool { return route.Kind == "local" && slices.Contains(m.Routes, route) })
		routes, err := resolveRoutes(additions)
		if err != nil {
			writeError(w, 400, err.Error())
			return
		}
		for _, existing := range m.Routes {
			if !slices.Contains(routes, existing) {
				routes = append(routes, existing)
			}
		}
		if err = a.inventory.store.AttachRoutes(r.Context(), m.ID, routes); err != nil {
			writeError(w, 400, "Route attachment failed. Check the target and existing machine records.")
			return
		}
		m, err = a.inventory.store.Machine(r.Context(), m.ID)
		if err != nil {
			fail(w, err)
			return
		}
		writeJSON(w, 200, m)
	})
	mux.HandleFunc("GET /v1/machines/{id}/inventory", func(w http.ResponseWriter, r *http.Request) {
		if !available(w) {
			return
		}
		out, err := a.inventory.store.Snapshot(r.Context(), r.PathValue("id"))
		if err != nil {
			fail(w, err)
			return
		}
		writeJSON(w, 200, out)
	})
	mux.HandleFunc("POST /v1/machines/{id}/refresh", func(w http.ResponseWriter, r *http.Request) {
		if !available(w) {
			return
		}
		out, err := a.inventory.engine.Refresh(r.Context(), r.PathValue("id"))
		if err != nil {
			fail(w, err)
			return
		}
		writeJSON(w, 200, out)
	})
	mux.HandleFunc("GET /v1/machines/{id}/history", func(w http.ResponseWriter, r *http.Request) {
		if !available(w) {
			return
		}
		q := r.URL.Query()
		after := int64(0)
		limit := 100
		var err error
		if v := q.Get("after"); v != "" {
			after, err = strconv.ParseInt(v, 10, 64)
			if err != nil || after < 0 {
				writeError(w, 400, "Invalid history cursor.")
				return
			}
		}
		if v := q.Get("limit"); v != "" {
			limit, err = strconv.Atoi(v)
			if err != nil || limit < 1 || limit > 500 {
				writeError(w, 400, "History limit must be 1 to 500.")
				return
			}
		}
		out, err := a.inventory.store.History(r.Context(), r.PathValue("id"), q.Get("service"), after, limit)
		if err != nil {
			fail(w, err)
			return
		}
		writeJSON(w, 200, out)
	})
}
