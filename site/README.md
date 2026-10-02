# site

Berth's landing page: static HTML and CSS, no build step. Open
`index.html`, or serve the folder as it is.

- `index.html`, `styles.css`: the page. Light and dark follow the system.
- `assets/shots/`: screenshots of the app, as WebP pairs per theme:
  `<scene>-<dark|light>-<width>.webp`, at 1x and 2x.
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
```

Also `--port N`, `--quality 0.8` (WebP), `--skip-plugins`, and the
environment variables `PLAYWRIGHT_CORE` (playwright-core's folder, if it
is installed elsewhere) and `CHROME_CHANNEL` (default `chrome`).

Each scene in `scripts/capture.mjs` stages one screen and returns the area
to keep. Adding one there and a `<picture>` for it in `index.html` (a
light `<source>`, a dark `<img>`, both with the two widths) is all a new
screenshot takes. `&shots=1` in the demo's URL hides its "mock" badge.

Keep the page light: about 250 KB on first load and under 1 MB after
scrolling to the end at 2x.
