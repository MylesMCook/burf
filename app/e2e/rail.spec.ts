import { expect, mockOnly, test } from "./fixtures";

// The folded sidebar's rail (components/sidebar/rail.tsx): agents by what
// they need from you, each named, with a hover card, and a click that goes
// to the agent.

test("the folded rail lists agents by state, with a hover card, and a click goes to the agent", async ({ app }) => {
  mockOnly();
  await app.open();
  const page = app.page;

  // Fold the sidebar.
  await page.getByRole("button", { name: "Hide the sidebar" }).click();
  await expect(page.getByTestId("nav-home")).toBeHidden();
  const rail = page.getByRole("navigation", { name: "Agents" });
  await expect(rail).toBeVisible();

  // Lanes in order of what needs you; idle agents and shells say nothing.
  await expect(rail.getByTestId("rail-section")).toHaveCount(3);
  const lanes = await rail.getByTestId("rail-section").evaluateAll((els) => els.map((e) => e.getAttribute("data-lane")));
  expect(lanes).toEqual(["waiting", "running", "finished"]);
  await expect(rail.getByRole("button", { name: "Needs you: 2" })).toBeVisible();
  const tile = rail.locator('[data-testid=rail-agent][data-session="devl/checkout-fix-claude"]');
  await expect(tile).toHaveAttribute("data-agent-state", "waiting");
  // Named for a screen reader, and on screen, by its worktree, not initials.
  await expect(tile).toHaveAccessibleName(/Claude Code in shop \/ checkout-fix on devl: Fix checkout webhook retries\. Needs you/);
  await expect(tile).toContainText("checkout-fix");
  await expect(rail.locator("[data-agent-state=idle], [data-agent-state=ready]")).toHaveCount(0);

  // The hover card: the agent, its state, what it works on and waits for, where.
  await tile.hover();
  const card = page.getByTestId("rail-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Needs you");
  await expect(card).toContainText("Fix checkout webhook retries");
  await expect(card).toContainText("pnpm prisma migrate dev");
  await expect(card).toContainText("shop / checkout-fix");
  await expect(card).toContainText("devl");

  // A click goes to it: its worktree opens with its tab in front.
  await tile.click();
  await expect(tile).toHaveAttribute("aria-current", "true");
  await expect(page.locator("[role=tab][aria-selected=true]")).toHaveAccessibleName(/Fix checkout webhook retries/);

  // The keyboard: one tab stop, arrows between items, Enter goes.
  await rail.getByRole("button", { name: "Needs you: 2" }).focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const second = rail.getByTestId("rail-agent").nth(1);
  await expect(second).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(second).toHaveAttribute("aria-current", "true");

  // A lane folds to its count, and stays folded.
  const done = rail.getByRole("button", { name: /^Done: \d+$/ });
  await done.click();
  await expect(done).toHaveAttribute("aria-expanded", "false");
  await expect(rail.locator("[data-agent-state=finished]")).toHaveCount(0);
  await expect.poll(() => app.stored("berth.rail")).toEqual(["finished"]);
});
