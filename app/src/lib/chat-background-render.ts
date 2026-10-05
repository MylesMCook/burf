import { type ChatBackground, downscale } from "@/lib/chat-background";

// Drawing a chat background: the picture fitted to the pane, then, as
// chosen, pixelated, frosted, toned to the theme, dimmed and dithered. It
// is drawn once into the canvas it is given, at the resolution the effects
// need (a dot or a block per pixel when dithered or pixelated, a third of
// the pane when frosted, else up to 1.5x the screen's), and redrawn only
// when the picture, the effects, the theme or the size change. Nothing runs
// between.
//
// It also measures the result: the reading sheet behind the conversation
// (chat-background.tsx) must be opaque enough that body and muted text
// keep WCAG AA contrast over the worst of it, and render() says how opaque.

export type RGB = [number, number, number];

export interface ThemeColours {
  bg: RGB;
  fg: RGB;
  muted: RGB;
  dark: boolean;
}

export interface RenderResult {
  // Draw the canvas with hard pixels (dither, pixelate) or smooth.
  pixelated: boolean;
  // The reading sheet's opacity, 0 to 1.
  sheet: number;
}

type Source = CanvasImageSource & { width: number; height: number };

const BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63,
  31, 55, 23, 61, 29, 53, 21,
].map((v) => (v + 0.5) / 64);

// The most pixels a background is drawn with: a 5K pane at 1x.
const MAX_PIXELS = 2560 * 1600;

// render draws src into out for a pane of w×h CSS px. unit scales the
// effects' sizes, for a preview smaller than a pane.
export function render(out: HTMLCanvasElement, src: Source, w: number, h: number, dpr: number, o: ChatBackground, theme: ThemeColours, unit = 1): RenderResult {
  // A background behind dimming and a sheet needs no more than 1.5x; at
  // 2x a large pane takes twice as long to draw for no visible gain.
  const device = 1 / Math.min(Math.max(dpr, 1), 1.5);
  let cell = device;
  if (o.pixelate >= 2) cell = o.pixelate * unit;
  else if (o.dither) cell = o.ditherSize * unit;
  else if (o.glass > 0.05) cell = 3 * unit;
  cell = Math.max(cell, device);
  let ww = Math.max(1, Math.round(w / cell));
  let wh = Math.max(1, Math.round(h / cell));
  if (ww * wh > MAX_PIXELS) {
    const k = Math.sqrt(MAX_PIXELS / (ww * wh));
    ww = Math.round(ww * k);
    wh = Math.round(wh * k);
  }

  const work = document.createElement("canvas");
  work.width = ww;
  work.height = wh;
  const ctx = work.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = `rgb(${theme.bg.join(",")})`;
  ctx.fillRect(0, 0, ww, wh);
  place(ctx, src, ww, wh, o);

  // Frosted: a blur as wide as the glass is thick, in work pixels.
  if (o.glass > 0) blur(work, (o.glass * 40 * unit) / cell);

  const frame = ctx.getImageData(0, 0, ww, wh);
  shade(frame, o, theme);
  ctx.putImageData(frame, 0, 0);

  out.width = ww;
  out.height = wh;
  out.getContext("2d")!.drawImage(work, 0, 0);
  const sheet = sheetFor(work, theme);
  work.width = work.height = 0;
  return { pixelated: o.pixelate >= 2 || o.dither, sheet };
}

// place fits the picture: cover crops it to fill, contain shows all of it
// over a soft, wide wash of itself.
function place(ctx: CanvasRenderingContext2D, src: Source, ww: number, wh: number, o: ChatBackground) {
  const pos = o.position === "top" ? 0 : o.position === "bottom" ? 1 : 0.5;
  const draw = (scale: number) => {
    const dw = Math.max(1, Math.round(src.width * scale));
    const dh = Math.max(1, Math.round(src.height * scale));
    const scaled = dw < src.width ? downscale(src, dw, dh) : null;
    ctx.drawImage(scaled ?? src, Math.round((ww - dw) / 2), Math.round((wh - dh) * pos), dw, dh);
    if (scaled) scaled.width = scaled.height = 0;
  };
  const cover = Math.max(ww / src.width, wh / src.height);
  if (o.fit === "contain") {
    const tiny = downscale(src, 24, Math.max(1, Math.round((24 * src.height) / src.width)));
    const s = Math.max(ww / tiny.width, wh / tiny.height);
    ctx.drawImage(tiny, (ww - tiny.width * s) / 2, (wh - tiny.height * s) / 2, tiny.width * s, tiny.height * s);
    tiny.width = tiny.height = 0;
    draw(Math.min(ww / src.width, wh / src.height));
  } else draw(cover);
}

// blur by a pyramid: halve r's worth of times, then double back up, each
// step smoothing. Close to a gaussian, and the same in every webview.
function blur(c: HTMLCanvasElement, r: number) {
  const steps = Math.round(Math.log2(Math.max(1, r)));
  if (steps < 1) return;
  const levels: HTMLCanvasElement[] = [c];
  for (let i = 0; i < steps; i++) {
    const prev = levels[levels.length - 1];
    if (prev.width < 4 || prev.height < 4) break;
    const t = document.createElement("canvas");
    t.width = Math.ceil(prev.width / 2);
    t.height = Math.ceil(prev.height / 2);
    const x = t.getContext("2d")!;
    x.imageSmoothingQuality = "high";
    x.drawImage(prev, 0, 0, t.width, t.height);
    levels.push(t);
  }
  for (let i = levels.length - 1; i > 0; i--) {
    const x = levels[i - 1].getContext("2d")!;
    x.imageSmoothingQuality = "high";
    x.clearRect(0, 0, levels[i - 1].width, levels[i - 1].height);
    x.drawImage(levels[i], 0, 0, levels[i - 1].width, levels[i - 1].height);
    levels[i].width = levels[i].height = 0;
  }
}

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

// shade tones, dims, frosts and dithers, one pass over the pixels.
function shade(frame: ImageData, o: ChatBackground, t: ThemeColours) {
  const { data, width: w, height: h } = frame;
  const n = w * h;
  const bg = t.bg;
  const bgY = luma(...bg);
  const target = o.tone === "auto" ? (t.dark ? "dark" : "light") : o.tone;

  // The picture's own range, so a dark picture and a light one both fill
  // the band they are moved into.
  const hist = new Uint32Array(256);
  for (let i = 0; i < n * 4; i += 4) hist[Math.round(luma(data[i], data[i + 1], data[i + 2]))]++;
  const lo = percentile(hist, n, 0.02);
  const hi = Math.max(lo + 1, percentile(hist, n, 0.98));

  // The bands: dark sits just above a dark theme's background, light just
  // below a light one's; the reading sheet does the rest.
  const band: [number, number] | null = target === "dark" ? [Math.max(0, bgY * 0.5), Math.min(255, bgY + 58)] : target === "light" ? [Math.max(0, Math.min(bgY, 255) - 80), Math.min(255, Math.max(bgY, 200))] : null;
  // Frosted glass is also a little lighter or darker, toward the page.
  const dim = Math.min(0.95, o.dim + o.glass * 0.18);

  const Ys = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    if (band) {
      // Darkened by scaling toward black, lightened by scaling toward
      // white, so hues and their proportions survive the move.
      const Y = luma(r, g, b);
      const k = Math.min(1, Math.max(0, (Y - lo) / (hi - lo)));
      const Yn = band[0] + k * (band[1] - band[0]);
      if (target === "dark") {
        const f = Y > 0.5 ? Yn / Y : 0;
        r = r * f + (f ? 0 : Yn);
        g = g * f + (f ? 0 : Yn);
        b = b * f + (f ? 0 : Yn);
      } else {
        const f = Y < 254.5 ? (255 - Yn) / (255 - Y) : 0;
        r = 255 - (255 - r) * f;
        g = 255 - (255 - g) * f;
        b = 255 - (255 - b) * f;
      }
    }
    if (dim) {
      r += (bg[0] - r) * dim;
      g += (bg[1] - g) * dim;
      b += (bg[2] - b) * dim;
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
    Ys[p] = luma(data[i], data[i + 1], data[i + 2]);
  }
  if (!o.dither) return;

  // Dither within the range the picture now spans, so a toned picture
  // still gets all its steps.
  let min = 255;
  let max = 0;
  for (let p = 0; p < n; p += 7) {
    if (Ys[p] < min) min = Ys[p];
    if (Ys[p] > max) max = Ys[p];
  }
  const span = Math.max(8, max - min);
  if (o.ditherColour === "theme") {
    // Ink: four steps from the page's background toward its text.
    const steps = 4;
    const reach = t.dark ? 0.32 : 0.26;
    const inks: RGB[] = Array.from({ length: steps }, (_, k) => mix(bg, t.fg, (k / (steps - 1)) * reach));
    for (let y = 0; y < h; y++) {
      const row = (y & 7) * 8;
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        // Light pictures under a dark theme read as light ink, and the
        // reverse under a light one: ink always rises from the page.
        let k = (Ys[p] - min) / span;
        if (!t.dark) k = 1 - k;
        const q = Math.min(steps - 1, Math.floor(k * (steps - 1) + BAYER8[row + (x & 7)]));
        const c = inks[q];
        const i = p * 4;
        data[i] = c[0];
        data[i + 1] = c[1];
        data[i + 2] = c[2];
      }
    }
    return;
  }
  // Picture: each dot's lightness moves to one of a few steps, its colour
  // kept (dithering the channels apart is what makes static).
  const L = 4;
  for (let y = 0; y < h; y++) {
    const row = (y & 7) * 8;
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p * 4;
      const k = (Ys[p] - min) / span;
      const q = Math.min(L, Math.floor(k * L + BAYER8[row + (x & 7)])) / L;
      const d = min + q * span - Ys[p];
      data[i] = data[i] + d;
      data[i + 1] = data[i + 1] + d;
      data[i + 2] = data[i + 2] + d;
    }
  }
}

function percentile(hist: Uint32Array, n: number, q: number): number {
  const want = n * q;
  let seen = 0;
  for (let v = 0; v < 256; v++) {
    seen += hist[v];
    if (seen >= want) return v;
  }
  return 255;
}

export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function lin(c: number) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export const luminance = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export function contrast(a: RGB, b: RGB) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// sheetFor is how opaque the reading sheet must be: over the picture as
// the sheet's blur sees it (a small copy, though not so small that a
// webview without backdrop blur shows detail it never measured), the worst
// 2% of it in the direction that hurts (light under a dark theme's light
// text, dark under a light one's), body text keeps 7:1 and muted text 4.5:1.
function sheetFor(c: HTMLCanvasElement, t: ThemeColours): number {
  const sw = 128;
  const sh = Math.max(1, Math.round((sw * c.height) / c.width));
  const small = downscale(c, sw, sh);
  const px = small.getContext("2d")!.getImageData(0, 0, sw, sh).data;
  small.width = small.height = 0;
  const all: { y: number; c: RGB }[] = [];
  for (let i = 0; i < px.length; i += 4) {
    const col: RGB = [px[i], px[i + 1], px[i + 2]];
    all.push({ y: luminance(col), c: col });
  }
  all.sort((a, b) => a.y - b.y);
  const worst = t.dark ? all[Math.floor(all.length * 0.98)].c : all[Math.floor(all.length * 0.02)].c;
  return sheetOver(worst, t);
}

// sheetOver is the least opacity, from 0.6, at which the theme's text
// reads over the sheet laid on colour c.
export function sheetOver(c: RGB, t: ThemeColours): number {
  for (let a = 0.6; a < 0.97; a += 0.01) {
    const under = mix(c, t.bg, a);
    if (contrast(t.fg, under) >= 7 && contrast(t.muted, under) >= 4.5) return a;
  }
  return 0.97;
}
