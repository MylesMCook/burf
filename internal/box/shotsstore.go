package box

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

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

// visualDiffs is where a compare keeps its result: a visual diff per
// worktree and base, a new version per re-run.
type visualDiffs interface {
	// prepare finds the worktree's visual diff with key to add a version
	// to (unless fresh), or makes one; imgDir is where its images go.
	prepare(loc Location, wt Worktree, key string, fresh bool) (id, imgDir string, err error)
	// commit keeps the manifest as the diff's next version.
	commit(loc Location, wt Worktree, id, key string, raw []byte, title, note, session string) (n int, err error)
	// latest is the diff's newest manifest and its image folder.
	latest(loc Location, wt Worktree, id string) (VisualDiff, int, string, error)
}

// dirDiffs keeps visual diffs in the box's shots folder:
// <dir>/<loc>/<wt>/diffs/<id>/{meta.json, v<n>.json, img/}. The first
// version and the newest 8 are kept; images no kept version names go.
type dirDiffs struct{ dir string }

type vdMeta struct {
	ID       string      `json:"id"`
	Kind     string      `json:"kind"`
	Key      string      `json:"key"` // visualdiff:<base>
	Title    string      `json:"title"`
	By       string      `json:"by,omitempty"`
	Created  time.Time   `json:"created"`
	Versions []vdVersion `json:"versions"`
}

type vdVersion struct {
	N    int       `json:"n"`
	At   time.Time `json:"at"`
	Note string    `json:"note,omitempty"`
}

const vdKeepNewest = 8

var vdIDRe = regexp.MustCompile(`^vd-[0-9a-f]{8}$`)

func (d dirDiffs) root(loc Location, wt Worktree) string {
	return filepath.Join(d.dir, loc.Name, wt.Name, "diffs")
}

func (d dirDiffs) meta(dir string) (vdMeta, error) {
	var m vdMeta
	raw, err := os.ReadFile(filepath.Join(dir, "meta.json"))
	if err == nil {
		err = json.Unmarshal(raw, &m)
	}
	return m, err
}

func (d dirDiffs) prepare(loc Location, wt Worktree, key string, fresh bool) (string, string, error) {
	root := d.root(loc, wt)
	if !fresh {
		ents, _ := os.ReadDir(root)
		var best vdMeta
		for _, e := range ents {
			m, err := d.meta(filepath.Join(root, e.Name()))
			if err == nil && m.Key == key && m.ID == e.Name() && m.Created.After(best.Created) {
				best = m
			}
		}
		if best.ID != "" {
			return best.ID, filepath.Join(root, best.ID, "img"), nil
		}
	}
	var r [4]byte
	rand.Read(r[:])
	id := "vd-" + hex.EncodeToString(r[:])
	if err := os.MkdirAll(filepath.Join(root, id, "img"), 0o755); err != nil {
		return "", "", err
	}
	return id, filepath.Join(root, id, "img"), nil
}

func (d dirDiffs) commit(loc Location, wt Worktree, id, key string, raw []byte, title, note, session string) (int, error) {
	dir := filepath.Join(d.root(loc, wt), id)
	m, err := d.meta(dir)
	if err != nil {
		m = vdMeta{ID: id, Kind: "visualdiff", Key: key, Created: time.Now().UTC(), By: session}
	}
	n := 1
	if len(m.Versions) > 0 {
		n = m.Versions[len(m.Versions)-1].N + 1
	}
	if err := statefile.Write(filepath.Join(dir, "v"+strconv.Itoa(n)+".json"), raw); err != nil {
		return 0, err
	}
	m.Title = title
	m.Versions = append(m.Versions, vdVersion{N: n, At: time.Now().UTC(), Note: note})
	if len(m.Versions) > vdKeepNewest+1 {
		for _, v := range m.Versions[1 : len(m.Versions)-vdKeepNewest] {
			os.Remove(filepath.Join(dir, "v"+strconv.Itoa(v.N)+".json"))
		}
		m.Versions = append(m.Versions[:1], m.Versions[len(m.Versions)-vdKeepNewest:]...)
		keep := map[string]bool{}
		for _, v := range m.Versions {
			if vd, err := readManifest(filepath.Join(dir, "v"+strconv.Itoa(v.N)+".json")); err == nil {
				for _, im := range vd.Images() {
					keep[im] = true
				}
			}
		}
		gcImages(filepath.Join(dir, "img"), keep)
	}
	mraw, _ := json.MarshalIndent(m, "", "  ")
	return n, statefile.Write(filepath.Join(dir, "meta.json"), mraw)
}

func (d dirDiffs) latest(loc Location, wt Worktree, id string) (VisualDiff, int, string, error) {
	if !vdIDRe.MatchString(id) {
		return VisualDiff{}, 0, "", badRequest("%q isn't a visual diff's id (vd- and 8 hex digits)", id)
	}
	dir := filepath.Join(d.root(loc, wt), id)
	m, err := d.meta(dir)
	if err != nil || len(m.Versions) == 0 {
		return VisualDiff{}, 0, "", badRequest("no visual diff %s in %s/%s", id, loc.Name, wt.Name)
	}
	n := m.Versions[len(m.Versions)-1].N
	vd, err := readManifest(filepath.Join(dir, "v"+strconv.Itoa(n)+".json"))
	return vd, n, filepath.Join(dir, "img"), err
}

func readManifest(path string) (VisualDiff, error) {
	var vd VisualDiff
	raw, err := os.ReadFile(path)
	if err == nil {
		err = json.Unmarshal(raw, &vd)
	}
	return vd, err
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
	vd, n, imgDir, err := b.diffs().latest(loc, wt, id)
	if err != nil {
		return ShotsResult{}, err
	}
	bl := &baseline{Name: "accepted", Taken: time.Now().UTC(), Commit: vd.Head.Commit, Chromium: vd.Settings.Chromium, Shots: map[string]baselineShot{}}
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
