import type { Page } from "@playwright/test";

import { expect, mockOnly, test } from "./fixtures";

// Visual diffs (components/art/views/vdiff-view.tsx): real runs of berthd
// shots compare against acme's shop (lib/art/mock-vdiff.ts, images in
// e2e/fixtures/vdiff-img/): the search-perf agent's v1 (a sideways scroll
// at 375, /account failing), its fix (v2), and an all clear against the
// accepted baseline. They're artifacts of kind visualdiff, so the card,
// tab, versions, board and live updates are the artifacts system's.

const VD = "46ab3c4e1b";
const CLEAR = "39fdf22244";

const card = (page: Page, id: string) => page.locator(`[data-testid=pane]:visible [data-art-card="${id}"]`).first();

// The chat draws only the rows near the view, and the visual diffs are
// earlier in the turn: scroll up until the card is drawn.
async function reach(page: Page, id: string) {
  const c = card(page, id);
  const chat = page.locator("[data-testid=pane]:visible [data-testid=chat]");
  const box = await chat.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // A wheel is the person scrolling up, which the chat keeps to.
  for (let i = 0; i < 60 && !(await c.isVisible()); i++) {
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(60);
  }
  await c.scrollIntoViewIfNeeded();
  return c;
}
const artPane = (page: Page) => page.locator("[data-testid=pane][data-pane-kind=artifact]:visible");

async function openChat(app: { open(o?: object): Promise<void>; openWorktree(w: string): Promise<void> }) {
  await app.open({ params: { view: "conversation" } });
  await app.openWorktree("devl/search-perf");
}

async function openDiff(app: Parameters<typeof openChat>[0] & { page: Page }, id = VD) {
  await openChat(app);
  const c = await reach(app.page, id);
  await c.getByRole("button", { name: "Open", exact: true }).click();
  const pane = artPane(app.page);
  await expect(pane.locator("[data-vd-view]")).toBeVisible();
  return pane;
}

test.beforeEach(() => mockOnly("drives the demo's visual diffs"));

test("the chat's card leads with the headline, says what needs a look, and shows a before/after thumbnail", async ({ app }) => {
  await openChat(app);
  const c = await reach(app.page, VD);
  await expect(c.locator("[data-art-title]")).toHaveText("Visual changes: search-perf vs main");
  await expect(c.locator("[data-art-gist]")).toHaveText("2 of 6 pages changed · most: /search at 768 (48%)");
  await expect(c.locator("[data-vd-chip=new]")).toHaveText("/deals new");
  await expect(c.locator("[data-vd-chip=unchanged]")).toHaveText("3 unchanged");
  await expect(c).toContainText("Visual diff");
  await expect(c.locator("[data-art-version]")).toHaveText("v2");
  await expect(c.locator("[data-vd-thumb=wipe]")).toBeVisible();
  // The agent's re-run is the quiet update line.
  await expect(app.chat.getByTestId("art-update").filter({ hasText: "Visual changes" })).toContainText("to v2");
  // And the all clear.
  const clear = await reach(app.page, CLEAR);
  await expect(clear.locator("[data-art-gist]")).toHaveText(/^No visual changes/);
  await expect(clear.locator("[data-vd-thumb=clear]")).toContainText("All clear");
});

test("every way to compare: slider, side by side, flicker and onion skin", async ({ app }) => {
  const pane = await openDiff(app);
  const handle = pane.locator("[data-vd-handle]");
  await expect(handle).toHaveAttribute("aria-valuenow", "50");
  await handle.focus();
  await handle.press("ArrowLeft");
  await handle.press("ArrowLeft");
  await expect(handle).toHaveAttribute("aria-valuenow", "40");
  await handle.press("End");
  await expect(handle).toHaveAttribute("aria-valuenow", "100");
  await pane.locator("[data-vd-mode=side]").click();
  await expect(pane.locator("[data-vd-stage=side] [data-vd-canvas]")).toHaveCount(2);
  await expect(pane.locator("[data-vd-stage=side]")).toContainText("Before");
  await pane.locator("[data-vd-mode=flicker]").click();
  await expect(pane.locator("[data-vd-stage=flicker]")).toBeVisible();
  // It alternates by itself.
  const label = pane.locator("[data-vd-stage=flicker] [aria-live]");
  const first = await label.textContent();
  await expect(label).not.toHaveText(first ?? "");
  await pane.locator("[data-vd-mode=onion]").click();
  await expect(pane.locator("[data-vd-stage=onion]")).toContainText("After at 50% over before");
  await pane.getByRole("slider", { name: "After" }).fill("0.8");
  await expect(pane.locator("[data-vd-stage=onion]")).toContainText("After at 80% over before");
  await pane.locator("[data-vd-mode=slider]").click();
  await expect(pane.locator("[data-vd-handle]")).toBeVisible();
});

test("n and p step through every change across pages and sizes, and the stepper says where", async ({ app }) => {
  const pane = await openDiff(app);
  await expect(pane.locator("[data-vd-step]:visible")).toHaveText("24");
  await app.page.keyboard.press("n");
  await expect(pane.locator("[data-vd-step]:visible")).toHaveText("1 of 24");
  const caption = pane.locator("[data-vd-caption]");
  await expect(caption).toContainText("/search");
  await expect(caption).toContainText("region 1 of 3");
  await expect(pane.locator("[data-vd-region][data-loud]")).toHaveCount(1);
  await app.page.keyboard.press("n");
  await expect(pane.locator("[data-vd-step]:visible")).toHaveText("2 of 24");
  await app.page.keyboard.press("p");
  await expect(pane.locator("[data-vd-step]:visible")).toHaveText("1 of 24");
  // The buttons do the same, and the last change is a new page.
  for (let i = 0; i < 30; i++) await app.page.keyboard.press("n");
  await expect(pane.locator("[data-vd-step]:visible")).toHaveText("24 of 24");
  await expect(caption).toContainText("/deals");
  await expect(pane.locator("[data-vd-banner=info]")).toContainText("A new page.");
  await pane.getByRole("button", { name: "Previous change" }).locator("visible=true").click();
  await expect(pane.locator("[data-vd-step]:visible")).toHaveText("23 of 24");
});

test("All shots shows every page and size at once, and a shot opens it large", async ({ app }) => {
  const pane = await openDiff(app);
  await pane.locator("[data-vd-all]").click();
  const grid = pane.locator("[data-vd-grid]");
  await expect(grid.locator("[data-vd-cell]")).toHaveCount(18);
  await expect(grid.locator("[data-vd-cell='/account@375']")).toContainText("Same");
  await grid.locator("[data-vd-cell='/@1280']").click();
  await expect(pane.locator("[data-vd-detail]")).toHaveAttribute("data-vd-page", "/");
  await expect(pane.locator("[data-vd-detail]")).toHaveAttribute("data-vd-size", "1280");
  await expect(pane.locator("[data-vd-region-list]")).toContainText("form.hero-search");
});

test("an older version shows what the agent fixed: the sideways scroll and the failing page", async ({ app }) => {
  const pane = await openDiff(app);
  await pane.getByTestId("art-versions").getByRole("radio", { name: /v1/ }).click();
  await expect(pane.getByTestId("art-old")).toContainText("Showing v1");
  await expect(pane.locator("[data-vd-chips] [data-vd-chip=sideways]")).toHaveText("/search at 375 scrolls sideways");
  await expect(pane.locator("[data-vd-chips] [data-vd-chip=fails]")).toHaveText("/account fails");
  // It opens on the sideways scroll, flagged on the stage too.
  await expect(pane.locator("[data-vd-detail]")).toHaveAttribute("data-vd-size", "375");
  await expect(pane.locator("[data-vd-banner=bad]")).toContainText("Now scrolls sideways at 375");
  await expect(pane.locator("[data-vd-overflow]")).toContainText("125px wider than the screen");
  await pane.locator("[data-vd-page-chip='/account']").click();
  await expect(pane.locator("[data-vd-banner=bad]")).toContainText("/account fails on search-perf");
  // Only the latest can be accepted.
  await expect(pane.locator("[data-vd-accept]")).toBeDisabled();
});

test("Accept as baseline asks once, then says so", async ({ app }) => {
  const pane = await openDiff(app);
  await pane.locator("[data-vd-accept]").click();
  await expect(pane.locator("[data-vd-accept-ask]")).toContainText("Keep these 18 after-shots as search-perf's accepted look?");
  await pane.getByRole("button", { name: "Cancel" }).click();
  await expect(pane.locator("[data-vd-accept-ask]")).toHaveCount(0);
  await pane.locator("[data-vd-accept]").click();
  await pane.getByRole("button", { name: "Accept v2" }).click();
  await expect(pane.locator("[data-vd-accepted]")).toHaveText("Accepted as baseline");
});

test("the all clear: no changes against the accepted baseline", async ({ app }) => {
  const pane = await openDiff(app, CLEAR);
  const clear = pane.locator("[data-vd-all-clear]");
  await expect(clear.getByRole("heading", { name: "No visual changes" })).toBeVisible();
  await expect(clear).toContainText("All 18 shots of 6 pages match the accepted baseline pixel for pixel, with dynamic content masked.");
  await expect(clear).toContainText("/account");
  await expect(pane.locator("[data-vd-accept]")).toHaveCount(0);
});

test("the board shows visual diffs as tiles, filtered by kind; a new version lands live", async ({ app }) => {
  await openChat(app);
  await app.page.getByTestId("art-chip").click();
  const board = app.page.getByTestId("artifact-board");
  await board.locator("[data-filter=visualdiff]").click();
  await expect(board.locator("[data-art-tile]")).toHaveCount(2);
  await expect(board.locator(`[data-art-tile="${VD}"] [data-vd-thumb=wipe]`)).toBeVisible();
  await expect(board.locator(`[data-art-tile="${CLEAR}"]`)).toContainText("No visual changes");
  await board.getByRole("button", { name: "Open Visual changes: search-perf vs main", exact: true }).last().click();
  const pane = artPane(app.page).filter({ has: app.page.locator("[data-vd-view]") });
  await expect(pane.getByTestId("art-live")).toContainText("v2");
  await app.page.evaluate(() => (window as unknown as { __art: { vdiff(): Promise<void> } }).__art.vdiff());
  await expect(pane.getByTestId("art-live")).toContainText("Updated just now · v3");
  await expect(pane.getByTestId("art-versions").getByRole("radio")).toHaveCount(3);
});

test("beside the chat, at a narrow width, it keeps the stage and the controls", async ({ app }) => {
  await app.page.setViewportSize({ width: 900, height: 900 });
  await openChat(app);
  const c = await reach(app.page, VD);
  await c.getByRole("button", { name: "Open Visual changes: search-perf vs main beside the chat" }).click();
  await expect(app.panes).toHaveCount(2);
  const pane = artPane(app.page);
  await expect(pane.locator("[data-vd-canvas]")).toBeVisible();
  await expect(pane.locator("[data-vd-mode=side]")).toBeVisible();
  await expect(pane.locator("[data-vd-stepper]:visible")).toBeVisible();
  // No sideways scroll of its own.
  const scroll = await pane.locator("[data-vd-view]").evaluate((el) => {
    let s = el.parentElement;
    while (s && getComputedStyle(s).overflowX === "visible") s = s.parentElement;
    return s ? s.scrollWidth - s.clientWidth : 0;
  });
  expect(scroll).toBeLessThanOrEqual(1);
});
