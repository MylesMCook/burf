package box

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/sean-brydon/berthd/internal/wire"
)

// The artifacts API (artifacts.go):
//
//	GET    /v1/locations/{name}/worktrees/{worktree}/artifacts             a worktree's, newest change first
//	POST   /v1/locations/{name}/worktrees/{worktree}/artifacts             add one, or a version (berthd artifact add)
//	GET    /v1/locations/{name}/worktrees/{worktree}/artifacts/{id}        one, with its versions
//	DELETE /v1/locations/{name}/worktrees/{worktree}/artifacts/{id}        forget one
//	GET    /v1/locations/{name}/worktrees/{worktree}/artifacts/{id}/v/{n}  a version's content (n: a number or "latest")
//	GET    /v1/artifacts/{id}/v/{n}                                         the same by id alone, for the laptop's art- origin
//
// Content is always served as text/plain under a sandbox policy: a page is
// only ever run on its own origin by the laptop proxy (internal/proxy/
// artifact.go), never from the box's API.

func (b *Box) mountArtifacts(route func(string, func(http.ResponseWriter, *http.Request) error)) {
	const p = "/v1/locations/{name}/worktrees/{worktree}/artifacts"
	route("GET "+p, b.listArtifacts)
	route("POST "+p, b.addArtifact)
	route("GET "+p+"/{id}", b.getArtifact)
	route("DELETE "+p+"/{id}", b.removeArtifact)
	route("GET "+p+"/{id}/v/{n}", b.artifactContent)
	route("GET /v1/artifacts/{id}/v/{n}", b.artifactContent)
	route("GET "+p+"/{id}/img/{img}", b.artifactImage)
}

var errNoArtifacts = httpError{http.StatusNotImplemented, "this box keeps no artifacts"}

func (b *Box) artifactWorktree(r *http.Request) (Location, Worktree, error) {
	if b.Artifacts == nil {
		return Location{}, Worktree{}, errNoArtifacts
	}
	return b.worktreeRef(r.Context(), r.PathValue("name"), r.PathValue("worktree"))
}

func (b *Box) listArtifacts(w http.ResponseWriter, r *http.Request) error {
	_, wt, err := b.artifactWorktree(r)
	if err != nil {
		return err
	}
	writeJSON(w, b.Artifacts.List(wt.Path))
	return nil
}

type addArtifactRequest struct {
	ID      string `json:"id,omitempty"`
	Title   string `json:"title,omitempty"`
	Kind    string `json:"kind,omitempty"`
	Note    string `json:"note,omitempty"`
	Name    string `json:"name,omitempty"`
	Source  string `json:"source,omitempty"`
	Content string `json:"content"`
	Session string `json:"session,omitempty"`
	Agent   string `json:"agent,omitempty"`
	Helper  string `json:"helper,omitempty"`
}

// AddArtifactResult is what an add answers.
type AddArtifactResult struct {
	Artifact Artifact `json:"artifact"`
	// Changed: the content was new (a new version), not a retitle.
	Changed bool `json:"changed"`
	// Added: a new artifact, not a version of one.
	Added bool `json:"added"`
}

func (b *Box) addArtifact(w http.ResponseWriter, r *http.Request) error {
	loc, wt, err := b.artifactWorktree(r)
	if err != nil {
		return err
	}
	var req addArtifactRequest
	// The largest version (a page, 2 MB) as a JSON string, escaped.
	if err := decodeLimit(r, &req, 3*maxPageArtifact); err != nil {
		var he httpError
		if errors.As(err, &he) && he.status == http.StatusRequestEntityTooLarge {
			return tooLarge("a page may be 2 MB and data 1 MB; this is larger")
		}
		return err
	}
	if req.ID != "" && !ValidArtifactID(req.ID) {
		return badRequest("%q isn't an artifact id (berthd artifact list shows them)", req.ID)
	}
	// A visual diff is what berthd shots compare saw; an agent can't write
	// one of its own.
	if kind, _, err := classifyArtifact(req.Kind, req.Name, []byte(req.Content)); err == nil && kind == "visualdiff" {
		return badRequest("a visual diff is made by berthd shots compare, not added")
	}
	if err := b.before(r, "artifact.add", map[string]any{"location": loc.Name, "name": wt.Name, "path": wt.Path, "title": req.Title, "kind": req.Kind, "id": req.ID}); err != nil {
		return err
	}
	in := ArtifactInput{
		ID: req.ID, Title: req.Title, Kind: req.Kind, Note: req.Note, Name: filepath.Base(req.Name), Content: []byte(req.Content),
		By: ArtifactBy{Session: clipRunes(req.Session, 80), Agent: clipRunes(req.Agent, 40), Helper: clipRunes(req.Helper, 80)},
	}
	// A file on the box is remembered, and watched: only from the box
	// itself, where the path means this machine's file.
	if wire.IsLocal(r.Context()) && filepath.IsAbs(req.Source) {
		in.Source = filepath.Clean(req.Source)
		in.Watch = true
	}
	added := req.ID == ""
	if added && in.Source != "" {
		for _, a := range b.Artifacts.List(wt.Path) {
			if a.Source == in.Source {
				added = false
			}
		}
	}
	a, changed, err := b.Artifacts.Add(loc.Name, wt.Name, wt.Path, in)
	if err != nil {
		return err
	}
	typ := "artifact.updated"
	if added {
		typ = "artifact.added"
	}
	b.publish(r, typ, artifactEventData(a))
	writeJSON(w, AddArtifactResult{Artifact: a, Changed: changed, Added: added})
	return nil
}

func (b *Box) getArtifact(w http.ResponseWriter, r *http.Request) error {
	_, wt, err := b.artifactWorktree(r)
	if err != nil {
		return err
	}
	a, err := b.Artifacts.Get(r.PathValue("id"), wt.Path)
	if err != nil {
		return notFound(err)
	}
	writeJSON(w, a)
	return nil
}

func (b *Box) removeArtifact(w http.ResponseWriter, r *http.Request) error {
	loc, wt, err := b.artifactWorktree(r)
	if err != nil {
		return err
	}
	id := r.PathValue("id")
	if err := b.before(r, "artifact.remove", map[string]any{"location": loc.Name, "name": wt.Name, "path": wt.Path, "id": id}); err != nil {
		return err
	}
	a, err := b.Artifacts.Remove(id, wt.Path)
	if err != nil {
		return notFound(err)
	}
	b.publish(r, "artifact.removed", artifactEventData(a))
	writeJSON(w, a)
	return nil
}

func (b *Box) artifactContent(w http.ResponseWriter, r *http.Request) error {
	if b.Artifacts == nil {
		return errNoArtifacts
	}
	path := ""
	if r.PathValue("name") != "" {
		_, wt, err := b.artifactWorktree(r)
		if err != nil {
			return err
		}
		path = wt.Path
	}
	n := 0
	if s := r.PathValue("n"); s != "latest" {
		v, err := strconv.Atoi(s)
		if err != nil || v < 1 {
			return badRequest("a version is a number from 1, or latest")
		}
		n = v
	}
	a, v, body, err := b.Artifacts.Content(r.PathValue("id"), path, n)
	if err != nil {
		return notFound(err)
	}
	h := w.Header()
	h.Set("Content-Type", "text/plain; charset=utf-8")
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Content-Security-Policy", "default-src 'none'; sandbox")
	h.Set("X-Berth-Artifact-Kind", a.Kind)
	h.Set("X-Berth-Artifact-Format", a.Format)
	h.Set("X-Berth-Artifact-Version", strconv.Itoa(v.N))
	if n != 0 {
		// A version never changes.
		h.Set("Cache-Control", "private, max-age=31536000, immutable")
	} else {
		h.Set("Cache-Control", "no-store")
	}
	h.Set("Content-Length", strconv.Itoa(len(body)))
	_, _ = w.Write(body)
	return nil
}

func notFound(err error) error {
	if errors.Is(err, ErrUnknownArtifact) {
		return httpError{http.StatusNotFound, err.Error()}
	}
	return err
}

// artifactImage is one image of a visual diff: a PNG named by its content
// hash, from the artifact's own img/ folder. The app reads it with the
// box's credentials and draws it from a blob: URL, so no image is ever on
// an origin of its own, and only an artifact of a kind that has images
// answers.
func (b *Box) artifactImage(w http.ResponseWriter, r *http.Request) error {
	_, wt, err := b.artifactWorktree(r)
	if err != nil {
		return err
	}
	a, err := b.Artifacts.Get(r.PathValue("id"), wt.Path)
	if err != nil {
		return notFound(err)
	}
	name := r.PathValue("img")
	if a.Kind != "visualdiff" || !vdImgRe.MatchString(name) {
		return httpError{http.StatusNotFound, "no such image"}
	}
	body, err := os.ReadFile(filepath.Join(b.Artifacts.Folder(a.ID), "img", name))
	if err != nil {
		return httpError{http.StatusNotFound, "no such image (its version may have been dropped)"}
	}
	h := w.Header()
	h.Set("Content-Type", "image/png")
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Content-Security-Policy", "default-src 'none'; sandbox")
	// Named by its content: it never changes.
	h.Set("Cache-Control", "private, max-age=31536000, immutable")
	h.Set("Content-Length", strconv.Itoa(len(body)))
	_, _ = w.Write(body)
	return nil
}
