package mcpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"unicode"
	"unicode/utf8"

	"github.com/MylesMCook/burf/internal/box"
	"github.com/MylesMCook/burf/internal/boxcmd"
)

// A structured chat's own tool server (box/chattools.go): `burfd mcp
// --socket PATH --chat ID`, started by the chat's provider outside its
// sandbox. It is this package's server with the chat as its caller, so work
// it starts reports back into the chat, plus the one thing a sandboxed
// command cannot do for itself: show the person a file. Before a tool that
// acts, it asks the chat's person through the box and waits.

// chatCaller is how a chat is named as the caller of work (box.chatCaller).
const chatCaller = "chat:"

// acting are the tools that do something outside the provider's sandbox: a
// command, an agent, a prompt to one. The chat's person is asked first.
var acting = map[string]bool{
	"berth_task_new": true, "berth_send": true, "berth_exec": true,
	"berth_run_start": true, "berth_run_cancel": true, "berth_attempts": true,
}

// plain is a tool answer given as it is, not as JSON.
type plain string

// chatTools are the tools only a chat's server has.
var chatTools = []Tool{
	{Name: "berth_artifact_add", Description: "Show the person a file you made, as a chart, table, diagram, notes or one small page in their Burf app, with a card in this chat. The file is a berth.chart JSON, a CSV, Mermaid, Markdown or one self-contained HTML file inside this chat's folder. Give id to add a version to an artifact you made before. Use this instead of `berthd artifact add`: a command in your sandbox cannot reach Burf.", InputSchema: obj(map[string]any{
		"file":  str("the file, absolute or relative to this chat's folder"),
		"title": str("what it shows, in a few words"),
		"kind":  str("chart, table, diagram, page or notes (default: from the file)"),
		"id":    str("an artifact's id, to update it instead of adding one"),
		"note":  str("what changed in this version"),
	}, "file"), call: artifactAdd},
}

// ServeChat serves one chat's tools on in and out until in ends.
func ServeChat(ctx context.Context, c *box.Client, chat string, in io.Reader, out io.Writer) error {
	return (&Server{Box: c, Chat: chat, Caller: chatCaller + chat}).Serve(ctx, in, out)
}

func (s *Server) tools() []Tool {
	if s.Chat == "" {
		return Tools
	}
	return append(append([]Tool{}, Tools...), chatTools...)
}

func (s *Server) chatInstructions() string {
	if s.Chat == "" {
		return ""
	}
	return "You are in a Burf chat. To show the person a chart, table, diagram, notes or page, write the file and call berth_artifact_add. A tool that starts work or runs a command asks the person first; a refusal is final. "
}

// ask has the chat's person allow a tool that acts. Outside a chat there is
// no one to ask here: the agent's own approvals apply. final says the answer
// stands: a refusal to ask at all can be put right and tried again.
func (s *Server) ask(ctx context.Context, tool string, args map[string]any) (final bool, err error) {
	if s.Chat == "" || !acting[tool] {
		return false, nil
	}
	// The person allows what they are shown, so all of it must show: nothing
	// that hides or reorders text on screen, and nothing cut short.
	if unreadable(args) {
		return false, errors.New("an argument holds characters that would not show as written (controls, invisible or direction marks); remove them and call again")
	}
	detail := describe(tool, args)
	if padded(detail) {
		return false, fmt.Errorf("an argument holds a run of more than %d blank characters, which would push the rest out of sight; remove it and call again", maxBlank)
	}
	if len(detail) > maxAskDetail {
		return false, fmt.Errorf("this is too long to show the person in full (%d bytes, at most %d); make it shorter and call again", len(detail), maxAskDetail)
	}
	return true, s.Box.Call(ctx, http.MethodPost, "/v1/chats/"+url.PathEscape(s.Chat)+"/tools/approve", map[string]any{"tool": tool, "detail": detail}, nil)
}

// maxAskDetail keeps a question within what a chat takes (localchat's 8 KiB).
const maxAskDetail = 6 << 10

// hidden is a character that would not read as it is written. Anything that
// is not a letter, mark, number, punctuation, symbol or space is refused
// (controls, format and direction marks, separators, private and unassigned
// code points), and so is everything Unicode says is drawn as nothing by
// default: joiners, variation selectors, fillers. A line break and a tab stay.
func hidden(r rune) bool {
	switch {
	case r == '\n' || r == '\t':
		return false
	case !unicode.IsGraphic(r), r == utf8.RuneError:
		return true
	case unicode.In(r, unicode.Other_Default_Ignorable_Code_Point, unicode.Variation_Selector):
		return true
	case r == 0x2800: // a Braille pattern with no dots
		return true
	}
	return false
}

// maxBlank is the longest run of blank space shown as it is. A longer one
// would push what follows out of sight in the question.
const maxBlank = 64

// padded says whether text holds a run of more than maxBlank spaces, tabs
// and line breaks.
func padded(text string) bool {
	run := 0
	for _, r := range text {
		if !unicode.IsSpace(r) {
			run = 0
			continue
		}
		if run++; run > maxBlank {
			return true
		}
	}
	return false
}

// unreadable looks at every name and string in the arguments, however deep,
// as they are before anything is escaped for show.
func unreadable(v any) bool {
	switch x := v.(type) {
	case string:
		return strings.ContainsFunc(x, hidden)
	case map[string]any:
		for k, e := range x {
			if strings.ContainsFunc(k, hidden) || unreadable(e) {
				return true
			}
		}
	case []any:
		for _, e := range x {
			if unreadable(e) {
				return true
			}
		}
	}
	return false
}

// describe says what a call would do, for the person asked to allow it: a
// command as a command, anything else argument by argument, each as the tool
// itself reads it (arg), so what is shown is what is sent.
func describe(tool string, args map[string]any) string {
	var lines []string
	keys := make([]string, 0, len(args))
	for k := range args {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	command := ""
	for _, k := range keys {
		switch v := args[k].(type) {
		case string, float64:
			text := arg(args, k)
			if tool == "berth_exec" && k == "command" {
				command = "$ " + text
				continue
			}
			lines = append(lines, k+": "+text)
		default:
			// A list or a set of parameters, as the JSON that is sent on.
			var b strings.Builder
			enc := json.NewEncoder(&b)
			enc.SetEscapeHTML(false)
			enc.SetIndent("", "  ")
			_ = enc.Encode(v)
			lines = append(lines, k+": "+strings.TrimSpace(b.String()))
		}
	}
	if command != "" {
		lines = append(lines, command)
	}
	return strings.Join(lines, "\n")
}

// place is the chat's folder and its worktree, asked of the box once.
func (s *Server) place(ctx context.Context) (cwd, location string, err error) {
	if s.cwd == "" {
		var chat struct {
			CWD      string `json:"cwd"`
			Location string `json:"location"`
		}
		if err = s.Box.Call(ctx, http.MethodGet, "/v1/chats/"+url.PathEscape(s.Chat), nil, &chat); err != nil {
			return "", "", err
		}
		if chat.CWD == "" || chat.Location == "" {
			return "", "", errors.New("this chat has no project folder")
		}
		s.cwd, s.loc = chat.CWD, chat.Location
	}
	return s.cwd, s.loc, nil
}

func artifactAdd(ctx context.Context, s *Server, a map[string]any) (any, error) {
	if err := need(a, "file"); err != nil {
		return nil, err
	}
	cwd, location, err := s.place(ctx)
	if err != nil {
		return nil, err
	}
	file := arg(a, "file")
	if !filepath.IsAbs(file) {
		file = filepath.Join(cwd, file)
	}
	// Only what the chat's own folder holds, wherever a link points.
	resolved, err := filepath.EvalSymlinks(file)
	if err != nil {
		return nil, fmt.Errorf("can't read %s: %w", arg(a, "file"), errors.Unwrap(err))
	}
	root, err := filepath.EvalSymlinks(cwd)
	if err != nil {
		return nil, err
	}
	if !strings.HasPrefix(resolved, root+string(os.PathSeparator)) {
		return nil, errors.New("the file must be inside this chat's folder")
	}
	// Opened beneath the folder itself: whatever is done to the path between
	// that look and this read, nothing outside the folder can be what is read.
	rel, err := filepath.Rel(root, resolved)
	if err != nil {
		return nil, errors.New("the file must be inside this chat's folder")
	}
	content, err := readBeneath(root, rel)
	if err != nil {
		return nil, err
	}
	loc, wt, err := s.worktree(ctx, cwd, location)
	if err != nil {
		return nil, err
	}
	// No source: the box would watch that path and read it again later,
	// whatever it had become by then. A new version is another call with id.
	req := map[string]any{
		"id": arg(a, "id"), "title": arg(a, "title"), "kind": arg(a, "kind"), "note": arg(a, "note"),
		"name": filepath.Base(resolved), "content": string(content), "agent": "codex",
	}
	var res box.AddArtifactResult
	if err = s.Box.Call(ctx, http.MethodPost, "/v1/locations/"+url.PathEscape(loc)+"/worktrees/"+url.PathEscape(wt)+"/artifacts", req, &res); err != nil {
		return nil, err
	}
	line := boxcmd.ArtifactLine(res.Artifact)
	switch {
	case res.Added:
		line += fmt.Sprintf("\nShown in this chat and on %s's board. To update it, call berth_artifact_add again with id %s.", wt, res.Artifact.ID)
	case res.Changed:
		line += fmt.Sprintf("\nVersion %d is live.", res.Artifact.Latest().N)
	default:
		line += " (no change)"
	}
	return plain(line), nil
}

// maxArtifactFile keeps a huge file off the wire; the box says the exact limit.
const maxArtifactFile = 4 << 20

// readBeneath reads one ordinary file beneath dir (os.Root): each folder on
// the way is checked as it is walked, so a link leading out of dir is not
// followed whenever it was put there. It does not wait on a pipe.
func readBeneath(dir, rel string) ([]byte, error) {
	root, err := os.OpenRoot(dir)
	if err != nil {
		return nil, err
	}
	defer root.Close()
	f, err := root.OpenFile(rel, os.O_RDONLY|syscall.O_NONBLOCK, 0)
	if err != nil {
		return nil, errors.New("the file must be an ordinary file inside this chat's folder")
	}
	defer f.Close()
	fi, err := f.Stat()
	if err != nil || !fi.Mode().IsRegular() {
		return nil, errors.New("an artifact is one ordinary file")
	}
	if fi.Size() > maxArtifactFile {
		return nil, fmt.Errorf("the file is %d KB: an artifact is at most 2 MB (a page) or 1 MB (data). Aggregate first", fi.Size()>>10)
	}
	return io.ReadAll(io.LimitReader(f, maxArtifactFile))
}

// worktree names the chat's worktree as the box's routes do.
func (s *Server) worktree(ctx context.Context, cwd, location string) (loc, wt string, err error) {
	loc, wt, _ = strings.Cut(location, "/")
	if wt != "" {
		return loc, wt, nil
	}
	// A project's own checkout: its worktree has a name of its own.
	locations, err := s.Box.Locations(ctx)
	if err != nil {
		return "", "", err
	}
	for _, l := range locations {
		if l.Name != loc {
			continue
		}
		for _, w := range l.Worktrees {
			if w.Main || w.Path == cwd {
				return loc, w.Name, nil
			}
		}
	}
	return "", "", errors.New("this chat's project is no longer on the box")
}
