package agent

import (
	"context"
	"net/http"
	"os"
	"runtime"
	"sync"
	"time"

	"github.com/cosscom/shipyard/internal/doctor"
	"github.com/cosscom/shipyard/internal/version"
)

// DoctorReport answers GET /v1/doctor: `berth doctor`'s checks of this
// laptop and what the agent is, for the app's Copy diagnostics.
type DoctorReport struct {
	Version string         `json:"version"`
	Build   string         `json:"build,omitempty"`
	OS      string         `json:"os"`
	Arch    string         `json:"arch"`
	Home    string         `json:"home,omitempty"`
	Checks  []doctor.Check `json:"checks"`
}

var agentBuild = sync.OnceValue(func() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	b, err := os.ReadFile(exe)
	if err != nil {
		return ""
	}
	return version.BuildID(b)
})

func (a *Agent) doctorRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/doctor", func(w http.ResponseWriter, r *http.Request) {
		home, _ := os.UserHomeDir()
		rep := DoctorReport{Version: version.Version, Build: agentBuild(), OS: doctor.HostOS(r.Context()), Arch: runtime.GOARCH, Home: home, Checks: []doctor.Check{}}
		if a.cfg.Doctor != nil {
			// The checks ask this agent and port 80 a few things; none waits
			// long, and the app gives up before this does.
			ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
			defer cancel()
			rep.Checks = a.cfg.Doctor(ctx)
		}
		writeJSON(w, http.StatusOK, rep)
	})
}
