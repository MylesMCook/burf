package box

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/sean-brydon/berthd/internal/events"
	"github.com/sean-brydon/berthd/internal/statefile"
)

// Artifacts are things an agent made for the person to look at — a chart,
// a table, a diagram, notes, one small page — kept by the box for the
// worktree it was made in and drawn by the app (`berthd artifact add`).
//
// They live outside the worktree, in the box's state folder, one folder
// per artifact: meta.json and a file per version kept (v<n>.<ext>). The
// first version and the newest eight are kept. A file added from the box
// itself is watched: when the agent rewrites it, the new content is a new
// version, live in every view. Nothing is read from the worktree on its
// own: only `artifact add` registers one, so a repository can't plant
// any.

// ErrUnknownArtifact is an artifact id this box doesn't keep (or keeps for
// another worktree).
var ErrUnknownArtifact = errors.New("no such artifact")

const (
	// keepNewest is how many of the latest versions are kept, besides the
	// first.
	keepNewest = 8
	// maxDataArtifact and maxPageArtifact bound one version: a chart, a
	// table, a diagram or notes, and a page.
	maxDataArtifact = 1 << 20
	maxPageArtifact = 2 << 20
	// maxArtifactsPerWorktree bounds how many one worktree keeps.
	maxArtifactsPerWorktree = 200
	maxArtifactTitle        = 120
	maxArtifactNote         = 200
)

// ArtifactKind describes one kind: the formats it takes and how big a
// version may be. A new kind (a visual diff, say) is one more entry here,
// one in kindFor's inference, and a viewer in the app (lib/art/kinds.ts).
type ArtifactKind struct {
	Name    string
	Formats []string
	MaxSize int
}

var artifactKinds = map[string]ArtifactKind{
	"chart":   {Name: "chart", Formats: []string{"chart"}, MaxSize: maxDataArtifact},
	"table":   {Name: "table", Formats: []string{"csv", "tsv", "json"}, MaxSize: maxDataArtifact},
	"diagram": {Name: "diagram", Formats: []string{"mermaid"}, MaxSize: maxDataArtifact},
	"notes":   {Name: "notes", Formats: []string{"markdown"}, MaxSize: maxDataArtifact},
	"page":    {Name: "page", Formats: []string{"html"}, MaxSize: maxPageArtifact},
	// A visual diff: a berth.visualdiff/v1 manifest per version, its
	// images by content hash beside the versions (img/). Only
	// `berthd shots compare` makes one (shots.go).
	"visualdiff": {Name: "visualdiff", Formats: []string{"visualdiff"}, MaxSize: maxVisualDiff},
}

// ArtifactKinds are the kinds this box takes, sorted.
func ArtifactKinds() []string {
	out := make([]string, 0, len(artifactKinds))
	for k := range artifactKinds {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

var formatExt = map[string]string{"visualdiff": "json", "chart": "json", "csv": "csv", "tsv": "tsv", "json": "json", "mermaid": "mmd", "markdown": "md", "html": "html"}

// ArtifactBy is who made an artifact: the berth session (and its agent)
// the command ran in, and a helper's name when a helper said it.
type ArtifactBy struct {
	Session string `json:"session,omitempty"`
	Agent   string `json:"agent,omitempty"`
	Helper  string `json:"helper,omitempty"`
}

// ArtifactVersion is one version kept.
type ArtifactVersion struct {
	N      int       `json:"n"`
	At     time.Time `json:"at"`
	Size   int       `json:"size"`
	SHA256 string    `json:"sha256"`
	Note   string    `json:"note,omitempty"`
}

// Artifact is one artifact and the versions kept of it.
type Artifact struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Kind     string `json:"kind"`
	Format   string `json:"format"`
	Location string `json:"location"`
	Worktree string `json:"worktree"`
	// Path is the worktree's folder; Source the file it was registered
	// from, and File that file relative to the worktree when it's in it.
	Path    string     `json:"path"`
	Source  string     `json:"source,omitempty"`
	File    string     `json:"file,omitempty"`
	By      ArtifactBy `json:"by"`
	Created time.Time  `json:"created"`
	Updated time.Time  `json:"updated"`
	// Watched: a rewrite of Source becomes a new version.
	Watched bool `json:"watched,omitempty"`
	// Key makes a re-run a new version of this artifact rather than a new
	// one: a visual diff's is visualdiff:<base>.
	Key string `json:"key,omitempty"`
	// Problem is why the source's latest rewrite wasn't taken (it didn't
	// parse, grew too big, looked like a secret); cleared by the next
	// version.
	Problem  string            `json:"problem,omitempty"`
	Versions []ArtifactVersion `json:"versions"`
}

// Latest is the newest version kept.
func (a Artifact) Latest() ArtifactVersion {
	if len(a.Versions) == 0 {
		return ArtifactVersion{}
	}
	return a.Versions[len(a.Versions)-1]
}

// ArtifactInput is an add: the content and what it is.
type ArtifactInput struct {
	// ID updates that artifact; empty adds one, or updates the one this
	// worktree already has from the same Source.
	ID      string
	Title   string
	Kind    string
	Note    string
	Name    string // the file's name, for its kind
	Source  string // its path on the box, when added from the box
	Content []byte
	By      ArtifactBy
	// Watch the source for rewrites.
	Watch bool
	// Key, for a new artifact: see Artifact.Key.
	Key string
	// NewID is the id a new artifact takes, one ReserveID gave (its
	// folder may hold files already, such as a visual diff's images).
	NewID string
}

// ArtifactStore keeps the box's artifacts.
type ArtifactStore struct {
	Dir    string
	Events *events.Bus
	Box    string
	// Now is the clock (tests).
	Now func() time.Time

	mu       sync.Mutex
	loaded   bool
	byID     map[string]*Artifact
	reserved map[string]bool
	// watch is what the watcher saw of each watched source last.
	watch map[string]sourceStat
}

func (s *ArtifactStore) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

// ArtifactHostPrefix starts the host label of an artifact's own origin,
// art-<id>.<box>.localhost:1377 (internal/proxy/artifact.go). No location
// or worktree may take a name starting with it, so those hosts can't be
// read as anything else.
const ArtifactHostPrefix = "art-"

// ReservedName says a location or worktree name is kept for artifacts.
func ReservedName(name string) bool {
	return strings.HasPrefix(strings.ToLower(name), ArtifactHostPrefix)
}

var artifactIDRe = regexp.MustCompile(`^[0-9a-f]{10}$`)

// ValidArtifactID says id has the form the box gives ids.
func ValidArtifactID(id string) bool { return artifactIDRe.MatchString(id) }

func newArtifactID() string {
	var b [5]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

func (s *ArtifactStore) load() {
	if s.loaded {
		return
	}
	s.loaded = true
	s.byID = map[string]*Artifact{}
	ents, _ := os.ReadDir(s.Dir)
	for _, e := range ents {
		if !e.IsDir() || !ValidArtifactID(e.Name()) {
			continue
		}
		b, err := os.ReadFile(filepath.Join(s.Dir, e.Name(), "meta.json"))
		if err != nil {
			continue
		}
		var a Artifact
		if json.Unmarshal(b, &a) != nil || a.ID != e.Name() || len(a.Versions) == 0 {
			continue
		}
		s.byID[a.ID] = &a
	}
}

func (s *ArtifactStore) save(a *Artifact) error {
	b, err := json.MarshalIndent(a, "", "  ")
	if err != nil {
		return err
	}
	return statefile.Write(filepath.Join(s.Dir, a.ID, "meta.json"), b)
}

func (s *ArtifactStore) versionPath(a *Artifact, n int) string {
	return filepath.Join(s.Dir, a.ID, fmt.Sprintf("v%d.%s", n, formatExt[a.Format]))
}

// List is a worktree's artifacts, newest change first.
func (s *ArtifactStore) List(path string) []Artifact {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.load()
	var out []Artifact
	for _, a := range s.byID {
		if a.Path == path {
			out = append(out, clone(a))
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].Updated.Equal(out[j].Updated) {
			return out[i].Updated.After(out[j].Updated)
		}
		return out[i].ID < out[j].ID
	})
	return out
}

func clone(a *Artifact) Artifact {
	c := *a
	c.Versions = slices.Clone(a.Versions)
	return c
}

// Get is one artifact; with path set, only if it belongs to that worktree.
func (s *ArtifactStore) Get(id, path string) (Artifact, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.load()
	a, ok := s.byID[id]
	if !ok || (path != "" && a.Path != path) {
		return Artifact{}, ErrUnknownArtifact
	}
	return clone(a), nil
}

// Content is a version's content; n 0 is the latest.
func (s *ArtifactStore) Content(id, path string, n int) (Artifact, ArtifactVersion, []byte, error) {
	a, err := s.Get(id, path)
	if err != nil {
		return a, ArtifactVersion{}, nil, err
	}
	v := a.Latest()
	if n != 0 {
		i := slices.IndexFunc(a.Versions, func(v ArtifactVersion) bool { return v.N == n })
		if i < 0 {
			return a, ArtifactVersion{}, nil, fmt.Errorf("%w: v%d isn't kept (kept: %s)", ErrUnknownArtifact, n, keptList(a))
		}
		v = a.Versions[i]
	}
	b, err := os.ReadFile(s.versionPath(&a, v.N))
	return a, v, b, err
}

func keptList(a Artifact) string {
	var ns []string
	for _, v := range a.Versions {
		ns = append(ns, fmt.Sprintf("v%d", v.N))
	}
	return strings.Join(ns, ", ")
}

// Add registers an artifact for a worktree, or a new version of one.
// Changed is false when the content is the latest version's already (a
// retitle or nothing).
func (s *ArtifactStore) Add(loc, wt, path string, in ArtifactInput) (a Artifact, changed bool, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.load()
	in.Title = strings.TrimSpace(in.Title)
	in.Note = clipRunes(strings.TrimSpace(in.Note), maxArtifactNote)
	if utf8.RuneCountInString(in.Title) > maxArtifactTitle {
		return a, false, badRequest("the title is longer than %d characters", maxArtifactTitle)
	}
	var cur *Artifact
	switch {
	case in.ID != "":
		c, ok := s.byID[in.ID]
		if !ok || c.Path != path {
			return a, false, fmt.Errorf("%w %s in %s/%s", ErrUnknownArtifact, in.ID, loc, wt)
		}
		cur = c
	case in.Source != "":
		for _, c := range s.byID {
			if c.Path == path && c.Source == in.Source {
				cur = c
				break
			}
		}
	}
	kind, format, err := classifyArtifact(in.Kind, in.Name, in.Content)
	if err != nil {
		return a, false, err
	}
	if cur != nil && kind != cur.Kind {
		return a, false, badRequest("%s is a %s; a new version must be one too (this looks like a %s)", cur.ID, cur.Kind, kind)
	}
	if err := checkArtifact(kind, format, in.Content); err != nil {
		return a, false, err
	}
	now := s.now().UTC()
	if cur == nil {
		if in.Title == "" {
			return a, false, badRequest("an artifact needs a title (--title)")
		}
		n := 0
		for _, c := range s.byID {
			if c.Path == path {
				n++
			}
		}
		if n >= maxArtifactsPerWorktree {
			return a, false, badRequest("this worktree keeps %d artifacts already; update one (--id) or remove some (berthd artifact rm)", n)
		}
		id := in.NewID
		if !ValidArtifactID(id) || s.byID[id] != nil {
			id = newArtifactID()
			for s.byID[id] != nil || s.reserved[id] {
				id = newArtifactID()
			}
		}
		delete(s.reserved, id)
		cur = &Artifact{ID: id, Title: in.Title, Kind: kind, Format: format, Location: loc, Worktree: wt, Path: path, By: in.By, Created: now, Key: in.Key}
	}
	if in.Title != "" {
		cur.Title = in.Title
	}
	if in.Source != "" {
		cur.Source = in.Source
		cur.File = ""
		if rel, err := filepath.Rel(path, in.Source); err == nil && !strings.HasPrefix(rel, "..") && !filepath.IsAbs(rel) {
			cur.File = filepath.ToSlash(rel)
		}
	}
	if in.Watch && in.Source != "" {
		cur.Watched = true
	}
	cur.Format = format
	sum := sha256.Sum256(in.Content)
	hash := hex.EncodeToString(sum[:])
	changed = len(cur.Versions) == 0 || cur.Latest().SHA256 != hash
	if changed {
		if err := s.appendVersion(cur, in.Content, hash, in.Note, now); err != nil {
			return a, false, err
		}
	} else if in.Note != "" {
		cur.Versions[len(cur.Versions)-1].Note = in.Note
	}
	cur.Problem = ""
	cur.Updated = now
	if err := s.save(cur); err != nil {
		return a, false, err
	}
	s.byID[cur.ID] = cur
	if cur.Watched {
		s.noteSource(cur.Source)
	}
	return clone(cur), changed, nil
}

// appendVersion writes content as the next version and drops the ones
// past the first and the newest keepNewest.
func (s *ArtifactStore) appendVersion(a *Artifact, content []byte, hash, note string, at time.Time) error {
	n := 1
	if len(a.Versions) > 0 {
		n = a.Latest().N + 1
	}
	v := ArtifactVersion{N: n, At: at, Size: len(content), SHA256: hash, Note: note}
	if err := os.MkdirAll(filepath.Join(s.Dir, a.ID), 0o700); err != nil {
		return err
	}
	if err := statefile.Write(s.versionPath(a, n), content); err != nil {
		return err
	}
	a.Versions = append(a.Versions, v)
	for len(a.Versions) > keepNewest+1 {
		drop := a.Versions[1]
		_ = os.Remove(s.versionPath(a, drop.N))
		a.Versions = append(a.Versions[:1], a.Versions[2:]...)
	}
	return nil
}

// ReserveID gives an id no artifact has, for a new artifact whose files
// are written before it is added (a visual diff's images).
func (s *ArtifactStore) ReserveID() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.load()
	if s.reserved == nil {
		s.reserved = map[string]bool{}
	}
	id := newArtifactID()
	for s.byID[id] != nil || s.reserved[id] {
		id = newArtifactID()
	}
	s.reserved[id] = true
	return id
}

// Folder is where an artifact's files are kept.
func (s *ArtifactStore) Folder(id string) string { return filepath.Join(s.Dir, id) }

// Remove forgets an artifact and its versions.
func (s *ArtifactStore) Remove(id, path string) (Artifact, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.load()
	a, ok := s.byID[id]
	if !ok || (path != "" && a.Path != path) {
		return Artifact{}, ErrUnknownArtifact
	}
	delete(s.byID, id)
	if err := os.RemoveAll(filepath.Join(s.Dir, id)); err != nil {
		return Artifact{}, err
	}
	return clone(a), nil
}

// RemoveWorktree forgets every artifact of a worktree that is gone.
func (s *ArtifactStore) RemoveWorktree(path string) []Artifact {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.load()
	var gone []Artifact
	for id, a := range s.byID {
		if a.Path == path {
			delete(s.byID, id)
			_ = os.RemoveAll(filepath.Join(s.Dir, id))
			gone = append(gone, clone(a))
		}
	}
	return gone
}

func clipRunes(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	r := []rune(s)
	return string(r[:n-1]) + "…"
}

// classifyArtifact works out an artifact's kind and format from what the
// agent said (--kind), the file's name and its content.
func classifyArtifact(kind, name string, content []byte) (string, string, error) {
	kind = strings.ToLower(strings.TrimSpace(kind))
	if kind != "" {
		if _, ok := artifactKinds[kind]; !ok {
			return "", "", badRequest("unknown kind %q: use %s", kind, strings.Join(ArtifactKinds(), ", "))
		}
	}
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))
	trim := strings.TrimSpace(string(content))
	isChart := strings.HasPrefix(trim, "{") && chartSchemaRe.MatchString(firstBytes(trim, 4096))
	isVisualDiff := strings.HasPrefix(trim, "{") && visualDiffSchemaRe.MatchString(firstBytes(trim, 4096))
	format := ""
	switch {
	case isVisualDiff:
		format = "visualdiff"
	case isChart:
		format = "chart"
	case ext == "csv":
		format = "csv"
	case ext == "tsv":
		format = "tsv"
	case ext == "json" && strings.HasPrefix(trim, "["):
		format = "json"
	case ext == "mmd" || ext == "mermaid":
		format = "mermaid"
	case ext == "md" || ext == "markdown":
		format = "markdown"
	case ext == "html" || ext == "htm":
		format = "html"
	}
	// With a kind and no format from the name, the kind's own format.
	if kind != "" && (format == "" || !slices.Contains(artifactKinds[kind].Formats, format)) {
		switch kind {
		case "chart":
			format = "chart"
		case "table":
			switch {
			case strings.HasPrefix(trim, "["):
				format = "json"
			case strings.Contains(headLine(trim), "\t"):
				format = "tsv"
			default:
				format = "csv"
			}
		default:
			format = artifactKinds[kind].Formats[0]
		}
	}
	if format == "" {
		return "", "", badRequest("can't tell what %s is: name it .json (berth.chart/v1), .csv, .tsv, .mmd, .md or .html, or say --kind %s", firstNonEmptyStr(name, "the file"), strings.Join(ArtifactKinds(), "|"))
	}
	if kind == "" {
		for k, spec := range artifactKinds {
			if slices.Contains(spec.Formats, format) {
				kind = k
				break
			}
		}
	}
	return kind, format, nil
}

var (
	chartSchemaRe      = regexp.MustCompile(`"\$schema"\s*:\s*"berth\.chart/v1"`)
	visualDiffSchemaRe = regexp.MustCompile(`"\$schema"\s*:\s*"berth\.visualdiff/v1"`)
)

func firstBytes(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

func headLine(s string) string {
	line, _, _ := strings.Cut(s, "\n")
	return line
}

func firstNonEmptyStr(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// checkArtifact refuses what the box won't keep: too big, not text, a
// spec or table that doesn't parse, or something that looks like a secret.
func checkArtifact(kind, format string, content []byte) error {
	spec := artifactKinds[kind]
	if len(content) == 0 {
		return badRequest("the file is empty")
	}
	if len(content) > spec.MaxSize {
		return tooLarge(fmt.Sprintf("a %s may be %d KB; this is %d KB. Aggregate first (p95 per hour, not every request)", kind, spec.MaxSize>>10, (len(content)+1023)>>10))
	}
	if !utf8.Valid(content) || slices.Contains(content, 0) {
		return badRequest("an artifact is text (UTF-8); this file isn't")
	}
	if what := LooksLikeSecret(content); what != "" {
		return badRequest("refused: this looks like it holds a secret (%s). Artifacts are kept on the box and shown in the app; leave secrets, tokens and keys out", what)
	}
	switch format {
	case "visualdiff":
		return ValidateVisualDiff(content)
	case "chart":
		return ValidateChart(content)
	case "json":
		var rows []map[string]any
		if err := json.Unmarshal(content, &rows); err != nil {
			return badRequest("a JSON table is an array of objects, one per row: %v", jsonProblem(err))
		}
		if len(rows) > maxChartRows {
			return badRequest("a table may have %d rows; this has %d", maxChartRows, len(rows))
		}
	case "csv", "tsv":
		lines := strings.Count(strings.TrimSpace(string(content)), "\n") + 1
		if lines > maxChartRows+1 {
			return badRequest("a table may have %d rows; this has %d", maxChartRows, lines-1)
		}
	}
	return nil
}

func tooLarge(msg string) error { return httpError{413, msg} }

func jsonProblem(err error) string {
	var se *json.SyntaxError
	if errors.As(err, &se) {
		return fmt.Sprintf("%v (at byte %d)", se, se.Offset)
	}
	var te *json.UnmarshalTypeError
	if errors.As(err, &te) {
		if te.Field != "" {
			return fmt.Sprintf("%s is a %s, not a %s", te.Field, te.Value, te.Type)
		}
		return fmt.Sprintf("found a %s where a %s goes", te.Value, te.Type)
	}
	return err.Error()
}
