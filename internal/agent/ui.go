package agent

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/coder/websocket"

	"github.com/sean-brydon/berth/internal/box"
	"github.com/sean-brydon/berth/internal/hooks"
	"github.com/sean-brydon/berth/internal/statefile"
	"github.com/sean-brydon/berth/internal/terminal"
)

// DefaultUIPort is where the agent serves the desktop app, on loopback only.
const DefaultUIPort = 1378

// UITokenFile holds the secret the app presents, inside the state directory.
const UITokenFile = "ui-token"

// uiOrigins are the pages allowed to call the UI API from a browser engine:
// the Tauri webview on macOS and Windows, and Vite while developing.
var uiOrigins = map[string]bool{
	"tauri://localhost":       true,
	"http://tauri.localhost":  true,
	"https://tauri.localhost": true,
	"http://localhost:1420":   true,
}

// UIToken returns the app's token, creating it on first use.
func UIToken(dir string) (string, error) {
	p := filepath.Join(dir, UITokenFile)
	if b, err := os.ReadFile(p); err == nil && len(strings.TrimSpace(string(b))) >= 32 {
		return strings.TrimSpace(string(b)), nil
	}
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	tok := hex.EncodeToString(buf)
	return tok, statefile.Write(p, []byte(tok+"\n"))
}

// startUI serves the app's API until ctx ends. A port someone else holds is
// logged rather than fatal: forwards and URLs matter more than the app.
func (a *Agent) startUI(ctx context.Context, inner http.Handler) {
	addr := a.cfg.UIAddr
	if addr == "off" {
		return
	}
	tok, err := UIToken(a.cfg.Dir)
	if err != nil {
		a.cfg.Log.Printf("app API off: %v", err)
		return
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		a.cfg.Log.Printf("app API off: %v", err)
		return
	}
	srv := &http.Server{Handler: a.ui(tok, ln.Addr().String(), inner), ReadHeaderTimeout: 10 * time.Second}
	context.AfterFunc(ctx, func() { srv.Close() })
	go srv.Serve(ln)
}

// ui is the app's API: the agent's own control routes, an event stream the
// browser can read, box APIs passed through, terminals over WebSocket, and
// the user's themes, templates and plugins.
func (a *Agent) ui(token, hostport string, inner http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/events", a.uiEvents)
	mux.HandleFunc("GET /v1/themes", a.uiList("themes"))
	mux.HandleFunc("GET /v1/templates", a.uiList("templates"))
	mux.HandleFunc("GET /v1/plugins", a.uiPlugins)
	mux.HandleFunc("GET /v1/plugins/{id}/{file...}", a.uiPluginFile)
	mux.HandleFunc("/v1/boxes/{box}/api/{path...}", a.uiBoxAPI)
	mux.HandleFunc("GET /v1/boxes/{box}/sessions/{name}/attach", a.uiAttach)
	a.manageRoutes(mux)
	mux.HandleFunc("POST /v1/stop", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusForbidden, "the app cannot stop the agent")
	})
	mux.Handle("/", inner)

	_, port, _ := net.SplitHostPort(hostport)
	hosts := map[string]bool{"127.0.0.1:" + port: true, "localhost:" + port: true}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only loopback names reach the agent, so no website can rebind its
		// own name to 127.0.0.1 and talk to it.
		if !hosts[r.Host] {
			writeError(w, http.StatusForbidden, "unexpected host")
			return
		}
		if o := r.Header.Get("Origin"); uiOrigins[o] {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", o)
			h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			h.Set("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		got, _ := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if got == "" {
			got = r.URL.Query().Get("token")
		}
		if subtle.ConstantTimeCompare([]byte(got), []byte(token)) != 1 {
			writeError(w, http.StatusUnauthorized, "missing or wrong token")
			return
		}
		mux.ServeHTTP(w, r)
	})
}

// uiEvents streams events as server-sent events.
func (a *Agent) uiEvents(w http.ResponseWriter, r *http.Request) {
	ch, cancel := a.bus.Subscribe()
	defer cancel()
	rc := http.NewResponseController(w)
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	io.WriteString(w, ": berth\n\n")
	rc.Flush()
	keepalive := time.NewTicker(20 * time.Second)
	defer keepalive.Stop()
	for {
		var chunk []byte
		select {
		case <-r.Context().Done():
			return
		case e := <-ch:
			b, err := json.Marshal(e)
			if err != nil {
				continue
			}
			chunk = append(append([]byte("data: "), b...), '\n', '\n')
		case <-keepalive.C:
			chunk = []byte(": keepalive\n\n")
		}
		if _, err := w.Write(chunk); err != nil || rc.Flush() != nil {
			return
		}
	}
}

// uiBoxAPI passes a request to a box's API and streams the answer back, so
// the app reaches every box through the one connection the agent keeps.
func (a *Agent) uiBoxAPI(w http.ResponseWriter, r *http.Request) {
	a.sync()
	c, ok := a.client(r.PathValue("box"))
	if !ok {
		writeError(w, http.StatusNotFound, "no paired box named "+r.PathValue("box"))
		return
	}
	target := "/v1/" + r.PathValue("path")
	if r.URL.RawQuery != "" {
		target += "?" + r.URL.RawQuery
	}
	header := http.Header{box.OriginHeader: {"app"}}
	if ct := r.Header.Get("Content-Type"); ct != "" {
		header.Set("Content-Type", ct)
	}
	var body io.Reader
	if r.ContentLength != 0 {
		body = http.MaxBytesReader(w, r.Body, 1<<20)
	}
	resp, err := c.DoWithHeader(r.Context(), r.Method, target, body, header)
	if err != nil {
		a.checkSoon()
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	defer resp.Body.Close()
	if ct := resp.Header.Get("Content-Type"); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	w.WriteHeader(resp.StatusCode)
	rc := http.NewResponseController(w)
	buf := make([]byte, 32<<10)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := w.Write(buf[:n]); werr != nil {
				return
			}
			rc.Flush()
		}
		if err != nil {
			return
		}
	}
}

// uiAttach bridges a WebSocket to a session's terminal on a box. Binary
// messages are keystrokes, text messages are resizes; the box's output comes
// back as binary messages. Closing either side detaches.
func (a *Agent) uiAttach(w http.ResponseWriter, r *http.Request) {
	a.sync()
	c, ok := a.client(r.PathValue("box"))
	if !ok {
		writeError(w, http.StatusNotFound, "no paired box named "+r.PathValue("box"))
		return
	}
	cols, _ := strconv.Atoi(r.URL.Query().Get("cols"))
	rows, _ := strconv.Atoi(r.URL.Query().Get("rows"))
	ws, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"localhost", "localhost:1420", "tauri.localhost"},
	})
	if err != nil {
		return
	}
	defer ws.CloseNow()
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	stream, err := c.OpenStream(ctx, "/v1/sessions/"+r.PathValue("name")+"/attach?cols="+strconv.Itoa(max(cols, 20))+"&rows="+strconv.Itoa(max(rows, 5)), "attach")
	if err != nil {
		ws.Close(websocket.StatusTryAgainLater, truncate(err.Error(), 120))
		return
	}
	defer stream.Close()
	go func() {
		defer cancel()
		for {
			typ, msg, err := ws.Read(ctx)
			if err != nil {
				return
			}
			if typ == websocket.MessageText {
				var m struct {
					Type       string `json:"type"`
					Cols, Rows int
				}
				if json.Unmarshal(msg, &m) == nil && m.Type == "resize" {
					err = terminal.WriteResize(stream, m.Cols, m.Rows)
				}
			} else {
				err = terminal.WriteData(stream, msg)
			}
			if err != nil {
				return
			}
		}
	}()
	buf := make([]byte, 32<<10)
	for {
		n, err := stream.Read(buf)
		if n > 0 {
			if werr := ws.Write(ctx, websocket.MessageBinary, buf[:n]); werr != nil {
				return
			}
		}
		if err != nil {
			ws.Close(websocket.StatusNormalClosure, "session detached")
			return
		}
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// uiList serves every JSON object in ~/.berth/<kind>/*.json, plus, for
// themes, those plugins ship. A broken file is skipped, not fatal.
func (a *Agent) uiList(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		files, _ := filepath.Glob(filepath.Join(a.cfg.UserDir, kind, "*.json"))
		if kind == "themes" {
			for _, p := range a.plugins() {
				if p.Enabled {
					for _, t := range p.Themes {
						files = append(files, filepath.Join(a.cfg.UserDir, "plugins", p.ID, filepath.Clean("/"+t)))
					}
				}
			}
		}
		out := []json.RawMessage{}
		for _, f := range files {
			b, err := os.ReadFile(f)
			var obj map[string]any
			if err != nil || json.Unmarshal(b, &obj) != nil {
				a.cfg.Log.Printf("skipping %s: not a JSON object", f)
				continue
			}
			if _, ok := obj["id"]; !ok {
				obj["id"] = strings.TrimSuffix(filepath.Base(f), ".json")
			}
			b, _ = json.Marshal(obj)
			out = append(out, b)
		}
		writeJSON(w, http.StatusOK, out)
	}
}

// PluginInfo describes an installed plugin to the app.
type PluginInfo struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Version     string   `json:"version,omitempty"`
	Description string   `json:"description,omitempty"`
	Main        string   `json:"main,omitempty"`
	Themes      []string `json:"themes,omitempty"`
	Hooks       int      `json:"hooks"`
	Enabled     bool     `json:"enabled"`
	// Entry is the URL the app imports, when the plugin has a main module.
	Entry string `json:"entry,omitempty"`
	Error string `json:"error,omitempty"`
}

func (a *Agent) plugins() []PluginInfo {
	manifests, _ := filepath.Glob(filepath.Join(a.cfg.UserDir, "plugins", "*", hooks.PluginManifest))
	out := []PluginInfo{}
	for _, m := range manifests {
		dir := filepath.Dir(m)
		p := PluginInfo{ID: filepath.Base(dir)}
		var raw struct {
			PluginInfo
			Hooks []json.RawMessage `json:"hooks"`
		}
		if b, err := os.ReadFile(m); err != nil {
			p.Error = err.Error()
		} else if err := json.Unmarshal(b, &raw); err != nil {
			p.Error = hooks.PluginManifest + ": " + err.Error()
		} else {
			p.Name, p.Version, p.Description, p.Main, p.Themes = raw.Name, raw.Version, raw.Description, raw.Main, raw.Themes
			p.Hooks = len(raw.Hooks)
		}
		// The folder name is the ID, so it is always a safe path segment.
		if p.Name == "" {
			p.Name = p.ID
		}
		_, err := os.Stat(filepath.Join(dir, "disabled"))
		p.Enabled = err != nil
		if p.Main != "" {
			p.Entry = "/v1/plugins/" + p.ID + "/" + path.Clean(p.Main)
		}
		out = append(out, p)
	}
	return out
}

func (a *Agent) uiPlugins(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, a.plugins())
}

// uiPluginFile serves a file from inside a plugin's folder, never above it.
func (a *Agent) uiPluginFile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" || strings.ContainsAny(id, `/\`) || strings.HasPrefix(id, ".") {
		writeError(w, http.StatusNotFound, "no such plugin")
		return
	}
	root, err := os.OpenRoot(filepath.Join(a.cfg.UserDir, "plugins", id))
	if err != nil {
		writeError(w, http.StatusNotFound, "no such plugin")
		return
	}
	defer root.Close()
	name := path.Clean(r.PathValue("file"))
	f, err := root.Open(name)
	if errors.Is(err, os.ErrNotExist) || errors.Is(err, os.ErrPermission) || err != nil {
		writeError(w, http.StatusNotFound, "no such file")
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || info.IsDir() {
		writeError(w, http.StatusNotFound, "no such file")
		return
	}
	ct := mime.TypeByExtension(path.Ext(name))
	if path.Ext(name) == ".js" || path.Ext(name) == ".mjs" {
		ct = "text/javascript; charset=utf-8"
	}
	if ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	w.Header().Set("Cache-Control", "no-store")
	http.ServeContent(w, r, "", info.ModTime(), f)
}
