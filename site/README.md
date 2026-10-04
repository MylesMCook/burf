# site

Berth's landing page: static HTML and CSS, no build step. Open
`index.html`, or serve the folder as it is.

- `index.html`, `styles.css`: the page. Light and dark follow the system.
- `assets/harbour.js` and `assets/harbour/`: the hero's harbour, the same
  painting the app's Labs home shows (day, and night in dark mode), drawn
  as the app's DitherBand draws it: an ordered dither of its lightness on a
  canvas at one dot per 2 CSS px, dissolving dot by dot into the page. It
  renders once per size; without the script the plain painting shows. The
  lighthouse's beam is a CSS wedge of halftone dots from the lamp, sweeping
  by transform only (still for reduced motion, paused when hidden).
- "Close the laptop" in the header puts the page to night by hand
  (`data-theme` on `<html>`): the harbour redraws at night, the screenshots
  and the bands of sea below switch to their dark versions, and a line
  counts what the agents keep doing while the laptop sleeps.
- Below the hero, a day in the harbour in five beats (sets out, out at sea,
  needs you, back at its berth, three at once), each a line and a real
  screenshot, then a box being added and the night. Bands of pale sea
  (`--sea`) come in and go out through dithered seams (`assets/seam.svg`,
  2 px dots of the harbour's Bayer matrix). `assets/dither.js` brings each
  screenshot in through the same grain as it enters the viewport, once
  (nothing is hidden without it or for reduced motion). "Needs you" has a
  Terminal | Conversation switch over the same agent; the install types
  itself the first time it's in view. The page ends at night whatever the
  theme: the harbour again (`data-night-only`, dissolving at both ends,
  drawn only when near), with a lamp lit for each agent still out. Motion
  pauses offscreen and when the tab is hidden, and is off for reduced
  motion.
- `assets/shots/`: screenshots from the live demo with Labs on, as WebPs
  per theme at 1x and 2x (720, 1280 and 2080 for the full-window ones), and
  a readable crop of each for phones (`<scene>-<theme>-phone-<width>.webp`;
  the conversation pane's is `pane-conversation-narrow`, taken at a
  phone's width). They load lazily. Home, conversation, dashboard and zen
  need the Vite demo; pane-terminal, pane-conversation(-narrow), attempts
  and review click their way in, so they also work against the built demo:
  `node site/scripts/capture.mjs --url http://127.0.0.1:1460/demo/ --only
  pane-terminal,attempts` with `site/` served on 1460.
- `demo/`: the live demo, built from `app/` (see below). Committed, so the
  site still has no build step.
- `assets/og.png`: the 1200×630 link preview (the dithered harbour and the
  headline); `assets/favicon.svg` and `assets/apple-touch-icon.png`.
- `assets/fonts/`: Inter and JetBrains Mono (SIL OFL, licences beside them).
- `scripts/capture.mjs`: retakes the screenshots.

## The live demo

"Try the live demo" opens `/demo/`: the real app, running in the browser on
invented fixtures (`app/src/lib/mock*.ts`). Nothing of it loads from the
page itself.

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
the guide (open checkout-fix, answer the waiting agent, press ⌘K, and Reset
demo), the script (an agent on gpu finishes, Codex on qa-deck stops to ask
something, a review lands in the inbox) and the agents' terminals, which
answer. None of it is in the app's own build (`__BERTH_DEMO__` is false
there). It loads nothing from anywhere but its own folder.

## The screenshots

```sh
npm install --prefix site/scripts --no-save playwright-core   # once
node site/scripts/capture.mjs
```

It builds the built-in plugins, starts Vite on `app/` in demo mode (port
1456), opens the demo with `?shots=1&labs=1` (no guide, badge or script;
Labs on) in headless Google Chrome at 2x in light and dark, stages each
scene, writes the WebPs into `assets/shots/`, and stops Vite. A console
error in the demo makes it exit non-zero. Also `--only home,zen`, `--theme
light`, `--png /tmp/shots` (keep the 2x PNGs), `--phone-only` (re-cut the
phone crops, no app needed), `--url URL` (a demo already served; no
Vite), `--port N`, `--quality 0.8`, `--skip-plugins`,
and the environment variables `PLAYWRIGHT_CORE` and `CHROME_CHANNEL`.

## Rules

The page follows the brand board (`design/brand/index.html`) and the app:
Inter and JetBrains Mono, coss-ui's buttons, sentence case, amber only for
what needs you (the mark's dot). The harbour is the only picture that is not
a screenshot. Keep it light: about 250 KB to first paint and well under
1.5 MB after scrolling to the end at 2x; no layout shift (every image has
its size); no trackers.
