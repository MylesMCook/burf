package nativefeedback

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/MylesMCook/burf/app/native/internal/nativefeedback/feedbackhttp"
	"github.com/MylesMCook/burf/app/native/internal/nativefeedback/transport"
	"github.com/MylesMCook/burf/internal/statefile"
)

type RuntimeConfig struct {
	Directory string
	Origin    string
}

// RuntimeStatus exposes only the main window's restricted toolbar capability.
type RuntimeStatus struct {
	Available  bool   `json:"available"`
	Enabled    bool   `json:"enabled"`
	Endpoint   string `json:"endpoint,omitempty"`
	Generation uint64 `json:"generation"`
	Error      string `json:"error,omitempty"`
}

type runtimeDescriptor struct {
	Version      int    `json:"version"`
	Mode         string `json:"mode"`
	Enabled      bool   `json:"enabled"`
	PID          int    `json:"pid"`
	RunID        string `json:"runID"`
	CompanionURL string `json:"companionURL,omitempty"`
	Token        string `json:"token,omitempty"`
	UpdatedAt    string `json:"updatedAt"`
}

type runtimeGeneration struct {
	store  *feedbackhttp.Store
	server *http.Server
	cancel context.CancelFunc
	bridge *transport.Bridge
	runID  string
}

// Runtime is dormant until an explicit trusted main-window enable command.
// An acquired owner lock remains held across disables until application close.
type Runtime struct {
	mu     sync.Mutex
	config RuntimeConfig
	status RuntimeStatus
	active *runtimeGeneration
	unlock func()
	closed bool
}

// NewRuntime performs no filesystem, network or environment access.
func NewRuntime(config RuntimeConfig) (*Runtime, error) {
	if !filepath.IsAbs(config.Directory) || filepath.Clean(config.Directory) != config.Directory {
		return nil, errors.New("feedback directory must be an absolute clean path")
	}
	if !runtimeOrigin(config.Origin) {
		return nil, errors.New("unsupported feedback main-window origin")
	}
	return &Runtime{config: config, status: RuntimeStatus{Available: true}}, nil
}

func runtimeOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil || u.User != nil || u.Path != "" || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" {
		return false
	}
	validScheme := u.Scheme == "wails" && u.Hostname() == "localhost"
	validScheme = validScheme || u.Scheme == "http" && u.Hostname() == "wails.localhost"
	if !validScheme {
		return false
	}
	if u.Port() == "" {
		return u.Host == u.Hostname()
	}
	// Reuse the transport's exact native origin validation on explicit enable.
	var port int
	if _, err := fmt.Sscanf(u.Port(), "%d", &port); err != nil {
		return false
	}
	return port >= 1024 && port <= 65535 && u.Host == fmt.Sprintf("%s:%d", u.Hostname(), port)
}

func (r *Runtime) Status() RuntimeStatus {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.status
}

func (r *Runtime) Enable() (RuntimeStatus, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed {
		return r.fail(errors.New("feedback controller is closed"))
	}
	if r.active != nil {
		return r.status, nil
	}
	if err := r.acquire(); err != nil {
		return r.fail(err)
	}
	token, err := runtimeSecret(32)
	if err != nil {
		return r.fail(err)
	}
	runID, err := runtimeSecret(16)
	if err != nil {
		return r.fail(err)
	}
	store, err := feedbackhttp.Open(r.config.Directory, token)
	if err != nil {
		return r.fail(err)
	}
	generation := &runtimeGeneration{store: store, runID: runID}
	ready := false
	defer func() {
		if !ready {
			_ = generation.close()
		}
	}()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return r.fail(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	generation.cancel = cancel
	host := listener.Addr().String()
	generation.server = &http.Server{
		Handler:           runtimeHandler(host, store.Handler()),
		BaseContext:       func(net.Listener) context.Context { return ctx },
		ReadHeaderTimeout: 3 * time.Second,
		ReadTimeout:       10 * time.Second,
		IdleTimeout:       30 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	go func() { _ = generation.server.Serve(listener) }()
	backend := "http://" + host
	if err := runtimeHealth(backend, token); err != nil {
		return r.fail(err)
	}
	generation.bridge, err = transport.StartAuthenticated(backend, r.config.Origin, token)
	if err != nil {
		return r.fail(err)
	}
	descriptor := runtimeDescriptor{
		Version: 1, Mode: "runtime", Enabled: true, PID: os.Getpid(), RunID: runID,
		CompanionURL: backend, Token: token, UpdatedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}
	if err := r.writeDescriptor(descriptor); err != nil {
		return r.fail(err)
	}
	r.active = generation
	r.status.Enabled = true
	r.status.Endpoint = transport.Endpoint(generation.bridge)
	r.status.Generation++
	r.status.Error = ""
	ready = true
	return r.status, nil
}

func (r *Runtime) Disable() (RuntimeStatus, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.disable()
}

func (r *Runtime) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed {
		return nil
	}
	r.closed = true
	_, err := r.disable()
	if r.unlock != nil {
		r.unlock()
		r.unlock = nil
	}
	return err
}

func (r *Runtime) disable() (RuntimeStatus, error) {
	if r.active == nil {
		return r.status, nil
	}
	generation := r.active
	r.active = nil
	r.status.Enabled = false
	r.status.Endpoint = ""
	// Revoke endpoints even if the private discovery file cannot be replaced.
	closeErr := generation.close()
	descriptor := runtimeDescriptor{
		Version: 1, Mode: "runtime", PID: os.Getpid(), RunID: generation.runID,
		UpdatedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}
	err := errors.Join(closeErr, r.writeDescriptor(descriptor))
	if err != nil {
		return r.fail(err)
	}
	r.status.Error = ""
	return r.status, nil
}

func (r *Runtime) fail(err error) (RuntimeStatus, error) {
	r.status.Error = err.Error()
	return r.status, err
}

func (g *runtimeGeneration) close() error {
	transport.Stop(g.bridge)
	if g.cancel != nil {
		g.cancel()
	}
	var serverErr error
	if g.server != nil {
		serverErr = g.server.Close()
	}
	return errors.Join(serverErr, g.store.Close())
}

func runtimeHandler(host string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Host != host || r.URL.RawPath != "" || len(r.Header.Values("Origin")) != 0 {
			http.Error(w, "feedback request is not allowed", http.StatusForbidden)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}

func runtimeHealth(endpoint, token string) error {
	request, err := http.NewRequest(http.MethodGet, endpoint+"/health", nil)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	client := &http.Client{Timeout: time.Second, Transport: &http.Transport{Proxy: nil}}
	defer client.CloseIdleConnections()
	response, err := client.Do(request)
	if err != nil {
		return errors.New("feedback listener did not become ready")
	}
	defer response.Body.Close()
	var health struct {
		Status string `json:"status"`
	}
	if response.StatusCode != http.StatusOK || json.NewDecoder(io.LimitReader(response.Body, 4096)).Decode(&health) != nil || health.Status != "ok" {
		return errors.New("feedback listener readiness failed")
	}
	return nil
}

func runtimeSecret(size int) (string, error) {
	value := make([]byte, size)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}

func (r *Runtime) acquire() error {
	if err := privateRuntimeDirectory(r.config.Directory); err != nil {
		return err
	}
	if err := privateRuntimeFile(filepath.Join(r.config.Directory, "session.json")); err != nil {
		return err
	}
	lockPath := filepath.Join(r.config.Directory, "runtime.lock")
	if err := privateRuntimeFile(lockPath); err != nil {
		return err
	}
	if r.unlock != nil {
		return nil
	}
	unlock, acquired, err := statefile.TryLock(strings.TrimSuffix(lockPath, ".lock"))
	if err != nil {
		return err
	}
	if !acquired {
		return errors.New("feedback is owned by another application instance")
	}
	r.unlock = unlock
	if err := statefile.Private(lockPath); err != nil {
		unlock()
		r.unlock = nil
		return err
	}
	return nil
}

func (r *Runtime) writeDescriptor(descriptor runtimeDescriptor) error {
	if err := privateRuntimeDirectory(r.config.Directory); err != nil {
		return err
	}
	path := filepath.Join(r.config.Directory, "session.json")
	if err := privateRuntimeFile(path); err != nil {
		return err
	}
	data, err := json.Marshal(descriptor)
	if err != nil {
		return err
	}
	return statefile.Write(path, append(data, '\n'))
}

func privateRuntimeDirectory(directory string) error {
	for current := directory; ; current = filepath.Dir(current) {
		info, err := os.Lstat(current)
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		if err == nil && (!info.IsDir() || info.Mode()&os.ModeSymlink != 0) {
			return errors.New("feedback directory contains an unsafe path")
		}
		if parent := filepath.Dir(current); parent == current {
			break
		}
	}
	if err := statefile.EnsurePrivateDir(directory); err != nil {
		return err
	}
	if runtime.GOOS != "windows" {
		return os.Chmod(directory, 0o700)
	}
	return nil
}

func privateRuntimeFile(path string) error {
	info, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return errors.New("feedback state is not a regular private file")
	}
	if runtime.GOOS != "windows" && info.Mode().Perm()&0o077 != 0 {
		return errors.New("feedback state file has unsafe permissions")
	}
	return statefile.Private(path)
}
