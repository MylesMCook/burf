import { readFileSync } from "node:fs";

import { expect, mockOnly, test } from "./fixtures";

// The Preview tab: a worktree's page at several sizes at once, synced or
// isolated, light or dark. Mock mode has no laptop proxy, so the stand-in dev
// server below carries the proxy's own preview script, as the proxy puts it
// into a Preview frame's page (internal/proxy/preview.go), and nowhere else.

const SCRIPT = readFileSync(new URL("../../internal/proxy/preview.js", import.meta.url), "utf8");
const PROXIED = /^https?:\/\/[^/]+\.localhost:1377(?:\/|$)/;

// A small single-page app: Tailwind's breakpoints named in CSS, light and
// dark by prefers-color-scheme, a router, a long page and a form.
const PAGE = (script: boolean) => `<!doctype html><html><head>${script ? `<script>${SCRIPT}</script>` : ""}<meta name="viewport" content="width=device-width,initial-scale=1"><title>Shop</title>
<style>
body{margin:0;font:16px system-ui;background:#ffffff;color:#111}
@media (prefers-color-scheme: dark){body{background:#0a0a0a;color:#eee}}
#bp::after{content:"base"} @media (min-width:640px){#bp::after{content:"sm"}} @media (min-width:768px){#bp::after{content:"md"}}
@media (min-width:1024px){#bp::after{content:"lg"}} @media (min-width:1280px){#bp::after{content:"xl"}}
section{height:900px;border-bottom:1px solid #8884}
</style></head><body>
<nav><a href="/" data-spa>Home</a> <a href="/pricing" data-spa>Pricing</a></nav>
<p id="bp"></p><p id="route"></p><p id="width"></p>
<form><input id="q" name="q" placeholder="Search"></form>
<section>one</section><section>two</section><section>three</section>
<script>
const render = () => { document.getElementById("route").textContent = location.pathname; document.getElementById("width").textContent = String(innerWidth); };
document.addEventListener("click", (e) => { const a = e.target.closest("a[data-spa]"); if (!a) return; e.preventDefault(); history.pushState({}, "", a.getAttribute("href")); render(); });
addEventListener("popstate", render);
render();
</script></body></html>`;

test.beforeEach(async ({ app }) => {
  // Preview frames ask with the flag; the stand-in gives those the script.
  await app.context.route(PROXIED, (route) => {
    const flagged = new URL(route.request().url()).searchParams.has("__berth_preview");
    return route.fulfill({ status: 200, contentType: "text/html", body: PAGE(flagged) });
  });
  await app.open();
});

const frame = (app: { page: import("@playwright/test").Page }, id: string) => app.page.frameLocator(`[data-testid=preview-frame][data-frame="${id}"] iframe`);
const bodyColor = (app: { page: import("@playwright/test").Page }, id: string) => frame(app, id).locator("body").evaluate((b) => getComputedStyle(b).backgroundColor);

test("a Preview tab shows the dev server at every size, synced, in light and dark", async ({ app }) => {
  mockOnly();
  const page = app.page;
  await app.openWorktree("devl/checkout-fix");
  await page.getByRole("button", { name: "New tab" }).click();
  await page.getByRole("option", { name: /^Preview/ }).click();

  const pane = page.locator("[data-testid=preview-pane]:visible");
  await expect(pane).toHaveAttribute("data-sync", "synced");
  const tiles = pane.locator("[data-testid=preview-frame]");
  // The defaults: a phone and Tailwind's md, lg and xl, all connected.
  await expect(tiles).toHaveCount(4);
  for (const id of ["phone", "md", "lg", "xl"]) await expect(pane.locator(`[data-frame="${id}"]`)).toHaveAttribute("data-status", "live");
  // Each frame is its real CSS width, whatever its scale on screen.
  await expect(frame(app, "md").locator("#width")).toHaveText("768");
  await expect(frame(app, "phone").locator("#width")).toHaveText("390");
  await expect(pane.locator('[data-frame="xl"]')).toContainText("1280 × 900");
  // The page sees its own address, without the flag that asked for the script.
  await expect(frame(app, "lg").locator("#route")).toHaveText("/");
  expect(await frame(app, "lg").locator("body").evaluate(() => location.search)).toBe("");

  // Synced: a route opened in one frame opens in all.
  await frame(app, "phone").getByRole("link", { name: "Pricing" }).click();
  for (const id of ["md", "lg", "xl"]) await expect(frame(app, id).locator("#route")).toHaveText("/pricing");
  // Scrolling one scrolls the others, to the same place in the page.
  await frame(app, "md").locator("body").evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2));
  await expect.poll(() => frame(app, "xl").locator("body").evaluate(() => Math.round((scrollY / (document.documentElement.scrollHeight - innerHeight)) * 10))).toBe(5);

  // Light and dark, for all frames (the browser here is dark) and for one.
  const bar = pane.getByRole("toolbar", { name: "Preview" });
  await expect.poll(() => bodyColor(app, "lg")).toBe("rgb(10, 10, 10)");
  await bar.getByRole("button", { name: "Light theme for all frames" }).click();
  for (const id of ["phone", "lg"]) await expect.poll(() => bodyColor(app, id)).toBe("rgb(255, 255, 255)");
  await pane.getByRole("button", { name: "Theme of md: Light" }).click();
  await expect.poll(() => bodyColor(app, "md")).toBe("rgb(10, 10, 10)");
  await expect.poll(() => bodyColor(app, "lg")).toBe("rgb(255, 255, 255)");
  // The page's own matchMedia answers for the forced theme too.
  expect(await frame(app, "md").locator("body").evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(true);

  // Isolated: each frame on its own.
  await bar.getByRole("button", { name: "Sync frames" }).click();
  await expect(pane).toHaveAttribute("data-sync", "isolated");
  await frame(app, "phone").getByRole("link", { name: "Home" }).click();
  await expect(frame(app, "phone").locator("#route")).toHaveText("/");
  await expect(frame(app, "xl").locator("#route")).toHaveText("/pricing");

  // A phone turns sideways; a custom width joins the sizes.
  await pane.getByRole("button", { name: "Rotate Phone" }).click();
  await expect(pane.locator('[data-frame="phone"]')).toContainText("844 × 390");
  await expect(frame(app, "phone").locator("#width")).toHaveText("844");
  await bar.getByRole("button", { name: "Sizes" }).click();
  const width = page.getByRole("textbox", { name: "Custom width" });
  await width.fill("1440");
  await width.press("Enter");
  await page.keyboard.press("Escape");
  await expect(pane.locator('[data-frame="w1440"]')).toContainText("1440 × 900");
  await expect(frame(app, "w1440").locator("#bp")).toBeAttached();

  // Fit all, a filmstrip, a grid.
  await bar.getByRole("button", { name: "Filmstrip" }).click();
  await expect(pane).toHaveAttribute("data-layout", "row");
  await bar.getByRole("button", { name: "Grid" }).click();
  await expect(pane).toHaveAttribute("data-layout", "grid");

  // All of it is remembered for the worktree.
  const saved = (await app.stored("berth.preview")) as Record<string, { sync: boolean; layout: string; rotated: string[]; custom: number[]; theme: string }>;
  const mine = Object.entries(saved).find(([k]) => k.startsWith("devl:"))?.[1];
  expect(mine).toMatchObject({ sync: false, layout: "grid", rotated: ["phone"], custom: [1440], theme: "light" });

  // A screenshot of every frame, side by side.
  await bar.getByRole("button", { name: "Screenshot of all frames" }).click();
  const dialog = page.getByRole("dialog", { name: "Screenshot of all frames" });
  await expect(dialog.getByRole("img", { name: "All frames" })).toBeVisible();
  expect(await dialog.getByRole("img", { name: "All frames" }).evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(1000);
  await dialog.getByRole("button", { name: "Close" }).first().click();

  // A site that isn't the worktree's can't be framed: it says so, and offers
  // a Browser tab.
  const address = bar.getByRole("textbox", { name: "Address" });
  await address.fill("https://example.com/");
  await address.press("Enter");
  await expect(pane.getByText("example.com can't be framed")).toBeVisible();
  await pane.getByRole("button", { name: "Open in Browser tab" }).click();
  await expect(page.locator("[data-testid=browser-pane]:visible")).toBeVisible();
});

test("the Browser tab's toolbar opens the page as a Preview tab", async ({ app }) => {
  mockOnly();
  const page = app.page;
  await app.openWorktree("devl/checkout-fix");
  await page.getByRole("button", { name: "New tab" }).click();
  await page.getByRole("option", { name: /New browser tab/ }).click();
  const browser = page.locator("[data-testid=browser-pane]:visible");
  const address = browser.locator("form input").first();
  await address.fill("3001");
  await address.press("Enter");
  // Normal browsing never gets the preview script.
  await expect(browser.frameLocator("iframe").locator("#route")).toHaveText("/");
  expect(await browser.frameLocator("iframe").locator("body").evaluate(() => "__berthPreview" in window)).toBe(false);
  await browser.getByRole("button", { name: /^Preview sizes/ }).click();
  const pane = page.locator("[data-testid=preview-pane]:visible");
  await expect(pane.locator("[data-testid=preview-frame]").first()).toHaveAttribute("data-status", "live");
  await expect(page.locator("[data-tab-strip] [data-tab]").filter({ hasText: "Preview" })).toBeVisible();
});
