package agent

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/cosscom/shipyard/internal/box"
	"github.com/cosscom/shipyard/internal/sshconfig"
)

// Opening a worktree, or a file at a line, in the editor on this computer.
// Remote boxes open through the editor's remote SSH, using the berth-<box>
// SSH hosts that sshconfig writes; a box that is this computer opens
// directly.

// Editor is an editor berth knows how to open things in.
type Editor struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// Installed is true when the app is on this computer; CLI is its command
	// line tool, which opening a file at a line needs.
	Installed bool   `json:"installed"`
	CLI       string `json:"cli,omitempty"`
	// Lines is true when files open at a line on remote boxes.
	Lines bool `json:"lines"`

	app    string   // the app bundle's name
	inApp  string   // the CLI inside the bundle
	onPath []string // the CLI's names on PATH
	scheme string   // its URL scheme
	vscode bool     // a VS Code family editor
}

var knownEditors = []Editor{
	{ID: "cursor", Name: "Cursor", app: "Cursor.app", inApp: "Contents/Resources/app/bin/cursor", onPath: []string{"cursor"}, scheme: "cursor", vscode: true},
	{ID: "vscode", Name: "VS Code", app: "Visual Studio Code.app", inApp: "Contents/Resources/app/bin/code", onPath: []string{"code"}, scheme: "vscode", vscode: true},
	{ID: "windsurf", Name: "Windsurf", app: "Windsurf.app", inApp: "Contents/Resources/app/bin/windsurf", onPath: []string{"windsurf"}, scheme: "windsurf", vscode: true},
	{ID: "zed", Name: "Zed", app: "Zed.app", inApp: "Contents/MacOS/cli", onPath: []string{"zed"}, scheme: "zed"},
}

func (a *Agent) editorRoots() []string {
	if a.cfg.EditorRoots != nil {
		return a.cfg.EditorRoots
	}
	roots := []string{"/Applications"}
	if home, err := os.UserHomeDir(); err == nil {
		roots = append(roots, filepath.Join(home, "Applications"))
	}
	return roots
}

// editors reports which editors this computer has, and their CLIs.
func (a *Agent) editors() []Editor {
	out := make([]Editor, 0, len(knownEditors))
	for _, e := range knownEditors {
		for _, root := range a.editorRoots() {
			bundle := filepath.Join(root, e.app)
			if _, err := os.Stat(bundle); err != nil {
				continue
			}
			e.Installed = true
			if cli := filepath.Join(bundle, e.inApp); isExecutable(cli) {
				e.CLI = cli
			}
			break
		}
		if e.CLI == "" {
			for _, name := range e.onPath {
				if p := lookPath(name); p != "" {
					e.CLI, e.Installed = p, true
					break
				}
			}
		}
		// VS Code's remote URLs open folders only; the CLI goes to a line.
		e.Lines = e.CLI != "" && e.vscode
		out = append(out, e)
	}
	return out
}

func isExecutable(p string) bool {
	info, err := os.Stat(p)
	return err == nil && !info.IsDir() && info.Mode()&0o111 != 0
}

// lookPath also looks where Homebrew and installers put CLIs, since the
// agent may run under launchd with a short PATH.
func lookPath(name string) string {
	if p, err := exec.LookPath(name); err == nil {
		return p
	}
	for _, dir := range []string{"/opt/homebrew/bin", "/usr/local/bin"} {
		if p := filepath.Join(dir, name); isExecutable(p) {
			return p
		}
	}
	return ""
}

func (a *Agent) sshConfig() sshconfig.Config {
	if a.cfg.SSHDir != "" {
		return sshconfig.Config{Dir: a.cfg.SSHDir}
	}
	c, _ := sshconfig.Default()
	return c
}

// boxUsers caches the account each box runs as, from its info.
var boxUsers sync.Map

func (a *Agent) boxUser(ctx context.Context, name string) string {
	online := false
	for _, b := range a.status().Boxes {
		if b.Name == name && b.State == StateOnline {
			online = true
		}
	}
	if c, ok := a.client(name); ok && online {
		var info box.Info
		cctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		err := box.NewClient(c).Call(cctx, http.MethodGet, "/v1/info", nil, &info)
		cancel()
		// The box names its own user; only a plain account name is kept,
		// since it is written into ~/.ssh.
		if err == nil && info.User != "" && sshconfig.ValidUser(info.User) {
			boxUsers.Store(name, info.User)
			return info.User
		}
	}
	if u, ok := boxUsers.Load(name); ok {
		return u.(string)
	}
	return ""
}

// identityAgent is the SSH agent editors log in with: 1Password's when it
// runs, as berth add ssh falls back to.
func (a *Agent) identityAgent() string {
	if a.cfg.SSHDir != "" {
		return "" // tests use their own SSH folder and no agent
	}
	return sshconfig.OnePasswordAgent()
}

// SSHHost is one box's SSH host, as the app shows it before writing.
type SSHHost struct {
	Box     string `json:"box"`
	Host    string `json:"host"`
	User    string `json:"user,omitempty"`
	Network string `json:"network,omitempty"`
	// Local boxes are this computer and need no SSH host.
	Local bool `json:"local,omitempty"`
	Ready bool `json:"ready"`
}

// sshHosts is the SSH host every paired box should have.
func (a *Agent) sshHosts(ctx context.Context) ([]sshconfig.Host, []SSHHost, error) {
	peers, err := a.boxes.List()
	if err != nil {
		return nil, nil, err
	}
	berth, err := a.cliPath()
	if err != nil {
		return nil, nil, err
	}
	if resolved, err := filepath.EvalSymlinks(berth); err == nil {
		berth = resolved
	}
	cfg := a.sshConfig()
	var hosts []sshconfig.Host
	var shown []SSHHost
	for _, p := range peers {
		if p.Address == "" {
			continue
		}
		if sshconfig.Local(p.Address) {
			shown = append(shown, SSHHost{Box: p.Name, Local: true, Ready: true})
			continue
		}
		h := sshconfig.Host{Box: p.Name, Address: p.Address, User: a.boxUser(ctx, p.Name), Network: p.Network, Berth: berth, IdentityAgent: a.identityAgent()}
		hosts = append(hosts, h)
		shown = append(shown, SSHHost{Box: p.Name, Host: sshconfig.HostName(p.Name), User: h.User, Network: p.Network, Ready: cfg.Ready(p.Name)})
	}
	return hosts, shown, nil
}

// OpenRequest asks to open a folder, or a file in it, in an editor. Either
// Path, or Location ("loc" or "loc/worktree") on Box, names the folder.
type OpenRequest struct {
	Editor   string `json:"editor"`
	Box      string `json:"box"`
	Location string `json:"location,omitempty"`
	Path     string `json:"path,omitempty"`
	File     string `json:"file,omitempty"`
	Line     int    `json:"line,omitempty"`
	Col      int    `json:"col,omitempty"`
}

// OpenResult says what berth ran.
type OpenResult struct {
	Command []string `json:"command"`
	Note    string   `json:"note,omitempty"`
}

var errSSHSetup = errors.New("set up SSH for editors first: berth ssh-config --write, or Settings → Boxes")

// folderFor finds the folder a location names on a box.
func (a *Agent) folderFor(ctx context.Context, boxName, ref string) (string, error) {
	c, ok := a.client(boxName)
	if !ok {
		return "", fmt.Errorf("no paired box named %s", boxName)
	}
	var locs []box.Location
	if err := box.NewClient(c).Call(ctx, http.MethodGet, "/v1/locations", nil, &locs); err != nil {
		return "", err
	}
	name, wt, _ := strings.Cut(ref, "/")
	for _, l := range locs {
		if l.Name != name {
			continue
		}
		if wt == "" {
			return l.Path, nil
		}
		for _, w := range l.Worktrees {
			if w.Name == wt {
				return w.Path, nil
			}
		}
	}
	return "", fmt.Errorf("no %s on %s", ref, boxName)
}

func cleanAbs(p string) (string, bool) {
	if p == "" || !strings.HasPrefix(p, "/") || strings.ContainsAny(p, "\x00\n\r") {
		return "", false
	}
	return filepath.Clean(p), true
}

// openCommand works out how to open req: a CLI command, or a URL for open.
func (a *Agent) openCommand(ctx context.Context, req OpenRequest) (OpenResult, error) {
	var ed *Editor
	for _, e := range a.editors() {
		if e.ID == req.Editor && e.Installed {
			ed = &e
			break
		}
	}
	if ed == nil {
		return OpenResult{}, fmt.Errorf("%s is not installed on this computer", req.Editor)
	}
	folder := req.Path
	if folder == "" && req.Location != "" {
		f, err := a.folderFor(ctx, req.Box, req.Location)
		if err != nil {
			return OpenResult{}, err
		}
		folder = f
	}
	folder, ok := cleanAbs(folder)
	if !ok {
		return OpenResult{}, errors.New("an absolute folder path is needed")
	}
	file := ""
	if req.File != "" {
		if file, ok = cleanAbs(req.File); !ok {
			return OpenResult{}, errors.New("the file must be an absolute path")
		}
	}
	peer, found, err := a.boxes.ByName(req.Box)
	if err != nil {
		return OpenResult{}, err
	}
	if !found {
		return OpenResult{}, fmt.Errorf("no paired box named %s", req.Box)
	}
	pos := func(f string) string {
		if req.Line > 0 {
			f += ":" + strconv.Itoa(req.Line)
			if req.Col > 0 {
				f += ":" + strconv.Itoa(req.Col)
			}
		}
		return f
	}
	open := func(u string) OpenResult { return OpenResult{Command: []string{"open", u}} }

	if sshconfig.Local(peer.Address) {
		switch {
		case ed.CLI != "" && ed.vscode && file != "":
			return OpenResult{Command: []string{ed.CLI, folder, "-g", pos(file)}}, nil
		case ed.CLI != "" && file != "":
			return OpenResult{Command: []string{ed.CLI, folder, pos(file)}}, nil
		case ed.CLI != "":
			return OpenResult{Command: []string{ed.CLI, folder}}, nil
		case ed.vscode && file != "":
			return open(ed.scheme + "://file" + pos(file)), nil
		case ed.vscode:
			return open(ed.scheme + "://file" + folder), nil
		default:
			return open("zed://file" + folder), nil
		}
	}

	if !a.sshConfig().Ready(req.Box) {
		return OpenResult{}, errSSHSetup
	}
	host := sshconfig.HostName(req.Box)
	if ed.vscode {
		if ed.CLI != "" {
			cmd := []string{ed.CLI, "--remote", "ssh-remote+" + host, folder}
			if file != "" {
				cmd = append(cmd, "-g", pos(file))
			}
			return OpenResult{Command: cmd}, nil
		}
		r := open(ed.scheme + "://vscode-remote/ssh-remote+" + host + (&url.URL{Path: folder}).EscapedPath())
		if file != "" {
			r.Note = "Opened the folder: " + ed.Name + "'s links open folders only. Install its command line tool to jump to files."
		}
		return r, nil
	}
	// Zed opens ssh://host/path; a file opens without its line.
	target := folder
	note := ""
	if file != "" {
		target = file
		if req.Line > 0 {
			note = "Zed opened the file; it does not take a line over SSH links."
		}
	}
	if ed.CLI != "" {
		return OpenResult{Command: []string{ed.CLI, "ssh://" + host + target}, Note: note}, nil
	}
	r := open("zed://ssh/" + host + target)
	r.Note = note
	return r, nil
}

func (a *Agent) runOpen(r OpenResult) error {
	if a.cfg.Run != nil {
		return a.cfg.Run(r.Command)
	}
	cmd := exec.Command(r.Command[0], r.Command[1:]...)
	cmd.Env = append(os.Environ(), "PATH="+os.Getenv("PATH")+":/opt/homebrew/bin:/usr/local/bin")
	if err := cmd.Start(); err != nil {
		return err
	}
	go cmd.Wait()
	return nil
}

func (a *Agent) editorRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/editors", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, a.editors())
	})
	mux.HandleFunc("POST /v1/editors/open", func(w http.ResponseWriter, r *http.Request) {
		var req OpenRequest
		if !decodeBody(w, r, &req) {
			return
		}
		a.sync()
		res, err := a.openCommand(r.Context(), req)
		if errors.Is(err, errSSHSetup) {
			writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error(), "code": "ssh_setup"})
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := a.runOpen(res); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, res)
	})
	// ssh-config shows what setting up SSH for editors would change;
	// POST writes exactly that.
	plan := func(w http.ResponseWriter, r *http.Request, write bool) {
		a.sync()
		hosts, shown, err := a.sshHosts(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		cfg := a.sshConfig()
		changes, err := cfg.Plan(hosts)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if write && len(changes) > 0 {
			if err := cfg.Apply(changes); err != nil {
				writeError(w, http.StatusInternalServerError, err.Error())
				return
			}
			_, shown, _ = a.sshHosts(r.Context())
			changes = nil
		}
		if changes == nil {
			changes = []sshconfig.Change{}
		}
		writeJSON(w, http.StatusOK, map[string]any{"dir": cfg.Dir, "hosts": shown, "changes": changes})
	}
	mux.HandleFunc("GET /v1/ssh-config", func(w http.ResponseWriter, r *http.Request) { plan(w, r, false) })
	mux.HandleFunc("POST /v1/ssh-config", func(w http.ResponseWriter, r *http.Request) { plan(w, r, true) })
}
