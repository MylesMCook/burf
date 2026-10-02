package box

import (
	"net/http"
	"path/filepath"
	"sort"
	"strings"
)

// Service is a listening port that belongs to a worktree, found by where its
// process runs: Next.js in ~/work/cal-billing/apps/web serves cal/billing.
type Service struct {
	Location string `json:"location"`
	Worktree string `json:"worktree"`
	Path     string `json:"path"`
	Port     int    `json:"port"`
	Process  string `json:"process,omitempty"`
	// Main marks the location's own checkout, reachable as LOCATION.BOX.
	Main bool `json:"main,omitempty"`
}

// Services joins listening ports with location worktrees. A port in a
// worktree's own block ($BERTH_PORT…) is that worktree's, whatever runs it;
// otherwise a process belongs to the deepest worktree containing its folder.
func Services(ports []Port, locations []Location) []Service {
	type tree struct {
		location, name, path string
		main                 bool
		port                 int
	}
	var trees []tree
	for _, l := range locations {
		if !l.Repo {
			trees = append(trees, tree{location: l.Name, name: l.Name, path: l.Path, main: true})
			continue
		}
		for _, w := range l.Worktrees {
			trees = append(trees, tree{l.Name, w.Name, w.Path, w.Main, w.Port})
		}
	}
	sort.Slice(trees, func(i, j int) bool { return len(trees[i].path) > len(trees[j].path) })
	var out []Service
next:
	for _, p := range ports {
		for _, t := range trees {
			if t.port > 0 && p.Port >= t.port && p.Port < t.port+portBlock {
				out = append(out, Service{Location: t.location, Worktree: t.name, Path: t.path, Port: p.Port, Process: p.Command, Main: t.main})
				continue next
			}
		}
		if p.Dir == "" {
			continue
		}
		for _, t := range trees {
			if p.Dir == t.path || strings.HasPrefix(p.Dir, t.path+string(filepath.Separator)) {
				out = append(out, Service{Location: t.location, Worktree: t.name, Path: t.path, Port: p.Port, Process: p.Command, Main: t.main})
				break
			}
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Port < out[j].Port })
	return out
}

func (b *Box) handleServices(w http.ResponseWriter, r *http.Request) error {
	ports, err := ListPorts(r.Context())
	if err != nil {
		return err
	}
	locs, err := b.Locations.List(r.Context())
	if err != nil {
		return err
	}
	writeJSON(w, Services(ports, locs))
	return nil
}

// Tools reports which agent CLIs this box has.
func Tools() []string {
	var have []string
	for _, t := range []string{"claude", "codex", "opencode", "gemini", "pi"} {
		if _, err := toolPath(t); err == nil {
			have = append(have, t)
		}
	}
	return have
}
