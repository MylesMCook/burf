import type { Page } from "@playwright/test";

import { expect, mockOnly, test } from "./fixtures";

// A long, busy chat (the demo's bench: ?bench=chat&turns=N, made-up acme
// work, lib/mock-bench.ts): only the rows near the view are drawn, and what
// the person does in it works as in a short one. Timings are checked with
// generous limits; perf/bench.mjs measures them properly.

const TURNS = "2000";
const CHAT = "devl/search-perf";
const SESSION = { box: "devl", session: "search-perf-claude" };

const scroller = (page: Page) => page.locator("[data-testid=pane]:visible [data-testid=chat] .overflow-y-auto").first();

// Scrolled as the person would: a wheel event, then the move (the chat
// stops following its foot only for the person's own scrolling).
async function scrollTo(page: Page, top: number | "foot") {
  await scroller(page).evaluate((el, top) => {
    el.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }));
    el.scrollTop = top === "foot" ? el.scrollHeight : top;
  }, top);
}

const atFoot = (page: Page) => scroller(page).evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight < 4);

test.beforeEach(async ({ app }) => {
  mockOnly();
  // React's commits, read through the DevTools hook (production React calls
  // it too): which chat rows had a component render in each.
  await app.context.addInitScript(() => {
    const w = window as unknown as { __rows: string[][]; __track: boolean; __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown };
    w.__rows = [];
    type Fiber = { type: unknown; flags: number; alternate: Fiber | null; child: Fiber | null; sibling: Fiber | null; return: Fiber | null; stateNode: unknown };
    w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      renderers: new Map(),
      inject: () => 1,
      checkDCE() {},
      onScheduleFiberRoot() {},
      onCommitFiberUnmount() {},
      onPostCommitFiberRoot() {},
      onCommitFiberRoot(_: number, root: { current: Fiber }) {
        if (!w.__track) return;
        const rows = new Set<string>();
        const stack: (Fiber | null)[] = [root.current];
        while (stack.length) {
          const f = stack.pop();
          if (!f) continue;
          const component = typeof f.type === "function" || (!!f.type && typeof f.type === "object");
          if (component && (f.alternate === null || (f.flags & 1) !== 0)) {
            for (let p = f.return; p; p = p.return) {
              const el = p.stateNode as HTMLElement | null;
              if (el?.nodeType === 1 && el.dataset.chatRow !== undefined) {
                rows.add(el.dataset.chatRow);
                break;
              }
            }
          }
          if (f.child && (f.alternate === null || f.child !== f.alternate.child)) stack.push(f.child);
          if (f.sibling) stack.push(f.sibling);
        }
        w.__rows.push([...rows]);
      },
    };
  });
  await app.open({ params: { view: "conversation", bench: "chat", turns: TURNS } });
});

test("a 2,000-turn chat opens quickly and draws only the rows near the view", async ({ app }) => {
  const t0 = Date.now();
  await app.openWorktree(CHAT);
  const list = app.chat.getByRole("list", { name: "Conversation" });
  await expect(list.getByRole("listitem").first()).toBeVisible();
  // Generous: about 0.4 s on a laptop.
  expect(Date.now() - t0).toBeLessThan(8000);
  // The list says how long it is, though few of its rows are drawn.
  const size = Number(await list.getByRole("listitem").first().getAttribute("aria-setsize"));
  expect(size).toBeGreaterThan(5000);
  expect(await list.getByRole("listitem").count()).toBeLessThan(60);
  // It opens at its foot, on the latest answer.
  await expect(app.chat.getByText("Turn 2000: ", { exact: false })).toBeAttached();
  expect(await app.page.evaluate(() => document.getElementsByTagName("*").length)).toBeLessThan(8000);
});

test("a streaming draft draws only its own row, and the chat keeps to its foot", async ({ app }) => {
  await app.openWorktree(CHAT);
  await expect(app.chat.locator("[data-chat-row]").first()).toBeVisible();
  const words = "the acme ledger retries now keep their key so a repeat finds the row once ".repeat(20).split(" ");
  await app.page.evaluate(() => ((window as unknown as { __track: boolean }).__track = true));
  for (let k = 1; k <= 12; k++) {
    await app.page.evaluate(
      ({ s, text }) =>
        new Promise<void>((r) => {
          (window as unknown as { __berthDraft: { show(b: string, s: string, t: string): void } }).__berthDraft.show(s.box, s.session, text);
          requestAnimationFrame(() => setTimeout(r));
        }),
      { s: SESSION, text: words.slice(0, k * 8).join(" ") },
    );
  }
  await expect(app.chat.locator("[data-draft]").first()).toBeVisible();
  const commits = await app.page.evaluate(() => {
    const w = window as unknown as { __rows: string[][]; __track: boolean };
    w.__track = false;
    return w.__rows;
  });
  expect(commits.length).toBeGreaterThan(0);
  // Each update draws the draft's row, and nothing else of the chat's.
  expect(Math.max(...commits.map((c) => c.length))).toBeLessThanOrEqual(1);
  await expect.poll(() => atFoot(app.page)).toBe(true);
  // Its message lands in the same row.
  await app.page.evaluate((s) => (window as unknown as { __berthDraft: { clear(b: string, s: string): void } }).__berthDraft.clear(s.box, s.session), SESSION);
});

test("scrolled up, the place read stays put when a row above it opens", async ({ app }) => {
  await app.openWorktree(CHAT);
  await expect(app.chat.locator("[data-chat-row]").first()).toBeVisible();
  await scrollTo(app.page, 600_000);
  await app.page.waitForTimeout(300);
  await scrollTo(app.page, 600_000);
  // A row in view, and a fold drawn above the view (in the overscan).
  const picked = await app.page.evaluate(() => {
    const sc = document.querySelector<HTMLElement>("[data-testid=pane]:not([hidden]) [data-testid=chat] .overflow-y-auto, [data-testid=chat] .overflow-y-auto")!;
    const top = sc.getBoundingClientRect().top;
    const rows = [...sc.querySelectorAll<HTMLElement>("[data-chat-row]")].sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
    const seen = rows.find((r) => r.getBoundingClientRect().top >= top + 40);
    const above = rows.find((r) => r.getBoundingClientRect().bottom < top && r.querySelector("button[aria-expanded=false]"));
    return seen && above ? { seen: seen.dataset.chatRow!, above: above.dataset.chatRow! } : undefined;
  });
  expect(picked).toBeTruthy();
  const seen = app.chat.locator(`[data-chat-row="${picked!.seen}"]`);
  const before = (await seen.boundingBox())!.y;
  await app.chat.locator(`[data-chat-row="${picked!.above}"] button[aria-expanded=false]`).first().evaluate((b: HTMLElement) => b.click());
  await expect(app.chat.locator(`[data-chat-row="${picked!.above}"] button[aria-expanded=true]`).first()).toBeAttached();
  await app.page.waitForTimeout(500);
  expect(Math.abs((await seen.boundingBox())!.y - before)).toBeLessThan(3);
});

test("⌘F finds words in an old turn and brings it into view", async ({ app }) => {
  await app.openWorktree(CHAT);
  await expect(app.chat.locator("[data-chat-row]").first()).toBeVisible();
  await app.chat.locator("[data-kind=text] .cv-md").last().click();
  await app.page.keyboard.press("ControlOrMeta+f");
  const find = app.page.getByRole("textbox", { name: "Find in chat" });
  await find.fill("Turn 7: ");
  await expect(app.chat.getByText("Turn 7: cache acme auth", { exact: false })).toBeInViewport();
});

test("a selection stays whole while the chat scrolls past it", async ({ app }) => {
  await app.openWorktree(CHAT);
  await expect(app.chat.locator("[data-chat-row]").first()).toBeVisible();
  await scrollTo(app.page, 300_000);
  await app.page.waitForTimeout(300);
  // Words selected from one reply into the next.
  const from = await app.page.evaluate(() => {
    const mds = [...document.querySelectorAll<HTMLElement>("[data-testid=chat] [data-kind=text] .cv-md")].filter((e) => e.getBoundingClientRect().height > 0);
    const a = mds[0];
    const b = mds[1];
    const sel = document.getSelection()!;
    sel.setBaseAndExtent(a.querySelector("p")!.firstChild!, 0, b.querySelector("p")!.firstChild!, 5);
    return a.closest<HTMLElement>("[data-chat-row]")!.dataset.chatRow!;
  });
  const words = await app.page.evaluate(() => document.getSelection()!.toString());
  expect(words.length).toBeGreaterThan(20);
  // Far below: the row the selection starts in is still drawn, and the
  // selection still has its words.
  await scrollTo(app.page, 340_000);
  await app.page.waitForTimeout(400);
  await expect(app.chat.locator(`[data-chat-row="${from}"]`)).toBeAttached();
  expect(await app.page.evaluate(() => document.getSelection()!.toString())).toBe(words);
  // Let go, it goes as any row out of view does.
  await app.page.evaluate(() => document.getSelection()!.removeAllRanges());
  await scrollTo(app.page, 360_000);
  await expect(app.chat.locator(`[data-chat-row="${from}"]`)).toHaveCount(0);
});
