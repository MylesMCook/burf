package agent

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"

	"github.com/cosscom/shipyard/internal/statefile"
)

// The app keeps what people set up by hand across boxes — project names and
// groups, a project's default box — on this laptop rather than in the
// webview's storage, so it survives reinstalling the app and is there for
// the CLI too. Each key is one JSON document in ~/.berth/app/<key>.json.

var appKey = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,47}$`)

const maxAppDoc = 1 << 20

func (a *Agent) appStateRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/app/{key}", func(w http.ResponseWriter, r *http.Request) {
		key := r.PathValue("key")
		if !appKey.MatchString(key) {
			writeError(w, http.StatusBadRequest, "invalid key")
			return
		}
		b, err := os.ReadFile(filepath.Join(a.cfg.UserDir, "app", key+".json"))
		if os.IsNotExist(err) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte("null"))
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(b)
	})
	mux.HandleFunc("PUT /v1/app/{key}", func(w http.ResponseWriter, r *http.Request) {
		key := r.PathValue("key")
		if !appKey.MatchString(key) {
			writeError(w, http.StatusBadRequest, "invalid key")
			return
		}
		b, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxAppDoc))
		if err != nil || !json.Valid(b) {
			writeError(w, http.StatusBadRequest, "the body must be JSON, at most 1 MB")
			return
		}
		if err := statefile.Write(filepath.Join(a.cfg.UserDir, "app", key+".json"), b); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		a.publish(Event{Type: "app.changed", Data: map[string]any{"key": key}})
		w.Header().Set("Content-Type", "application/json")
		w.Write(b)
	})
}
