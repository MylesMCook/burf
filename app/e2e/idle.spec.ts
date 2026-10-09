import type { Page } from "@playwright/test";

import { expect, mockOnly, STUB_PAGE, test } from "./fixtures";

// The app at rest (perf/soak.mjs measures it properly, over an hour): what
// it asks the agent for while nothing changes, and while its window is
// hidden; that opening and closing tabs leaves nothing behind; and that
// terminals in hidden tabs don't draw, and catch up when shown. Mock mode,
// with its fixtures at rest (?still): the mock agent counts what it is
// asked (window.__berthCalls, lib/mock.ts). Time is Playwright's clock,
// run on by the minute, so a minute takes a moment.

const PROXIED = /^https?:\/\/[^/]+\.localhost:1377(?:\/|$)/;

type Calls = Record<string, number>;
const calls = (page: Page) => page.evaluate(() => ({ ...((window as unknown as { __berthCalls?: Calls }).__berthCalls ?? {}) }));
const minus = (b: Calls, a: Calls) => Object.fromEntries(Object.entries(b).flatMap(([k, v]) => (v - (a[k] ?? 0) > 0 ? [[k, v - (a[k] ?? 0)]] : [])));
const total = (c: Calls) => Object.values(c).reduce((x, y) => x + y, 0);

// The window hidden, as minimised or covered: document.hidden and
// visibilitychange, which is what the app goes by.
const hide = (page: Page, on: boolean) =>
  page.evaluate((on) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => on });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (on ? "hidden" : "visible") });
    document.dispatchEvent(new Event("visibilitychange"));
  }, on);

async function minuteOf(page: Page, minutes = 1) {
  const a = await calls(page);
  for (let i = 0; i < minutes * 12; i++) {
    await page.clock.runFor(5000);
    // React renders on its own scheduler, outside the fake clock.
    await page.waitForTimeout(20);
  }
  return minus(await calls(page), a);
}

test.beforeEach(() => mockOnly());

test("at rest the app asks the agent little, and nothing at all while hidden", async ({ app }) => {
  test.setTimeout(120_000);
  const page = app.page;
  await app.context.route(PROXIED, (route) => route.fulfill({ status: 200, contentType: "text/html", body: STUB_PAGE }));
  await page.clock.install();
  await app.open({ params: { still: "", view: "conversation" } });
  // A worktree with its chat, a Browser tab with the Network drawer open,
  // and the Files panel: each of them looks at the box now and then.
  await app.openWorktree("devl/checkout-fix");
  await page.getByRole("button", { name: "New tab" }).click();
  await page.getByRole("option", { name: /New browser tab/ }).click();
  const pane = page.locator("[data-testid=browser-pane]:visible");
  await pane.getByRole("textbox", { name: "Address" }).fill("http://checkout-fix.shop.devl.localhost:1377/");
  await pane.getByRole("textbox", { name: "Address" }).press("Enter");
  await page.keyboard.press("ControlOrMeta+Alt+KeyI");
  await expect(pane.getByTestId("devtools-drawer")).toBeVisible();
  await page.keyboard.press("ControlOrMeta+Shift+E");
  await expect(page.getByTestId("files-panel")).toBeVisible();
  await page.clock.pauseAt(Date.now() + 1000);

  // Settled: what is left is the backstops, backed off.
  await minuteOf(page, 2);
  const visible = await minuteOf(page);
  test.info().annotations.push({ type: "idle calls a minute", description: JSON.stringify(visible) });
  // Was ~160 a minute before the soak's fixes (perf/soak.mjs).
  expect(total(visible), JSON.stringify(visible)).toBeLessThanOrEqual(65);

  await hide(page, true);
  await page.clock.runFor(1000);
  const hidden = await minuteOf(page, 2);
  expect(hidden, "nothing polls while the window is hidden").toEqual({});

  // Back: it catches up at once.
  const before = await calls(page);
  await hide(page, false);
  await page.waitForTimeout(500);
  expect(total(minus(await calls(page), before))).toBeGreaterThan(0);
});

test("opening and closing tabs again and again leaves nothing behind", async ({ app }) => {
  test.setTimeout(120_000);
  const page = app.page;
  await app.context.route(PROXIED, (route) => route.fulfill({ status: 200, contentType: "text/html", body: STUB_PAGE }));
  await app.open({ params: { still: "", bench: "noisy", rate: "5" } });
  await app.openWorktree("devl/checkout-fix");
  const cdp = await app.context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const strip = page.locator("[data-tab-strip]");
  const settle = async () => {
    await page.waitForTimeout(800);
    await cdp.send("HeapProfiler.collectGarbage");
    const { metrics } = await cdp.send("Performance.getMetrics");
    const m = Object.fromEntries(metrics.map((x: { name: string; value: number }) => [x.name, x.value]));
    // Each ghostty-web terminal has a WASM instance of its own: one kept
    // after its tab closed keeps all of its memory.
    const proto = await cdp.send("Runtime.evaluate", { expression: "WebAssembly.Memory.prototype" });
    const found = await cdp.send("Runtime.queryObjects", { prototypeObjectId: proto.result.objectId! });
    const n = await cdp.send("Runtime.callFunctionOn", { objectId: found.objects.objectId!, functionDeclaration: "function () { return this.length; }", returnByValue: true });
    return { listeners: m.JSEventListeners, nodes: m.Nodes, wasm: n.result.value as number };
  };
  const round = async () => {
    const n = await strip.locator("[data-tab]").count();
    // A terminal, a Browser tab and a Preview tab, then each closed.
    await page.keyboard.press("ControlOrMeta+KeyT");
    await expect(strip.locator("[data-tab]")).toHaveCount(n + 1);
    await expect(page.locator("[data-testid=pane]:visible [data-terminal] canvas")).toHaveCount(1);
    await page.getByRole("button", { name: "New tab" }).click();
    await page.getByRole("option", { name: /New browser tab/ }).click();
    await page.getByRole("button", { name: "New tab" }).click();
    await page.getByRole("option", { name: /^Preview/ }).click();
    await expect(strip.locator("[data-tab]")).toHaveCount(n + 3);
    // The New tab menu is still closing for a moment after its tab shows,
    // and a key pressed while it is goes to the menu, not the tab.
    await expect(page.getByRole("option", { name: /^Preview/ })).toHaveCount(0);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("ControlOrMeta+KeyW");
      const confirm = page.getByRole("alertdialog");
      if (await confirm.isVisible().catch(() => false)) await confirm.getByRole("button", { name: /Close/ }).click();
      await expect(strip.locator("[data-tab]")).toHaveCount(n + 2 - i);
    }
  };
  // Twice first, so what is made once (code, caches) is made.
  await round();
  await round();
  const a = await settle();
  for (let i = 0; i < 6; i++) await round();
  const b = await settle();
  test.info().annotations.push({ type: "after six more rounds", description: JSON.stringify({ a, b }) });
  // A leak keeps a round's listeners: a terminal alone adds dozens.
  expect(b.listeners - a.listeners, "event listeners").toBeLessThan(30);
  expect(b.nodes - a.nodes, "DOM nodes").toBeLessThan(600);
  expect(b.wasm, "terminals' WASM memories kept after their tabs closed").toBeLessThanOrEqual(a.wasm);
});

test("terminals in hidden tabs don't draw, and catch up when shown", async ({ app }) => {
  const page = app.page;
  // Canvas draws, by whether the canvas shows.
  await app.context.addInitScript(() => {
    const w = window as unknown as { __draws: { shown: number; hidden: number } };
    w.__draws = { shown: 0, hidden: 0 };
    const P = CanvasRenderingContext2D.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    for (const k of ["fillText", "fillRect", "clearRect"]) {
      const f = P[k];
      P[k] = function (this: CanvasRenderingContext2D, ...a: unknown[]) {
        if (this.canvas.isConnected) w.__draws[this.canvas.offsetParent ? "shown" : "hidden"]++;
        return f.apply(this, a);
      };
    }
  });
  // Every terminal prints 20 numbered lines a second (lib/mock-bench.ts).
  await app.open({ params: { still: "", bench: "noisy", rate: "20", view: "terminal" } });
  await app.openWorktree("devl/checkout-fix");
  const strip = page.locator("[data-tab-strip]");
  const first = await strip.locator('[data-tab][aria-selected="true"]').getAttribute("data-tab");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ControlOrMeta+KeyT");
  await expect.poll(() => page.locator("[data-terminal] canvas").count()).toBeGreaterThanOrEqual(4);
  await page.waitForTimeout(1000);

  // Home in front: every terminal is hidden, and none draws.
  await page.getByTestId("nav-home").click();
  await page.waitForTimeout(300);
  const draws = () => page.evaluate(() => ({ ...(window as unknown as { __draws: { shown: number; hidden: number } }).__draws }));
  const a = await draws();
  await page.waitForTimeout(2000);
  const b = await draws();
  expect(b.hidden - a.hidden, "draws on hidden terminals").toBe(0);
  expect(b.shown - a.shown).toBe(0);

  // Back to the first: it shows every line it was sent while away, none
  // missing, and draws again.
  await app.openWorktree("devl/checkout-fix");
  await strip.locator(`[data-tab="${first}"]`).click();
  await page.waitForTimeout(300);
  const screen = await page.evaluate(() => {
    const pane = [...document.querySelectorAll<HTMLElement>("[data-testid=pane]")].find((p) => p.style.display !== "none" && p.querySelector("[data-terminal]"));
    const host = pane?.querySelector("[data-terminal] > div") as (HTMLElement & { __berthTerm?: { rows: number; buffer: { active: { viewportY?: number; baseY?: number; getLine(y: number): { translateToString(trim: boolean): string } | undefined } } } }) | null;
    const t = host?.__berthTerm;
    if (!t) return null;
    const nums: number[] = [];
    for (let y = 0; y < t.rows; y++) {
      const m = /^\s*(\d+) /.exec(t.buffer.active.getLine((t.buffer.active.viewportY ?? t.buffer.active.baseY ?? 0) + y)?.translateToString(true) ?? "");
      if (m) nums.push(Number(m[1]));
    }
    return nums;
  });
  expect(screen, "the terminal's screen").not.toBeNull();
  expect(screen!.length).toBeGreaterThan(5);
  // Two seconds away at 20 lines a second: well past the first screenful.
  expect(screen![screen!.length - 1]).toBeGreaterThan(40);
  expect(
    screen!.slice(1).every((n, i) => n === screen![i] + 1),
    `lines in order, none missing: ${screen!.join(",")}`,
  ).toBe(true);
  const c = await draws();
  await page.waitForTimeout(500);
  expect((await draws()).shown - c.shown, "the shown one draws").toBeGreaterThan(0);
});
