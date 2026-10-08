package agent

import (
	"context"
	"errors"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"sync"

	"github.com/MylesMCook/burf/internal/localagent"
	"github.com/MylesMCook/burf/internal/localhistory"
	"github.com/MylesMCook/burf/internal/localpty"
)

type localClient struct {
	once     sync.Once
	manager  *localagent.Manager
	history  *localhistory.Store
	commands map[string]localagent.Command
}

func (a *Agent) initLocalClient() {
	a.localClient.once.Do(func() {
		a.localClient.commands = localAgentCommands()
		a.localClient.history = localhistory.New(localhistory.Config{})
		a.localClient.manager = localagent.New(a.localClient.commands, func(program string, args []string, dir string, env []string, cols, rows int) (localagent.Process, error) {
			return localpty.Start(program, args, dir, env, cols, rows)
		})
	})
}

func (a *Agent) localClientRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/local", func(w http.ResponseWriter, r *http.Request) {
		if runtime.GOOS != "windows" {
			writeJSON(w, http.StatusOK, map[string]any{"supported": false})
			return
		}
		a.initLocalClient()
		name, _ := os.Hostname()
		home, _ := os.UserHomeDir()
		agents := make([]map[string]any, 0, 2)
		for _, id := range []string{"claude", "codex"} {
			command := a.localClient.commands[id]
			agents = append(agents, map[string]any{"id": id, "available": command.Program != "", "can_fork": command.CanFork})
		}
		writeJSON(w, http.StatusOK, map[string]any{"supported": true, "name": name, "home": home, "agents": agents, "sessions": a.localClient.manager.List()})
	})
	handle := func(pattern string, fn http.HandlerFunc) {
		mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
			if runtime.GOOS != "windows" {
				writeError(w, http.StatusNotImplemented, "native local sessions are available on Windows only")
				return
			}
			a.initLocalClient()
			fn(w, r)
		})
	}
	handle("GET /v1/local/conversations", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithCancel(r.Context())
		defer cancel()
		list, err := a.localClient.history.List(ctx)
		if err != nil {
			localClientError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, list)
	})
	handle("GET /v1/local/conversations/{id}", func(w http.ResponseWriter, r *http.Request) {
		before := int64(0)
		if raw := r.URL.Query().Get("before"); raw != "" {
			var err error
			before, err = strconv.ParseInt(raw, 10, 64)
			if err != nil || before < 0 {
				writeError(w, 400, "invalid history cursor")
				return
			}
		}
		result, err := a.localClient.history.Read(r.Context(), r.PathValue("id"), before)
		if err != nil {
			localClientError(w, err)
			return
		}
		writeJSON(w, 200, result)
	})
	handle("POST /v1/local/conversations/{id}/fork", func(w http.ResponseWriter, r *http.Request) {
		done, err := a.work.begin("continuing a local conversation")
		if err != nil {
			writeCoded(w, 503, err.Error(), "agent_restarting")
			return
		}
		defer done()
		s, err := a.localClient.manager.ForkFrom(r.Context(), func() (string, string, string, error) {
			source, err := a.localClient.history.Continuation(r.Context(), r.PathValue("id"))
			return source.Source, source.Cwd, source.SessionID, err
		})
		if err != nil {
			localClientError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, s)
	})
	handle("POST /v1/local/sessions", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Agent string `json:"agent"`
			CWD   string `json:"cwd"`
		}
		if !decodeBody(w, r, &req) {
			return
		}
		done, err := a.work.begin("starting a local agent")
		if err != nil {
			writeCoded(w, 503, err.Error(), "agent_restarting")
			return
		}
		defer done()
		s, err := a.localClient.manager.StartContext(r.Context(), req.Agent, req.CWD)
		if err != nil {
			localClientError(w, err)
			return
		}
		writeJSON(w, 201, s)
	})
	handle("GET /v1/local/sessions/{id}/output", func(w http.ResponseWriter, r *http.Request) {
		after := int64(0)
		if raw := r.URL.Query().Get("after"); raw != "" {
			var err error
			after, err = strconv.ParseInt(raw, 10, 64)
			if err != nil || after < 0 {
				writeError(w, 400, "invalid terminal cursor")
				return
			}
		}
		out, err := a.localClient.manager.Output(r.PathValue("id"), after)
		if err != nil {
			localClientError(w, err)
			return
		}
		writeJSON(w, 200, out)
	})
	handle("POST /v1/local/sessions/{id}/input", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Data string `json:"data"`
		}
		if !decodeBody(w, r, &req) {
			return
		}
		if err := a.localClient.manager.Input(r.PathValue("id"), req.Data); err != nil {
			localClientError(w, err)
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	})
	handle("POST /v1/local/sessions/{id}/resize", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Cols int `json:"cols"`
			Rows int `json:"rows"`
		}
		if !decodeBody(w, r, &req) {
			return
		}
		if err := a.localClient.manager.Resize(r.PathValue("id"), req.Cols, req.Rows); err != nil {
			localClientError(w, err)
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	})
	handle("DELETE /v1/local/sessions/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := a.localClient.manager.Stop(r.PathValue("id")); err != nil {
			localClientError(w, err)
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	})
}

func localClientError(w http.ResponseWriter, err error) {
	status := http.StatusBadRequest
	if errors.Is(err, localagent.ErrNotFound) || errors.Is(err, localhistory.ErrNotFound) {
		status = http.StatusNotFound
	}
	writeError(w, status, err.Error())
}
