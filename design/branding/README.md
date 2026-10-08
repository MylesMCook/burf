# Burf Branding Pack

Owner: Codex side conversation on mac-mini. This pack is separate from the active source checkout.
Source: user-supplied Quiver/Arrow SVG, 2026-10-08. No redesign or new artwork.

## App Icon

- `originals/burf-app-icon-quiver.svg`: original pasted SVG preserved.
- `burf-app-icon.svg`: square 1024px master; all artwork paths, circle, colors and strokes unchanged.
- Removed only the translucent white presentation rectangle.
- Adjusted the viewBox to 280 154 384 384 for tight, balanced square framing.
- Colors: plum #4E2A4A; cream #F4EAD5; coral #E4895E.
- Exterior is transparent. No fonts, scripts, embedded raster data or external assets.
- Validation: both files parse as XML; element comparison confirms original artwork unchanged; rendered preview inspected with no clipping.
- `previews/burf-app-icon.svg.png` is a Quick Look review thumbnail with a white presentation background, not a production transparent PNG export.

## Transparent Wordmark

- `originals/burf-wordmark-quiver.svg`: original pasted SVG preserved.
- `burf-wordmark.svg`: transparent 620x412 master, viewBox 318 242 310 206.
- Only the canvas framing and line formatting changed; every supplied vector path is preserved.
- Plum lettering #4E2A4A and coral underline #E4895E; the b counter is an actual transparent even-odd cutout.
- Validation: both XML files parse; all packaged paths match the original; u/r/f paths also match the app icon; rendered preview checked for clipping.
- `previews/burf-wordmark.svg.png` is a white-backed, padded Quick Look review thumbnail, not a production transparent PNG export.

## Smiling Alternate

- `originals/burf-wordmark-smiling-quiver.svg`: original pasted SVG preserved.
- `burf-wordmark-smiling.svg`: transparent 620x412 master with the same viewBox as the regular wordmark.
- All Quiver geometry and face transforms preserved; only canvas framing and whitespace changed.
- Face uses the supplied lighter cream #FFF5E4. Main lettering and underline retain #4E2A4A and #E4895E.
- Validation: both SVGs parse; all supplied element attributes match; base lettering/underline match the regular wordmark; rendered face sits inside the u without clipping.
- `previews/burf-wordmark-smiling.svg.png` is a white-backed, padded Quick Look review thumbnail, not a production transparent PNG export.

## Small b Mark

- `originals/burf-mark-quiver.svg`: original pasted SVG preserved.
- `burf-mark.svg`: square 512px master, viewBox 296 246 162 162.
- Exact plum b path from the wordmark, with its transparent even-odd counter; only framing and whitespace changed.
- Validation: XML parsing and exact path comparison passed. Reviewed native SVG renders at 16, 24, 32 and 48px; no clipping and the counter remains visible.
- `previews/{16,24,32,48}/burf-mark.svg.png` are correctly sized, white-backed Quick Look review images, not transparent production exports.
- The plum version is for light backgrounds. Dark-background and native monochrome tray variants are not included or verified.

## Delivery Status

All four requested SVG designs are packaged, with supplied originals retained.
The source SVGs are the masters; Quick Look PNGs are review previews only.
No installed app icons or active repository files were changed.
Native ICO/ICNS and production transparent PNG exports are not part of this SVG pack yet.
Do not infer a redesign or replace installed application assets from this staging pack.
