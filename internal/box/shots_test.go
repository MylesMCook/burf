package box

import (
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/cosscom/shipyard/internal/events"
)

func shotOf(img *image.NRGBA, status int) shot {
	return shot{img: img, png: encodePNG(img), w: img.Rect.Dx(), h: img.Rect.Dy(), status: status}
}

func TestDiffPairVerdicts(t *testing.T) {
	cfg := ShotsConfig{}.withDefaults()
	store := &imgStore{dir: t.TempDir()}
	page := flat(375, 812, white)

	same := diffPair(store, shotOf(page, 200), shotOf(flat(375, 812, white), 200), 375, cfg)
	if same.Verdict != "unchanged" || same.Changed != 0 || same.Heat != "" || len(same.Regions) != 0 {
		t.Fatalf("identical: %+v", same)
	}

	changed := flat(375, 812, white)
	draw.Draw(changed, image.Rect(16, 100, 216, 160), &image.Uniform{color.NRGBA{240, 90, 20, 255}}, image.Point{}, draw.Src)
	after := shotOf(changed, 200)
	after.els = []pageEl{{R: image.Rect(0, 0, 375, 812), Name: "main", Parent: -1}, {R: image.Rect(16, 100, 216, 160), Name: `button.cta "Shop now"`, Parent: 0}}
	d := diffPair(store, shotOf(page, 200), after, 375, cfg)
	if d.Verdict != "changed" || d.Changed != 200*60 || d.Heat == "" || len(d.Crops) != 1 || len(d.Regions) != 1 {
		t.Fatalf("changed: %+v", d)
	}
	if d.Regions[0].El != `button.cta "Shop now" in main` {
		t.Fatalf("region named %q", d.Regions[0].El)
	}

	if s := diffPair(store, shotOf(page, 200), shot{status: 500, why: ""}, 375, cfg); s.Verdict != "error" || s.Why != "after: HTTP 500" {
		t.Fatalf("a 500: %+v", s)
	}
	if s := diffPair(store, shot{status: 404}, shot{status: 404}, 375, cfg); s.Verdict != "unchanged" || s.Why != "404 on both sides" {
		t.Fatalf("404 on both sides: %+v", s)
	}
	if s := diffPair(store, shot{status: 404}, shotOf(page, 200), 375, cfg); s.Verdict != "new" || s.After.Img == "" {
		t.Fatalf("new: %+v", s)
	}
	if s := diffPair(store, shotOf(page, 200), shot{status: 404}, 375, cfg); s.Verdict != "removed" {
		t.Fatalf("removed: %+v", s)
	}
	if s := diffPair(store, shot{why: "no baseline", status: 404}, shotOf(page, 200), 375, cfg); s.Verdict != "new" || s.Why != "not in the baseline" {
		t.Fatalf("not in the baseline: %+v", s)
	}
	if s := diffPair(store, shotOf(page, 200), shot{why: "could not load: net::ERR_CONNECTION_REFUSED"}, 375, cfg); s.Verdict != "error" || !strings.Contains(s.Why, "REFUSED") {
		t.Fatalf("refused: %+v", s)
	}
}

func TestDiffPairFlagsASidewaysScroll(t *testing.T) {
	cfg := ShotsConfig{}.withDefaults()
	store := &imgStore{dir: t.TempDir()}
	before, after := shotOf(flat(375, 812, white), 200), shotOf(flat(375, 812, white), 200)
	after.overflow = 125
	// The same pixels (the screenshot is clipped to the viewport), but the
	// page now scrolls sideways: that alone is a change, and a check.
	d := diffPair(store, before, after, 375, cfg)
	if d.Verdict != "changed" || len(d.Checks) != 1 || d.Checks[0] != "overflow_x:125" || d.After.Overflow != 125 {
		t.Fatalf("sideways: %+v", d)
	}
	if rank(d) < 100 {
		t.Fatalf("a sideways scroll ranks above any percentage: %v", rank(d))
	}
	// It scrolled sideways before too: not new, so no warning.
	before.overflow = 40
	if d := diffPair(store, before, after, 375, cfg); d.Verdict != "unchanged" || len(d.Checks) != 0 {
		t.Fatalf("already sideways: %+v", d)
	}
}

func TestDiffPairMasks(t *testing.T) {
	cfg := ShotsConfig{}.withDefaults()
	store := &imgStore{dir: t.TempDir()}
	a, b := flat(300, 200, white), flat(300, 200, white)
	draw.Draw(a, image.Rect(10, 10, 60, 30), &image.Uniform{color.NRGBA{0, 0, 0, 255}}, image.Point{}, draw.Src)
	draw.Draw(b, image.Rect(10, 10, 60, 30), &image.Uniform{color.NRGBA{200, 0, 0, 255}}, image.Point{}, draw.Src)
	before, after := shotOf(a, 200), shotOf(b, 200)
	before.masks = []image.Rectangle{image.Rect(10, 10, 60, 30)}
	after.masks = []image.Rectangle{image.Rect(10, 10, 60, 30)}
	d := diffPair(store, before, after, 300, cfg)
	if d.Verdict != "unchanged" || len(d.Masks) != 2 {
		t.Fatalf("masked clock: %+v", d)
	}
}

func TestNameRegion(t *testing.T) {
	els := []pageEl{
		{R: image.Rect(0, 0, 1280, 3000), Name: "div", Parent: -1},
		{R: image.Rect(0, 0, 1280, 600), Name: "section.hero", Parent: 0},
		{R: image.Rect(80, 200, 600, 400), Name: "div", Parent: 1},
		{R: image.Rect(96, 344, 544, 408), Name: `a.btn.hot "Shop now"`, Parent: 2},
		{R: image.Rect(0, 600, 1280, 1400), Name: "main#results", Parent: 0},
	}
	cases := map[DiffRegion]string{
		{X: 96, Y: 344, W: 448, H: 64}:   `a.btn.hot "Shop now" in section.hero`,
		{X: 100, Y: 210, W: 300, H: 100}: "section.hero",        // a bare div names its ancestor
		{X: 10, Y: 700, W: 400, H: 300}:  "main#results",        // no named ancestor beyond it
		{X: 10, Y: 500, W: 400, H: 300}:  "around main#results", // spans the hero and the results
		{X: 10, Y: 5000, W: 10, H: 10}:   "",                    // past every element
	}
	for r, want := range cases {
		if got := nameRegion(r, els); got != want {
			t.Errorf("%+v: %q, want %q", r, got, want)
		}
	}
	if nameRegion(DiffRegion{W: 1, H: 1}, nil) != "" {
		t.Fatal("no elements, no name")
	}
}

func sampleVisualDiff() VisualDiff {
	img := func(c byte) string { return fmt.Sprintf("%016x.png", int(c)+0xd0) }
	return VisualDiff{
		Schema: VisualDiffSchema, Title: "Visual changes: search-perf vs main", Created: time.Date(2026, 10, 7, 12, 0, 0, 0, time.UTC),
		Base:     vdSide{Kind: "main", Label: "main", Commit: "620ac99"},
		Head:     vdSide{Kind: "worktree", Label: "search-perf", Commit: "68a95ac"},
		Settings: vdSettings{Sizes: []int{375, 1280}, Scale: 1, Threshold: 0.03, Unchanged: 0.02, MaxHeight: 4000, ColorScheme: "light", ColorSchemes: []string{"light"}, ReducedMotion: true},
		Pages: []vdPage{
			{Path: "/search", Title: "Search · acme", MaxPct: 130, Shots: []vdShot{
				{Size: 375, Scheme: "light", Viewport: [2]int{375, 812}, Verdict: "changed", Pct: 30.4, Changed: 265002,
					Before: &vdImage{Img: img(0), W: 375, H: 2325, Status: 200}, After: &vdImage{Img: img(1), W: 375, H: 2325, Status: 200, Overflow: 125},
					Heat: img(2), Crops: []string{img(3)}, Checks: []string{"overflow_x:125"}, RegionsTotal: 5,
					Regions: []DiffRegion{{X: 16, Y: 704, W: 359, H: 712, Px: 130211, El: "aside.filters in main#results"}}},
				{Size: 1280, Scheme: "light", Viewport: [2]int{1280, 800}, Verdict: "unchanged",
					Before: &vdImage{Img: img(4), W: 1280, H: 900, Status: 200}, After: &vdImage{Img: img(4), W: 1280, H: 900, Status: 200}},
			}},
			{Path: "/account", MaxPct: 1000, Shots: []vdShot{
				{Size: 375, Scheme: "light", Verdict: "error", Why: "after: HTTP 500", Before: &vdImage{Img: img(5), W: 375, H: 812, Status: 200}, After: &vdImage{Status: 500, Errors: []string{"TypeError: user is undefined"}}},
				{Size: 1280, Scheme: "light", Verdict: "error", Why: "after: HTTP 500", Before: &vdImage{Img: img(6), W: 1280, H: 800, Status: 200}, After: &vdImage{Status: 500}},
			}},
			{Path: "/deals", MaxPct: 500, Shots: []vdShot{
				{Size: 375, Scheme: "light", Verdict: "new", Why: "404 before", Before: &vdImage{Status: 404}, After: &vdImage{Img: img(7), W: 375, H: 812, Status: 200}},
				{Size: 1280, Scheme: "light", Verdict: "new", Why: "404 before", Before: &vdImage{Status: 404}, After: &vdImage{Img: img(8), W: 1280, H: 800, Status: 200}},
			}},
			{Path: "/about", Shots: []vdShot{
				{Size: 375, Scheme: "light", Verdict: "unchanged", Before: &vdImage{Img: img(9), W: 375, H: 812}, After: &vdImage{Img: img(9), W: 375, H: 812}},
				{Size: 1280, Scheme: "light", Verdict: "unchanged", Before: &vdImage{Img: img(10), W: 1280, H: 800}, After: &vdImage{Img: img(10), W: 1280, H: 800}},
			}},
		},
		Timing: vdTiming{TotalMS: 5600},
	}
}

func TestValidateVisualDiff(t *testing.T) {
	vd := sampleVisualDiff()
	vd.Summary = summarize(vd.Pages)
	raw, _ := json.Marshal(vd)
	if err := ValidateVisualDiff(raw); err != nil {
		t.Fatalf("a good manifest: %v", err)
	}
	bad := map[string]func(*VisualDiff){
		"schema":     func(v *VisualDiff) { v.Schema = "berth.chart/v1" },
		"no pages":   func(v *VisualDiff) { v.Pages = nil },
		"no title":   func(v *VisualDiff) { v.Title = " " },
		"path":       func(v *VisualDiff) { v.Pages[0].Path = "search" },
		"verdict":    func(v *VisualDiff) { v.Pages[0].Shots[0].Verdict = "meh" },
		"size":       func(v *VisualDiff) { v.Pages[0].Shots[0].Size = 9000 },
		"scheme":     func(v *VisualDiff) { v.Pages[0].Shots[0].Scheme = "sepia" },
		"pct":        func(v *VisualDiff) { v.Pages[0].Shots[0].Pct = 140 },
		"image name": func(v *VisualDiff) { v.Pages[0].Shots[0].After.Img = "../../meta.json" },
		"heat name":  func(v *VisualDiff) { v.Pages[0].Shots[0].Heat = "x.svg" },
		"crop name":  func(v *VisualDiff) { v.Pages[0].Shots[0].Crops = []string{"/etc/passwd"} },
		"region":     func(v *VisualDiff) { v.Pages[0].Shots[0].Regions[0].Y = 2300 },
		"no before":  func(v *VisualDiff) { v.Pages[0].Shots[0].Before = nil },
	}
	for name, spoil := range bad {
		v := sampleVisualDiff()
		spoil(&v)
		raw, _ := json.Marshal(v)
		if err := ValidateVisualDiff(raw); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
	if ValidateVisualDiff([]byte("{")) == nil {
		t.Error("broken JSON accepted")
	}
}

func TestAgentTextIsShort(t *testing.T) {
	vd := sampleVisualDiff()
	vd.Summary = summarize(vd.Pages)
	text := agentText(vd, Artifact{ID: "50a4e501aa", Kind: "visualdiff", Title: "Visual changes: search-perf vs main", Versions: []ArtifactVersion{{N: 1}}}, "/s/img")
	t.Logf("%d bytes:\n%s", len(text), text)
	for _, want := range []string{
		"visual diff 50a4e501aa v1: search-perf vs main, 4 pages × 2 sizes in 5.6s",
		"Artifact 50a4e501aa v1 · visualdiff · Visual changes: search-perf vs main\n",
		"1 of 4 pages changed · most: /search at 375 (30%) · 1 layout warning · 2 new shots · 2 errors",
		"/account       375,1280  ERROR: after: HTTP 500 · page error: TypeError: user is undefined",
		"/deals         375,1280  NEW: 404 before",
		"(aside.filters in main#results)",
		"⚠ now scrolls sideways: 125px wider than the screen",
		"look: 00000000000000d3.png",
		"look: before|after crops of each shot's largest change, in /s/img/",
		"/search         1280  unchanged",
		"/about                unchanged at every size",
	} {
		if !strings.Contains(text, want) {
			t.Errorf("lacks %q", want)
		}
	}
	// About 4 bytes a token: a run like this stays well under 450 tokens.
	if len(text) > 1800 {
		t.Errorf("%d bytes is too long for the agent", len(text))
	}
}

func TestImageStoreKeepsOneCopy(t *testing.T) {
	dir := t.TempDir()
	s := &imgStore{dir: dir}
	png1 := encodePNG(flat(10, 10, white))
	a, b := s.put(png1), s.put(append([]byte(nil), png1...))
	c := s.put(encodePNG(flat(10, 11, white)))
	if a != b || a == c || !vdImgRe.MatchString(a) {
		t.Fatalf("names %s %s %s", a, b, c)
	}
	ents, _ := os.ReadDir(dir)
	if len(ents) != 2 || s.bytes != len(png1)+len(encodePNG(flat(10, 11, white))) {
		t.Fatalf("%d files, %d bytes", len(ents), s.bytes)
	}
	// A second store over the same folder (the next version) adds nothing.
	s2 := &imgStore{dir: dir}
	s2.put(png1)
	if s2.bytes != 0 {
		t.Fatalf("a re-run wrote %d bytes again", s2.bytes)
	}
}

func TestVisualDiffsAreArtifacts(t *testing.T) {
	bx := &Box{Name: "devbox", Artifacts: &ArtifactStore{Dir: t.TempDir()}, Events: &events.Bus{}}
	loc, wt := Location{Name: "shop"}, Worktree{Name: "search-perf", Path: "/w/shop-search-perf"}
	ch, unsub := bx.Events.Subscribe()
	defer unsub()
	var id, first string
	for i := 1; i <= 12; i++ {
		got, imgDir, existing, err := bx.prepareDiff(wt, "visualdiff:main", false)
		if err != nil || !ValidArtifactID(got) || existing != (i > 1) || (i > 1 && got != id) {
			t.Fatalf("prepare %d: %s %v %v", i, got, existing, err)
		}
		id = got
		s := &imgStore{dir: imgDir}
		name := s.put(encodePNG(flat(4, i, white)))
		if i == 1 {
			first = name
		}
		vd := sampleVisualDiff()
		vd.Pages = vd.Pages[:1]
		vd.Pages[0].Shots[0].After.Img = name
		raw, _ := json.Marshal(vd)
		a, err := bx.commitDiff(loc, wt, id, existing, "visualdiff:main", raw, vd.Title, fmt.Sprintf("run %d", i), ArtifactBy{Session: "search-perf-claude"})
		if err != nil || a.ID != id || a.Latest().N != i || a.Kind != "visualdiff" || a.Key != "visualdiff:main" {
			t.Fatalf("commit %d: %+v %v", i, a, err)
		}
		e := <-ch
		if (i == 1) != (e.Type == "artifact.added") || e.Data["kind"] != "visualdiff" || e.Data["summary"] == nil {
			t.Fatalf("event %d: %+v", i, e)
		}
	}
	a, _ := bx.Artifacts.Get(id, wt.Path)
	var ns []string
	for _, v := range a.Versions {
		ns = append(ns, strconv.Itoa(v.N))
	}
	if strings.Join(ns, ",") != "1,5,6,7,8,9,10,11,12" {
		t.Fatalf("kept %v", ns)
	}
	imgDir := filepath.Join(bx.Artifacts.Folder(id), "img")
	if _, err := os.Stat(filepath.Join(imgDir, first)); err != nil {
		t.Fatal("the first version's image went")
	}
	if _, err := os.Stat(filepath.Join(imgDir, imgName(encodePNG(flat(4, 3, white))))); err == nil {
		t.Fatal("a dropped version's image stayed")
	}
	vd, n, dir, err := bx.latestDiff(wt, id)
	if err != nil || n != 12 || vd.Schema != VisualDiffSchema || dir != imgDir {
		t.Fatalf("latest: %d %v", n, err)
	}
	if other, _, existing, _ := bx.prepareDiff(wt, "visualdiff:accepted", false); other == id || existing {
		t.Fatal("another base is another diff")
	}
	if fresh, _, _, _ := bx.prepareDiff(wt, "visualdiff:main", true); fresh == id {
		t.Fatal("--new is a new diff")
	}
	if _, _, _, err := bx.latestDiff(wt, "../../etc"); err == nil {
		t.Fatal("a bad id was read")
	}
	if _, _, _, err := bx.latestDiff(Worktree{Path: "/w/other"}, id); err == nil {
		t.Fatal("another worktree's diff was read")
	}
	// An agent can't add a visual diff of its own.
	raw, _ := json.Marshal(sampleVisualDiff())
	if kind, format, err := classifyArtifact("", "vd.json", raw); err != nil || kind != "visualdiff" || format != "visualdiff" {
		t.Fatalf("classify: %s %s %v", kind, format, err)
	}
}

func TestShotsConfigChecks(t *testing.T) {
	for _, c := range []ShotsConfig{
		{Sizes: []int{100}}, {Pages: []string{"//evil.example"}}, {Pages: []string{"/a b"}}, {ColorScheme: "sepia"}, {Threshold: 2},
	} {
		if c.withDefaults().check() == nil {
			t.Errorf("%+v accepted", c)
		}
	}
	if s := (ShotsConfig{ColorScheme: "both"}).schemes(); len(s) != 2 {
		t.Fatalf("both: %v", s)
	}
	if shotKey("/", 375, "light") != "/@375" || shotKey("/", 375, "dark") != "/@375@dark" {
		t.Fatal("shot keys")
	}
}

// A box whose main checkout's dev server is down: the default base falls
// back to turn-start when there is one, and says so; an explicit --base
// main refuses.
func TestShotsBaseFallsBackToTurnStart(t *testing.T) {
	b, wt, _ := shotsBox(t, func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, "ok") })
	b.ShotsDir = t.TempDir()
	ctx := context.Background()
	_, err := b.planShots(ctx, "cal", "billing", ShotsRequest{})
	if err == nil || !strings.Contains(err.Error(), "main's dev server isn't running") || !strings.Contains(err.Error(), "berthd shots baseline") {
		t.Fatalf("no main, no baseline: %v", err)
	}
	loc, _ := b.Locations.Get(ctx, "cal")
	dir := b.baselineDir(loc, wt, "turn-start")
	if _, err := writeBaseline(dir, &baseline{Name: "turn-start", Taken: time.Now()}, func(*imgStore) {}); err != nil {
		t.Fatal(err)
	}
	p, err := b.planShots(ctx, "cal", "billing", ShotsRequest{})
	if err != nil || p.base != "turn-start" || p.saved == nil || !strings.Contains(p.notice, "compared with the turn-start baseline instead") {
		t.Fatalf("fallback: %+v %v", p, err)
	}
	if _, err := b.planShots(ctx, "cal", "billing", ShotsRequest{Base: "main"}); err == nil {
		t.Fatal("an explicit --base main fell back")
	}
	if _, err := b.planShots(ctx, "cal", "billing", ShotsRequest{Base: "accepted"}); err == nil || !strings.Contains(err.Error(), "Accept as baseline") {
		t.Fatalf("no accepted baseline: %v", err)
	}
	if _, err := b.planShots(ctx, "cal", "billing", ShotsRequest{Base: "../x"}); err == nil {
		t.Fatal("a path as a base")
	}
	if _, err := b.planShots(ctx, "cal", "billing", ShotsRequest{Save: "Bad Name"}); err == nil {
		t.Fatal("a bad baseline name")
	}
}

// shotsBox is browserBox on port blocks that are free on this machine
// (another app's dev server may sit on the first ones), with the next block
// free for main's dev server too.
func shotsBox(t *testing.T, page http.HandlerFunc) (*Box, Worktree, int) {
	t.Helper()
	ctx := context.Background()
	repo := gitRepo(t)
	dir := t.TempDir()
	b := &Box{Name: "devbox", Locations: NewLocations(filepath.Join(dir, "locations.json")), Events: &events.Bus{}, Sessions: testSessions(t),
		Flows: &Flows{Path: filepath.Join(dir, "flows.json")}, ShotsDir: filepath.Join(dir, "shots")}
	free := func(port int) bool {
		for p := port; p < port+portBlock; p++ {
			ln, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(p))
			if err != nil {
				return false
			}
			ln.Close()
		}
		return true
	}
	taken := map[string]int{}
	for port, ok := portBase, 0; ok < 2 && port < portLimit; port += portBlock {
		if free(port) {
			ok++
			continue
		}
		d := filepath.Join(dir, "busy-"+strconv.Itoa(port))
		os.MkdirAll(d, 0o755)
		taken[d] = port
	}
	raw, _ := json.Marshal(taken)
	os.WriteFile(b.Locations.Ports.Path, raw, 0o644)
	b.Locations.Add(ctx, "cal", repo)
	wt, err := b.Locations.CreateWorktree(ctx, "cal", "billing", "", "")
	if err != nil {
		t.Fatal(err)
	}
	port, err := b.Locations.Ports.For(wt.Path)
	if err != nil || port == 0 {
		t.Fatalf("no port block: %v", err)
	}
	ln, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(port))
	if err != nil {
		t.Skipf("the worktree's port %d is taken: %v", port, err)
	}
	srv := &http.Server{Handler: page}
	go srv.Serve(ln)
	t.Cleanup(func() { srv.Close() })
	b.BrowserProxies = &BrowserProxies{Path: filepath.Join(dir, "proxies.json")}
	t.Cleanup(b.BrowserProxies.CloseAll)
	return b, wt, port
}

// The whole thing with a real Chromium: two dev servers (the worktree and
// main) serving a page that differs, a 500, a new page and one that only
// scrolls sideways; then a baseline, Accept and an all clear. Opt in with
// BERTH_TEST_SHOTS=1.
func TestShotsCompareWithARealChromium(t *testing.T) {
	if os.Getenv("BERTH_TEST_SHOTS") == "" {
		t.Skip("set BERTH_TEST_SHOTS=1 to shoot pages with a real Chromium")
	}
	if _, err := FindChromium(); err != nil {
		t.Skip(err)
	}
	page := func(head bool) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			style := `<meta name="viewport" content="width=device-width"><style>body{margin:0;font:16px sans-serif;background:#faf8f4} .hero{padding:40px 16px} .cta{display:inline-block;padding:12px 20px;background:#333;color:#fff} @keyframes p{to{opacity:.2}} .pulse{animation:p 1s infinite alternate}</style>`
			switch r.URL.Path {
			case "/":
				cta := `<a class="cta" href="/search">Browse</a>`
				if head {
					cta = `<a class="cta hot" href="/search" style="background:#e8590c">Shop now</a>`
				}
				fmt.Fprintf(w, `<!doctype html><title>Home · acme</title>%s<section class="hero"><h1>Everyday goods</h1>%s<span class="pulse">●</span> <time>%s</time></section><main>%s</main>`, style, cta, time.Now().Format(time.RFC3339Nano), strings.Repeat("<p>Row of products</p>", 30))
			case "/search":
				wide := ""
				if head {
					wide = `<div style="width:500px;height:40px;background:#eee">filters</div>`
				}
				fmt.Fprintf(w, `<!doctype html><title>Search · acme</title>%s<h1>Search</h1>%s`, style, wide)
			case "/account":
				if head {
					http.Error(w, "boom", 500)
					return
				}
				fmt.Fprintf(w, `<!doctype html><title>Account</title>%s<h1>Account</h1>`, style)
			case "/deals":
				if !head {
					http.NotFound(w, r)
					return
				}
				fmt.Fprintf(w, `<!doctype html><title>Deals</title>%s<h1>Deals</h1>`, style)
			default:
				http.NotFound(w, r)
			}
		}
	}
	b, wt, _ := shotsBox(t, page(true))
	b.ShotsDir = t.TempDir()
	b.Artifacts = &ArtifactStore{Dir: t.TempDir()}
	b.NewBrowsers(t.TempDir(), 2)
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	loc, _ := b.Locations.Get(ctx, "cal")
	var main Worktree
	for _, w := range loc.Worktrees {
		if w.Main {
			main = w
		}
	}
	mport, err := b.Locations.Ports.For(main.Path)
	if err != nil || mport == 0 {
		t.Fatalf("main's port: %v", err)
	}
	ln, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(mport))
	if err != nil {
		t.Skipf("main's port %d is taken: %v", mport, err)
	}
	srv := &http.Server{Handler: page(false)}
	go srv.Serve(ln)
	defer srv.Close()

	req := ShotsRequest{Pages: []string{"/", "/search", "/account", "/deals"}, Sizes: []int{375, 1280}, Mask: []string{"time"}}
	res, err := b.ShotsCompare(ctx, "cal", "billing", req)
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("%s", res.Text)
	vd, n, imgDir, err := b.latestDiff(wt, res.Artifact)
	if err != nil || n != 1 {
		t.Fatalf("latest: %v", err)
	}
	verdicts := map[string]string{}
	for _, p := range vd.Pages {
		for _, s := range p.Shots {
			verdicts[shotKey(p.Path, s.Size, s.Scheme)] = s.Verdict
			if s.Verdict == "changed" && p.Path == "/" && (len(s.Regions) == 0 || !strings.Contains(s.Regions[0].El, "a.cta.hot")) {
				t.Errorf("/ at %d: regions %+v", s.Size, s.Regions)
			}
		}
	}
	want := map[string]string{"/@375": "changed", "/@1280": "changed", "/search@375": "changed", "/search@1280": "changed", "/account@375": "error", "/account@1280": "error", "/deals@375": "new", "/deals@1280": "new"}
	for k, v := range want {
		if verdicts[k] != v {
			t.Errorf("%s: %s, want %s", k, verdicts[k], v)
		}
	}
	if !strings.Contains(res.Text, "⚠ now scrolls sideways") || !strings.Contains(res.Text, "/account") {
		t.Fatalf("text:\n%s", res.Text)
	}
	if ents, _ := os.ReadDir(imgDir); len(ents) < 8 {
		t.Fatalf("%d images", len(ents))
	}

	// The same compare again is v2 of the same diff, adding few bytes.
	res2, err := b.ShotsCompare(ctx, "cal", "billing", req)
	if err != nil || res2.Artifact != res.Artifact || res2.Version != 2 {
		t.Fatalf("re-run: %+v %v", res2, err)
	}
	// Accept, then compare with what was accepted: no visual changes
	// (except the 500, which has no after image to accept).
	if _, err := b.AcceptBaseline(ctx, "cal", "billing", res.Artifact); err != nil {
		t.Fatal(err)
	}
	if bls, err := b.Baselines(ctx, "cal", "billing"); err != nil || len(bls) != 1 || bls[0].Name != "accepted" || bls[0].From != res.Artifact || bls[0].FromVersion != 2 {
		t.Fatalf("baselines: %+v %v", bls, err)
	}
	req.Pages = []string{"/", "/search", "/deals"}
	req.Base = "accepted"
	clear, err := b.ShotsCompare(ctx, "cal", "billing", req)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(clear.Text, "No visual changes") {
		t.Fatalf("after accepting:\n%s", clear.Text)
	}
	// A dark baseline and a compare in both schemes.
	if _, err := b.ShotsCompare(ctx, "cal", "billing", ShotsRequest{Pages: []string{"/"}, Sizes: []int{375}, Mask: []string{"time"}, Save: "turn-start", ColorScheme: "both"}); err != nil {
		t.Fatal(err)
	}
	both, err := b.ShotsCompare(ctx, "cal", "billing", ShotsRequest{Pages: []string{"/"}, Sizes: []int{375}, Mask: []string{"time"}, Base: "turn-start", ColorScheme: "both"})
	if err != nil || !strings.Contains(both.Text, "× 2 schemes") || !strings.Contains(both.Text, "No visual changes") {
		t.Fatalf("both schemes: %v\n%s", err, both.Text)
	}
}

// The visual diff's routes: its images (only real image names, only a
// visual diff's), Accept as baseline, the baselines, and no visual diff
// added by hand.
func TestVisualDiffRoutes(t *testing.T) {
	repo := gitRepo(t)
	ctx := context.Background()
	bus := &events.Bus{Sequence: true}
	bx := &Box{Name: "devbox", Locations: NewLocations(filepath.Join(t.TempDir(), "locations.json")), Events: bus, ShotsDir: t.TempDir()}
	bx.Artifacts = &ArtifactStore{Dir: t.TempDir(), Events: bus, Box: "devbox"}
	if _, err := bx.Locations.Add(ctx, "shop", repo); err != nil {
		t.Fatal(err)
	}
	loc, _ := bx.Locations.Get(ctx, "shop")
	wt := loc.Worktrees[0]
	c := localBox(t, bx)

	id, imgDir, existing, err := bx.prepareDiff(wt, "visualdiff:main", false)
	if err != nil {
		t.Fatal(err)
	}
	png1 := encodePNG(flat(375, 812, white))
	name := (&imgStore{dir: imgDir}).put(png1)
	vd := sampleVisualDiff()
	vd.Pages = vd.Pages[:1]
	vd.Pages[0].Shots[0].After.Img = name
	raw, _ := json.Marshal(vd)
	if _, err := bx.commitDiff(loc, wt, id, existing, "visualdiff:main", raw, vd.Title, "", ArtifactBy{}); err != nil {
		t.Fatal(err)
	}
	base := "/v1/locations/shop/worktrees/" + wt.Name + "/artifacts/" + id
	get := func(path string) (*http.Response, []byte) {
		resp, err := c.Doer.DoWithHeader(ctx, "GET", path, nil, nil)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		return resp, body
	}
	resp, body := get(base + "/img/" + name)
	if resp.StatusCode != 200 || resp.Header.Get("Content-Type") != "image/png" || resp.Header.Get("X-Content-Type-Options") != "nosniff" || !strings.Contains(resp.Header.Get("Content-Security-Policy"), "sandbox") || string(body) != string(png1) {
		t.Fatalf("image: %d %v", resp.StatusCode, resp.Header)
	}
	for _, bad := range []string{"0000000000000000.png", "meta.json", "..%2Fmeta.json", "v1.json"} {
		if resp, _ := get(base + "/img/" + bad); resp.StatusCode != 404 {
			t.Fatalf("%s: %d", bad, resp.StatusCode)
		}
	}
	// A chart has no images.
	var chart AddArtifactResult
	if err := c.Call(ctx, "POST", "/v1/locations/shop/worktrees/"+wt.Name+"/artifacts", addArtifactRequest{Title: "p95", Name: "p95.json", Content: barChart}, &chart); err != nil {
		t.Fatal(err)
	}
	os.MkdirAll(filepath.Join(bx.Artifacts.Folder(chart.Artifact.ID), "img"), 0o700)
	os.WriteFile(filepath.Join(bx.Artifacts.Folder(chart.Artifact.ID), "img", name), png1, 0o600)
	if resp, _ := get("/v1/locations/shop/worktrees/" + wt.Name + "/artifacts/" + chart.Artifact.ID + "/img/" + name); resp.StatusCode != 404 {
		t.Fatalf("a chart's image: %d", resp.StatusCode)
	}
	// No visual diff by hand.
	err = c.Call(ctx, "POST", "/v1/locations/shop/worktrees/"+wt.Name+"/artifacts", addArtifactRequest{Title: "fake", Name: "vd.json", Content: string(raw)}, nil)
	if err == nil || !strings.Contains(err.Error(), "berthd shots compare") {
		t.Fatalf("a hand-made visual diff: %v", err)
	}
	// Accept, then the baselines.
	var acc ShotsResult
	if err := c.Call(ctx, "POST", "/v1/worktrees/shop/"+wt.Name+"/shots/accept", map[string]string{"artifact": id}, &acc); err != nil || !strings.Contains(acc.Text, "accepted "+id+" v1") {
		t.Fatalf("accept: %+v %v", acc, err)
	}
	var bls []BaselineInfo
	if err := c.Call(ctx, "GET", "/v1/worktrees/shop/"+wt.Name+"/shots/baselines", nil, &bls); err != nil || len(bls) != 1 || bls[0].From != id || bls[0].Shots != 1 {
		t.Fatalf("baselines: %+v %v", bls, err)
	}
	if err := c.Call(ctx, "POST", "/v1/worktrees/shop/"+wt.Name+"/shots/accept", map[string]string{"artifact": chart.Artifact.ID}, nil); err == nil {
		t.Fatal("accepted a chart")
	}
}

func TestBaselinesGoWithTheirWorktree(t *testing.T) {
	bx := &Box{Name: "devbox", Events: &events.Bus{}, ShotsDir: t.TempDir()}
	dir := filepath.Join(bx.ShotsDir, "shop", "search-perf", "baselines", "turn-start")
	keep := filepath.Join(bx.ShotsDir, "shop", "other", "baselines", "turn-start")
	os.MkdirAll(dir, 0o755)
	os.MkdirAll(keep, 0o755)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go bx.RunShots(ctx)
	time.Sleep(50 * time.Millisecond)
	bx.Events.Publish(events.Event{Type: "worktree.removed", Data: map[string]any{"location": "shop", "name": "../shop"}})
	bx.Events.Publish(events.Event{Type: "worktree.removed", Data: map[string]any{"location": "shop", "name": "search-perf", "path": "/w/x"}})
	for i := 0; i < 100; i++ {
		if _, err := os.Stat(filepath.Join(bx.ShotsDir, "shop", "search-perf")); err != nil {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if _, err := os.Stat(filepath.Join(bx.ShotsDir, "shop", "search-perf")); err == nil {
		t.Fatal("the removed worktree's baselines stayed")
	}
	if _, err := os.Stat(keep); err != nil {
		t.Fatal("another worktree's baselines went")
	}
}
