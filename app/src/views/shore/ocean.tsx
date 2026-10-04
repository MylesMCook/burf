import { useEffect, useRef } from "react";

// Ocean draws open water seen from above: deep blue out at sea, turquoise
// in the shallows by the quay, with glints and foam drifting slowly. It is
// drawn at a third of the window's resolution and scaled up with hard
// pixels, then ordered-dithered to a few levels per channel: that grain is
// the look, and it keeps the drawing cheap. The water moves a pixel at a
// time, a few times a second, and stops when the window is hidden or the
// mode asks it to (still).

export type Light = "dawn" | "day" | "dusk" | "night";

type RGB = [number, number, number];
interface Palette {
  deep: RGB;
  open: RGB;
  shallow: RGB;
  glint: RGB;
  foam: RGB;
}

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

const PALETTES: Record<Light, Palette> = {
  dawn: { deep: hex("#4f63b8"), open: hex("#7d9be0"), shallow: hex("#a9d9e6"), glint: hex("#ffd9e4"), foam: hex("#fff6f2") },
  day: { deep: hex("#2f62c4"), open: hex("#3f8fdc"), shallow: hex("#7fd6dc"), glint: hex("#e9fbff"), foam: hex("#ffffff") },
  dusk: { deep: hex("#3a3f93"), open: hex("#6d64b8"), shallow: hex("#e0a3b4"), glint: hex("#ffd2a6"), foam: hex("#fff0e2") },
  night: { deep: hex("#0b1533"), open: hex("#16295a"), shallow: hex("#24506e"), glint: hex("#9fc2ff"), foam: hex("#d6e4ff") },
};

export function lightFor(d = new Date()): Light {
  const q = new URLSearchParams(location.search).get("light");
  if (q === "dawn" || q === "day" || q === "dusk" || q === "night") return q;
  const h = d.getHours();
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

const PX = 3;
const LEVELS = 7;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Value noise that wraps every px cells across and py down, so a field
// built from it tiles and can scroll for ever.
function noise(x: number, y: number, px: number, py = px) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const wx = (v: number) => ((v % px) + px) % px;
  const wy = (v: number) => ((v % py) + py) % py;
  const a = hash(wx(ix), wy(iy)), b = hash(wx(ix + 1), wy(iy));
  const c = hash(wx(ix), wy(iy + 1)), d = hash(wx(ix + 1), wy(iy + 1));
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// fields builds two tiling S×S textures: `lines`, the crests of the swell
// as thin broken contour lines of stretched noise, which read as waves seen
// from above; and `bands`, slow light and dark swells under them.
function fields(S: number): { lines: Float32Array; bands: Float32Array } {
  const lines = new Float32Array(S * S);
  const bands = new Float32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      // Stretched across: features are wider than tall.
      const n = noise(u * 6, v * 16, 6, 16) * 0.7 + noise(u * 12, v * 32, 12, 32) * 0.3;
      const crest = 1 - Math.min(1, Math.abs(n - 0.5) / 0.035);
      const gap = noise(u * 10, v * 10 + 0.5, 10); // breaks the lines into dashes
      lines[y * S + x] = crest > 0 && gap > 0.42 ? crest : 0;
      bands[y * S + x] = noise(u * 3, v * 7, 3, 7) * 2 - 1;
    }
  return { lines, bands };
}

const S = 256;
let shared: ReturnType<typeof fields> | undefined;

export function Ocean({ still, light = lightFor() }: { still?: boolean; light?: Light }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stillRef = useRef(still);
  stillRef.current = still;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    shared ??= fields(S);
    const { lines, bands } = shared;
    const pal = PALETTES[light];
    let img: ImageData | undefined;
    let t = 0;

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      if (!img || img.width !== W || img.height !== H) img = ctx.createImageData(W, H);
      const d = img.data;
      // The crests drift up the screen and a little across; the swells
      // under them move the other way, slower, so nothing simply slides.
      const ax = t, ay = t * 2, bx = -(t >> 1), by = t >> 2;
      const tick = t >> 2;
      for (let y = 0; y < H; y++) {
        const depth = y / H; // 0 out at sea, 1 by the quay
        const g = Math.pow(depth, 1.8);
        const k = Math.min(1, depth * 1.4);
        const r0 = pal.deep[0] + (pal.open[0] - pal.deep[0]) * k, g0 = pal.deep[1] + (pal.open[1] - pal.deep[1]) * k, b0 = pal.deep[2] + (pal.open[2] - pal.deep[2]) * k;
        const r1 = r0 + (pal.shallow[0] - r0) * g, g1 = g0 + (pal.shallow[1] - g0) * g, b1 = b0 + (pal.shallow[2] - b0) * g;
        const rowA = (((y + ay) % S) + S) % S;
        const rowB = (((y + by) % S) + S) % S;
        for (let x = 0; x < W; x++) {
          const line = lines[rowA * S + ((((x + ax) % S) + S) % S)];
          const band = bands[rowB * S + ((((x + bx) % S) + S) % S)];
          // Glints: a few crest pixels catch the light, and change as the
          // water moves.
          const glint = line > 0.6 && hash(x + tick * 7, y) > 0.985 ? 1 : 0;
          const foam = line * (0.38 + g * 0.5);
          const lift = band * 0.035;
          let r = r1 + lift + (pal.foam[0] - r1) * foam + (pal.glint[0] - r1) * glint;
          let gg = g1 + lift + (pal.foam[1] - g1) * foam + (pal.glint[1] - g1) * glint;
          let bb = b1 + lift * 0.6 + (pal.foam[2] - b1) * foam + (pal.glint[2] - b1) * glint;
          const th = BAYER[(y & 3) * 4 + (x & 3)];
          r = Math.floor(r * LEVELS + th + 0.5) / LEVELS;
          gg = Math.floor(gg * LEVELS + th + 0.5) / LEVELS;
          bb = Math.floor(bb * LEVELS + th + 0.5) / LEVELS;
          const i = (y * W + x) * 4;
          d[i] = r * 255;
          d[i + 1] = gg * 255;
          d[i + 2] = bb * 255;
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    const size = () => {
      const r = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.ceil(r.width / PX)), h = Math.max(1, Math.ceil(r.height / PX));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        draw();
      }
    };
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    size();
    draw();

    // A pixel step about four times a second; nothing while hidden or still.
    const timer = setInterval(() => {
      if (document.hidden || stillRef.current) return;
      t += 1;
      draw();
    }, 260);
    return () => {
      clearInterval(timer);
      ro.disconnect();
    };
  }, [light]);

  return <canvas ref={ref} aria-hidden className="absolute inset-0 size-full [image-rendering:pixelated]" />;
}
