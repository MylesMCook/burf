import type { Page } from "@playwright/test";

import { expect, mockOnly, test } from "./fixtures";

// Artifact panes and boards, opened from the worktree toolbar.

const P95 = "d2e8f1a0b3";
const PAGE = "f9b4c8d7e6";

const artPane = (page: Page) => page.locator("[data-testid=pane][data-pane-kind=artifact]:visible");

async function openBoard(app: { page: Page; open(): Promise<void>; openWorktree(w: string): Promise<void> }) {
  await app.open();
  await app.openWorktree("devl/search-perf");
  await app.page.getByTestId("art-board-button").click();
}

test.beforeEach(() => mockOnly("drives the demo's artifacts"));

test("the source view shows what the agent wrote", async ({ app }) => {
  await openBoard(app);
  await app.page.locator(`[data-art-tile="${P95}"]`).getByRole("button", { name: /^Open / }).last().click();
  const pane = artPane(app.page);
  await pane.getByTestId("art-source-toggle").click();
  await expect(pane.getByTestId("art-source")).toContainText('"$schema": "berth.chart/v1"');
  await pane.getByTestId("art-source-toggle").click();
  await expect(pane.locator("[data-chart-type=bar]")).toBeVisible();
});

test("the board shows the worktree's artifacts, filters by kind, and opens one", async ({ app }) => {
  await openBoard(app);
  const board = app.page.getByTestId("artifact-board");
  await expect(board).toBeVisible();
  await expect(board.locator("[data-art-tile]")).toHaveCount(15);
  for (const [kind, n] of [["chart", 9], ["table", 1], ["diagram", 1], ["page", 1], ["notes", 1], ["visualdiff", 2]] as const) {
    await board.locator(`[data-filter=${kind}]`).click();
    await expect(board.locator("[data-art-tile]")).toHaveCount(n);
  }
  await board.locator("[data-filter=table]").click();
  await board.getByRole("button", { name: "Open Search test results", exact: true }).last().click();
  const pane = artPane(app.page).filter({ has: app.page.locator("[data-art-table]") });
  await expect(pane.locator("[data-art-gist]")).toHaveText("3 failed of 16 · 1 skipped");
  await pane.getByRole("button", { name: "Failures only" }).click();
  await expect(pane.locator("tbody tr")).toHaveCount(3);
  // The tab's Board button, and the toolbar's, come back to the board.
  await pane.getByTestId("art-board-link").click();
  await expect(app.page.getByTestId("artifact-board")).toBeVisible();
  await expect(app.page.getByTestId("art-board-button")).toContainText("15");
});

test("Compare's Artifacts lane shows each side's board", async ({ app }) => {
  await app.open();
  await app.openWorktree("devl/search-perf");
  await app.page.keyboard.press("ControlOrMeta+Alt+KeyC");
  const input = app.page.getByPlaceholder("Compare search-perf with…");
  await input.fill("checkout-fix");
  await input.press("Enter");
  const bar = app.page.getByRole("toolbar", { name: "Compare search-perf and checkout-fix" });
  await app.page.keyboard.press("Alt+Digit5");
  await expect(bar.getByRole("button", { name: "Artifacts lane" })).toHaveAttribute("aria-pressed", "true");
  const boards = app.page.locator("[data-pane-area] [data-compare-side]:visible [data-testid=artifact-board]");
  await expect(boards).toHaveCount(2);
  // search-perf's agents made thirteen; checkout-fix's none yet.
  await expect(boards.filter({ hasText: "15 made by its agents" }).locator("[data-art-tile]")).toHaveCount(15);
  await expect(boards.filter({ hasText: "No artifacts here yet" })).toHaveCount(1);
});

const TYPES: [string, string, string][] = [
  ["d2e8f1a0b3", "bar", "svg rect"],
  ["a3c7d9e1b2", "line", "svg path"],
  ["e0a9b8c7d6", "area", "svg path"],
  ["d6f7a8b9c0", "funnel", "svg"],
  ["b8d6e4f2a0", "sankey", "svg path"],
  ["c1e2f3a4b5", "gauge", "svg path"],
  ["f5e4d3c2b1", "pie", "svg path"],
  ["a0b1c2d3e5", "ring", "svg path"],
  ["b7c2a9e1f0", "heatmap", "[data-heatmap] td[data-level]"],
];

test("every chart type draws, and the other kinds too", async ({ app }) => {
  // Twelve artifacts opened one after another.
  test.slow();
  await openBoard(app);
  for (const [id, type, mark] of TYPES) {
    await app.page.getByTestId("art-board-button").click();
    await app.page.locator(`[data-art-tile="${id}"]`).getByRole("button", { name: /^Open .*/ }).last().click();
    const pane = app.page.locator(`[data-testid=artifact-pane][data-art-id="${id}"]:visible`);
    await expect(pane.locator(`[data-chart-type=${type}]`)).toBeVisible();
    await expect(pane.locator(`[data-chart-type=${type}] ${mark}`).first()).toBeAttached();
  }
  const heat = app.page.locator('[data-testid=artifact-pane][data-art-id="b7c2a9e1f0"] [data-heatmap]');
  await expect(heat.locator("td[data-level]")).toHaveCount(72);
  // A diagram, notes and a page.
  for (const [id, sel] of [["a1f3c0d2e4", "[data-art-diagram] svg g.art-node-g"], ["c4d9e2b7a1", "[data-art-notes] ol li"], [PAGE, "iframe[data-art-frame]"]] as const) {
    await app.page.getByTestId("art-board-button").click();
    await app.page.locator(`[data-art-tile="${id}"]`).getByRole("button", { name: /^Open .*/ }).last().click();
    await expect(app.page.locator(`[data-testid=artifact-pane][data-art-id="${id}"]:visible ${sel}`).first()).toBeAttached();
  }
});
