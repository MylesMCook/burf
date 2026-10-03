#!/usr/bin/env node
// capture.mjs takes the landing page's screenshots from the app's demo mode.
//
// It builds the built-in plugins, starts Vite on app/ (the current tree, in
// demo mode: ?mock=1&shots=1), opens each scene in headless Chrome at 2x in
// Berth Dark and Berth Light, and writes WebP pairs into site/assets/shots/:
// <scene>-<dark|light>-<width>.webp at the scene's 1x and 2x widths. Vite is
// stopped when it finishes, fails or is interrupted.
//
//   node site/scripts/capture.mjs                     every scene, both themes
//   node site/scripts/capture.mjs --only flow,env     some scenes
//   node site/scripts/capture.mjs --theme dark        one theme
//   node site/scripts/capture.mjs --png /tmp/shots    also keep the 2x PNGs
//   node site/scripts/capture.mjs --phone-only        only re-cut the phone crops
//                                                     from the WebPs already there
//
// A scene with a `phone` area also gets a crop for phones, shown below 640px
// wide: <scene>-<theme>-phone-<width>.webp, at the area's 1x and 2x widths.
// The area is in CSS pixels from the top left of the scene's clip, so it can
// be re-cut from the saved 2x WebP without starting the app (--phone-only).
//
// Other flags: --port N (default 1456), --quality 0.8, --skip-plugins.
// It needs Google Chrome and playwright-core; see site/README.md.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..", "..");
const appDir = join(root, "app");
const outDir = join(root, "site", "assets", "shots");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const only = flag("only")?.split(",");
const themes = (flag("theme") ?? "dark,light").split(",");
const port = Number(flag("port", "1456"));
const quality = Number(flag("quality", "0.8"));
const pngDir = flag("png");
const base = `http://localhost:${port}/?mock=1&shots=1`;

// The demo's browser tab points at a worktree's dev server, which demo mode
// doesn't have; this stands in for it, unbranded.
const devServerPage = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font:14px/1.5 system-ui,-apple-system,sans-serif;background:#f6f6f4;color:#222}
header{display:flex;align-items:center;gap:10px;padding:14px 28px;border-bottom:1px solid #e4e4e4;background:#fff}
header b{font-size:15px} header span{color:#888;font-size:13px}
main{padding:28px;max-width:560px} h1{font-size:20px;margin:0 0 4px} p{color:#666;margin:0 0 20px}
.card{background:#fff;border:1px solid #e4e4e4;border-radius:10px;padding:18px 20px;margin-bottom:14px}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0}.row:last-child{border:0}
.price{font-size:26px;font-weight:600}.tag{display:inline-block;background:#eef6ee;color:#1f7a3a;border-radius:99px;padding:2px 10px;font-size:12px;margin-left:8px;vertical-align:middle}
small{color:#888}</style></head><body><header><b>Billing</b><span>localhost · dev</span></header><main>
<h1>Team plan</h1><p>Billed yearly · renews 14 March</p>
<div class="card"><div class="price">€1,200.00 <small>/ year</small><span class="tag">EUR</span></div></div>
<div class="card"><div class="row"><span>Invoice 0042</span><span>€1,200.00</span></div><div class="row"><span>Invoice 0031</span><span>€1,200.00</span></div><div class="row"><span>Invoice 0019</span><span>€960.00</span></div></div>
</main></body></html>`;

// A scene opens the demo, stages one screen and returns the area to keep,
// in CSS pixels. A `bare` scene is a dialog kept on a transparent ground.
// Widths are the WebP widths written; the default is the
// clip's width and twice it. A scene whose widths are set also says its
// clip's width (clipWidth), for --phone-only.
const scenes = [
  {
    name: "dashboard",
    // Wide enough for all four columns.
    viewport: { width: 1440, height: 900 },
    widths: [1280, 2240],
    clipWidth: 1440,
    // The "Needs you" column: the waiting agent's card, its question and answers.
    phone: { x: 251, y: 52, width: 300, height: 206 },
    async stage(s) {
      await s.view({ kind: "dashboard" });
      await s.wait(600);
      await s.quietQueue();
      await s.page.mouse.move(1430, 450);
      await s.wait(600);
      return s.full();
    },
  },
  {
    name: "workspace",
    widths: [1280, 2240],
    clipWidth: 1280,
    // The agent's terminal, at about its own size on a phone.
    phone: { x: 240, y: 0, width: 340, height: 280 },
    async stage(s) {
      await s.quietQueue();
      await s.page.getByText("billing-fix", { exact: true }).first().click();
      await s.wait(800);
      // The worktree's dev server, opened beside the agent.
      await s.page.getByText("web", { exact: true }).first().click();
      await s.wait(1500);
      return s.full();
    },
  },
  {
    name: "project",
    bare: true,
    // The box tiles, the field and what Enter will do.
    phone: { x: 30, y: 36, width: 340, height: 250 },
    async stage(s) {
      await s.page.evaluate(() => window.__berthStore.getState().openAddProject());
      await s.wait(600);
      await s.page.keyboard.type("acme/handbook");
      await s.wait(900);
      await s.alone();
      return s.around(s.page.getByRole("dialog"), 20);
    },
  },
  {
    name: "graph",
    widths: [760, 1400],
    clipWidth: 760,
    // The branch, ahead and behind, its actions and the first commits.
    phone: { x: 0, y: 10, width: 340, height: 340 },
    async stage(s) {
      await s.view({ kind: "worktrees" });
      await s.wait(800);
      await s.page.locator("main").getByText("billing-fix", { exact: true }).first().click();
      await s.wait(1000);
      // A shot, not a dialog: no close button in the corner.
      await s.page.addStyleTag({ content: '[role="dialog"] [aria-label="Close"], [role="dialog"] [data-slot="dialog-close"], [role="dialog"] [data-slot="sheet-close"] { visibility: hidden !important; }' });
      const box = await s.page.getByRole("dialog").boundingBox();
      return { x: box.x, y: 0, width: Math.min(box.width, 1280 - box.x), height: 760 };
    },
  },
  {
    name: "broadcast",
    bare: true,
    // The prompt and the first chosen agents.
    phone: { x: 20, y: 30, width: 340, height: 340 },
    async stage(s) {
      await s.view({ kind: "dashboard" });
      await s.wait(800);
      await s.page.getByRole("button", { name: "Select" }).click();
      await s.wait(300);
      for (const n of ["billing-fix", "qa-deck", "judge-v2"]) await s.page.locator("main").getByText(n, { exact: true }).first().click();
      await s.page.getByRole("button", { name: /Send to/ }).click();
      await s.wait(600);
      await s.alone();
      return s.around(s.page.getByRole("dialog"), 24);
    },
  },
  {
    name: "queue",
    async stage(s) {
      await s.view({ kind: "dashboard" });
      await s.wait(600);
      await s.page.getByText(/^Queued/).first().click();
      await s.wait(800);
      await s.page.mouse.move(900, 400);
      // The popover's first box, offline with its prompts waiting; the list
      // scrolls below that, over the demo's own "Simulate" controls.
      const pop = s.page.getByText("Queued prompts", { exact: true }).locator("xpath=ancestor::*[@data-side][1]");
      const box = await pop.boundingBox();
      const next = await pop.getByText(/· online/).first().boundingBox();
      const bottom = next ? next.y - 12 : box.y + box.height;
      // Inside the popover's own border, so nothing beside it shows.
      return { x: box.x + 1, y: box.y + 1, width: box.width - 2, height: bottom - box.y - 1 };
    },
  },
  {
    name: "flow",
    phone: { x: 0, y: 0, width: 400, height: 400 },
    async stage(s) {
      await s.view({ kind: "automations", open: { box: "*", scope: "project:calcom/cal.com" } });
      await s.wait(1000);
      await s.page.getByPlaceholder("Name this flow").fill("Tell me when an agent finishes");
      await s.page.mouse.click(1240, 700);
      return { x: 420, y: 60, width: 664, height: 600 };
    },
  },
  {
    name: "kits",
    phone: { x: 0, y: 0, width: 400, height: 460 },
    async stage(s) {
      await s.view({ kind: "kits" });
      await s.wait(800);
      await s.page.getByRole("button", { name: /Add from link/ }).click();
      await s.wait(400);
      await s.page.keyboard.type("https://github.com/acme/kits/tree/main/cal-worktrees");
      await s.page.getByRole("button", { name: "Review" }).click();
      await s.wait(1500);
      await s.alone();
      const box = await s.page.getByRole("dialog").boundingBox();
      return { x: box.x, y: 0, width: 1280 - box.x, height: 800 };
    },
  },
  {
    name: "env",
    phone: { x: 0, y: 0, width: 420, height: 380 },
    async stage(s) {
      await s.view({ kind: "project", box: "devl", location: "cal" });
      await s.wait(1000);
      await s.page.getByText("Environment", { exact: true }).first().click();
      await s.wait(600);
      // A secret reference, tested: the result shows in its button.
      await s.page.locator("#env").getByRole("button", { name: "Test" }).first().click();
      await s.wait(700);
      await s.page.mouse.move(10, 10);
      return s.around(s.page.locator("#env"), 20);
    },
  },
  {
    name: "notifications",
    query: "&notify=1",
    async stage(s) {
      // Let the demo's notifications arrive and their toasts leave.
      await s.wait(10000);
      await s.view({ kind: "dashboard" });
      await s.page.keyboard.press("Meta+Shift+N");
      await s.wait(900);
      // The panel on its own: nothing of the dashboard behind it, cut mid-word.
      const box = await s.page.getByText("Mark all read").locator("xpath=ancestor::*[@data-side or @role='dialog'][1]").boundingBox();
      return { x: box.x, y: box.y, width: box.width, height: Math.min(800 - box.y, box.height) };
    },
  },
  {
    name: "plugins",
    phone: { x: 0, y: 0, width: 400, height: 440 },
    async stage(s) {
      await s.view({ kind: "settings", section: "plugins" });
      await s.wait(800);
      const intro = await s.page.getByText(/^Plugins live in/).boundingBox();
      return { x: intro.x - 16, y: intro.y - 16, width: 640, height: 700 };
    },
  },
];

async function loadPlaywright() {
  const tries = [];
  if (process.env.PLAYWRIGHT_CORE) {
    const p = process.env.PLAYWRIGHT_CORE;
    tries.push(statSync(p).isDirectory() ? join(p, "index.mjs") : p);
  }
  tries.push(join(import.meta.dirname, "node_modules", "playwright-core", "index.mjs"));
  // npx's cache, where `npx playwright-core` leaves it.
  const npx = join(homedir(), ".npm", "_npx");
  if (existsSync(npx)) {
    const found = readdirSync(npx)
      .map((d) => join(npx, d, "node_modules", "playwright-core", "index.mjs"))
      .filter((f) => existsSync(f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    tries.push(...found);
  }
  for (const f of tries) if (existsSync(f)) return import(pathToFileURL(f).href);
  try {
    return await import("playwright-core");
  } catch {
    throw new Error("playwright-core not found. Run `npm install --prefix site/scripts --no-save playwright-core`, or set PLAYWRIGHT_CORE to its folder.");
  }
}

function startVite() {
  if (!args.includes("--skip-plugins")) {
    const r = spawnSync(process.execPath, [join(appDir, "scripts", "build-plugins.mjs")], { cwd: appDir, stdio: "inherit" });
    if (r.status !== 0) throw new Error("building the built-in plugins failed");
  }
  const vite = join(appDir, "node_modules", "vite", "bin", "vite.js");
  if (!existsSync(vite)) throw new Error("app/node_modules is missing: run `pnpm install` in app/ first");
  const child = spawn(process.execPath, [vite, "--port", String(port), "--strictPort"], { cwd: appDir, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  return { child, log: () => log };
}

function stopVite(vite) {
  if (!vite || vite.child.exitCode !== null) return;
  try {
    process.kill(-vite.child.pid, "SIGTERM");
  } catch {
    vite.child.kill("SIGTERM");
  }
}

async function waitForServer(vite) {
  const until = Date.now() + 30_000;
  while (Date.now() < until) {
    if (vite.child.exitCode !== null) throw new Error(`Vite exited:\n${vite.log()}`);
    try {
      const r = await fetch(`http://localhost:${port}/`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Vite did not answer on port ${port}:\n${vite.log()}`);
}

// encode turns one 2x PNG into WebPs at the given widths, in the browser.
// The source is a 2x image of the clip; `area` (CSS pixels within the clip)
// cuts part of it, for the phone crops.
async function encode(page, image, clip, widths, area, mime = "image/png") {
  return page.evaluate(
    async ({ b64, mime, clip, widths, area, quality }) => {
      const img = new Image();
      img.src = `data:${mime};base64,${b64}`;
      await img.decode();
      const k = img.width / clip.width;
      const a = area ?? { x: 0, y: 0, width: clip.width, height: clip.height };
      return widths.map((w) => {
        const h = Math.round((a.height * w) / a.width);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, a.x * k, a.y * k, a.width * k, a.height * k, 0, 0, w, h);
        return { w, h, data: c.toDataURL("image/webp", quality).split(",")[1] };
      });
    },
    { b64: image.toString("base64"), mime, clip, widths, area, quality },
  );
}

function write(name, r) {
  const file = join(outDir, `${name}-${r.w}.webp`);
  writeFileSync(file, Buffer.from(r.data, "base64"));
  console.log(`${name}-${r.w}.webp  ${r.w}x${r.h}  ${(statSync(file).size / 1024).toFixed(0)} KB`);
}

// phoneOnly re-cuts every phone crop from the 2x WebP already in assets/shots.
async function phoneOnly() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL ?? "chrome", headless: true });
  try {
    const page = await browser.newPage();
    for (const scene of scenes) {
      if (!scene.phone || (only && !only.includes(scene.name))) continue;
      for (const theme of themes) {
        const re = new RegExp(`^${scene.name}-${theme}-(\\d+)\\.webp$`);
        const sizes = readdirSync(outDir).map((f) => Number(f.match(re)?.[1])).filter(Boolean).sort((a, b) => b - a);
        if (!sizes.length) throw new Error(`no ${scene.name}-${theme} WebP to cut a phone crop from`);
        const big = readFileSync(join(outDir, `${scene.name}-${theme}-${sizes[0]}.webp`));
        // The clip in CSS pixels: twice the widest WebP, unless the scene
        // says (its widths are set, and the widest is under 2x).
        const dims = await page.evaluate(async (b64) => {
          const img = new Image();
          img.src = `data:image/webp;base64,${b64}`;
          await img.decode();
          return { width: img.width, height: img.height };
        }, big.toString("base64"));
        const cw = scene.clipWidth ?? dims.width / 2;
        const clip = { width: cw, height: (dims.height * cw) / dims.width };
        const p = scene.phone;
        for (const r of await encode(page, big, clip, [p.width, p.width * 2], p, "image/webp")) write(`${scene.name}-${theme}-phone`, r);
      }
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const { chromium } = await loadPlaywright();
  mkdirSync(outDir, { recursive: true });
  if (pngDir) mkdirSync(pngDir, { recursive: true });
  const vite = startVite();
  const cleanup = () => stopVite(vite);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  process.on("exit", cleanup);

  let failed = 0;
  let browser;
  try {
    await waitForServer(vite);
    browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL ?? "chrome", headless: true });
    const encoder = await browser.newPage();
    for (const scene of scenes) {
      if (only && !only.includes(scene.name)) continue;
      for (const theme of themes) {
        const viewport = scene.viewport ?? { width: 1280, height: 800 };
        const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: theme === "light" ? "light" : "dark" });
        await ctx.addInitScript((id) => {
          localStorage.setItem("berth.ui", JSON.stringify({ themeId: id }));
          localStorage.setItem("berth.prefs", JSON.stringify({ density: "compact" }));
        }, theme === "light" ? "berth-light" : "berth-dark");
        await ctx.route(/^http:\/\/\d+\.[a-z0-9-]+\.localhost:1377\//, (r) => r.fulfill({ status: 200, contentType: "text/html", body: devServerPage }));
        const page = await ctx.newPage();
        const errors = [];
        page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
        page.on("pageerror", (e) => errors.push(e.message));
        const wait = (ms) => page.waitForTimeout(ms);
        const s = {
          page,
          wait,
          view: (v) => page.evaluate((v) => window.__berthStore.getState().setView(v), v),
          full: () => ({ x: 0, y: 0, ...viewport }),
          // The demo starts with one queued prompt that failed; drop it, so
          // the status bar shows the queue without a red error.
          async quietQueue() {
            await page.getByText(/^Queued/).first().click();
            await wait(500);
            const failed = page.getByRole("button", { name: "Retry" }).first();
            if (await failed.count()) {
              await failed.locator("xpath=ancestor::div[contains(@class,'border-b')][1]").getByRole("button", { name: "Discard" }).click();
              await wait(500);
            }
            await page.keyboard.press("Escape");
            // No focus ring left on the status bar's Queued button.
            await page.evaluate(() => document.activeElement?.blur());
            await wait(300);
          },
          // A dialog on its own: no dimmed, blurred window behind it and no
          // close button in its corner. A `bare` scene keeps nothing but the
          // dialog and its shadow, on a transparent ground, so the page can
          // set it on its own panel.
          async alone() {
            const ground = scene.bare
              ? '#root { visibility: hidden !important; } html, body { background: transparent !important; } [data-slot="dialog-backdrop"] { background: transparent !important; }'
              : '[data-slot="dialog-backdrop"] { background: var(--background) !important; }';
            await page.addStyleTag({ content: ground + ' [data-slot="dialog-backdrop"] { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; } [role="dialog"] [aria-label="Close"], [role="dialog"] [data-slot="dialog-close"] { visibility: hidden !important; }' });
            await wait(250);
          },
          async around(locator, pad) {
            const b = await locator.first().boundingBox();
            const x = Math.max(0, b.x - pad);
            const y = Math.max(0, b.y - pad);
            return { x, y, width: Math.min(viewport.width, b.x + b.width + pad) - x, height: Math.min(viewport.height, b.y + b.height + pad) - y };
          },
        };
        try {
          await page.goto(base + (scene.query ?? ""));
          await page.waitForFunction(() => "__berthStore" in window);
          await wait(2500);
          const clip = await scene.stage(s);
          await wait(1200);
          const png = await page.screenshot({ clip, omitBackground: !!scene.bare });
          if (pngDir) writeFileSync(join(pngDir, `${scene.name}-${theme}.png`), png);
          const widths = scene.widths ?? [Math.round(clip.width), Math.round(clip.width * 2)];
          for (const r of await encode(encoder, png, clip, widths)) write(`${scene.name}-${theme}`, r);
          if (scene.phone) {
            const p = scene.phone;
            for (const r of await encode(encoder, png, clip, [p.width, p.width * 2], p)) write(`${scene.name}-${theme}-phone`, r);
          }
          if (errors.length) {
            failed++;
            console.error(`${scene.name} (${theme}): console errors in demo mode:\n  ${errors.join("\n  ")}`);
          }
        } catch (err) {
          failed++;
          console.error(`${scene.name} (${theme}) failed: ${err.message.split("\n")[0]}`);
        } finally {
          await ctx.close();
        }
      }
    }
  } finally {
    await browser?.close();
    cleanup();
  }
  if (failed) {
    console.error(`${failed} scene(s) failed or logged errors`);
    process.exit(1);
  }
}

(args.includes("--phone-only") ? phoneOnly() : main()).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
