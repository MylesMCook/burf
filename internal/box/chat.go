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
	"runtime"
	"sort"
	"strings"
	"sync"

	"github.com/MylesMCook/burf/internal/localchat"
)

type chatState struct {
	mu        sync.Mutex
	starting  int
	upgrading bool
	locations map[string]string
}

type Chat struct {
	localchat.Session
	Location string `json:"location"`
}

// EnableChats installs an owned runtime; it does not launch a provider.
func (b *Box) EnableChats() {
	if runtime.GOOS == "darwin" || runtime.GOOS == "linux" {
		b.Chats = localchat.New("", localchat.StartProcess)
	}
}

func (b *Box) CloseChats() {
	b.chatState.mu.Lock()
	b.chatState.upgrading = true
	b.chatState.mu.Unlock()
	if b.Chats != nil {
		b.Chats.Close()
	}
}

func (b *Box) chatSnapshot(s localchat.Session) Chat {
	b.chatState.mu.Lock()
	defer b.chatState.mu.Unlock()
	return Chat{Session: s, Location: b.chatState.locations[s.ID]}
}

func chatError(err error) error {
	if errors.Is(err, localchat.ErrNotFound) {
		return httpError{404, "chat not found"}
	}
	return httpError{409, err.Error()}
}

func (b *Box) beforeChat(r *http.Request, typ string) error {
	s, err := b.Chats.Get(r.PathValue("id"))
	if err != nil {
		return chatError(err)
	}
	chat := b.chatSnapshot(s)
	return b.before(r, typ, map[string]any{
		"name": s.ID, "location": chat.Location, "path": s.CWD,
		"agent": s.Agent, "mode": "chat",
	})
}

// This API never accepts a raw executable, environment, or filesystem path.
func decodeChat(r *http.Request, v any) error {
	d := json.NewDecoder(io.LimitReader(r.Body, (64<<10)+1))
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return badRequest("invalid chat request")
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return badRequest("invalid chat request")
	}
	return nil
}

func (b *Box) mountChats(route func(string, func(http.ResponseWriter, *http.Request) error)) {
	add := func(path string, h func(http.ResponseWriter, *http.Request) error) {
		route(path, func(w http.ResponseWriter, r *http.Request) error {
			if b.Chats == nil {
				return httpError{501, "structured Codex chat is unavailable on this box"}
			}
			return h(w, r)
		})
	}
	add("GET /v1/chats", func(w http.ResponseWriter, r *http.Request) error {
		out := []Chat{}
		for _, s := range b.Chats.List() {
			out = append(out, b.chatSnapshot(s))
		}
		writeJSON(w, map[string]any{"chats": out})
		return nil
	})
	add("POST /v1/chats", b.startChat)
	// The account's models for a location, before any chat exists there.
	add("GET /v1/chats/models", func(w http.ResponseWriter, r *http.Request) error {
		location := r.URL.Query().Get("location")
		dir, err := b.Locations.Dir(r.Context(), location)
		if err != nil {
			return badRequest("%v", err)
		}
		// It launches the provider, so it passes the same gate as a chat start.
		if err := b.before(r, "session.start", map[string]any{
			"location": location, "path": dir, "agent": "codex", "mode": "models",
			"command": "codex app-server --listen stdio://",
		}); err != nil {
			return err
		}
		opts, err := b.chatOptions(r.Context(), location)
		if err != nil {
			return badRequest("%v", err)
		}
		models, err := b.Chats.ListModels(r.Context(), opts)
		if err != nil {
			return chatError(err)
		}
		writeJSON(w, models)
		return nil
	})
	add("GET /v1/chats/{id}", func(w http.ResponseWriter, r *http.Request) error {
		s, err := b.Chats.Get(r.PathValue("id"))
		if err != nil {
			return chatError(err)
		}
		writeJSON(w, b.chatSnapshot(s))
		return nil
	})
	add("POST /v1/chats/{id}/messages", func(w http.ResponseWriter, r *http.Request) error {
		var req struct {
			Text    string                `json:"text"`
			Options localchat.TurnOptions `json:"options"`
		}
		if err := decodeChat(r, &req); err != nil {
			return err
		}
		if err := b.beforeChat(r, "session.send"); err != nil {
			return err
		}
		if err := b.Chats.SendWith(r.Context(), r.PathValue("id"), req.Text, req.Options); err != nil {
			return chatError(err)
		}
		writeJSON(w, map[string]bool{"ok": true})
		return nil
	})
	add("GET /v1/chats/{id}/models", func(w http.ResponseWriter, r *http.Request) error {
		models, err := b.Chats.Models(r.Context(), r.PathValue("id"))
		if err != nil {
			return chatError(err)
		}
		writeJSON(w, models)
		return nil
	})
	add("POST /v1/chats/{id}/interrupt", func(w http.ResponseWriter, r *http.Request) error {
		if err := b.beforeChat(r, "session.send"); err != nil {
			return err
		}
		if err := b.Chats.Interrupt(r.Context(), r.PathValue("id")); err != nil {
			return chatError(err)
		}
		writeJSON(w, map[string]bool{"ok": true})
		return nil
	})
	add("POST /v1/chats/{id}/approvals", func(w http.ResponseWriter, r *http.Request) error {
		var req struct {
			ID       string `json:"id"`
			Decision string `json:"decision"`
		}
		if err := decodeChat(r, &req); err != nil {
			return err
		}
		if err := b.beforeChat(r, "session.send"); err != nil {
			return err
		}
		if err := b.Chats.Decide(r.PathValue("id"), req.ID, req.Decision); err != nil {
			return chatError(err)
		}
		writeJSON(w, map[string]bool{"ok": true})
		return nil
	})
	add("DELETE /v1/chats/{id}", func(w http.ResponseWriter, r *http.Request) error {
		if err := b.beforeChat(r, "session.stop"); err != nil {
			return err
		}
		if err := b.Chats.Stop(r.PathValue("id")); err != nil {
			return chatError(err)
		}
		writeJSON(w, map[string]bool{"ok": true})
		return nil
	})
}

func (b *Box) startChat(w http.ResponseWriter, r *http.Request) error {
	var req struct {
		Location string `json:"location"`
	}
	if err := decodeChat(r, &req); err != nil {
		return err
	}
	b.chatState.mu.Lock()
	if b.chatState.upgrading {
		b.chatState.mu.Unlock()
		return httpError{409, "this box is updating; refresh before starting a chat"}
	}
	b.chatState.starting++
	b.chatState.mu.Unlock()
	defer func() { b.chatState.mu.Lock(); b.chatState.starting--; b.chatState.mu.Unlock() }()
	dir, err := b.Locations.Dir(r.Context(), req.Location)
	if err != nil {
		return badRequest("%v", err)
	}
	// Structured launches obey the same gates as terminal agent launches.
	// Gate before resolving the launch environment or invoking provider help.
	if err := b.before(r, "session.start", map[string]any{
		"location": req.Location, "path": dir, "agent": "codex", "mode": "chat",
		"command": "codex app-server --listen stdio://",
	}); err != nil {
		return err
	}
	opts, err := b.chatOptions(r.Context(), req.Location)
	if err != nil {
		return badRequest("%v", err)
	}
	s, err := b.Chats.StartWith(r.Context(), opts)
	if s.ID != "" {
		b.chatState.mu.Lock()
		if b.chatState.locations == nil {
			b.chatState.locations = map[string]string{}
		}
		b.chatState.locations[s.ID] = req.Location
		retained := map[string]bool{}
		for _, live := range b.Chats.List() {
			retained[live.ID] = true
		}
		for id := range b.chatState.locations {
			if !retained[id] {
				delete(b.chatState.locations, id)
			}
		}
		b.chatState.mu.Unlock()
	}
	if err != nil {
		return chatError(err)
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, b.chatSnapshot(s))
	return nil
}

func (b *Box) chatOptions(ctx context.Context, ref string) (localchat.LaunchOptions, error) {
	var opts localchat.LaunchOptions
	name, wtName, hasWT := strings.Cut(ref, "/")
	if name == "" || (hasWT && wtName == "") {
		return opts, errors.New("choose a registered project or worktree")
	}
	dir, err := b.Locations.Dir(ctx, ref)
	if err != nil {
		return opts, err
	}
	cfg, err := b.Locations.Config(ctx, name)
	if err != nil {
		return opts, err
	}
	for _, p := range cfg.Effective.Agents {
		if p.ID == "codex" && p.Command != "" && p.Command != "codex" {
			return opts, errors.New("this project's custom Codex command requires a terminal")
		}
	}
	loc, err := b.Locations.Get(ctx, name)
	if err != nil {
		return opts, err
	}
	wt := Worktree{Path: dir, Name: wtName}
	for _, w := range loc.Worktrees {
		if w.Path == dir {
			wt = w
			break
		}
	}
	p, err := b.worktreeEnv(ctx, name, wt)
	if err != nil {
		return opts, err
	}
	values, failed := b.secrets().ResolveAll(ctx, p.refs, p.opEnv)
	if len(failed) > 0 {
		return opts, errors.New("project environment could not be resolved; check its secret references")
	}
	env := map[string]string{}
	for _, kv := range append(os.Environ(), p.env...) {
		k, v, _ := strings.Cut(kv, "=")
		env[k] = v
	}
	for k, v := range values {
		env[k] = v
	}
	if home, ok := env["CODEX_HOME"]; ok {
		st, e := os.Stat(home)
		if !filepath.IsAbs(home) || e != nil || !st.IsDir() {
			return opts, errors.New("CODEX_HOME must name an existing absolute account directory")
		}
	}
	program, err := chatCodexPath(env)
	if err != nil {
		return opts, err
	}
	keys := make([]string, 0, len(env))
	for k := range env {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	opts = localchat.LaunchOptions{Program: program, CWD: dir}
	for _, k := range keys {
		opts.Env = append(opts.Env, k+"="+env[k])
	}
	// The owned, timeout-bounded initialize handshake validates the actual CLI.
	// Spawning a second process for --help delayed every new chat.
	return opts, nil
}

func chatCodexPath(env map[string]string) (string, error) {
	dirs := filepath.SplitList(env["PATH"])
	if home := env["HOME"]; filepath.IsAbs(home) {
		dirs = append(dirs, filepath.Join(home, ".local", "bin"))
	}
	for _, dir := range dirs {
		if !filepath.IsAbs(dir) {
			continue
		}
		p := filepath.Join(dir, "codex")
		st, err := os.Stat(p)
		if err == nil && st.Mode().IsRegular() && st.Mode().Perm()&0111 != 0 {
			return p, nil
		}
	}
	return "", fmt.Errorf("Codex is not installed on this project's executable path")
}

// Starts register before config resolution; neither a slow probe nor a slow
// handshake can race past this guard into an executable replacement.
func (b *Box) beginChatUpgrade() error {
	b.chatState.mu.Lock()
	defer b.chatState.mu.Unlock()
	if b.chatState.upgrading || b.chatState.starting > 0 {
		return httpError{409, "a chat is starting or this box is already updating"}
	}
	if b.Chats != nil {
		for _, s := range b.Chats.List() {
			if s.State != "exited" {
				return httpError{409, "stop structured Codex chats before updating this box"}
			}
		}
	}
	b.chatState.upgrading = true
	return nil
}
func (b *Box) endChatUpgrade() {
	b.chatState.mu.Lock()
	b.chatState.upgrading = false
	b.chatState.mu.Unlock()
}
