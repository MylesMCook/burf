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

const artPane = (page: Page) => page.locator("[data-testid=pane][data-pane-kind=artifact]:visible");

async function openBoard(app: { page: Page; open(): Promise<void>; openWorktree(w: string): Promise<void> }) {
  await app.open();
  await app.openWorktree("devl/search-perf");
  await app.page.getByTestId("art-board-button").click();
}

async function openDiff(app: Parameters<typeof openBoard>[0], id = VD) {
  await openBoard(app);
  await app.page.locator(`[data-art-tile="${id}"]`).getByRole("button", { name: /^Open / }).last().click();
  const pane = artPane(app.page);
  await expect(pane.locator("[data-vd-view]")).toBeVisible();
  return pane;
}

test.beforeEach(() => mockOnly("drives the demo's visual diffs"));

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
  await openBoard(app);
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
