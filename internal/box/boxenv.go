package box

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/MylesMCook/burf/internal/statefile"
)

// The box's own environment, ~/.berth/env.json: variables every worktree on
// the box gets, under the project's own. It is how a box picks a default,
// such as which Claude Code or Codex account new sessions use.

// BoxEnv is ~/.berth/env.json.
type BoxEnv struct {
	Env map[string]string `json:"env"`
}

func loadBoxEnv(path string) (BoxEnv, error) {
	var e BoxEnv
	if path == "" {
		return e, nil
	}
	b, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return e, nil
	}
	if err != nil {
		return e, err
	}
	if err := json.Unmarshal(b, &e); err != nil {
		return e, fmt.Errorf("%s: %w", path, err)
	}
	return e, nil
}

func saveBoxEnv(path string, e BoxEnv) error {
	for k := range e.Env {
		if !envName.MatchString(k) {
			return fmt.Errorf("%q is not an environment variable name", k)
		}
	}
	if err := validateEnvRefs(e.Env); err != nil {
		return err
	}
	if e.Env == nil {
		e.Env = map[string]string{}
	}
	b, err := json.MarshalIndent(e, "", "  ")
	if err != nil {
		return err
	}
	return statefile.Write(path, append(b, '\n'))
}

type boxEnvDoc struct {
	Path string            `json:"path"`
	Env  map[string]string `json:"env"`
}

func (b *Box) getBoxEnv(w http.ResponseWriter, r *http.Request) error {
	if b.EnvFile == "" {
		return httpError{http.StatusNotImplemented, "this box has no environment file"}
	}
	e, err := loadBoxEnv(b.EnvFile)
	if err != nil {
		return err
	}
	if e.Env == nil {
		e.Env = map[string]string{}
	}
	writeJSON(w, boxEnvDoc{Path: b.EnvFile, Env: e.Env})
	return nil
}

func (b *Box) putBoxEnv(w http.ResponseWriter, r *http.Request) error {
	if b.EnvFile == "" {
		return httpError{http.StatusNotImplemented, "this box has no environment file"}
	}
	var doc boxEnvDoc
	if err := decode(r, &doc); err != nil {
		return err
	}
	if err := b.before(r, "config.change", map[string]any{"env": len(doc.Env)}); err != nil {
		return err
	}
	if err := saveBoxEnv(b.EnvFile, BoxEnv{Env: doc.Env}); err != nil {
		return badRequest("%v", err)
	}
	b.publish(r, "config.changed", map[string]any{"env": len(doc.Env)})
	return b.getBoxEnv(w, r)
}
