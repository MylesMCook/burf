package box

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/sean-brydon/berthd/internal/box/runs"
	"github.com/sean-brydon/berthd/internal/events"
	"github.com/sean-brydon/berthd/internal/statefile"
)

// "Auto-fix this PR": one toggle per worktree that has its pull request's
// failed checks (the fix-ci template) and new review comments (the
// address-review template, comments merged while it works) handed to the
// worktree's agent, within a cap of runs per day.

// AutoFix is one worktree's settings.
type AutoFix struct {
	Path string `json:"path"`
	// CI fixes failed checks; Review addresses review comments.
	CI     bool `json:"ci"`
	Review bool `json:"review"`
	// Check is a local check to pass before pushing (default none).
	Check string `json:"check,omitempty"`
	// Max is how many runs a day each may start (default 3).
	Max   int    `json:"max,omitempty"`
	Agent string `json:"agent,omitempty"`
}

// AutoFixStore keeps every worktree's AutoFix.
type AutoFixStore struct {
	Path string
	mu   sync.Mutex
}

func (s *AutoFixStore) load() map[string]AutoFix {
	out := map[string]AutoFix{}
	if s == nil || s.Path == "" {
		return out
	}
	if b, err := os.ReadFile(s.Path); err == nil {
		json.Unmarshal(b, &out)
	}
	return out
}

// List returns every worktree's settings.
func (s *AutoFixStore) List() []AutoFix {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []AutoFix{}
	for _, a := range s.load() {
		out = append(out, a)
	}
	return out
}

// Put saves one worktree's settings; both off removes them.
func (s *AutoFixStore) Put(a AutoFix) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	all := s.load()
	a.Path = filepath.Clean(a.Path)
	if !a.CI && !a.Review {
		delete(all, a.Path)
	} else {
		all[a.Path] = a
	}
	b, err := json.Marshal(all)
	if err != nil {
		return err
	}
	return statefile.Write(s.Path, b)
}

// autoFlow is an AutoFix acting as a flow.
type autoFlow struct {
	path     string
	template string
	fix      AutoFix
}

func (a *autoFlow) params(e events.Event, session string) map[string]any {
	p := map[string]any{"session": session}
	if a.fix.Check != "" {
		p["check"] = a.fix.Check
	}
	if a.fix.Agent != "" {
		p["agent"] = a.fix.Agent
	}
	if a.template == "fix-ci" {
		p["check_url"], _ = e.Data["url"].(string)
		p["check_name"], _ = e.Data["check"].(string)
	}
	return p
}

// autofixFlows are the toggles turned on, as GitHub flows each limited to
// its worktree.
func (b *Box) autofixFlows(ctx context.Context) []ScopedFlow {
	if b.AutoFix == nil {
		return nil
	}
	var out []ScopedFlow
	for _, a := range b.AutoFix.List() {
		loc, wt, ok := b.worktreeAt(ctx, a.Path)
		if !ok {
			continue
		}
		add := func(id, on, template string) {
			out = append(out, ScopedFlow{Scope: "repo:" + loc.Name, Source: "autofix", Flow: Flow{
				ID: id, Name: "Auto-fix " + wt.Name, Enabled: true, Coalesce: template == "address-review", Queue: 1,
				MaxRunsPerHour: max(a.Max, 3), Trigger: Trigger{GitHub: &GitHubTrigger{On: on}, Where: Where{Branch: wt.Branch}},
			}, autofix: &autoFlow{path: wt.Path, template: template, fix: a}})
		}
		if a.CI {
			add("autofix-ci", "check_failed", "fix-ci")
		}
		if a.Review {
			add("autofix-review", "review_comment", "address-review")
		}
	}
	return out
}

// autofixAllowed applies a toggle's daily cap; past it, says so once.
func (b *Box) autofixAllowed(sf ScopedFlow) bool {
	a := sf.autofix
	limit := a.fix.Max
	if limit <= 0 {
		limit = 3
	}
	key := sf.Scope + "/" + sf.Flow.ID + "@" + a.path
	n := 0
	for _, s := range b.runsEngine(context.Background()).List(runs.Filter{Key: key, Limit: 50}) {
		if time.Since(s.Created) < 24*time.Hour {
			n++
		}
	}
	if n < limit {
		return true
	}
	if n == limit {
		b.Events.Publish(events.Event{Type: "notify", Box: b.Name, Origin: "autofix", Data: map[string]any{
			"title": "Auto-fix paused", "body": "It started " + itoa(limit) + " runs today for " + filepath.Base(a.path) + "; it starts again tomorrow.", "path": a.path,
		}})
	}
	return false
}

func itoa(n int) string { b, _ := json.Marshal(n); return string(b) }

func (b *Box) listAutoFix(w http.ResponseWriter, r *http.Request) error {
	if b.AutoFix == nil {
		writeJSON(w, []AutoFix{})
		return nil
	}
	writeJSON(w, b.AutoFix.List())
	return nil
}

func (b *Box) putAutoFix(w http.ResponseWriter, r *http.Request) error {
	if b.AutoFix == nil {
		return httpError{http.StatusNotFound, "this box has no auto-fix"}
	}
	var a AutoFix
	if err := decode(r, &a); err != nil {
		return err
	}
	if _, _, ok := b.worktreeAt(r.Context(), a.Path); !ok {
		return badRequest("%s is not a worktree", a.Path)
	}
	if a.Max < 0 || a.Max > 20 {
		return badRequest("max must be from 1 to 20")
	}
	if err := b.before(r, "config.change", map[string]any{"autofix": a.Path}); err != nil {
		return err
	}
	if err := b.AutoFix.Put(a); err != nil {
		return err
	}
	b.publish(r, "config.changed", map[string]any{"autofix": a.Path, "ci": a.CI, "review": a.Review})
	return b.listAutoFix(w, r)
}
