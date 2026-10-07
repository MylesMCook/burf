package box

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/sean-brydon/berthd/internal/events"
	"github.com/sean-brydon/berthd/internal/statefile"
)

// Storage for visual diffs: images by content hash, so a re-run adds only
// what changed; baselines per worktree; and the diffs themselves.

// imgStore keeps images by their content in one folder.
type imgStore struct {
	dir   string
	mu    sync.Mutex
	bytes int // written by this store, not already there
	ms    int
}

// imgName is an image's name in a store: its SHA-256's first 16 hex
// digits.
func imgName(raw []byte) string {
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:8]) + ".png"
}

func (s *imgStore) put(raw []byte) string {
	name := imgName(raw)
	s.mu.Lock()
	defer s.mu.Unlock()
	t := time.Now()
	os.MkdirAll(s.dir, 0o755)
	p := filepath.Join(s.dir, name)
	if _, err := os.Stat(p); err != nil {
		if statefile.Write(p, raw) == nil {
			s.bytes += len(raw)
		}
	}
	s.ms += int(time.Since(t).Milliseconds())
	return name
}

// gcImages removes the images in dir no kept manifest names.
func gcImages(dir string, keep map[string]bool) {
	ents, _ := os.ReadDir(dir)
	for _, e := range ents {
		if vdImgRe.MatchString(e.Name()) && !keep[e.Name()] {
			os.Remove(filepath.Join(dir, e.Name()))
		}
	}
}

func encodePNG(img image.Image) []byte {
	var buf bytes.Buffer
	(&png.Encoder{CompressionLevel: png.BestSpeed}).Encode(&buf, img)
	return buf.Bytes()
}

func dirSize(dir string) int {
	n := 0
	filepath.Walk(dir, func(_ string, fi os.FileInfo, err error) error {
		if err == nil && !fi.IsDir() {
			n += int(fi.Size())
		}
		return nil
	})
	return n
}

// --- the diffs ----------------------------------------------------------------

// A visual diff is an artifact (artifacts.go) of kind visualdiff: each
// version's content is its manifest, and its images sit in the artifact's
// folder, img/, shared by every version (a re-run adds only what changed).
// The artifact store keeps the first version and the newest 8; an image no
// kept version names goes with the versions.

// prepareDiff finds the worktree's visual diff with key to add a version
// to (unless fresh), or reserves an id for a new one; imgDir is where its
// images go.
func (b *Box) prepareDiff(wt Worktree, key string, fresh bool) (id, imgDir string, existing bool, err error) {
	if b.Artifacts == nil {
		return "", "", false, errNoArtifacts
	}
	if !fresh {
		for _, a := range b.Artifacts.List(wt.Path) { // newest change first
			if a.Kind == "visualdiff" && a.Key == key {
				id, existing = a.ID, true
				break
			}
		}
	}
	if id == "" {
		id = b.Artifacts.ReserveID()
	}
	imgDir = filepath.Join(b.Artifacts.Folder(id), "img")
	return id, imgDir, existing, os.MkdirAll(imgDir, 0o700)
}

// commitDiff keeps raw as the visual diff's next version, announces it as
// any artifact's (artifact.added or artifact.updated), and drops the
// images no kept version names.
func (b *Box) commitDiff(loc Location, wt Worktree, id string, existing bool, key string, raw []byte, title, note string, by ArtifactBy) (Artifact, error) {
	in := ArtifactInput{Title: title, Kind: "visualdiff", Note: note, Name: "visualdiff.json", Content: raw, By: by, Key: key}
	if existing {
		in.ID = id
	} else {
		in.NewID = id
	}
	a, _, err := b.Artifacts.Add(loc.Name, wt.Name, wt.Path, in)
	if err != nil {
		return a, err
	}
	keep := map[string]bool{}
	for _, v := range a.Versions {
		if _, _, body, err := b.Artifacts.Content(a.ID, wt.Path, v.N); err == nil {
			var vd VisualDiff
			if json.Unmarshal(body, &vd) == nil {
				for _, im := range vd.Images() {
					keep[im] = true
				}
			}
		}
	}
	gcImages(filepath.Join(b.Artifacts.Folder(a.ID), "img"), keep)
	typ := "artifact.updated"
	if !existing {
		typ = "artifact.added"
	}
	if b.Events != nil {
		data := artifactEventData(a)
		data["summary"] = summaryOf(raw)
		b.Events.Publish(events.Event{Type: typ, Box: b.Name, Origin: "shots", Data: data})
	}
	return a, nil
}

func summaryOf(raw []byte) string {
	var vd struct {
		Summary vdSummary `json:"summary"`
	}
	json.Unmarshal(raw, &vd)
	return vd.Summary.Text
}

// latestDiff is a visual diff's newest manifest, its version and its
// image folder.
func (b *Box) latestDiff(wt Worktree, id string) (VisualDiff, int, string, error) {
	if b.Artifacts == nil {
		return VisualDiff{}, 0, "", errNoArtifacts
	}
	if !ValidArtifactID(id) {
		return VisualDiff{}, 0, "", badRequest("%q isn't an artifact id (the visual diff's, from berthd shots compare)", id)
	}
	a, v, body, err := b.Artifacts.Content(id, wt.Path, 0)
	if err != nil {
		return VisualDiff{}, 0, "", notFound(err)
	}
	if a.Kind != "visualdiff" {
		return VisualDiff{}, 0, "", badRequest("%s is a %s, not a visual diff", id, a.Kind)
	}
	var vd VisualDiff
	if err := json.Unmarshal(body, &vd); err != nil {
		return vd, 0, "", err
	}
	return vd, v.N, filepath.Join(b.Artifacts.Folder(id), "img"), nil
}

// --- baselines ------------------------------------------------------------------

// baseline is a saved side: per page, size and scheme, an image and its
// masks. It lives in <shots>/<loc>/<wt>/baselines/<name>/.
type baseline struct {
	Name     string                  `json:"name"`
	Taken    time.Time               `json:"taken"`
	Commit   string                  `json:"commit,omitempty"`
	Chromium string                  `json:"chromium,omitempty"`
	Shots    map[string]baselineShot `json:"shots"` // shotKey →
	// From is the visual diff an accepted baseline was taken from.
	From        string `json:"from,omitempty"`
	FromVersion int    `json:"from_version,omitempty"`
}

// BaselineInfo is a baseline as GET .../shots/baselines lists it.
type BaselineInfo struct {
	Name        string    `json:"name"`
	Taken       time.Time `json:"taken"`
	Commit      string    `json:"commit,omitempty"`
	Shots       int       `json:"shots"`
	From        string    `json:"from,omitempty"`
	FromVersion int       `json:"from_version,omitempty"`
}

// Baselines are a worktree's saved baselines, newest first.
func (b *Box) Baselines(ctx context.Context, locName, wtName string) ([]BaselineInfo, error) {
	loc, wt, err := b.worktreeRef(ctx, locName, wtName)
	if err != nil {
		return nil, err
	}
	root := filepath.Dir(b.baselineDir(loc, wt, "x"))
	ents, _ := os.ReadDir(root)
	out := []BaselineInfo{}
	for _, e := range ents {
		if !baselineNameRe.MatchString(e.Name()) {
			continue
		}
		bl, err := readBaseline(filepath.Join(root, e.Name()))
		if err != nil {
			continue
		}
		out = append(out, BaselineInfo{Name: bl.Name, Taken: bl.Taken, Commit: bl.Commit, Shots: len(bl.Shots), From: bl.From, FromVersion: bl.FromVersion})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Taken.After(out[j].Taken) })
	return out, nil
}

type baselineShot struct {
	Img    string   `json:"img"`
	Status int      `json:"status"`
	Title  string   `json:"title,omitempty"`
	Masks  [][4]int `json:"masks,omitempty"`
	Cut    bool     `json:"cut,omitempty"`
	Over   int      `json:"overflow_x,omitempty"`
}

// shotKey names one shot of a page: "/login@375", or "/login@375@dark".
func shotKey(page string, size int, scheme string) string {
	k := page + "@" + strconv.Itoa(size)
	if scheme != "" && scheme != "light" {
		k += "@" + scheme
	}
	return k
}

var baselineNameRe = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{0,39}$`)

func (b *Box) baselineDir(loc Location, wt Worktree, name string) string {
	return filepath.Join(b.shotsDir(), loc.Name, wt.Name, "baselines", name)
}

func readBaseline(dir string) (*baseline, error) {
	raw, err := os.ReadFile(filepath.Join(dir, "baseline.json"))
	if err != nil {
		return nil, err
	}
	bl := &baseline{}
	return bl, json.Unmarshal(raw, bl)
}

// writeBaseline replaces the baseline in dir with bl and the images
// fill puts in its store.
func writeBaseline(dir string, bl *baseline, fill func(*imgStore)) (int, error) {
	tmp := dir + ".new"
	os.RemoveAll(tmp)
	store := &imgStore{dir: tmp}
	fill(store)
	raw, _ := json.MarshalIndent(bl, "", "  ")
	if err := statefile.Write(filepath.Join(tmp, "baseline.json"), raw); err != nil {
		return 0, err
	}
	os.RemoveAll(dir)
	return store.bytes, os.Rename(tmp, dir)
}

func (b *Box) saveBaseline(loc Location, wt Worktree, name string, cfg ShotsConfig, chromium string, get func(string) shot) (ShotsResult, error) {
	dir := b.baselineDir(loc, wt, name)
	commit, _ := gitInfo(wt.Path)
	bl := &baseline{Name: name, Taken: time.Now().UTC(), Commit: commit, Chromium: chromium, Shots: map[string]baselineShot{}}
	var lines []string
	n, err := writeBaseline(dir, bl, func(store *imgStore) {
		for _, p := range cfg.Pages {
			for _, sc := range cfg.schemes() {
				for _, s := range cfg.Sizes {
					k := shotKey(p, s, sc)
					sh := get(k)
					bs := baselineShot{Status: sh.status, Title: sh.title, Cut: sh.cut, Over: sh.overflow}
					if sh.img != nil && sh.why == "" {
						bs.Img = store.put(sh.png)
					} else {
						lines = append(lines, fmt.Sprintf("  %s at %d: %s", p, s, sh.why))
					}
					for _, m := range sh.masks {
						bs.Masks = append(bs.Masks, [4]int{m.Min.X, m.Min.Y, m.Dx(), m.Dy()})
					}
					bl.Shots[k] = bs
				}
			}
		}
	})
	if err != nil {
		return ShotsResult{}, err
	}
	text := fmt.Sprintf("baseline %q saved for %s/%s: %d pages × %d sizes", name, loc.Name, wt.Name, len(cfg.Pages), len(cfg.Sizes))
	if len(cfg.schemes()) > 1 {
		text += " × 2 schemes"
	}
	text += fmt.Sprintf(", %d KB", n/1024)
	if len(lines) > 0 {
		text += "\nnot saved:\n" + strings.Join(lines, "\n")
	}
	return ShotsResult{Text: text, Dir: dir}, nil
}

func loadBaselineShot(dir string, bl *baseline, key string) shot {
	bs, ok := bl.Shots[key]
	if !ok || bs.Img == "" {
		return shot{why: "no baseline", status: 404}
	}
	raw, err := os.ReadFile(filepath.Join(dir, bs.Img))
	if err != nil {
		return shot{why: "no baseline", status: 404}
	}
	img, err := png.Decode(bytes.NewReader(raw))
	if err != nil {
		return shot{why: err.Error()}
	}
	s := shot{png: raw, img: toNRGBA(img), status: bs.Status, title: bs.Title, cut: bs.Cut, overflow: bs.Over}
	s.w, s.h = s.img.Rect.Dx(), s.img.Rect.Dy()
	for _, m := range bs.Masks {
		s.masks = append(s.masks, image.Rect(m[0], m[1], m[0]+m[2], m[1]+m[3]))
	}
	return s
}

// AcceptBaseline keeps a visual diff's after images as the worktree's
// "accepted" baseline (the app's Accept as baseline): a later compare with
// --base accepted shows only what changed since.
func (b *Box) AcceptBaseline(ctx context.Context, locName, wtName, id string) (ShotsResult, error) {
	loc, wt, err := b.worktreeRef(ctx, locName, wtName)
	if err != nil {
		return ShotsResult{}, err
	}
	vd, n, imgDir, err := b.latestDiff(wt, id)
	if err != nil {
		return ShotsResult{}, err
	}
	bl := &baseline{Name: "accepted", Taken: time.Now().UTC(), Commit: vd.Head.Commit, Chromium: vd.Settings.Chromium, Shots: map[string]baselineShot{}, From: id, FromVersion: n}
	_, err = writeBaseline(b.baselineDir(loc, wt, "accepted"), bl, func(store *imgStore) {
		for _, p := range vd.Pages {
			for _, s := range p.Shots {
				if s.After == nil || s.After.Img == "" {
					continue
				}
				src, err := os.ReadFile(filepath.Join(imgDir, s.After.Img))
				if err != nil {
					continue
				}
				// The after image as shot: its masks are painted on it
				// already, and recorded so the next compare leaves them out.
				var masks [][4]int
				for _, m := range s.Masks {
					masks = append(masks, m)
				}
				bl.Shots[shotKey(p.Path, s.Size, s.Scheme)] = baselineShot{Img: store.put(src), Status: s.After.Status, Title: p.Title, Masks: masks, Cut: s.After.Cut, Over: s.After.Overflow}
			}
		}
	})
	if err != nil {
		return ShotsResult{}, err
	}
	return ShotsResult{Text: fmt.Sprintf("accepted %s v%d as %s/%s's baseline: %d shots. Compare with it: berthd shots compare --base accepted", id, n, loc.Name, wt.Name, len(bl.Shots)), Artifact: id, Version: n}, nil
}

// RunShots forgets a worktree's baselines when the worktree is removed
// (its visual diffs go with its artifacts).
func (b *Box) RunShots(ctx context.Context) {
	if b.Events == nil {
		return
	}
	ch, unsub := b.Events.SubscribeNamed("shots")
	defer unsub()
	for {
		select {
		case <-ctx.Done():
			return
		case e, ok := <-ch:
			if !ok {
				return
			}
			if e.Type != "worktree.removed" {
				continue
			}
			loc, _ := e.Data["location"].(string)
			name, _ := e.Data["name"].(string)
			if loc == "" || name == "" || strings.ContainsAny(loc+name, `/\`) || loc == ".." || name == ".." {
				continue
			}
			os.RemoveAll(filepath.Join(b.shotsDir(), loc, name))
		}
	}
}
