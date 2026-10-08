package box

import (
	"image"
	"image/color"
	"image/draw"
	"testing"
)

func flat(w, h int, c color.NRGBA) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	draw.Draw(img, img.Rect, &image.Uniform{c}, image.Point{}, draw.Src)
	return img
}

var white = color.NRGBA{255, 255, 255, 255}

func TestPixelDiffSame(t *testing.T) {
	a, b := flat(100, 80, white), flat(100, 80, white)
	d := PixelDiff(a, b, DiffOptions{})
	if d.Changed != 0 || len(d.Regions) != 0 || d.Percent() != 0 {
		t.Fatalf("identical images differ: %+v", d)
	}
}

func TestPixelDiffRegions(t *testing.T) {
	a, b := flat(200, 200, white), flat(200, 200, white)
	// Two changes far apart: two regions, the bigger first.
	draw.Draw(b, image.Rect(10, 10, 30, 30), &image.Uniform{color.NRGBA{220, 30, 30, 255}}, image.Point{}, draw.Src)
	draw.Draw(b, image.Rect(120, 140, 180, 190), &image.Uniform{color.NRGBA{30, 30, 220, 255}}, image.Point{}, draw.Src)
	d := PixelDiff(a, b, DiffOptions{})
	if d.Changed != 20*20+60*50 {
		t.Fatalf("changed %d, want %d", d.Changed, 20*20+60*50)
	}
	if len(d.Regions) != 2 {
		t.Fatalf("regions %+v", d.Regions)
	}
	r := d.Regions[0]
	if r.X > 120 || r.Y > 140 || r.X+r.W < 180 || r.Y+r.H < 190 || r.Px != 3000 {
		t.Fatalf("largest region %+v does not cover the blue box", r)
	}
	if d.Heat.NRGBAAt(15, 15).A == 0 || d.Heat.NRGBAAt(60, 60).A != 0 {
		t.Fatal("the heatmap should mark changed pixels only")
	}
}

func TestPixelDiffThresholdAndMasks(t *testing.T) {
	// A pastel tile (#fff0e6) over the off-white page (#faf8f4): under
	// pixelmatch's 0.1, over 0.03. White on the page stays under both.
	a, b := flat(50, 50, color.NRGBA{250, 248, 244, 255}), flat(50, 50, color.NRGBA{255, 240, 230, 255})
	if d := PixelDiff(a, b, DiffOptions{Threshold: 0.1}); d.Changed != 0 {
		t.Fatalf("0.1 should forgive the pastel, changed %d", d.Changed)
	}
	if d := PixelDiff(a, b, DiffOptions{Threshold: 0.03}); d.Changed != 2500 {
		t.Fatalf("0.03 should see the pastel, changed %d", d.Changed)
	}
	if d := PixelDiff(flat(50, 50, white), a, DiffOptions{Threshold: 0.03}); d.Changed != 0 {
		t.Fatalf("white on off-white is under 0.03, changed %d", d.Changed)
	}
	d := PixelDiff(a, b, DiffOptions{Threshold: 0.03, Masks: []image.Rectangle{image.Rect(0, 0, 50, 25)}})
	if d.Changed != 1250 || d.Masked != 1250 || d.Percent() != 100 {
		t.Fatalf("masked half: %+v", d)
	}
}

func TestPixelDiffTaller(t *testing.T) {
	a, b := flat(40, 40, white), flat(40, 60, white)
	d := PixelDiff(a, b, DiffOptions{})
	if d.Height != 60 || d.Extra != 40*20 || d.Changed != 40*20 {
		t.Fatalf("a page 20px taller: %+v", d)
	}
}

func TestSummarize(t *testing.T) {
	s := summarize([]vdPage{
		{Path: "/", Shots: []vdShot{{Size: 375, Verdict: "changed", Pct: 4.2, RegionsTotal: 2}, {Size: 1280, Verdict: "unchanged"}}},
		{Path: "/deals", Shots: []vdShot{{Size: 375, Verdict: "new"}}},
		{Path: "/account", Shots: []vdShot{{Size: 375, Verdict: "error"}}},
	})
	if s.Text != "1 of 3 pages changed · most: / at 375 (4.2%) · 1 new shot · 1 error" {
		t.Fatalf("summary %q", s.Text)
	}
	if s := summarize([]vdPage{{Path: "/", Shots: []vdShot{{Size: 375, Verdict: "unchanged"}, {Size: 1280, Verdict: "unchanged"}}}}); s.Text != "No visual changes · 1 page × 2 sizes" {
		t.Fatalf("all clear %q", s.Text)
	}
}

func TestPixelDiffShift(t *testing.T) {
	// A 20px banner inserted at y=30 pushes the striped rest down: the
	// stripes moved, only the banner changed.
	stripes := func(img *image.NRGBA, from, dy int) {
		for y := from; y < img.Rect.Dy(); y++ {
			if (y-dy)%10 < 3 {
				draw.Draw(img, image.Rect(0, y, 100, y+1), &image.Uniform{color.NRGBA{40, 40, 40, 255}}, image.Point{}, draw.Src)
			}
		}
	}
	a, b := flat(100, 200, white), flat(100, 220, white)
	stripes(a, 0, 0)
	stripes(b, 0, 0)
	draw.Draw(b, image.Rect(0, 30, 100, 50), &image.Uniform{color.NRGBA{220, 30, 30, 255}}, image.Point{}, draw.Src)
	stripes(b, 50, 20)
	d := PixelDiff(a, b, DiffOptions{})
	if d.Shift == nil || d.Shift.DY != 20 {
		t.Fatalf("shift %+v", d.Shift)
	}
	if d.Changed > 20*100+100*12 || len(d.Regions) != 1 || d.Regions[0].Y < 24 || d.Regions[0].Y+d.Regions[0].H > 64 {
		t.Fatalf("only the banner should change: %d px, %+v", d.Changed, d.Regions)
	}
}

func TestRegionClustering(t *testing.T) {
	// Cells two apart join one region; cells further apart are two; boxes
	// that overlap after growing merge; the biggest comes first.
	const gw, gh, cell = 40, 40, 8
	cells := make([]int, gw*gh)
	set := func(x, y, n int) { cells[y*gw+x] = n }
	set(1, 1, 10)
	set(3, 1, 10) // two cells from (1,1): joins it
	set(20, 20, 64)
	set(21, 20, 64)
	set(20, 21, 64)
	set(35, 2, 5) // far from everything: its own
	got := regions(cells, gw, gh, cell, gw*cell, gh*cell)
	if len(got) != 3 {
		t.Fatalf("regions %+v", got)
	}
	if got[0].X != 160 || got[0].Y != 160 || got[0].W != 16 || got[0].H != 16 || got[0].Px != 192 {
		t.Fatalf("largest %+v", got[0])
	}
	if got[1].X != 8 || got[1].Y != 8 || got[1].W != 24 || got[1].H != 8 || got[1].Px != 20 {
		t.Fatalf("joined pair %+v", got[1])
	}
	if got[2].X != 280 || got[2].Px != 5 {
		t.Fatalf("lone cell %+v", got[2])
	}
	// The last cell of a ragged edge stops at the image's edge.
	edge := regions([]int{0, 3}, 2, 1, cell, 12, 5)
	if len(edge) != 1 || edge[0].X != 8 || edge[0].W != 4 || edge[0].H != 5 {
		t.Fatalf("edge %+v", edge)
	}
}

func TestPixelDiffIgnoresAntialiasing(t *testing.T) {
	// A one-pixel grey step at an edge between flat black and white areas
	// on one side only: anti-aliasing, not a change.
	a, b := flat(20, 20, white), flat(20, 20, white)
	black := color.NRGBA{0, 0, 0, 255}
	draw.Draw(a, image.Rect(0, 0, 10, 20), &image.Uniform{black}, image.Point{}, draw.Src)
	draw.Draw(b, image.Rect(0, 0, 10, 20), &image.Uniform{black}, image.Point{}, draw.Src)
	b.SetNRGBA(10, 10, color.NRGBA{128, 128, 128, 255})
	d := PixelDiff(a, b, DiffOptions{Threshold: 0.03})
	if d.Changed != 0 || d.AA != 1 {
		t.Fatalf("anti-aliased pixel: changed %d aa %d", d.Changed, d.AA)
	}
	if d := PixelDiff(a, b, DiffOptions{Threshold: 0.03, IncludeAA: true}); d.Changed != 1 {
		t.Fatalf("with IncludeAA: changed %d", d.Changed)
	}
}
