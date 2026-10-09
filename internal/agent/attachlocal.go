package agent

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/MylesMCook/burf/internal/box"
)

// A path pasted into the app (a screenshot's /var/folders/…/Screenshot.png,
// a file on the Desktop) names a file on this laptop, which an agent on a
// remote box can't read. POST /v1/boxes/{box}/attach-local reads that file
// here and uploads it to the box as an attachment (the box's
// .../attachments route), answering where it landed there. Only what the
// box would take anyway goes: an image, a PDF or text, up to its limit.

type attachLocalRequest struct {
	Path string `json:"path"`
	// Session, or Location and Worktree: whose worktree it goes to.
	Session  string `json:"session,omitempty"`
	Location string `json:"location,omitempty"`
	Worktree string `json:"worktree,omitempty"`
}

var localAttachExts = map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true, ".pdf": true, ".txt": true, ".md": true, ".log": true, ".csv": true, ".json": true}

// localAttachment reads the file a pasted path names, or says why not.
func localAttachment(path string) (string, []byte, error) {
	path = strings.TrimSpace(strings.TrimPrefix(path, "file://"))
	if p, err := url.PathUnescape(path); err == nil {
		path = p
	}
	if rest, ok := strings.CutPrefix(path, "~/"); ok {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", nil, err
		}
		path = filepath.Join(home, rest)
	}
	if !filepath.IsAbs(path) {
		return "", nil, errors.New("not a full path")
	}
	path = filepath.Clean(path)
	if !localAttachExts[strings.ToLower(filepath.Ext(path))] {
		return "", nil, errors.New("only images, PDFs and text files can be attached")
	}
	fi, err := os.Stat(path)
	if err != nil {
		return "", nil, fmt.Errorf("no file at %s on this computer", path)
	}
	if !fi.Mode().IsRegular() {
		return "", nil, errors.New("not a file")
	}
	if fi.Size() > box.MaxAttachment {
		return "", nil, fmt.Errorf("%s is larger than %d MB", filepath.Base(path), box.MaxAttachment>>20)
	}
	data, err := os.ReadFile(path)
	return filepath.Base(path), data, err
}

func (a *Agent) uiAttachLocal(w http.ResponseWriter, r *http.Request) {
	a.sync()
	c, ok := a.client(r.PathValue("box"))
	if !ok {
		writeCoded(w, http.StatusNotFound, "no paired box named "+r.PathValue("box"), "box_unknown")
		return
	}
	var req attachLocalRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	var route string
	switch {
	case req.Session != "":
		route = "sessions/" + url.PathEscape(req.Session)
	case req.Location != "" && req.Worktree != "":
		route = "locations/" + url.PathEscape(req.Location) + "/worktrees/" + url.PathEscape(req.Worktree)
	default:
		writeError(w, http.StatusBadRequest, "give a session, or a location and a worktree")
		return
	}
	name, data, err := localAttachment(req.Path)
	if err != nil {
		writeCoded(w, http.StatusBadRequest, err.Error(), "attach_local")
		return
	}
	target := "/v1/" + route + "/attachments?" + url.Values{"name": {name}}.Encode()
	header := http.Header{box.OriginHeader: {"app"}, "Content-Type": {"application/octet-stream"}}
	a.relayBox(w, r, c, http.MethodPost, target, bytes.NewReader(data), header)
}
