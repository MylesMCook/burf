# site

Berth's landing page: static HTML and CSS, no build step. Open
`index.html`, or serve the folder as it is.

- `index.html`, `styles.css`: the page. Light and dark follow the system.
- `assets/shots/`: the hero's poster, the one screenshot on the page: the
  live demo as it opens, as WebP pairs per theme,
  `dashboard-<dark|light>-<width>.webp` at 1x and 2x, and for phones a
  readable crop, `dashboard-<dark|light>-phone-<width>.webp`.
- `demo/`: the live demo, built from `app/` (see below). Committed, so the
  site still has no build step.
- `assets/og.png`: the 1200×630 link preview (harbour and headline);
  `assets/favicon.svg` and `assets/apple-touch-icon.png` (180px, opaque).
- `assets/fonts/`: Inter and JetBrains Mono (SIL OFL, licences beside them).
- `scripts/capture.mjs`: retakes the poster.

## The live demo

"Try the live demo" on the hero's poster swaps in the real app, running in
the browser on invented fixtures (`app/src/lib/mock*.ts`), in a frame at
`/demo/`. Nothing of it loads before that click: the frame is only made
then. On phones (640px and narrower) the button opens `/demo/` full screen
instead, and "Open the demo full screen" under the stage does the same at
any width. Escape with nothing open in the demo hands the keyboard back to
the page ("Close demo"); Close puts the poster back.

It is `pnpm -C app build:demo` (`vite build --mode demo`), which writes
`site/demo/`. Rebuild and commit it when the app changes:

```sh
pnpm -C app install       # once
pnpm -C app build:demo    # about 3.3 MB in 55 files; ~640 KB gzipped to open
```

Demo mode is always mock mode, follows the system's light or dark, starts
afresh on every load, and leaves out what needs a laptop agent or Tauri:
no system notifications, no plugins from `~/.berth/plugins`, and a box's
dev server is a page drawn in place. Its own code is in `app/src/demo/`:
the guide (open billing-fix, answer the waiting agent, press ⌘K, and Reset
demo), the script (an agent on gpu finishes, Codex on qa-deck stops to ask
something, a review lands in the inbox) and the agents' terminals, which
answer. None of it is in the app's own build (`__BERTH_DEMO__` is false
there). It loads nothing from anywhere but its own folder.

## The poster

```sh
npm install --prefix site/scripts --no-save playwright-core   # once
node site/scripts/capture.mjs
```

It builds the built-in plugins, starts Vite on `app/` in demo mode (port
1456), opens the demo with `?shots=1` (no guide, badge or script) in
headless Google Chrome at 2x in light and dark, writes the WebPs into
`assets/shots/`, and stops Vite. A console error in the demo makes it
exit non-zero. Also `--theme light`, `--png /tmp/shots` (keep the 2x PNGs),
`--phone-only` (re-cut the phone crop, no app needed), `--port N`,
`--quality 0.8`, `--skip-plugins`, and the environment variables
`PLAYWRIGHT_CORE` (playwright-core's folder) and `CHROME_CHANNEL`
(default `chrome`).

## The drawings

The features below the hero are drawings, not screenshots: inline SVG in
`index.html`, in the brand's line (`design/brand/index.html`). The four
every-day features are simplified renderings of their screens (a
workspace's sidebar, terminal and dev server; Add a project; a commit
graph; one prompt fanning out to three agents), and each card under "When
you need it" has a small harbour scene (prompts waiting on the shore while
the box is in fog, a flow as a chart with a dotted course, a kit as a crate
on the quay, a secret as a strongbox with only its tag outside, the lamp
that is lit when something needs you, a pontoon that locks onto the jetty).
Strokes take `--line`, text the page's type, panels `--card`, so they follow
the theme; the lamp is the only amber. Each is 1.5 to 4 KB. The workspace
keeps its size on a phone and shows its left part.

## Rules

The page follows the brand board (`design/brand/index.html`): amber only
for what needs you (the lit masthead, the "needs you" row), small labels in
sentence case and never tracked, no stripe down one side of a card, the
harbour by day, and the app's own words ("Send a prompt to several agents",
not "Broadcast"). The drawings move by `transform` and `opacity` only, with
fixed keyframes and no SVG masks over moving parts (both forced style and
layout every frame), pause offscreen (`.art.off`), and stop for reduced
motion, where each still reads (the fan-out shows three ticks).

Get started leads with the release: the install one-liner on a box, then
the app (built from source until it ships signed) and pairing, with `berth
add ssh` as the alternative. If a release is missing, `install.sh` says so
plainly and prints the source-and-SSH route.

Keep the page light: about 250 KB on first load and under 1 MB after
scrolling to the end at 2x (now about 200 KB for both, compressed: the
drawings cost no requests). The live demo costs nothing until it is opened.
