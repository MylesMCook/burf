package box

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strconv"
	"time"

	"github.com/sean-brydon/berth/internal/doctor"
	"github.com/sean-brydon/berth/internal/events"
	"github.com/sean-brydon/berth/internal/hooks"
	"github.com/sean-brydon/berth/internal/terminal"
	"github.com/sean-brydon/berth/internal/wire"
)

// OriginHeader names the tool a request comes from, so the events it causes
// carry that origin and hooks driving the same tool skip them.
const OriginHeader = "X-Berth-Origin"

var validOrigin = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,31}$`)

type Box struct {
	Name      string
	Locations *Locations
	Sessions  *Sessions
	Shares    *Shares
	Events    *events.Bus
	// Watcher, when set, is told about berth's own worktree changes so it
	// does not announce them a second time.
	Watcher *Watcher
	// Update, when set, lets paired laptops upgrade the daemon in place.
	Update *SelfUpdate
	// DaemonChecks adds berthd's own checks to Doctor.
	DaemonChecks func() []doctor.Check
	// LogDir holds the logs of lifecycle scripts.
	LogDir string
	// Units runs berthd's managed units; nil where they cannot run.
	Units *Units
	// AgentStates, when running, says which agents wait for someone.
	AgentStates *AgentStates
	// Hooks, when set, may refuse actions through "before:" hooks.
	Hooks *hooks.Runner
	// Flows runs the box's and its repositories' automations.
	Flows *Flows
}

func (b *Box) own(path string) {
	if b.Watcher != nil {
		b.Watcher.Own(path)
	}
}

// Mount registers the box's routes on s. They are reachable by paired
// laptops and, through ServeLocal, by the box's own user.
func (b *Box) Mount(s *wire.Server) {
	route := func(pattern string, h func(http.ResponseWriter, *http.Request) error) {
		s.Handle(pattern, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if err := h(w, r); err != nil {
				writeError(w, statusFor(err), err.Error())
			}
		}))
	}
	route("GET /v1/ports", b.ports)
	route("GET /v1/locations", b.listLocations)
	route("POST /v1/locations", b.addLocation)
	route("DELETE /v1/locations/{name}", b.removeLocation)
	route("PUT /v1/locations/{name}/scripts", b.setScripts)
	route("POST /v1/locations/{name}/worktrees", b.addWorktree)
	route("POST /v1/locations/clone", b.cloneLocation)
	route("POST /v1/locations/new", b.newLocation)
	route("POST /v1/locations/{name}/resolve", b.resolve)
	route("GET /v1/locations/{name}/branches", b.listBranches)
	route("GET /v1/fs", b.listFolder)
	route("GET /v1/flows", b.listFlows)
	route("PUT /v1/flows", b.putFlows)
	route("GET /v1/flows/runs", b.listFlowRuns)
	route("POST /v1/flows/{id}/test", b.testFlow)
	route("GET /v1/locations/{name}/config", b.getConfig)
	route("PUT /v1/locations/{name}/config", b.putConfig)
	route("GET /v1/locations/{name}/worktrees/{worktree}/services", b.listWorktreeServices)
	route("POST /v1/locations/{name}/worktrees/{worktree}/services/{service}/{action}", b.serviceAction)
	route("GET /v1/locations/{name}/worktrees/{worktree}/services/{service}/log", b.serviceLog)
	route("DELETE /v1/locations/{name}/worktrees/{worktree}", b.removeWorktree)
	route("POST /v1/tasks", b.addTask)
	route("GET /v1/services", b.handleServices)
	route("GET /v1/sessions", b.listSessions)
	route("POST /v1/sessions", b.addSession)
	route("DELETE /v1/sessions/{name}", b.removeSession)
	route("POST /v1/sessions/{name}/attach", b.attach)
	route("GET /v1/sessions/{name}/screen", b.screen)
	route("POST /v1/sessions/{name}/send", b.sendToSession)
	route("GET /v1/sessions/{name}/wait", b.waitForSession)
	route("POST /v1/exec", b.handleExec)
	route("GET /v1/hooks", b.getHooks)
	route("PUT /v1/hooks", b.putHooks)
	route("GET /v1/skills", b.listSkills)
	route("POST /v1/skills/install", b.installSkills)
	route("POST /v1/skills/uninstall", b.uninstallSkills)
	route("GET /v1/shares", b.listShares)
	route("POST /v1/shares", b.addShare)
	route("DELETE /v1/shares/{id}", b.removeShare)
	route("GET /v1/units", b.listUnits)
	route("POST /v1/units", b.addUnit)
	route("GET /v1/units/{name}", b.getUnit)
	route("DELETE /v1/units/{name}", b.removeUnit)
	route("POST /v1/units/{name}/restart", b.restartUnit)
	route("GET /v1/units/{name}/log", b.unitLog)
	route("GET /v1/stats", b.handleStats)
	route("GET /v1/info", b.handleInfo)
	route("GET /v1/doctor", b.handleDoctor)
	route("POST /v1/upgrade", b.handleUpgrade)
	route("GET /v1/events", b.streamEvents)
	route("POST /v1/events", b.emit)
}

type httpError struct {
	status int
	msg    string
}

func (e httpError) Error() string { return e.msg }

func badRequest(format string, args ...any) error {
	return httpError{http.StatusBadRequest, fmt.Sprintf(format, args...)}
}

func statusFor(err error) int {
	var he httpError
	switch {
	case errors.As(err, &he):
		return he.status
	case errors.Is(err, ErrUnknownLocation), errors.Is(err, ErrUnknownWorktree), errors.Is(err, ErrUnknownSession), errors.Is(err, ErrUnknownShare), errors.Is(err, ErrUnknownUnit):
		return http.StatusNotFound
	case errors.Is(err, ErrSessionExists):
		return http.StatusConflict
	}
	return http.StatusBadRequest
}

func origin(r *http.Request) string {
	if o := r.Header.Get(OriginHeader); validOrigin.MatchString(o) {
		return o
	}
	return "berth"
}

func (b *Box) publish(r *http.Request, typ string, data map[string]any) {
	b.Events.Publish(events.Event{Type: typ, Box: b.Name, Origin: origin(r), Data: data})
}

func decode(r *http.Request, v any) error {
	if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(v); err != nil {
		return badRequest("invalid request body")
	}
	return nil
}

func (b *Box) ports(w http.ResponseWriter, r *http.Request) error {
	ports, err := ListPorts(r.Context())
	if err != nil {
		return err
	}
	// berthd's own listener is not a service anyone should open or share.
	own := os.Getpid()
	visible := ports[:0]
	for _, p := range ports {
		if p.PID != own {
			visible = append(visible, p)
		}
	}
	writeJSON(w, visible)
	return nil
}

func (b *Box) listLocations(w http.ResponseWriter, r *http.Request) error {
	all, err := b.Locations.List(r.Context())
	if err != nil {
		return err
	}
	writeJSON(w, all)
	return nil
}

func (b *Box) addLocation(w http.ResponseWriter, r *http.Request) error {
	var req struct{ Name, Path string }
	if err := decode(r, &req); err != nil {
		return err
	}
	if err := b.before(r, "location.add", map[string]any{"location": req.Name, "path": req.Path}); err != nil {
		return err
	}
	loc, err := b.Locations.Add(r.Context(), req.Name, req.Path)
	if err != nil {
		return err
	}
	b.publish(r, "location.added", map[string]any{"location": loc.Name, "path": loc.Path})
	writeJSON(w, loc)
	return nil
}

func (b *Box) setScripts(w http.ResponseWriter, r *http.Request) error {
	var req struct{ Setup, Archive string }
	if err := decode(r, &req); err != nil {
		return err
	}
	if err := b.Locations.SetScripts(r.PathValue("name"), req.Setup, req.Archive); err != nil {
		return err
	}
	loc, err := b.Locations.Get(r.Context(), r.PathValue("name"))
	if err != nil {
		return err
	}
	writeJSON(w, loc)
	return nil
}

func (b *Box) removeLocation(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	if err := b.Locations.Remove(name); err != nil {
		return err
	}
	b.publish(r, "location.removed", map[string]any{"location": name})
	writeJSON(w, map[string]string{"removed": name})
	return nil
}

func (b *Box) addWorktree(w http.ResponseWriter, r *http.Request) error {
	var req WorktreeRequest
	if err := decode(r, &req); err != nil {
		return err
	}
	loc, err := b.Locations.Get(r.Context(), r.PathValue("name"))
	if err != nil {
		return err
	}
	wt, err := b.createWorktree(r, loc, req)
	if err != nil {
		return err
	}
	writeJSON(w, wt)
	return nil
}

// createWorktree makes a git worktree once the hooks allow it, then runs the
// location's setup script in the background.
func (b *Box) createWorktree(r *http.Request, loc Location, req WorktreeRequest) (Worktree, error) {
	if err := b.before(r, "worktree.create", map[string]any{
		"location": loc.Name, "name": req.Name, "branch": req.Branch, "base": req.Base,
	}); err != nil {
		return Worktree{}, err
	}
	wt, err := b.Locations.CreateWorktreeFrom(r.Context(), loc.Name, req)
	if err != nil {
		return Worktree{}, err
	}
	b.own(wt.Path)
	b.publish(r, "worktree.created", map[string]any{
		"location": loc.Name, "name": wt.Name, "path": wt.Path, "branch": wt.Branch,
	})
	// Services start once setup has made the worktree ready for them.
	if loc.Scripts.Setup != "" {
		go b.lifecycle(origin(r), "setup", loc, wt.Path, wt.Name, loc.Scripts.Setup, func() error {
			go b.startAutostart(loc.Name, wt.Name)
			return nil
		})
	} else {
		go b.startAutostart(loc.Name, wt.Name)
	}
	return wt, nil
}

// lifecycle runs a setup or archive script in the background, announcing its
// start and outcome, then calls next if it succeeded.
func (b *Box) lifecycle(from, kind string, loc Location, dir, name, script string, next func() error) {
	data := map[string]any{"location": loc.Name, "name": name, "path": dir, "script": script}
	b.Events.Publish(events.Event{Type: "worktree." + kind + ".started", Box: b.Name, Origin: from, Data: data})
	logPath := filepath.Join(b.LogDir, kind+"-"+loc.Name+"-"+name+".log")
	data["log"] = logPath
	err := runScript(context.Background(), script, loc.Path, dir, name, logPath, 30*time.Minute, b.envForDir(context.Background(), dir))
	if err == nil && next != nil {
		err = next()
	}
	if err != nil {
		b.Events.Publish(events.Event{Type: "worktree." + kind + ".failed", Box: b.Name, Origin: from, Error: err.Error(), Data: data})
		return
	}
	b.Events.Publish(events.Event{Type: "worktree." + kind + ".finished", Box: b.Name, Origin: from, Data: data})
}

func (b *Box) removeWorktree(w http.ResponseWriter, r *http.Request) error {
	location, name := r.PathValue("name"), r.PathValue("worktree")
	dir, err := b.Locations.Dir(r.Context(), location+"/"+name)
	if err != nil {
		return err
	}
	if err := b.before(r, "worktree.remove", map[string]any{"location": location, "name": name, "path": dir}); err != nil {
		return err
	}
	b.own(dir)
	force := r.URL.Query().Get("force") == "1"
	loc, err := b.Locations.Get(r.Context(), location)
	if err != nil {
		return err
	}
	// Only throwaway worktrees ask for their branch to go too.
	var branch string
	if r.URL.Query().Get("delete_branch") == "1" {
		for _, wt := range loc.Worktrees {
			if wt.Path == dir && !wt.Main {
				branch = wt.Branch
			}
		}
	}
	b.stopServices(location, name)
	removed := func(ctx context.Context) {
		b.Locations.Ports.Release(dir)
		if branch != "" {
			git(ctx, "-C", loc.Path, "branch", "-D", branch)
		}
	}
	// A worktree with an archive script is torn down in the background: the
	// script may take minutes, and removal only follows if it succeeds.
	if loc.Scripts.Archive != "" {
		from := origin(r)
		go b.lifecycle(from, "archive", loc, dir, name, loc.Scripts.Archive, func() error {
			if err := b.Locations.RemoveWorktree(context.Background(), location, name, force); err != nil {
				return err
			}
			removed(context.Background())
			b.Events.Publish(events.Event{Type: "worktree.removed", Box: b.Name, Origin: from, Data: map[string]any{"location": location, "name": name, "path": dir}})
			return nil
		})
		w.WriteHeader(http.StatusAccepted)
		writeJSON(w, map[string]string{"removing": name, "archive": loc.Scripts.Archive})
		return nil
	}
	if err := b.Locations.RemoveWorktree(r.Context(), location, name, force); err != nil {
		return err
	}
	removed(context.WithoutCancel(r.Context()))
	b.publish(r, "worktree.removed", map[string]any{"location": location, "name": name, "path": dir})
	writeJSON(w, map[string]string{"removed": name})
	return nil
}

func (b *Box) listSessions(w http.ResponseWriter, r *http.Request) error {
	all, err := b.Sessions.List(r.Context())
	if err != nil {
		return err
	}
	writeJSON(w, b.enrich(r.Context(), all))
	return nil
}

func (b *Box) addSession(w http.ResponseWriter, r *http.Request) error {
	var req struct {
		Name     string `json:"name"`
		Location string `json:"location"`
		Command  string `json:"command"`
	}
	if err := decode(r, &req); err != nil {
		return err
	}
	dir, err := b.Locations.Dir(r.Context(), req.Location)
	if err != nil {
		return err
	}
	if req.Name == "" {
		req.Name = defaultSessionName(req.Location, req.Command)
	}
	sess, err := b.startSession(r, req.Name, req.Location, dir, req.Command)
	if err != nil {
		return err
	}
	writeJSON(w, sess)
	return nil
}

// startSession runs command in dir once the hooks allow it.
func (b *Box) startSession(r *http.Request, name, location, dir, command string) (Session, error) {
	data := map[string]any{"name": name, "location": location, "path": dir, "command": command}
	if err := b.before(r, "session.start", data); err != nil {
		return Session{}, err
	}
	sess, err := b.Sessions.Create(r.Context(), name, location, dir, command, b.envForDir(r.Context(), dir))
	if err != nil {
		return Session{}, err
	}
	b.publish(r, "session.started", data)
	sess = b.enrich(r.Context(), []Session{sess})[0]
	if sess.Agent != "" {
		go b.watchStartup(origin(r), sess)
	}
	return sess, nil
}

func (b *Box) removeSession(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("name")
	if err := b.before(r, "session.stop", map[string]any{"name": name}); err != nil {
		return err
	}
	if err := b.Sessions.Kill(r.Context(), name); err != nil {
		return err
	}
	b.publish(r, "session.stopped", map[string]any{"name": name})
	writeJSON(w, map[string]string{"removed": name})
	return nil
}

// attach relays a terminal: framed keystrokes and resizes in, screen bytes
// out. Ending the request detaches; the session keeps running.
func (b *Box) attach(w http.ResponseWriter, r *http.Request) error {
	cols, _ := strconv.Atoi(r.URL.Query().Get("cols"))
	rows, _ := strconv.Atoi(r.URL.Query().Get("rows"))
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	master, cmd, err := b.Sessions.Attach(ctx, r.PathValue("name"), max(cols, 20), max(rows, 5))
	if err != nil {
		return err
	}
	defer cmd.Wait()
	defer master.Close()
	rc := http.NewResponseController(w)
	rc.EnableFullDuplex()
	w.WriteHeader(http.StatusOK)
	if err := rc.Flush(); err != nil {
		return nil
	}
	go func() {
		terminal.ReadFrames(r.Body,
			func(p []byte) error { _, err := master.Write(p); return err },
			func(c, rr int) { terminal.Resize(master, c, rr) })
		// The laptop went away: hang up the tmux client, not the session.
		cancel()
		master.Close()
	}()
	buf := make([]byte, 32<<10)
	for {
		n, err := master.Read(buf)
		if n > 0 {
			if _, werr := w.Write(buf[:n]); werr != nil {
				return nil
			}
			rc.Flush()
		}
		if err != nil {
			return nil
		}
	}
}

func (b *Box) screen(w http.ResponseWriter, r *http.Request) error {
	history, _ := strconv.Atoi(r.URL.Query().Get("history"))
	text, err := b.Sessions.Screen(r.Context(), r.PathValue("name"), min(history, 10000))
	if err != nil {
		return err
	}
	writeJSON(w, map[string]string{"screen": text})
	return nil
}

func (b *Box) listShares(w http.ResponseWriter, r *http.Request) error {
	writeJSON(w, b.Shares.List())
	return nil
}

func (b *Box) addShare(w http.ResponseWriter, r *http.Request) error {
	var req struct{ Port int }
	if err := decode(r, &req); err != nil {
		return err
	}
	sh, err := b.Shares.Create(r.Context(), req.Port)
	if err != nil {
		return err
	}
	b.publish(r, "share.started", map[string]any{"id": sh.ID, "port": sh.Port, "url": sh.URL})
	writeJSON(w, sh)
	return nil
}

func (b *Box) removeShare(w http.ResponseWriter, r *http.Request) error {
	sh, err := b.Shares.Remove(r.PathValue("id"))
	if err != nil {
		return err
	}
	b.publish(r, "share.stopped", map[string]any{"id": sh.ID, "port": sh.Port, "url": sh.URL})
	writeJSON(w, sh)
	return nil
}

func (b *Box) units() (*Units, error) {
	if b.Units == nil {
		return nil, badRequest("this box cannot run managed units")
	}
	return b.Units, nil
}

func (b *Box) listUnits(w http.ResponseWriter, r *http.Request) error {
	u, err := b.units()
	if err != nil {
		return err
	}
	all, err := u.List()
	if err != nil {
		return err
	}
	writeJSON(w, all)
	return nil
}

func (b *Box) addUnit(w http.ResponseWriter, r *http.Request) error {
	u, err := b.units()
	if err != nil {
		return err
	}
	var req UnitRequest
	if err := decode(r, &req); err != nil {
		return err
	}
	unit, err := u.Install(r.Context(), req)
	if err != nil {
		return err
	}
	// The unit's name only; its arguments can carry credentials.
	b.publish(r, "unit.started", map[string]any{"name": unit.Name})
	writeJSON(w, unit)
	return nil
}

func (b *Box) getUnit(w http.ResponseWriter, r *http.Request) error {
	u, err := b.units()
	if err != nil {
		return err
	}
	unit, err := u.Get(r.PathValue("name"))
	if err != nil {
		return err
	}
	writeJSON(w, unit)
	return nil
}

func (b *Box) removeUnit(w http.ResponseWriter, r *http.Request) error {
	u, err := b.units()
	if err != nil {
		return err
	}
	unit, err := u.Remove(r.PathValue("name"))
	if err != nil {
		return err
	}
	b.publish(r, "unit.stopped", map[string]any{"name": unit.Name})
	writeJSON(w, unit)
	return nil
}

func (b *Box) restartUnit(w http.ResponseWriter, r *http.Request) error {
	u, err := b.units()
	if err != nil {
		return err
	}
	unit, err := u.Restart(r.PathValue("name"))
	if err != nil {
		return err
	}
	b.publish(r, "unit.restarted", map[string]any{"name": unit.Name})
	writeJSON(w, unit)
	return nil
}

func (b *Box) unitLog(w http.ResponseWriter, r *http.Request) error {
	u, err := b.units()
	if err != nil {
		return err
	}
	limit := int64(1 << 20)
	if v := r.URL.Query().Get("limit"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n <= 0 || n > 1<<20 {
			return badRequest("limit must be between 1 and %d", 1<<20)
		}
		limit = n
	}
	out, err := u.Tail(r.PathValue("name"), limit)
	if err != nil {
		return err
	}
	// A []byte marshals as base64, so a log holding arbitrary bytes survives
	// the round trip that a plain string would corrupt.
	writeJSON(w, map[string][]byte{"log": out})
	return nil
}

func (b *Box) streamEvents(w http.ResponseWriter, r *http.Request) error {
	ch, stop := b.Events.Subscribe()
	defer stop()
	rc := http.NewResponseController(w)
	w.Header().Set("Content-Type", "application/x-ndjson")
	w.WriteHeader(http.StatusOK)
	rc.Flush()
	enc := json.NewEncoder(w)
	keepalive := time.NewTicker(25 * time.Second)
	defer keepalive.Stop()
	for {
		select {
		case <-r.Context().Done():
			return nil
		case e := <-ch:
			if enc.Encode(e) != nil || rc.Flush() != nil {
				return nil
			}
		case <-keepalive.C:
			if _, err := w.Write([]byte("\n")); err != nil || rc.Flush() != nil {
				return nil
			}
		}
	}
}

// emit lets tools announce their own events, such as an agent finishing in
// Cursor, so hooks and the laptop can react to them.
func (b *Box) emit(w http.ResponseWriter, r *http.Request) error {
	var req struct {
		Type string         `json:"type"`
		Data map[string]any `json:"data"`
	}
	if err := decode(r, &req); err != nil {
		return err
	}
	if !validEventType.MatchString(req.Type) {
		return badRequest("event type must look like area.action, e.g. agent.finished")
	}
	b.publish(r, req.Type, req.Data)
	writeJSON(w, map[string]bool{"ok": true})
	return nil
}

var validEventType = regexp.MustCompile(`^[a-z][a-z0-9-]{0,31}\.[a-z][a-z0-9-]{0,31}$`)

var unsafeSessionChars = regexp.MustCompile(`[^A-Za-z0-9_-]+`)

// defaultSessionName names a session after where it runs and what it runs,
// e.g. "cal-billing-claude".
func defaultSessionName(location, command string) string {
	prog := "shell"
	if f := splitFirst(command); f != "" {
		prog = filepath.Base(f)
	}
	name := unsafeSessionChars.ReplaceAllString(location+"-"+prog, "-")
	if len(name) > 48 {
		name = name[:48]
	}
	return name + "-" + strconv.FormatInt(time.Now().Unix()%100000, 36)
}

func splitFirst(command string) string {
	for i, r := range command {
		if r == ' ' || r == '\t' {
			return command[:i]
		}
	}
	return command
}

// writeJSON sends v, with an empty list as [] rather than null: every list
// the box answers with is one the app and plugins iterate over.
func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if rv := reflect.ValueOf(v); rv.Kind() == reflect.Slice && rv.IsNil() {
		v = []struct{}{}
	}
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
