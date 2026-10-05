package agent

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// Making a chat background from a prompt with an image generator on this
// computer. Only Codex's CLI is known so far: `codex exec` with its image
// generation tool, signed in with the person's own account. The app lists
// the generators (GET /v1/imagegen), shows the exact command, and runs it
// only when the person presses Generate (POST /v1/imagegen). Nothing else
// starts one.
//
// Codex runs read-only in an empty folder and is told to make one image and
// do nothing else. It saves what it generates under
// $CODEX_HOME/generated_images/<thread>/, and the thread comes first in its
// JSON events, so the image is read from there.

// ImageGenerator is a generator the app can offer.
type ImageGenerator struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// Installed: its CLI is on this computer. SignedIn: it can run now.
	Installed bool   `json:"installed"`
	SignedIn  bool   `json:"signed_in"`
	Path      string `json:"path,omitempty"`
	// Note says why it can't run, and what to do about it.
	Note string `json:"note,omitempty"`
	// Command is what Generate runs, with {prompt} for the instruction.
	Command []string `json:"command"`
}

// GeneratedImage is a generated picture, whole.
type GeneratedImage struct {
	Mime string `json:"mime"`
	// Data is the image, base64.
	Data   string `json:"data"`
	Prompt string `json:"prompt"`
}

const (
	imageGenTimeout = 5 * time.Minute
	imageGenMax     = 24 << 20
	promptMax       = 1000
)

// imageGen finds and runs Codex. codex and home default to the CLI on
// PATH (or Homebrew's) and ~/.codex (or $CODEX_HOME); tests set both.
type imageGen struct {
	codex string
	home  string
	busy  *sync.Mutex
}

func (a *Agent) imageGenRoutes(mux *http.ServeMux) {
	imageGen{codex: a.cfg.Codex, home: a.cfg.CodexHome, busy: &a.imageGenBusy}.routes(mux)
}

func (g imageGen) path() string {
	if g.codex != "" {
		if isExecutable(g.codex) {
			return g.codex
		}
		return ""
	}
	return lookPath("codex")
}

func (g imageGen) codexHome() string {
	if g.home != "" {
		return g.home
	}
	if h := os.Getenv("CODEX_HOME"); h != "" {
		return h
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".codex")
}

func (g imageGen) env() []string {
	return append(os.Environ(), "PATH="+os.Getenv("PATH")+":/opt/homebrew/bin:/usr/local/bin", "CODEX_HOME="+g.codexHome())
}

// codexArgs is the command, with dir the empty folder it runs in.
func codexArgs(bin, dir, instruction string) []string {
	return []string{bin, "exec", "--ephemeral", "--skip-git-repo-check", "--json", "--sandbox", "read-only", "--cd", dir, instruction}
}

// instruction wraps the person's prompt: one image, nothing else, shaped
// for a background.
func instruction(prompt string) string {
	return "Use your image generation tool to make exactly one image, then reply with the word done. " +
		"Do not run commands, and do not read or write files. " +
		"It is a wide background for a chat window: landscape 16:9, calm, low in detail, with no text, letters, logos or watermarks. " +
		"The picture: " + prompt
}

func (g imageGen) list(ctx context.Context) []ImageGenerator {
	c := ImageGenerator{ID: "codex", Name: "Codex", Command: codexArgs("codex", "<an empty temporary folder>", "{prompt}")}
	c.Path = g.path()
	c.Installed = c.Path != ""
	switch {
	case !c.Installed:
		c.Note = "Install Codex's CLI (brew install codex) and sign in with `codex login`, then check again."
	default:
		c.Command[0] = c.Path
		cctx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		cmd := exec.CommandContext(cctx, c.Path, "login", "status")
		cmd.Env = g.env()
		out, err := cmd.CombinedOutput()
		c.SignedIn = err == nil && !strings.Contains(strings.ToLower(string(out)), "not logged in")
		if !c.SignedIn {
			c.Note = "Run `codex login` in a terminal, then check again."
		}
	}
	return []ImageGenerator{c}
}

var errImageGenBusy = errors.New("an image is already being generated; wait for it to finish")

func (g imageGen) generate(ctx context.Context, prompt string) (GeneratedImage, error) {
	if !g.busy.TryLock() {
		return GeneratedImage{}, errImageGenBusy
	}
	defer g.busy.Unlock()
	bin := g.path()
	if bin == "" {
		return GeneratedImage{}, &codedError{"Codex's CLI isn't on this computer", "imagegen_missing", http.StatusNotFound}
	}
	dir, err := os.MkdirTemp("", "berth-imagegen-")
	if err != nil {
		return GeneratedImage{}, err
	}
	defer os.RemoveAll(dir)
	ctx, cancel := context.WithTimeout(ctx, imageGenTimeout)
	defer cancel()
	args := codexArgs(bin, dir, instruction(prompt))
	cmd := exec.CommandContext(ctx, args[0], args[1:]...)
	cmd.Dir = dir
	cmd.Env = g.env()
	cmd.Stdin = nil
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	runErr := cmd.Run()
	if ctx.Err() == context.DeadlineExceeded {
		return GeneratedImage{}, &codedError{"Codex took longer than 5 minutes; try again", "imagegen_timeout", http.StatusGatewayTimeout}
	}
	thread, said, paths := readCodexEvents(stdout.Bytes())
	file := g.findImage(thread, dir, paths)
	if file == "" {
		msg := strings.TrimSpace(said)
		if runErr != nil || msg == "" {
			msg = lastLines(stderr.String(), 4)
		}
		if strings.Contains(strings.ToLower(msg+stderr.String()), "login") || strings.Contains(strings.ToLower(msg+stderr.String()), "unauthorized") {
			return GeneratedImage{}, &codedError{"Codex isn't signed in. Run `codex login` in a terminal, then try again.", "imagegen_signed_out", http.StatusConflict}
		}
		if msg == "" {
			msg = "it made no image"
		}
		return GeneratedImage{}, &codedError{"Codex didn't make an image: " + msg, "imagegen_failed", http.StatusBadGateway}
	}
	b, err := os.ReadFile(file)
	if err != nil {
		return GeneratedImage{}, err
	}
	if len(b) > imageGenMax {
		return GeneratedImage{}, &codedError{"the image Codex made is too large", "imagegen_failed", http.StatusBadGateway}
	}
	mime := http.DetectContentType(b)
	if !strings.HasPrefix(mime, "image/") {
		return GeneratedImage{}, &codedError{"Codex's file isn't an image", "imagegen_failed", http.StatusBadGateway}
	}
	return GeneratedImage{Mime: mime, Data: base64.StdEncoding.EncodeToString(b), Prompt: prompt}, nil
}

var imagePath = regexp.MustCompile(`/[^"'\s]+\.(?:png|jpe?g|webp)`)

// readCodexEvents reads `codex exec --json`: the thread's id, its last
// message, and image paths it mentions.
func readCodexEvents(out []byte) (thread, said string, paths []string) {
	sc := bufio.NewScanner(bytes.NewReader(out))
	sc.Buffer(make([]byte, 64<<10), 8<<20)
	for sc.Scan() {
		var e struct {
			Type     string `json:"type"`
			ThreadID string `json:"thread_id"`
			Item     struct {
				Type    string `json:"type"`
				Text    string `json:"text"`
				Message string `json:"message"`
			} `json:"item"`
			Message string `json:"message"`
		}
		if json.Unmarshal(sc.Bytes(), &e) != nil {
			continue
		}
		switch {
		case e.Type == "thread.started":
			thread = e.ThreadID
		case e.Item.Type == "agent_message":
			said = e.Item.Text
		case e.Type == "error" || e.Type == "turn.failed":
			said = e.Message
		}
		if strings.Contains(sc.Text(), "generated_images") {
			paths = append(paths, imagePath.FindAllString(sc.Text(), -1)...)
		}
	}
	return thread, said, paths
}

// findImage is the newest image Codex saved for the thread, else one in
// the folder it ran in, else one its events named under generated_images.
func (g imageGen) findImage(thread, dir string, mentioned []string) string {
	var dirs []string
	if thread != "" && !strings.ContainsAny(thread, `/\`) && thread != ".." {
		dirs = append(dirs, filepath.Join(g.codexHome(), "generated_images", thread))
	}
	dirs = append(dirs, dir)
	for _, d := range dirs {
		if f := newestImage(d); f != "" {
			return f
		}
	}
	root := filepath.Join(g.codexHome(), "generated_images") + string(filepath.Separator)
	for i := len(mentioned) - 1; i >= 0; i-- {
		p := filepath.Clean(mentioned[i])
		if strings.HasPrefix(p, root) {
			if info, err := os.Stat(p); err == nil && info.Mode().IsRegular() {
				return p
			}
		}
	}
	return ""
}

func newestImage(dir string) string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return ""
	}
	type file struct {
		path string
		mod  time.Time
	}
	var files []file
	for _, e := range entries {
		ext := strings.ToLower(filepath.Ext(e.Name()))
		if !e.Type().IsRegular() || (ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".webp") {
			continue
		}
		if info, err := e.Info(); err == nil {
			files = append(files, file{filepath.Join(dir, e.Name()), info.ModTime()})
		}
	}
	if len(files) == 0 {
		return ""
	}
	sort.Slice(files, func(i, j int) bool { return files[i].mod.After(files[j].mod) })
	return files[0].path
}

func lastLines(s string, n int) string {
	var keep []string
	for _, l := range strings.Split(strings.TrimSpace(s), "\n") {
		// Codex logs its MCP servers' failures; they say nothing about the image.
		if l = strings.TrimSpace(l); l != "" && !strings.Contains(l, "rmcp::") && !strings.HasPrefix(l, "Reading additional input") {
			keep = append(keep, l)
		}
	}
	if len(keep) > n {
		keep = keep[len(keep)-n:]
	}
	return strings.Join(keep, " ")
}

type codedError struct {
	msg    string
	code   string
	status int
}

func (e *codedError) Error() string { return e.msg }

func (g imageGen) routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/imagegen", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"generators": g.list(r.Context())})
	})
	mux.HandleFunc("POST /v1/imagegen", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Generator string `json:"generator"`
			Prompt    string `json:"prompt"`
		}
		if !decodeBody(w, r, &req) {
			return
		}
		req.Prompt = strings.TrimSpace(req.Prompt)
		if req.Generator != "" && req.Generator != "codex" {
			writeError(w, http.StatusBadRequest, "unknown image generator "+req.Generator)
			return
		}
		if req.Prompt == "" || len(req.Prompt) > promptMax {
			writeError(w, http.StatusBadRequest, "describe the picture in at most 1000 characters")
			return
		}
		img, err := g.generate(r.Context(), req.Prompt)
		var ce *codedError
		switch {
		case errors.Is(err, errImageGenBusy):
			writeCoded(w, http.StatusConflict, err.Error(), "imagegen_busy")
		case errors.As(err, &ce):
			writeCoded(w, ce.status, ce.msg, ce.code)
		case err != nil:
			writeError(w, http.StatusInternalServerError, err.Error())
		default:
			writeJSON(w, http.StatusOK, img)
		}
	})
}
