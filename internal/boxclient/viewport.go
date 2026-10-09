package boxclient

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// A browser's size is part of the box protocol: the CLI checks one before
// sending it and the box checks again.

// Viewport is a page size: CSS pixels wide and tall, at a device scale.
type Viewport struct {
	Width  int     `json:"width"`
	Height int     `json:"height"`
	Scale  float64 `json:"scale"`
}

// DefaultViewport is the size a worktree's browser opens at until an agent
// chooses another: a common desktop.
var DefaultViewport = Viewport{Width: 1920, Height: 1080, Scale: 1}

// Bounds an agent's size must keep to.
const (
	minViewportW, MaxViewportWidth = 320, 3840
	minViewportH, maxViewportH     = 240, 2160
	minViewportScale               = 1.0
	MaxViewportScale               = 3.0
)

// ViewportPreset is a named size, the app's Preview sizes among them.
type ViewportPreset struct {
	Name   string
	Detail string
	Viewport
}

// ViewportPresets are the sizes agents can name. Phone, Phone Max and
// Tablet are the app's Preview devices.
var ViewportPresets = []ViewportPreset{
	{"phone", "iPhone 15 / 16", Viewport{390, 844, 1}},
	{"phone-max", "iPhone 15 / 16 Pro Max", Viewport{430, 932, 1}},
	{"tablet", "iPad Air", Viewport{820, 1180, 1}},
	{"laptop", "a 13-inch laptop", Viewport{1280, 800, 1}},
	{"desktop", "the default", DefaultViewport},
}

// String is the size as people read it: 1920×1080, or 390×844 @3x.
func (v Viewport) String() string {
	s := fmt.Sprintf("%d×%d", v.Width, v.Height)
	if v.Scale != 1 && v.Scale != 0 {
		s += " @" + strconv.FormatFloat(v.Scale, 'f', -1, 64) + "x"
	}
	return s
}

// Pixels is the size of a frame at the device scale.
func (v Viewport) Pixels() (int, int) {
	s := v.DeviceScale()
	return int(math.Round(float64(v.Width) * s)), int(math.Round(float64(v.Height) * s))
}

// DeviceScale is the scale a frame is drawn at: 1 when none is set.
func (v Viewport) DeviceScale() float64 {
	if v.Scale <= 0 {
		return 1
	}
	return v.Scale
}

// Check says what is wrong with a size, in words an agent can act on.
func (v Viewport) Check() error {
	switch {
	case v.Width < minViewportW || v.Width > MaxViewportWidth:
		return fmt.Errorf("width %d is out of range: %d to %d CSS pixels", v.Width, minViewportW, MaxViewportWidth)
	case v.Height < minViewportH || v.Height > maxViewportH:
		return fmt.Errorf("height %d is out of range: %d to %d CSS pixels", v.Height, minViewportH, maxViewportH)
	case math.IsNaN(v.Scale) || v.Scale < minViewportScale || v.Scale > MaxViewportScale:
		return fmt.Errorf("scale %s is out of range: %g to %g", strconv.FormatFloat(v.Scale, 'f', -1, 64), minViewportScale, MaxViewportScale)
	}
	return nil
}

// presetNames lists the presets, for an error: phone (390x844), ….
func presetNames() string {
	var n []string
	for _, p := range ViewportPresets {
		n = append(n, fmt.Sprintf("%s (%dx%d)", p.Name, p.Width, p.Height))
	}
	return strings.Join(n, ", ")
}

// ParseSize reads WIDTHxHEIGHT (x, X or ×) or a preset's name. A preset
// brings its own scale; a plain size has none (0), for the caller to keep.
func ParseSize(s string) (Viewport, error) {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "" {
		return Viewport{}, fmt.Errorf("give a size, WIDTHxHEIGHT such as 1280x800, or one of %s", presetNames())
	}
	if s == "default" {
		return DefaultViewport, nil
	}
	for _, p := range ViewportPresets {
		if p.Name == s {
			return p.Viewport, nil
		}
	}
	ws, hs, ok := strings.Cut(strings.ReplaceAll(s, "×", "x"), "x")
	if !ok {
		return Viewport{}, fmt.Errorf("%q is not a size: give WIDTHxHEIGHT such as 1280x800, or one of %s", s, presetNames())
	}
	w, err1 := strconv.Atoi(strings.TrimSpace(ws))
	h, err2 := strconv.Atoi(strings.TrimSpace(hs))
	if err1 != nil || err2 != nil {
		return Viewport{}, fmt.Errorf("%q is not a size: give whole CSS pixels, WIDTHxHEIGHT such as 1280x800", s)
	}
	return Viewport{Width: w, Height: h}, nil
}

// ParseScale reads a device scale factor: 1, 2, 2.5 or 3, with or without
// an x.
func ParseScale(s string) (float64, error) {
	s = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(s)), "x")
	f, err := strconv.ParseFloat(s, 64)
	if err != nil || math.IsNaN(f) || math.IsInf(f, 0) {
		return 0, fmt.Errorf("%q is not a scale: give a number from %g to %g, such as 2", s, minViewportScale, MaxViewportScale)
	}
	return f, nil
}

// Resolve applies a size and a scale (either may be empty) to cur: what
// isn't given stays as it was, except that a preset brings its own scale
// unless one is given.
func (cur Viewport) Resolve(size, scale string) (Viewport, error) {
	v := cur
	if v.Width == 0 {
		v = DefaultViewport
	}
	if strings.TrimSpace(size) == "" && strings.TrimSpace(scale) == "" {
		return Viewport{}, fmt.Errorf("give a size (WIDTHxHEIGHT such as 1280x800, or one of %s), a --scale, or both", presetNames())
	}
	if strings.TrimSpace(size) != "" {
		n, err := ParseSize(size)
		if err != nil {
			return Viewport{}, err
		}
		v.Width, v.Height = n.Width, n.Height
		if n.Scale != 0 {
			v.Scale = n.Scale
		}
	}
	if strings.TrimSpace(scale) != "" {
		f, err := ParseScale(scale)
		if err != nil {
			return Viewport{}, err
		}
		v.Scale = f
	}
	if v.Scale == 0 {
		v.Scale = 1
	}
	return v, v.Check()
}
