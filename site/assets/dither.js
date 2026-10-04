// Screenshots that arrive through the harbour's grain: as a [data-dither]
// figure comes into view, its picture appears as halftone dots (the same
// ordered Bayer dither as the harbour, one dot per 2 CSS px), then resolves,
// dot by dot and from the top, into the sharp screenshot. About a second,
// once per figure. Nothing is hidden without this script, for reduced
// motion, or if a picture fails to load.
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  const figs = [...document.querySelectorAll("[data-dither]")];
  if (!figs.length) return;
  const CELL = 2;
  const LEVELS = 4;
  const TIME = 1100;
  const B = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63,
    31, 55, 23, 61, 29, 53, 21,
  ].map((v) => (v + 0.5) / 64);

  const reveal = async (fig) => {
    // The picture showing (a figure can hold a switch of several).
    const img = [...fig.querySelectorAll("img")].find((i) => !i.closest('[aria-hidden="true"]'));
    const canvas = document.createElement("canvas");
    canvas.className = "dots";
    canvas.setAttribute("aria-hidden", "true");
    try {
      if (!img.complete) await new Promise((ok, no) => (img.addEventListener("load", ok, { once: true }), img.addEventListener("error", no, { once: true })));
      await img.decode();
    } catch {
      fig.classList.remove("veiled");
      return;
    }
    const box = img.getBoundingClientRect();
    const w = Math.max(1, Math.ceil(box.width / CELL));
    const h = Math.max(1, Math.ceil(box.height / CELL));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    const frame = ctx.getImageData(0, 0, w, h);
    const { data } = frame;
    // The dithered picture, and each dot's moment: its Bayer value, leaning
    // on the row so the picture settles from the top down.
    const at = new Float32Array(w * h);
    const L = LEVELS - 1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const i = p * 4;
        const Y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const d = (Math.floor((Y / 255) * L + B[(y & 7) * 8 + (x & 7)]) / L) * 255 - Y;
        data[i] += d;
        data[i + 1] += d;
        data[i + 2] += d;
        at[p] = 0.55 * B[((y + 3) & 7) * 8 + ((x + 5) & 7)] + 0.45 * (y / h);
      }
    }
    const alpha = new Uint8ClampedArray(w * h);
    fig.append(canvas);
    let start = 0;
    const step = (now) => {
      start ||= now;
      const t = Math.min(1, (now - start) / TIME);
      // First half: the dots come in. Second half: the sharp picture shows
      // under them and they go, one by one.
      const inT = Math.min(1, t * 2);
      const outT = Math.max(0, t * 2 - 1);
      if (outT > 0) fig.classList.add("resolving");
      for (let p = 0; p < w * h; p++) alpha[p] = at[p] < inT && at[p] >= outT ? 255 : 0;
      for (let p = 0, i = 3; p < w * h; p++, i += 4) data[i] = alpha[p];
      ctx.putImageData(frame, 0, 0);
      if (t < 1) requestAnimationFrame(step);
      else {
        fig.classList.remove("veiled", "resolving");
        canvas.remove();
      }
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        reveal(e.target);
      }
    },
    { threshold: 0.25 },
  );
  for (const fig of figs) {
    // Already on screen when the page opens: shown as it is.
    if (fig.getBoundingClientRect().top < innerHeight * 0.9) continue;
    fig.classList.add("veiled");
    io.observe(fig);
  }
})();
