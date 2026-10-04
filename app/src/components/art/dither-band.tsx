import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// DitherBand draws a picture as an ordered (Bayer) dither: a few levels per
// channel, so the grain shows as dots, most in the mid-tones and where light
// meets shade. Toward its foot the picture dissolves dot by dot (a threshold
// ramp, not a fade) into whatever is behind it, so set the band on the page's
// background and it melts into it in light and dark alike.
//
// It renders once, at a cell's resolution (cell CSS px per dot) on a small
// canvas scaled up by a whole number with hard pixels, so the dots stay crisp
// at any window size. It redraws only when its size changes (and not while
// the window is hidden), keeps no copy of the picture once drawn, and runs
// nothing in between: no timers, no animation frames.

const BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63,
  31, 55, 23, 61, 29, 53, 21,
].map((v) => (v + 0.5) / 64);

export interface DitherBandProps {
  // The picture. It covers the band, like object-fit: cover.
  src: string;
  // Where the picture sits vertically when cropped: 0 its top, 1 its foot.
  position?: number;
  // CSS px per dot.
  cell?: number;
  // Levels per colour channel.
  levels?: number;
  // How much of the band, from its foot, dissolves.
  fade?: number;
  className?: string;
}

export function DitherBand({ src, position = 0.5, cell = 2, levels = 5, fade = 0.45, className }: DitherBandProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    let alive = true;
    let pending = false;
    let timer = 0;
    let size = "";

    const draw = async () => {
      if (document.hidden) {
        pending = true;
        return;
      }
      pending = false;
      const w = Math.ceil(el.clientWidth / cell);
      const h = Math.ceil(el.clientHeight / cell);
      if (!w || !h || `${w}x${h}` === size) return;
      const img = new Image();
      img.src = src;
      try {
        await img.decode();
      } catch {
        return;
      }
      if (!alive) return;
      size = `${w}x${h}`;
      cv.width = w;
      cv.height = h;
      cv.style.width = `${w * cell}px`;
      cv.style.height = `${h * cell}px`;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, (w - dw) / 2, (h - dh) * position, dw, dh);
      const frame = ctx.getImageData(0, 0, w, h);
      dither(frame, levels, fade);
      ctx.putImageData(frame, 0, 0);
      setDrawn(true);
    };

    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void draw(), 120);
    };
    const onVisible = () => {
      if (pending && !document.hidden) void draw();
    };
    const ro = new ResizeObserver(later);
    ro.observe(el);
    document.addEventListener("visibilitychange", onVisible);
    void draw();
    return () => {
      alive = false;
      window.clearTimeout(timer);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      // Give the pixels back.
      cv.width = 0;
      cv.height = 0;
    };
  }, [src, position, cell, levels, fade]);

  return (
    <div ref={wrap} aria-hidden className={cn("pointer-events-none overflow-hidden", className)}>
      <canvas ref={canvas} className={cn("block [image-rendering:pixelated] transition-opacity duration-500", drawn ? "opacity-100" : "opacity-0")} />
    </div>
  );
}

// dither quantises each channel to a few levels against a Bayer threshold,
// and clears the dots below a ramp toward the foot. The ramp uses the matrix
// shifted, so the dissolve's pattern does not line up with the colour's.
function dither(frame: ImageData, levels: number, fade: number) {
  const { data, width: w, height: h } = frame;
  const L = levels - 1;
  const from = h * (1 - fade);
  for (let y = 0; y < h; y++) {
    let keep = 1;
    if (y > from) {
      const t = 1 - (y - from) / (h - from);
      keep = t * t * (3 - 2 * t);
    }
    const row = (y & 7) * 8;
    const rowB = ((y + 3) & 7) * 8;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (BAYER8[rowB + ((x + 5) & 7)] >= keep) {
        data[i + 3] = 0;
        continue;
      }
      const t = BAYER8[row + (x & 7)];
      data[i] = (Math.floor((data[i] / 255) * L + t) / L) * 255;
      data[i + 1] = (Math.floor((data[i + 1] / 255) * L + t) / L) * 255;
      data[i + 2] = (Math.floor((data[i + 2] / 255) * L + t) / L) * 255;
      data[i + 3] = 255;
    }
  }
}
