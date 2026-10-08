package agent

import (
	"errors"
	"net/http"
)

func (a *Agent) localChatRoutes(handle func(string, http.HandlerFunc)) {
	handle("POST /v1/local/chats", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			CWD string `json:"cwd"`
		}
		if !decodeBody(w, r, &req) {
			return
		}
		a.localClient.launchMu.Lock()
		defer a.localClient.launchMu.Unlock()
		done, err := a.work.begin("starting a local Codex chat")
		if err != nil {
			writeCoded(w, 503, err.Error(), "agent_restarting")
			return
		}
		defer done()
		s, err := a.localClient.chats.Start(r.Context(), req.CWD)
		if err != nil {
			localClientError(w, err)
			return
		}
		writeJSON(w, 201, s)
	})
	handle("GET /v1/local/chats/{id}", func(w http.ResponseWriter, r *http.Request) {
		s, err := a.localClient.chats.Get(r.PathValue("id"))
		if err != nil {
			localClientError(w, err)
			return
		}
		writeJSON(w, 200, s)
	})
	handle("POST /v1/local/chats/{id}/messages", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Text string `json:"text"`
		}
		if !decodeBody(w, r, &req) {
			return
		}
		if err := a.localClient.chats.Send(r.Context(), r.PathValue("id"), req.Text); err != nil {
			localClientError(w, err)
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	})
	handle("POST /v1/local/chats/{id}/interrupt", func(w http.ResponseWriter, r *http.Request) {
		if err := a.localClient.chats.Interrupt(r.Context(), r.PathValue("id")); err != nil {
			localClientError(w, err)
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	})
	handle("POST /v1/local/chats/{id}/approvals", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ID       string `json:"id"`
			Decision string `json:"decision"`
		}
		if !decodeBody(w, r, &req) {
			return
		}
		if err := a.localClient.chats.Decide(r.PathValue("id"), req.ID, req.Decision); err != nil {
			localClientError(w, err)
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	})
	handle("DELETE /v1/local/chats/{id}", func(w http.ResponseWriter, r *http.Request) {
		if err := a.localClient.chats.Stop(r.PathValue("id")); err != nil {
			localClientError(w, err)
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	})
}

func (a *Agent) prepareLocalRestart() error {
	a.localClient.launchMu.Lock()
	defer a.localClient.launchMu.Unlock()
	if a.localClient.chats != nil {
		for _, s := range a.localClient.chats.List() {
			if s.State != "exited" {
				return errors.New("stop local Codex chats before restarting Burf")
			}
		}
	}
	if err := a.localClient.manager.PrepareRestart(); err != nil {
		return err
	}
	if a.localClient.chats != nil {
		return a.localClient.chats.PrepareRestart()
	}
	return nil
}
