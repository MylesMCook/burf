# Production Assets

The four SVG masters and `originals/` are byte-for-byte copies of the approved
2026-10-08 pack. `README.md` is the original handoff. `previews/` contains review
thumbnails only; nothing in the production pipeline reads that directory.

## Regenerate

From the repository root, with the existing locked app dependencies and
Playwright Chromium available:

```sh
node scripts/export-branding.mjs
node --test scripts/branding.test.mjs
```

Chromium renders each SVG directly into a transparent canvas at the target
dimensions. This preserves viewBox, aspect ratio, paths, strokes, colors and
even-odd cutouts. ImageMagick's local SVG renderer omitted the coral underline
in a probe and is deliberately not used. No design or color transformations
are applied.

Tauri's installed icon tool creates ICNS and Windows store assets. ICNS chunks
are sorted by representation tag for repeatable exports; their payloads stay
unchanged. ICO embeds
the exact vector-rendered PNG frames at 16, 24, 32, 48, 64 and 256px, avoiding
alpha bleed from downsampling the 1024px bitmap. The standard desktop PNGs also
use direct vector renders. Temporary unused mobile outputs are not retained.

## Outputs

- `exports/burf-app-icon-*.png`: transparent app icon, 16 through 1024px.
- `exports/burf-app-icon.ico` and `.icns`: native desktop containers.
- `exports/burf-wordmark-{620,1240}.png`: 620x412 and 1240x824.
- `exports/burf-wordmark-smiling-{620,1240}.png`: same dimensions, supplied face.
- `exports/burf-mark-*.png`: small b at 16, 24, 32, 48, 64, 128, 256 and 512px.

The export script synchronizes Tauri icons, web/doc favicons and touch icons,
phone-web-app icons, and runtime branding folders. Existing `design/logo`
compatibility filenames point to the new art; historical concept sheets stay
untouched. No installed application is modified by this script.

Use the app icon on either background. The plum b and wordmarks are for light
backgrounds; do not recolor them or treat them as monochrome tray templates.
The smiling wordmark remains an optional alternate, not the default app icon.

Tests pin the four approved master hashes, verify runtime SVG equality, PNG
dimensions, transparent exteriors and counters, the coral underline and face,
ICO frames and the ICNS 1024px representation. Native installed-app appearance
is a separate verification step.
