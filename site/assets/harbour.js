// The hero's harbour, drawn as the app's Labs home draws it: the painting
// with a halftone grain (an ordered Bayer dither of its lightness, strongest
// on edges and in gradients), dissolving dot by dot into the page at its
// foot. Night in dark mode. It renders once per size on a small canvas, one
// dot per 2 CSS px, scaled up with hard pixels; nothing runs in between.
// Without this script the plain painting shows, faded by CSS.
(() => {
  const band = document.querySelector("[data-harbour]");
  if (!band) return;
  const canvas = band.querySelector("canvas");
  const CELL = 2;
  const LEVELS = 6;
  const FADE = 0.42;
  const POSITION = 0.42;
  const BAYER8 = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63,
    31, 55, 23, 61, 29, 53, 21,
  ].map((v) => (v + 0.5) / 64);
  const dark = matchMedia("(prefers-color-scheme: dark)");
  // The page can be put to night or day by hand ("Close the laptop"): it
  // sets data-theme on <html> and says so with a berth:theme event.
  const isNight = () => (document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "night" : dark.matches);
  const beam = band.querySelector(".beam");
  // Where the lighthouse's lamp is in the painting, as a fraction of it.
  const LAMP = [0.094, 0.457];
  let size = "";
  let timer = 0;
  let pending = false;

  const draw = async (force) => {
    if (document.hidden) return void (pending = true);
    pending = false;
    const w = Math.ceil(band.clientWidth / CELL);
    const h = Math.ceil(band.clientHeight / CELL);
    const night = isNight();
    const key = `${w}x${h}${night}`;
    if (!w || !h || (key === size && !force)) return;
    const img = new Image();
    img.src = night ? band.dataset.night : band.dataset.day;
    try {
      await img.decode();
    } catch {
      return;
    }
    size = key;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w * CELL}px`;
    canvas.style.height = `${h * CELL}px`;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    // Drawn small, then up: the brushwork softens to its forms, so the grain
    // is the dither's, not the paint's.
    const soft = document.createElement("canvas");
    soft.width = Math.max(1, Math.round(w * 0.6));
    soft.height = Math.max(1, Math.round(h * 0.6));
    const sctx = soft.getContext("2d");
    sctx.imageSmoothingQuality = "high";
    // On a narrow screen the lighthouse, at the left, stays in view.
    const across = band.clientWidth < 700 ? 0.08 : 0.5;
    sctx.drawImage(img, (w - dw) * across * 0.6, (h - dh) * POSITION * 0.6, dw * 0.6, dh * 0.6);
    if (beam) {
      beam.style.left = `${((w - dw) * across + dw * LAMP[0]) * CELL}px`;
      beam.style.top = `${((h - dh) * POSITION + dh * LAMP[1]) * CELL}px`;
    }
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(soft, 0, 0, w, h);
    soft.width = soft.height = 0;
    const frame = ctx.getImageData(0, 0, w, h);
    const bg = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g).map(Number);
    dither(frame, night ? 0.3 : 0.04, bg);
    ctx.putImageData(frame, 0, 0);
    band.classList.add("drawn");
  };

  function dither(frame, mute, bg) {
    const { data, width: w, height: h } = frame;
    const L = LEVELS - 1;
    const from = h * (1 - FADE);
    const lum = new Float32Array(w * h);
    for (let i = 0, p = 0; p < w * h; i += 4, p++) {
      data[i] += (bg[0] - data[i]) * mute;
      data[i + 1] += (bg[1] - data[i + 1]) * mute;
      data[i + 2] += (bg[2] - data[i + 2]) * mute;
      lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    for (let y = 0; y < h; y++) {
      let keep = 1;
      if (y > from) {
        const t = 1 - (y - from) / (h - from);
        keep = t * t * (3 - 2 * t);
      }
      const row = (y & 7) * 8;
      const rowB = ((y + 3) & 7) * 8;
      const up = Math.max(0, y - 1) * w;
      const down = Math.min(h - 1, y + 1) * w;
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const i = p * 4;
        if (BAYER8[rowB + ((x + 5) & 7)] >= keep) {
          data[i + 3] = 0;
          continue;
        }
        const Y = lum[p];
        const edge = Math.abs(lum[y * w + Math.min(w - 1, x + 1)] - lum[y * w + Math.max(0, x - 1)]) + Math.abs(lum[down + x] - lum[up + x]);
        const amount = Math.min(1, 0.35 + edge / 40);
        const d = ((Math.floor((Y / 255) * L + BAYER8[row + (x & 7)]) / L) * 255 - Y) * amount;
        data[i] += d;
        data[i + 1] += d;
        data[i + 2] += d;
        data[i + 3] = 255;
      }
    }
  }

  new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(draw, 120);
  }).observe(band);
  dark.addEventListener("change", () => draw(true));
  addEventListener("berth:theme", () => draw(true));
  document.addEventListener("visibilitychange", () => pending && !document.hidden && draw());
  draw();
})();
