package box

import (
	"hash/fnv"
	"image"
	"image/color"
	"image/draw"
	"math"
	"sort"
)

// A pixel diff for visual before/after (shots.go): which pixels of two
// screenshots differ by more than a perceptual threshold, how much, and
// where, as a heatmap and as a few boxes around the changes.
//
// The colour distance and the anti-aliasing test follow pixelmatch
// (https://github.com/mapbox/pixelmatch, ISC, Copyright (c) 2019 Mapbox):
// a weighted YIQ distance (Kotsarenko and Ramos, "Measuring perceived
// color difference using YIQ NTSC transmission color space in mobile
// applications", 2010), and the anti-aliased-pixel test of Vysniauskas,
// "Anti-aliased Pixel and Intensity Slope Detector" (2009), so text
// rendered a hair differently is not a change.

// DiffOptions tunes a diff.
type DiffOptions struct {
	// Threshold is the colour distance, 0 to 1, below which two pixels
	// are the same (pixelmatch's default, 0.1).
	Threshold float64
	// IncludeAA counts anti-aliased pixels as changes.
	IncludeAA bool
	// Masks are rectangles (in image pixels) left out of the diff: dynamic
	// content such as timestamps and avatars.
	Masks []image.Rectangle
}

// DiffRegion is one cluster of changed pixels.
type DiffRegion struct {
	X  int `json:"x"`
	Y  int `json:"y"`
	W  int `json:"w"`
	H  int `json:"h"`
	Px int `json:"px"` // changed pixels inside
	// El names the element the region is in, when the page said:
	// `button "Shop now" in section.hero`.
	El string `json:"el,omitempty"`
}

// DiffResult is what a diff found.
type DiffResult struct {
	Width, Height int // the compared area: the wider and taller of the two
	Changed       int // pixels that differ
	AA            int // pixels that differ only by anti-aliasing
	Masked        int // pixels left out by masks
	// Extra is the changed pixels that exist on one side only (the page
	// grew or shrank).
	Extra   int
	Regions []DiffRegion
	// Shift is set when the content below a change moved rather than
	// changed: from After row Y down, the page is the old one moved by DY.
	Shift *DiffShift
	// Heat is a transparent overlay: changed pixels coloured by how far
	// their colours moved, the rest clear.
	Heat *image.NRGBA
}

// DiffShift is the biggest band of the page that only moved: H rows from
// Y (in the after image) are the before image's rows moved by DY pixels.
type DiffShift struct {
	Y  int `json:"y"`
	H  int `json:"h"`
	DY int `json:"dy"`
}

// Percent is the share of compared pixels that changed.
func (r DiffResult) Percent() float64 {
	n := r.Width*r.Height - r.Masked
	if n <= 0 {
		return 0
	}
	return 100 * float64(r.Changed) / float64(n)
}

const maxYIQ = 35215.0 // the YIQ distance between black and white

// toNRGBA gives the image as straight-alpha RGBA rows.
func toNRGBA(img image.Image) *image.NRGBA {
	if n, ok := img.(*image.NRGBA); ok && n.Rect.Min == (image.Point{}) {
		return n
	}
	b := img.Bounds()
	out := image.NewNRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(out, out.Rect, img, b.Min, draw.Src)
	return out
}

// pixelDiffRaw compares a (before) with b (after) pixel by pixel, at the
// same coordinates.
func pixelDiffRaw(a, b image.Image, o DiffOptions) DiffResult {
	if o.Threshold <= 0 {
		o.Threshold = 0.1
	}
	A, B := toNRGBA(a), toNRGBA(b)
	aw, ah, bw, bh := A.Rect.Dx(), A.Rect.Dy(), B.Rect.Dx(), B.Rect.Dy()
	w, h := max(aw, bw), max(ah, bh)
	cw, ch := min(aw, bw), min(ah, bh) // the area both have
	res := DiffResult{Width: w, Height: h, Heat: image.NewNRGBA(image.Rect(0, 0, w, h))}
	maxDelta := maxYIQ * o.Threshold * o.Threshold

	masked := make([]bool, w*h)
	for _, m := range o.Masks {
		m = m.Intersect(image.Rect(0, 0, w, h))
		for y := m.Min.Y; y < m.Max.Y; y++ {
			for x := m.Min.X; x < m.Max.X; x++ {
				if !masked[y*w+x] {
					masked[y*w+x] = true
					res.Masked++
				}
			}
		}
	}

	// Changed pixels per 8x8 cell, for the regions.
	const cell = 8
	gw, gh := (w+cell-1)/cell, (h+cell-1)/cell
	cells := make([]int, gw*gh)
	mark := func(x, y int, t float64) {
		res.Changed++
		cells[(y/cell)*gw+x/cell]++
		c := heatColor(t)
		i := res.Heat.PixOffset(x, y)
		res.Heat.Pix[i], res.Heat.Pix[i+1], res.Heat.Pix[i+2], res.Heat.Pix[i+3] = c.R, c.G, c.B, c.A
	}
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			if masked[y*w+x] {
				continue
			}
			if x >= cw || y >= ch {
				// Only one side has this pixel: the page changed size.
				res.Extra++
				mark(x, y, 1)
				hatch(res.Heat, x, y)
				continue
			}
			d := colorDelta(A.Pix, B.Pix, A.PixOffset(x, y), B.PixOffset(x, y), false)
			if math.Abs(d) <= maxDelta {
				continue
			}
			if !o.IncludeAA && (antialiased(A, x, y, cw, ch, B) || antialiased(B, x, y, cw, ch, A)) {
				res.AA++
				continue
			}
			mark(x, y, math.Sqrt(math.Abs(d)/maxYIQ))
		}
	}
	res.Regions = regions(cells, gw, gh, cell, w, h)
	return res
}

// PixelDiff compares a (before) with b (after). Rows are aligned first,
// like lines in a text diff, so content pushed down by something taller
// above it counts as moved, not changed: each after row is compared with
// the before row it matches, or, for a changed row, the one at the same
// offset as the nearest match above. Results are in b's coordinates.
func PixelDiff(a, b image.Image, o DiffOptions) DiffResult {
	A, B := toNRGBA(a), toNRGBA(b)
	aw, bw, bh := A.Rect.Dx(), B.Rect.Dx(), B.Rect.Dy()
	if aw != bw {
		return pixelDiffRaw(A, B, o)
	}
	src, extra := alignRows(A, B)
	// The before image, warped onto the after image's rows.
	W := image.NewNRGBA(image.Rect(0, 0, bw, bh))
	for y := 0; y < bh; y++ {
		if src[y] >= 0 {
			copy(W.Pix[W.PixOffset(0, y):W.PixOffset(0, y)+4*bw], A.Pix[A.PixOffset(0, src[y]):A.PixOffset(0, src[y])+4*aw])
		}
	}
	res := pixelDiffRaw(W, B, o)
	// Rows with nothing to compare with (the page grew) changed entirely.
	for y := 0; y < bh; y++ {
		if src[y] >= 0 {
			continue
		}
		for x := 0; x < bw; x++ {
			i := res.Heat.PixOffset(x, y)
			if res.Heat.Pix[i+3] == 0 {
				res.Changed++
			}
			hatch(res.Heat, x, y)
		}
	}
	res.Extra = extra * bw
	// The longest run of rows that only moved.
	for y := 0; y < bh; {
		if src[y] < 0 || src[y] == y || !rowsEqual(W, B, y) {
			y++
			continue
		}
		dy, y0 := y-src[y], y
		for y < bh && src[y] >= 0 && y-src[y] == dy && rowsEqual(W, B, y) {
			y++
		}
		if y-y0 >= 24 && (res.Shift == nil || y-y0 > res.Shift.H) {
			res.Shift = &DiffShift{Y: y0, H: y - y0, DY: dy}
		}
	}
	if res.Changed > 0 {
		res.Regions = regionsOf(res.Heat)
	} else {
		res.Regions = nil
	}
	return res
}

// alignRows matches the after image's rows to the before image's, as
// patience diff matches lines: rows that occur once on each side anchor
// the alignment (the longest run of them in order), and between anchors
// rows match outwards from each anchor while they are equal. A row left
// over is compared with the before row at the offset of the anchor above
// it. src[y] is the before row for after row y (-1: none, the page grew);
// extra counts those.
func alignRows(A, B *image.NRGBA) (src []int, extra int) {
	ah, bh := A.Rect.Dy(), B.Rect.Dy()
	hash := func(img *image.NRGBA, y int) uint64 {
		h := fnv.New64a()
		i := img.PixOffset(0, y)
		h.Write(img.Pix[i : i+4*img.Rect.Dx()])
		return h.Sum64()
	}
	ha, hb := make([]uint64, ah), make([]uint64, bh)
	ca, cb := map[uint64]int{}, map[uint64]int{}
	at := map[uint64]int{}
	for y := range ha {
		ha[y] = hash(A, y)
		ca[ha[y]]++
		at[ha[y]] = y
	}
	for y := range hb {
		hb[y] = hash(B, y)
		cb[hb[y]]++
	}
	// Anchors: rows unique on both sides, in after order; keep the longest
	// run increasing in before order too (patience sorting).
	type pair struct{ a, b int }
	var cand []pair
	for y, h := range hb {
		if cb[h] == 1 && ca[h] == 1 {
			cand = append(cand, pair{at[h], y})
		}
	}
	var tails []int // index into cand of the smallest tail of each length
	prev := make([]int, len(cand))
	for i, c := range cand {
		k := sort.Search(len(tails), func(k int) bool { return cand[tails[k]].a >= c.a })
		if k > 0 {
			prev[i] = tails[k-1]
		} else {
			prev[i] = -1
		}
		if k == len(tails) {
			tails = append(tails, i)
		} else {
			tails[k] = i
		}
	}
	var anchors []pair
	for i := len(tails) - 1; i >= 0 && len(tails) > 0; {
		if len(anchors) == 0 {
			i = tails[len(tails)-1]
		}
		anchors = append(anchors, cand[i])
		i = prev[i]
		if i < 0 {
			break
		}
	}
	for i, j := 0, len(anchors)-1; i < j; i, j = i+1, j-1 {
		anchors[i], anchors[j] = anchors[j], anchors[i]
	}
	// The page's top and bottom edges anchor too.
	anchors = append(append([]pair{{-1, -1}}, anchors...), pair{ah, bh})
	src = make([]int, bh)
	for y := range src {
		src[y] = -2 // not yet
	}
	for k := 0; k+1 < len(anchors); k++ {
		lo, hi := anchors[k], anchors[k+1]
		if lo.b >= 0 {
			src[lo.b] = lo.a
		}
		// Outwards from the anchor above while equal…
		i, j := lo.a+1, lo.b+1
		for i < hi.a && j < hi.b && ha[i] == hb[j] {
			src[j] = i
			i++
			j++
		}
		// …and from the anchor below.
		i2, j2 := hi.a-1, hi.b-1
		for i2 >= i && j2 >= j && ha[i2] == hb[j2] {
			src[j2] = i2
			i2--
			j2--
		}
		// What is left is compared at the offset of the anchor above.
		off := lo.b - lo.a
		for y := j; y <= j2; y++ {
			if s := y - off; s >= 0 && s < ah {
				src[y] = s
			} else {
				src[y] = -1
				extra++
			}
		}
	}
	return src, extra
}

func rowsEqual(a, b *image.NRGBA, y int) bool {
	i, j := a.PixOffset(0, y), b.PixOffset(0, y)
	n := 4 * a.Rect.Dx()
	return string(a.Pix[i:i+n]) == string(b.Pix[j:j+n])
}

// hatch marks a pixel that only one side has (the page grew) with
// diagonal stripes, so added area reads as added, not as a solid block.
func hatch(heat *image.NRGBA, x, y int) {
	c := heatColor(0.85)
	c.A = 150
	if (x+y)/7%2 == 1 {
		c.A = 45
	}
	i := heat.PixOffset(x, y)
	heat.Pix[i], heat.Pix[i+1], heat.Pix[i+2], heat.Pix[i+3] = c.R, c.G, c.B, c.A
}

// regionsOf clusters the heatmap's marked pixels.
func regionsOf(heat *image.NRGBA) []DiffRegion {
	const cell = 8
	w, h := heat.Rect.Dx(), heat.Rect.Dy()
	gw, gh := (w+cell-1)/cell, (h+cell-1)/cell
	cells := make([]int, gw*gh)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			if heat.Pix[heat.PixOffset(x, y)+3] != 0 {
				cells[(y/cell)*gw+x/cell]++
			}
		}
	}
	return regions(cells, gw, gh, cell, w, h)
}

// heatColor runs from amber (a small change) through red to magenta (a
// colour swapped for its opposite), more opaque as it grows.
func heatColor(t float64) color.NRGBA {
	t = math.Max(0, math.Min(1, t))
	stops := []struct {
		t       float64
		r, g, b float64
	}{{0, 255, 196, 0}, {0.45, 255, 92, 40}, {0.75, 240, 30, 90}, {1, 214, 20, 200}}
	i := 1
	for i < len(stops)-1 && t > stops[i].t {
		i++
	}
	s0, s1 := stops[i-1], stops[i]
	k := (t - s0.t) / (s1.t - s0.t)
	k = math.Max(0, math.Min(1, k))
	lerp := func(a, b float64) uint8 { return uint8(math.Round(a + (b-a)*k)) }
	// A faint change stays see-through, so a recoloured background reads
	// as a tint over the page rather than paint.
	return color.NRGBA{lerp(s0.r, s1.r), lerp(s0.g, s1.g), lerp(s0.b, s1.b), uint8(math.Round(30 + 225*math.Pow(t, 0.9)))}
}

// regions clusters changed cells: cells within two of each other join, and
// each cluster's box is its changed cells' bounds.
func regions(cells []int, gw, gh, cell, w, h int) []DiffRegion {
	const reach = 2
	seen := make([]bool, len(cells))
	var out []DiffRegion
	var stack []int
	for start, n := range cells {
		if n == 0 || seen[start] {
			continue
		}
		minX, minY, maxX, maxY, px := gw, gh, -1, -1, 0
		stack = append(stack[:0], start)
		seen[start] = true
		for len(stack) > 0 {
			c := stack[len(stack)-1]
			stack = stack[:len(stack)-1]
			cx, cy := c%gw, c/gw
			px += cells[c]
			minX, minY, maxX, maxY = min(minX, cx), min(minY, cy), max(maxX, cx), max(maxY, cy)
			for dy := -reach; dy <= reach; dy++ {
				for dx := -reach; dx <= reach; dx++ {
					nx, ny := cx+dx, cy+dy
					if nx < 0 || ny < 0 || nx >= gw || ny >= gh {
						continue
					}
					j := ny*gw + nx
					if cells[j] > 0 && !seen[j] {
						seen[j] = true
						stack = append(stack, j)
					}
				}
			}
		}
		r := DiffRegion{X: minX * cell, Y: minY * cell, W: min((maxX+1)*cell, w) - minX*cell, H: min((maxY+1)*cell, h) - minY*cell, Px: px}
		out = append(out, r)
	}
	// Boxes that overlap become one.
	for merged := true; merged; {
		merged = false
		for i := 0; i < len(out) && !merged; i++ {
			for j := i + 1; j < len(out); j++ {
				a, b := out[i], out[j]
				if a.X < b.X+b.W && b.X < a.X+a.W && a.Y < b.Y+b.H && b.Y < a.Y+a.H {
					x0, y0 := min(a.X, b.X), min(a.Y, b.Y)
					x1, y1 := max(a.X+a.W, b.X+b.W), max(a.Y+a.H, b.Y+b.H)
					out[i] = DiffRegion{X: x0, Y: y0, W: x1 - x0, H: y1 - y0, Px: a.Px + b.Px}
					out = append(out[:j], out[j+1:]...)
					merged = true
					break
				}
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Px > out[j].Px })
	return out
}

func rgb2y(r, g, b float64) float64 { return r*0.29889531 + g*0.58662247 + b*0.11448223 }
func rgb2i(r, g, b float64) float64 { return r*0.59597799 - g*0.27417610 - b*0.32180189 }
func rgb2q(r, g, b float64) float64 { return r*0.21147017 - g*0.52261711 + b*0.31114694 }
func blend(c, a float64) float64    { return 255 + (c-255)*a }

// colorDelta is pixelmatch's: the squared YIQ distance between pixel k of
// p1 and pixel m of p2 (over white where transparent), negative when the
// second is lighter; with yOnly, just the brightness difference.
func colorDelta(p1, p2 []uint8, k, m int, yOnly bool) float64 {
	r1, g1, b1, a1 := float64(p1[k]), float64(p1[k+1]), float64(p1[k+2]), float64(p1[k+3])
	r2, g2, b2, a2 := float64(p2[m]), float64(p2[m+1]), float64(p2[m+2]), float64(p2[m+3])
	if a1 == a2 && r1 == r2 && g1 == g2 && b1 == b2 {
		return 0
	}
	if a1 < 255 {
		a1 /= 255
		r1, g1, b1 = blend(r1, a1), blend(g1, a1), blend(b1, a1)
	}
	if a2 < 255 {
		a2 /= 255
		r2, g2, b2 = blend(r2, a2), blend(g2, a2), blend(b2, a2)
	}
	y1, y2 := rgb2y(r1, g1, b1), rgb2y(r2, g2, b2)
	y := y1 - y2
	if yOnly {
		return y
	}
	i := rgb2i(r1, g1, b1) - rgb2i(r2, g2, b2)
	q := rgb2q(r1, g1, b1) - rgb2q(r2, g2, b2)
	d := 0.5053*y*y + 0.299*i*i + 0.1957*q*q
	if y1 > y2 {
		return -d
	}
	return d
}

// antialiased says whether the pixel at x1, y1 of img looks like an edge's
// anti-aliasing: it sits between a darker and a lighter neighbour, each of
// which has flat neighbours of its own in both images.
func antialiased(img *image.NRGBA, x1, y1, width, height int, other *image.NRGBA) bool {
	x0, y0 := max(x1-1, 0), max(y1-1, 0)
	x2, y2 := min(x1+1, width-1), min(y1+1, height-1)
	pos := img.PixOffset(x1, y1)
	zeroes := 0
	if x1 == x0 || x1 == x2 || y1 == y0 || y1 == y2 {
		zeroes = 1
	}
	var lo, hi float64
	var loX, loY, hiX, hiY int
	for x := x0; x <= x2; x++ {
		for y := y0; y <= y2; y++ {
			if x == x1 && y == y1 {
				continue
			}
			d := colorDelta(img.Pix, img.Pix, pos, img.PixOffset(x, y), true)
			switch {
			case d == 0:
				zeroes++
				if zeroes > 2 {
					return false
				}
			case d < lo:
				lo, loX, loY = d, x, y
			case d > hi:
				hi, hiX, hiY = d, x, y
			}
		}
	}
	if lo == 0 || hi == 0 {
		return false
	}
	return (manySiblings(img, loX, loY, width, height) && manySiblings(other, loX, loY, width, height)) ||
		(manySiblings(img, hiX, hiY, width, height) && manySiblings(other, hiX, hiY, width, height))
}

// manySiblings: at least three neighbours of the pixel are its exact colour.
func manySiblings(img *image.NRGBA, x1, y1, width, height int) bool {
	x0, y0 := max(x1-1, 0), max(y1-1, 0)
	x2, y2 := min(x1+1, width-1), min(y1+1, height-1)
	pos := img.PixOffset(x1, y1)
	zeroes := 0
	if x1 == x0 || x1 == x2 || y1 == y0 || y1 == y2 {
		zeroes = 1
	}
	p := img.Pix
	for x := x0; x <= x2; x++ {
		for y := y0; y <= y2; y++ {
			if x == x1 && y == y1 {
				continue
			}
			q := img.PixOffset(x, y)
			if p[pos] == p[q] && p[pos+1] == p[q+1] && p[pos+2] == p[q+2] && p[pos+3] == p[q+3] {
				zeroes++
			}
			if zeroes > 2 {
				return true
			}
		}
	}
	return false
}

// paintMasks fills each mask with one flat colour, so both sides show the
// same block where content is dynamic.
func paintMasks(img *image.NRGBA, masks []image.Rectangle) {
	c := color.NRGBA{0xc8, 0xc8, 0xd0, 0xff}
	for _, m := range masks {
		draw.Draw(img, m.Intersect(img.Rect), &image.Uniform{c}, image.Point{}, draw.Src)
	}
}

// regionCrop is a region as an agent reads it: before and after side by
// side, with some room around, at most maxW pixels wide.
func regionCrop(a, b *image.NRGBA, r DiffRegion, maxW int) *image.NRGBA {
	const pad, gap = 24, 10
	box := image.Rect(r.X-pad, r.Y-pad, r.X+r.W+pad, r.Y+r.H+pad)
	box = box.Intersect(a.Rect.Union(b.Rect))
	bw, bh := box.Dx(), box.Dy()
	if bh > 900 {
		box.Max.Y = box.Min.Y + 900
		bh = 900
	}
	out := image.NewNRGBA(image.Rect(0, 0, bw*2+gap, bh))
	draw.Draw(out, out.Rect, &image.Uniform{color.NRGBA{0x80, 0x80, 0x88, 0xff}}, image.Point{}, draw.Src)
	draw.Draw(out, image.Rect(0, 0, bw, bh), &image.Uniform{color.NRGBA{0xee, 0xee, 0xf0, 0xff}}, image.Point{}, draw.Src)
	draw.Draw(out, image.Rect(bw+gap, 0, bw*2+gap, bh), &image.Uniform{color.NRGBA{0xee, 0xee, 0xf0, 0xff}}, image.Point{}, draw.Src)
	draw.Draw(out, image.Rect(0, 0, bw, bh), a, box.Min, draw.Src)
	draw.Draw(out, image.Rect(bw+gap, 0, bw*2+gap, bh), b, box.Min, draw.Src)
	if out.Rect.Dx() <= maxW {
		return out
	}
	return scaleDown(out, maxW)
}

// scaleDown shrinks img to w pixels wide by averaging (box filter).
func scaleDown(img *image.NRGBA, w int) *image.NRGBA {
	sw, sh := img.Rect.Dx(), img.Rect.Dy()
	k := float64(sw) / float64(w)
	h := max(1, int(float64(sh)/k))
	out := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		y0, y1 := int(float64(y)*k), min(sh, int(float64(y+1)*k)+1)
		for x := 0; x < w; x++ {
			x0, x1 := int(float64(x)*k), min(sw, int(float64(x+1)*k)+1)
			var r, g, b, a, n float64
			for yy := y0; yy < y1; yy++ {
				for xx := x0; xx < x1; xx++ {
					i := img.PixOffset(xx, yy)
					r, g, b, a = r+float64(img.Pix[i]), g+float64(img.Pix[i+1]), b+float64(img.Pix[i+2]), a+float64(img.Pix[i+3])
					n++
				}
			}
			i := out.PixOffset(x, y)
			out.Pix[i], out.Pix[i+1], out.Pix[i+2], out.Pix[i+3] = uint8(r/n), uint8(g/n), uint8(b/n), uint8(a/n)
		}
	}
	return out
}
