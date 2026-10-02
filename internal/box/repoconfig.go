package box

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/sean-brydon/berth/internal/hooks"
	"github.com/sean-brydon/berth/internal/statefile"
)

// What a repository asks of every worktree: its own ports, environment,
// services and hooks. A repository can commit this in .berth/config.json,
// and a box can add to it or override it for that location alone, for what
// should not be committed (a database password, a box's own paths).

// WorktreeService is a long-running program each worktree runs, such as its dev
// server. It gets the worktree's environment, so it can listen on
// $BERTH_PORT.
type WorktreeService struct {
	Name string `json:"name"`
	Run  string `json:"run"`
	// Autostart starts it when the worktree is created, after setup.
	Autostart bool `json:"autostart,omitempty"`
}

var serviceName = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,31}$`)

// validate reports what is wrong with config someone wrote.
func (c RepoConfig) validate() error {
	if c.Ports < 0 || c.Ports > maxPortsPerWorktree {
		return fmt.Errorf("ports must be between 0 and %d", maxPortsPerWorktree)
	}
	seen := map[string]bool{}
	for _, s := range c.Services {
		if !serviceName.MatchString(s.Name) {
			return fmt.Errorf("service name %q must be lowercase letters, digits and dashes", s.Name)
		}
		if seen[s.Name] {
			return fmt.Errorf("two services are called %s", s.Name)
		}
		seen[s.Name] = true
		if strings.TrimSpace(s.Run) == "" {
			return fmt.Errorf("service %s has nothing to run", s.Name)
		}
	}
	for k := range c.Env {
		if !envName.MatchString(k) {
			return fmt.Errorf("%q is not an environment variable name", k)
		}
	}
	return hooks.Validate(c.Hooks)
}

var envName = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// merge lays local over repo: scalars and env entries replace, services and
// agents replace by name, and hooks add up.
func merge(repo, local RepoConfig) RepoConfig {
	out := repo
	if local.Setup != "" {
		out.Setup = local.Setup
	}
	if local.Archive != "" {
		out.Archive = local.Archive
	}
	if local.Ports != 0 {
		out.Ports = local.Ports
	}
	if len(local.Env) > 0 {
		out.Env = map[string]string{}
		for k, v := range repo.Env {
			out.Env[k] = v
		}
		for k, v := range local.Env {
			out.Env[k] = v
		}
	}
	out.Services = mergeBy(repo.Services, local.Services, func(s WorktreeService) string { return s.Name })
	out.Agents = mergeBy(repo.Agents, local.Agents, func(a AgentPreset) string { return a.ID })
	out.Hooks = append(append([]hooks.Hook{}, repo.Hooks...), local.Hooks...)
	return out
}

func mergeBy[T any](base, over []T, key func(T) string) []T {
	out := append([]T{}, base...)
	for _, o := range over {
		replaced := false
		for i := range out {
			if key(out[i]) == key(o) {
				out[i], replaced = o, true
			}
		}
		if !replaced {
			out = append(out, o)
		}
	}
	return out
}

// Config is a location's config as the app shows and edits it.
type Config struct {
	// Repo is the repository's .berth/config.json, read-only here.
	Repo     *RepoConfig `json:"repo"`
	RepoPath string      `json:"repo_path"`
	// Local is this box's own config for the location.
	Local     RepoConfig `json:"local"`
	Effective RepoConfig `json:"effective"`
}

// Config reads a location's config. A broken repository file is reported
// rather than silently ignored, since it would change what worktrees get.
func (l *Locations) Config(ctx context.Context, name string) (Config, error) {
	saved, err := l.saved(name)
	if err != nil {
		return Config{}, err
	}
	out := Config{RepoPath: filepath.Join(saved.Path, RepoConfigFile)}
	repo, ok, err := ReadRepoConfig(saved.Path)
	if err != nil {
		return Config{}, err
	}
	if ok {
		out.Repo = &repo
	}
	if saved.Config != nil {
		out.Local = *saved.Config
	}
	// Scripts set the older way count as local config.
	if saved.Setup != "" {
		out.Local.Setup = saved.Setup
	}
	if saved.Archive != "" {
		out.Local.Archive = saved.Archive
	}
	out.Effective = merge(repo, out.Local)
	return out, nil
}

func (l *Locations) saved(name string) (savedLocation, error) {
	all, err := l.read()
	if err != nil {
		return savedLocation{}, err
	}
	for _, s := range all {
		if s.Name == name {
			return s, nil
		}
	}
	return savedLocation{}, ErrUnknownLocation
}

// SetLocalConfig replaces this box's own config for a location.
func (l *Locations) SetLocalConfig(name string, c RepoConfig) error {
	if err := c.validate(); err != nil {
		return err
	}
	return l.update(func(all []savedLocation) ([]savedLocation, error) {
		for i := range all {
			if all[i].Name == name {
				cc := c
				all[i].Config = &cc
				// The config now holds the scripts.
				all[i].Setup, all[i].Archive = "", ""
				return all, nil
			}
		}
		return nil, ErrUnknownLocation
	})
}

// Ports: each worktree gets a stable block of ports of its own, so two
// worktrees of one app never fight over 3000.

const (
	portBase            = 41000
	portLimit           = 48999
	portBlock           = 10
	maxPortsPerWorktree = portBlock
)

// PortAlloc remembers which block each worktree has, by path.
type PortAlloc struct {
	Path string
	mu   sync.Mutex
}

func (p *PortAlloc) load() map[string]int {
	m := map[string]int{}
	if b, err := os.ReadFile(p.Path); err == nil {
		json.Unmarshal(b, &m)
	}
	return m
}

// For returns dir's first port, giving it a free block if it has none.
// Blocks of worktrees whose folder is gone are reused.
func (p *PortAlloc) For(dir string) (int, error) {
	if p == nil {
		return 0, nil
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	m := p.load()
	if port, ok := m[dir]; ok {
		return port, nil
	}
	used := map[int]bool{}
	for path, port := range m {
		if _, err := os.Stat(path); err != nil {
			delete(m, path)
			continue
		}
		used[port] = true
	}
	for port := portBase; port+portBlock-1 <= portLimit; port += portBlock {
		if !used[port] {
			m[dir] = port
			b, _ := json.MarshalIndent(m, "", "  ")
			return port, statefile.Write(p.Path, b)
		}
	}
	return 0, fmt.Errorf("every port block from %d to %d is taken", portBase, portLimit)
}

// Release frees dir's block.
func (p *PortAlloc) Release(dir string) {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	m := p.load()
	if _, ok := m[dir]; ok {
		delete(m, dir)
		b, _ := json.MarshalIndent(m, "", "  ")
		statefile.Write(p.Path, b)
	}
}

var nonIdent = regexp.MustCompile(`[^a-z0-9]+`)

// WorktreeEnv is what everything run in a worktree gets: berth's variables
// for it, then the location's env with those variables expanded.
func (b *Box) WorktreeEnv(ctx context.Context, location string, wt Worktree) ([]string, error) {
	loc, err := b.Locations.Get(ctx, location)
	if err != nil {
		return nil, err
	}
	cfg, err := b.Locations.Config(ctx, location)
	if err != nil {
		return nil, err
	}
	vars := map[string]string{
		"BERTH_BOX":           b.Name,
		"BERTH_LOCATION":      loc.Name,
		"BERTH_ROOT_PATH":     loc.Path,
		"BERTH_WORKTREE_PATH": wt.Path,
		"BERTH_WORKTREE_NAME": wt.Name,
		// Safe in database and container names: cal_fix_billing.
		"BERTH_WORKTREE_SLUG": strings.Trim(nonIdent.ReplaceAllString(strings.ToLower(loc.Name+"_"+wt.Name), "_"), "_"),
		"BERTH_BRANCH":        wt.Branch,
	}
	if port, err := b.Locations.Ports.For(wt.Path); err != nil {
		return nil, err
	} else if port > 0 {
		vars["BERTH_PORT"] = strconv.Itoa(port)
		for i := 1; i < max(cfg.Effective.Ports, 1); i++ {
			vars["BERTH_PORT_"+strconv.Itoa(i)] = strconv.Itoa(port + i)
		}
	}
	keys := make([]string, 0, len(cfg.Effective.Env))
	for k := range cfg.Effective.Env {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	env := make([]string, 0, len(vars)+len(keys))
	for k, v := range vars {
		env = append(env, k+"="+v)
	}
	sort.Strings(env)
	for _, k := range keys {
		v := os.Expand(cfg.Effective.Env[k], func(name string) string {
			if v, ok := vars[name]; ok {
				return v
			}
			return os.Getenv(name)
		})
		env = append(env, k+"="+v)
	}
	return env, nil
}

// envForDir is the worktree environment for dir, or nothing when dir is not
// in a location.
func (b *Box) envForDir(ctx context.Context, dir string) []string {
	loc, wt, ok := b.worktreeAt(ctx, dir)
	if !ok {
		return nil
	}
	env, err := b.WorktreeEnv(ctx, loc.Name, wt)
	if err != nil {
		return nil
	}
	return env
}

// worktreeAt finds the location and worktree containing dir.
func (b *Box) worktreeAt(ctx context.Context, dir string) (Location, Worktree, bool) {
	locs, err := b.Locations.List(ctx)
	if err != nil {
		return Location{}, Worktree{}, false
	}
	var best Worktree
	var bestLoc Location
	for _, l := range locs {
		for _, w := range l.Worktrees {
			if (dir == w.Path || strings.HasPrefix(dir, w.Path+string(filepath.Separator))) && len(w.Path) > len(best.Path) {
				best, bestLoc = w, l
			}
		}
	}
	return bestLoc, best, best.Path != ""
}

func (b *Box) getConfig(w http.ResponseWriter, r *http.Request) error {
	c, err := b.Locations.Config(r.Context(), r.PathValue("name"))
	if err != nil {
		return err
	}
	writeJSON(w, c)
	return nil
}

func (b *Box) putConfig(w http.ResponseWriter, r *http.Request) error {
	var req struct {
		Local RepoConfig `json:"local"`
	}
	if err := decode(r, &req); err != nil {
		return err
	}
	name := r.PathValue("name")
	if err := b.before(r, "config.change", map[string]any{"location": name}); err != nil {
		return err
	}
	if err := b.Locations.SetLocalConfig(name, req.Local); err != nil {
		if err == ErrUnknownLocation {
			return err
		}
		return badRequest("%v", err)
	}
	b.publish(r, "config.changed", map[string]any{"location": name})
	return b.getConfig(w, r)
}
