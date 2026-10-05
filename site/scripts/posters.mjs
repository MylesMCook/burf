// Posters for the page's videos: a frame of each section loop
// (assets/loops/<name>.mp4 -> <name>.webp) and of the hero's night loop
// (assets/film/hero-loop.mp4 -> hero-loop-poster.webp). It's the first frame,
// so a loop starts on the still that stood in for it, unless AT names a later
// one that says more on its own (the poster is all reduced motion sees). Frames come out with ffmpeg; WebP comes from
// Chrome's encoder (headless, through playwright-core).
//
//   node site/scripts/posters.mjs [--quality 0.72]
//
// Needs ffmpeg, Google Chrome, and playwright-core (as for capture.mjs:
// PLAYWRIGHT_CORE, site/scripts/node_modules, or npx's cache).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const site = join(import.meta.dirname, "..");
const qi = process.argv.indexOf("--quality");
const quality = qi > 0 ? Number(process.argv[qi + 1]) : 0.72;
// Seconds into a loop for its poster, where the first frame says too little.
const AT = { steps: 7.4 };
const jobs = [[join(site, "assets/film/hero-loop.mp4"), join(site, "assets/film/hero-loop-poster.webp"), 1600, 0]];
const loops = join(site, "assets/loops");
for (const f of readdirSync(loops).filter((f) => f.endsWith(".mp4"))) jobs.push([join(loops, f), join(loops, f.replace(/\.mp4$/, ".webp")), 1600, AT[f.replace(/\.mp4$/, "")] ?? 0]);

async function loadPlaywright() {
  const tries = [];
  if (process.env.PLAYWRIGHT_CORE) {
    const p = process.env.PLAYWRIGHT_CORE;
    tries.push(statSync(p).isDirectory() ? join(p, "index.mjs") : p);
  }
  tries.push(join(import.meta.dirname, "node_modules", "playwright-core", "index.mjs"));
  const npx = join(homedir(), ".npm", "_npx");
  if (existsSync(npx)) for (const d of readdirSync(npx)) tries.push(join(npx, d, "node_modules", "playwright-core", "index.mjs"));
  for (const f of tries) if (existsSync(f)) return import(pathToFileURL(f).href);
  return import("playwright-core");
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL ?? "chrome" });
const page = await browser.newPage();
const tmp = mkdtempSync(join(tmpdir(), "posters-"));
try {
  for (const [video, out, width, at] of jobs) {
    const png = join(tmp, "f.png");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(at), "-i", video, "-frames:v", "1", png]);
    const src = `data:image/png;base64,${readFileSync(png).toString("base64")}`;
    const data = await page.evaluate(
      async ([src, width, quality]) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = width;
        c.height = Math.round((img.naturalHeight * width) / img.naturalWidth);
        const ctx = c.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, c.width, c.height);
        return [c.width, c.height, c.toDataURL("image/webp", quality).split(",")[1]];
      },
      [src, width, quality],
    );
    writeFileSync(out, Buffer.from(data[2], "base64"));
    console.log(`${out.slice(site.length + 1)}  ${data[0]}x${data[1]}  ${(statSync(out).size / 1024).toFixed(0)} KB`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
  await browser.close();
}
