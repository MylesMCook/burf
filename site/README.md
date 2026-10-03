# site

Berth's landing page: static HTML and CSS, no build step. Open
`index.html`, or serve the folder as it is.

- `index.html`, `styles.css`: the page. Light and dark follow the system.
- `assets/shots/`: screenshots of the app, as WebP pairs per theme:
  `<scene>-<dark|light>-<width>.webp`, at 1x and 2x, and for phones a
  readable crop of each wide one, `<scene>-<dark|light>-phone-<width>.webp`.
- `assets/og.png`: the 1200×630 link preview (harbour and headline);
  `assets/favicon.svg` and `assets/apple-touch-icon.png` (180px, opaque).
- `assets/fonts/`: Inter and JetBrains Mono (SIL OFL, licences beside them).
- `scripts/capture.mjs`: retakes the screenshots.

## Screenshots

The screenshots come from the app's demo mode (`?mock=1`), whose data is
invented and safe to publish (`app/src/lib/mock*.ts`). Retake them when
the app changes:

```sh
pnpm -C app install                                   # once
npm install --prefix site/scripts --no-save playwright-core   # once
node site/scripts/capture.mjs
```

It builds the built-in plugins, starts Vite on `app/` (port 1456), opens
each scene in headless Google Chrome at 2x in Berth Dark and Berth Light,
writes the WebPs into `assets/shots/`, and stops Vite. A scene that fails,
or that logs a console error in demo mode, makes it exit non-zero.

```sh
node site/scripts/capture.mjs --only dashboard,env   # some scenes
node site/scripts/capture.mjs --theme light           # one theme
node site/scripts/capture.mjs --png /tmp/shots        # also keep the 2x PNGs to look at
node site/scripts/capture.mjs --phone-only            # re-cut the phone crops, no app needed
```

Also `--port N`, `--quality 0.8` (WebP), `--skip-plugins`, and the
environment variables `PLAYWRIGHT_CORE` (playwright-core's folder, if it
is installed elsewhere) and `CHROME_CHANNEL` (default `chrome`).

Each scene in `scripts/capture.mjs` stages one screen and returns the area
to keep: a dialog or panel on its own, not cut from the window around it.
Adding one there and a `<picture>` for it in `index.html` (a light
`<source>`, a dark `<img>`, both with the two widths) is all a new
screenshot takes. A scene's `phone` area adds the phone crop; give it two
more `<source>`s with `media="(max-width: 640px)"` (light first) and the
`crop` class on the shot if the crop cuts through the screen.

On the page every shot sits on a tinted `.plate` (the hero's on the
`.stage`, above the harbour). Only the four every-day features (workspace,
project, graph, broadcast) and the dashboard are shown; the second tier of
features is text cards, so the queue, flow, kits, env, notifications and
plugins scenes are captured but not on the page. Phone crops are about 340
CSS pixels wide, so they show at roughly their own size on a phone. A scene marked `bare` in `capture.mjs` keeps
only its dialog and shadow, on a transparent ground; give its shot the
`bare` class so the page adds no frame of its own. `alone()` in a scene
hides the dialog's backdrop and close button.
`&shots=1` in the demo's URL hides its "mock" badge.

## Rules

The page follows the brand board (`design/brand/index.html`): amber only
for what needs you (the lit masthead, the "needs you" row), small labels in
sentence case and never tracked, no stripe down one side of a card, the
harbour by day, and the app's own words ("Send a prompt to several agents",
not "Broadcast"). The drawings move by `transform` and `opacity` only, with
fixed keyframes and no SVG masks over moving parts (both forced style and
layout every frame), pause offscreen, and stop for reduced motion.

Get started leads with the release: the install one-liner on a box, then
the app (built from source until it ships signed) and pairing, with `berth
add ssh` as the alternative. If a release is missing, `install.sh` says so
plainly and prints the source-and-SSH route.

Keep the page light: about 250 KB on first load and under 1 MB after
scrolling to the end at 2x.
