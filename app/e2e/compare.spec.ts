import { expect, mockOnly, test } from "./fixtures";

// The Compare tab (Labs): two worktrees side by side in mirrored lanes.

test.beforeEach(async ({ app }) => {
  await app.open({ params: { view: "conversation" } });
});

test("⌘⌥C compares the worktree you are in with another, side by side", async ({ app }) => {
  mockOnly();
  const page = app.page;
  await app.openWorktree("devl/checkout-fix");
  await page.keyboard.press("Meta+Alt+KeyC");
  const input = page.getByPlaceholder("Compare checkout-fix with…");
  await expect(input).toBeVisible();
  await input.fill("search-perf");
  await input.press("Enter");
  const bar = page.getByRole("toolbar", { name: "Compare checkout-fix and search-perf" });
  await expect(bar).toBeVisible();
  // Both agents run: it opens on their chats, one pane each, side by side.
  await expect(bar.getByRole("button", { name: "Chat lane" })).toHaveAttribute("aria-pressed", "true");
  const sides = page.locator("[data-pane-area] [data-compare-side]:visible");
  await expect(sides).toHaveCount(2);
  await expect(page.getByRole("region", { name: "Claude Code, search-perf" })).toBeVisible();
  // ⌥2 shows the diffs; the hinge swaps the sides.
  await page.keyboard.press("Alt+Digit2");
  await expect(bar.getByRole("button", { name: "Diff lane" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-pane-area] [data-compare-side]:visible[data-pane-kind=panel]")).toHaveCount(2);
  await bar.getByRole("button", { name: /^Swap sides/ }).click();
  await expect(page.getByRole("toolbar", { name: "Compare search-perf and checkout-fix" })).toBeVisible();
  // The tab is named after both, and closing it stops neither agent.
  const tab = page.getByRole("tab", { name: "Compare search-perf ⇄ checkout-fix" });
  await expect(tab).toBeVisible();
  await tab.locator("[data-tab-close]").click();
  await expect(tab).toHaveCount(0);
  await expect(page.getByText(/Stopped/)).toHaveCount(0);
});
