package box

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/MylesMCook/burf/internal/boxclient"
	"github.com/MylesMCook/burf/internal/statefile"
)

// The agent browser's size: the page's viewport in CSS pixels and its
// device scale factor, which an agent chooses (berthd browser resize
// 390x844, or open --size), kept per worktree until it changes, in
// <Dir>/viewports.json. A browser starts at its worktree's size; one
// already running changes at once. Shots and the app's live view follow
// it.

// The size arithmetic lives with the protocol types, which the CLI on every
// platform shares; the box keeps what a worktree chose.
type (
	Viewport       = boxclient.Viewport
	ViewportPreset = boxclient.ViewportPreset
)

var (
	DefaultViewport = boxclient.DefaultViewport
	ViewportPresets = boxclient.ViewportPresets
	ParseSize       = boxclient.ParseSize
	ParseScale      = boxclient.ParseScale
)

const (
	maxViewportW     = boxclient.MaxViewportWidth
	maxViewportScale = boxclient.MaxViewportScale
)

func (m *Browsers) viewportsPath() string { return filepath.Join(m.Dir, "viewports.json") }

// viewports are the sizes agents chose, by worktree path.
func (m *Browsers) viewports() map[string]Viewport {
	out := map[string]Viewport{}
	if b, err := os.ReadFile(m.viewportsPath()); err == nil {
		json.Unmarshal(b, &out)
	}
	return out
}

// Viewport is the size a worktree's browser has, or opens at.
func (m *Browsers) Viewport(path string) Viewport {
	m.vpMu.Lock()
	defer m.vpMu.Unlock()
	if v, ok := m.viewports()[filepath.Clean(path)]; ok && v.Check() == nil {
		return v
	}
	return DefaultViewport
}

// setViewport keeps a worktree's size; the default is kept as no entry.
func (m *Browsers) setViewport(path string, v Viewport) error {
	m.vpMu.Lock()
	defer m.vpMu.Unlock()
	all := m.viewports()
	path = filepath.Clean(path)
	if v == DefaultViewport {
		if _, ok := all[path]; !ok {
			return nil
		}
		delete(all, path)
	} else {
		all[path] = v
	}
	if err := os.MkdirAll(m.Dir, 0o700); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(all, "", "  ")
	return statefile.Write(m.viewportsPath(), append(data, '\n'))
}

// forgetViewport drops a removed worktree's size.
func (m *Browsers) forgetViewport(path string) {
	m.setViewport(path, DefaultViewport)
}

// Resize sets a worktree's size, keeps it, and applies it to its browser if
// one runs (returned, or nil).
func (m *Browsers) Resize(ctx context.Context, path string, v Viewport) (*browser, error) {
	if err := v.Check(); err != nil {
		return nil, err
	}
	if err := m.setViewport(path, v); err != nil {
		return nil, err
	}
	br := m.Lookup(path)
	if br == nil {
		return nil, nil
	}
	return br, br.resize(ctx, v)
}

// resize applies a size to the running page: its viewport and scale, the
// screencast's frames, and a fresh frame for whoever watches.
func (br *browser) resize(ctx context.Context, v Viewport) error {
	br.run.Lock()
	defer br.run.Unlock()
	br.touch()
	if err := br.applyViewport(ctx, v); err != nil {
		return err
	}
	br.mu.Lock()
	casting := br.casting
	var watchers []chan frame
	for ch := range br.watchers {
		watchers = append(watchers, ch)
	}
	br.mu.Unlock()
	if casting {
		br.cdp.call(ctx, br.session, "Page.stopScreencast", nil, nil)
		br.cdp.call(ctx, br.session, "Page.startScreencast", br.castParams(v), nil)
	}
	for _, ch := range watchers {
		go br.firstFrame(context.Background(), ch)
	}
	return nil
}

// applyViewport sets the page's size and scale.
func (br *browser) applyViewport(ctx context.Context, v Viewport) error {
	if err := br.cdp.call(ctx, br.session, "Emulation.setDeviceMetricsOverride", map[string]any{
		"width": v.Width, "height": v.Height, "deviceScaleFactor": v.DeviceScale(), "mobile": false,
		"screenWidth": v.Width, "screenHeight": v.Height,
	}, nil); err != nil {
		return fmt.Errorf("resizing the page: %w", err)
	}
	br.mu.Lock()
	br.viewport = v
	br.mu.Unlock()
	return nil
}

// maxCastSide caps a screencast frame's longer side in device pixels: a
// 4K page at 2x would be 7680 pixels wide, far more than any pane shows,
// and every frame crosses the network to the laptop.
const maxCastSide = 2560

// castParams are the screencast's: frames at the page's own pixels, so the
// app can show them sharp, up to maxCastSide.
func (br *browser) castParams(v Viewport) map[string]any {
	w, h := v.Pixels()
	if long := max(w, h); long > maxCastSide {
		w, h = w*maxCastSide/long, h*maxCastSide/long
	}
	return map[string]any{"format": "jpeg", "quality": 60, "maxWidth": w, "maxHeight": h, "everyNthFrame": 1}
}

// captureFrame takes the page as it is now, a JPEG at the page's scale
// (its longer side at most maxCastSide pixels), as a frame for watchers.
func (br *browser) captureFrame(ctx context.Context) (frame, error) {
	v := br.currentViewport()
	params := map[string]any{"format": "jpeg", "quality": 60}
	if w, h := v.Pixels(); max(w, h) > maxCastSide {
		var metrics struct {
			Visual struct {
				PageX float64 `json:"pageX"`
				PageY float64 `json:"pageY"`
			} `json:"cssVisualViewport"`
		}
		br.cdp.call(ctx, br.session, "Page.getLayoutMetrics", nil, &metrics)
		params["clip"] = map[string]any{"x": metrics.Visual.PageX, "y": metrics.Visual.PageY, "width": v.Width, "height": v.Height, "scale": float64(maxCastSide) / float64(max(w, h))}
	}
	var shot struct {
		Data string `json:"data"`
	}
	if err := br.cdp.call(ctx, br.session, "Page.captureScreenshot", params, &shot); err != nil {
		return frame{}, err
	}
	if shot.Data == "" {
		return frame{}, errors.New("no image")
	}
	return frame{Data: shot.Data, Width: v.Width, Height: v.Height, Scale: v.DeviceScale(), URL: br.currentURL()}, nil
}

// recaptureLocked takes a sharp frame for watchers soon, one at a time: a
// change while one is taken is taken next. br.mu is held.
func (br *browser) recaptureLocked() {
	if br.recapturing {
		br.dirty = true
		return
	}
	br.recapturing = true
	go func() {
		for {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			f, err := br.captureFrame(ctx)
			cancel()
			br.mu.Lock()
			if err == nil {
				for ch := range br.watchers {
					select {
					case ch <- f:
					default:
					}
				}
			}
			if !br.dirty || len(br.watchers) == 0 {
				br.recapturing, br.dirty = false, false
				br.mu.Unlock()
				return
			}
			br.dirty = false
			br.mu.Unlock()
			// At most the screencast's rate: the box sends 8 a second.
			time.Sleep(castEvery)
		}
	}()
}

// castEvery is the least time between two frames sent to the laptop.
const castEvery = 125 * time.Millisecond

func (br *browser) currentViewport() Viewport {
	br.mu.Lock()
	defer br.mu.Unlock()
	if br.viewport.Width == 0 {
		return DefaultViewport
	}
	return br.viewport
}
