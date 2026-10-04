// Render the launch video: serve the repository, open src/index.html in
// headless Chrome, step window.seek(t) one frame at a time, pipe the frames
// to ffmpeg with the music, and write out/.
//
//   node scripts/render.mjs --format 16x9            out/berth-launch.mp4
//   node scripts/render.mjs --format all --poster    every cut, and the poster
//   node scripts/render.mjs --stills 0,4.2,8.4       PNGs of those times
//   node scripts/render.mjs --serve                  preview in a browser
//
// Options: --fps 60, --format 16x9|1x1|9x16|all, --stills t,t,… (or "beats"
// for every bar line), --out dir, --poster, --serve.

import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = path.resolve(HERE, "..");
const ROOT = path.resolve(VIDEO, "..");
const OUT = path.join(VIDEO, "out");
const MUSIC = path.join(VIDEO, ".cache", "music.wav");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf("--" + k);
  if (i < 0) return d;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
const FPS = +arg("fps", 60);
const NAMES = { "16x9": "berth-launch.mp4", "1x1": "berth-launch-square.mp4", "9x16": "berth-launch-vertical.mp4" };
const SIZES = { "16x9": [1920, 1080], "1x1": [1080, 1080], "9x16": [1080, 1920] };

// A small static server over the repository root (the page needs the
// site's fonts and its own beats.json).
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
function serve(port = 0) {
  const server = http.createServer((req, res) => {
    const p = path.normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

async function openPage(browser, base, fmt) {
  const [w, h] = SIZES[fmt];
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
  await page.goto(`${base}/video/src/index.html?f=${fmt}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  const cdp = await page.context().newCDPSession(page);
  return { page, cdp, w, h };
}

async function shot(P, t) {
  await P.page.evaluate((tt) => window.seek(tt), t);
  const { data } = await P.cdp.send("Page.captureScreenshot", {
    format: "png",
    // Without a clip, CDP captures the headless window, which is shorter
    // than the emulated viewport.
    clip: { x: 0, y: 0, width: P.w, height: P.h, scale: 1 },
    captureBeyondViewport: true,
    optimizeForSpeed: true,
  });
  return Buffer.from(data, "base64");
}

function ffmpeg(args) {
  const ff = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((ok, no) => ff.on("close", (c) => (c === 0 ? ok() : no(new Error("ffmpeg exited " + c)))));
  return { ff, done };
}

async function renderVideo(browser, base, fmt) {
  const P = await openPage(browser, base, fmt);
  const dur = await P.page.evaluate(() => window.VIDEO.duration);
  const frames = Math.round(dur * FPS);
  const out = path.join(OUT, NAMES[fmt]);
  // 16:9 keeps under ~20 MB; the others are smaller frames.
  const vbr = { "16x9": ["-crf", "17", "-maxrate", "4.2M", "-bufsize", "8M"], "1x1": ["-crf", "17", "-maxrate", "3.2M", "-bufsize", "6M"], "9x16": ["-crf", "17", "-maxrate", "4M", "-bufsize", "8M"] }[fmt];
  const { ff, done } = ffmpeg([
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-i", MUSIC,
    "-map", "0:v", "-map", "1:a",
    "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-tune", "animation", "-profile:v", "high", ...vbr,
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-af", "loudnorm=I=-15:TP=-1.5:LRA=11,aresample=48000",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-t", dur.toFixed(3),
    "-movflags", "+faststart",
    out,
  ]);
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const png = await shot(P, i / FPS);
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 120 === 0) process.stdout.write(`\r${fmt}: frame ${i}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end();
  await done;
  await P.page.close();
  console.log(`\r${fmt}: ${frames} frames at ${FPS} fps → ${path.relative(VIDEO, out)} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

async function stills(browser, base, fmt, times, dir) {
  const P = await openPage(browser, base, fmt);
  mkdirSync(dir, { recursive: true });
  const { writeFileSync } = await import("node:fs");
  for (const t of times) {
    const name = path.join(dir, `${fmt}-${t.toFixed(3).padStart(7, "0")}.png`);
    writeFileSync(name, await shot(P, t));
  }
  await P.page.close();
  console.log(`${fmt}: ${times.length} stills → ${path.relative(VIDEO, dir)}`);
}

const server = await serve(arg("serve") ? +arg("port", 4417) : 0);
const base = `http://127.0.0.1:${server.address().port}`;
if (arg("serve")) {
  console.log(`preview: ${base}/video/src/index.html?f=16x9&hud=1&t=0  (seek(t) in the console; ctrl-c to stop)`);
} else {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--force-color-profile=srgb", "--disable-lcd-text", "--font-render-hinting=none"] });
  try {
    const fmts = arg("format", "16x9") === "all" ? Object.keys(NAMES) : String(arg("format", "16x9")).split(",");
    mkdirSync(OUT, { recursive: true });
    if (arg("stills")) {
      const beats = JSON.parse(readFileSync(path.join(VIDEO, "src", "beats.json"), "utf8"));
      const spec = String(arg("stills"));
      const times = spec === "true" || spec === "beats" ? beats.downbeats.map((d) => Math.max(0, d)).filter((d) => d < beats.duration) : spec.split(",").map(Number);
      for (const f of fmts) await stills(browser, base, f, times, path.resolve(String(arg("out", path.join(OUT, "stills")))));
    } else {
      if (!existsSync(MUSIC)) throw new Error("no .cache/music.wav: run `python3 scripts/music.py` first");
      for (const f of fmts) await renderVideo(browser, base, f);
      if (arg("poster")) {
        const P = await openPage(browser, base, "16x9");
        const { writeFileSync } = await import("node:fs");
        const t = await P.page.evaluate(() => window.VIDEO.duration - 0.9);
        writeFileSync(path.join(OUT, "berth-launch-poster.png"), await shot(P, t));
        await P.page.close();
        console.log("poster → out/berth-launch-poster.png");
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}
