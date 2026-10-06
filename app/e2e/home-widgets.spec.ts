import { expect, mockOnly, test } from "./fixtures";

// Home's widget grid under the composer (views/home/widgets): the default
// layout, Customize (add, resize, move, remove), and the layout kept in
// prefs (Prefs.home, lib/home-layout.ts) across a reload.

type Saved = { home?: { version: number; items: { id: string; size: string }[] } | null };
const ids = (p: Saved) => p.home?.items.map((i) => i.id) ?? [];

test("a new person gets the default widgets, and nothing is saved until they customise", async ({ app }) => {
  await app.open();
  const grid = app.page.getByTestId("home-grid");
  await expect(grid.getByRole("heading", { name: "Needs you" })).toBeVisible();
  await expect(grid.getByRole("heading", { name: "Working now" })).toBeVisible();
  // A plugin's widget, under its plugin's name.
  await expect(grid.locator('[data-widget="pull-request/prs"]').getByRole("heading", { name: "Pull requests" })).toBeVisible();
  expect(((await app.stored("berth.prefs")) as Saved).home).toBeNull();
});

test("a widget is added, resized and removed in Customize, and stays that way after a reload", async ({ app }) => {
  await app.open();
  const page = app.page;
  const grid = page.getByTestId("home-grid");
  await page.getByTestId("home-customize").click();
  await expect(grid.getByRole("heading", { name: "Customize Home" })).toBeVisible();

  // Add: the Harbour, from the picker.
  await grid.getByRole("button", { name: "Add widget", exact: true }).first().click();
  const picker = page.getByTestId("widget-picker");
  await picker.locator('[data-widget-id="harbour"]').click();
  await expect(picker.getByRole("img", { name: "Preview of Harbour" })).toBeVisible();
  await picker.getByTestId("widget-add").click();
  await expect(picker).toBeHidden();
  await expect(grid.locator('[data-widget="harbour"]')).toBeVisible();

  // Resize: Needs you to Large.
  const needs = grid.locator('[data-widget="needs-you"]');
  await needs.getByRole("button", { name: "Large, 2 by 2" }).click();
  await expect(needs).toHaveAttribute("data-size", "l");

  // Remove: Recent areas.
  await grid.getByRole("button", { name: "Remove Recent areas" }).click();
  await expect(grid.locator('[data-widget="areas"]')).toHaveCount(0);

  await expect.poll(async () => ids((await app.stored("berth.prefs")) as Saved)).toContain("harbour");
  const saved = (await app.stored("berth.prefs")) as Saved;
  expect(saved.home?.version).toBe(1);
  expect(ids(saved)).not.toContain("areas");
  expect(saved.home?.items.find((i) => i.id === "needs-you")?.size).toBe("l");

  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(grid.locator('[data-widget="harbour"]')).toBeVisible();
  await expect(grid.locator('[data-widget="needs-you"]')).toHaveAttribute("data-size", "l");
  await expect(grid.locator('[data-widget="areas"]')).toHaveCount(0);

  // Reset brings the default back.
  await page.getByTestId("home-customize").click();
  await grid.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(grid.locator('[data-widget="areas"]')).toBeVisible();
  await expect.poll(async () => ((await app.stored("berth.prefs")) as Saved).home).toBeNull();
});

test("the keyboard moves, resizes and removes a widget in Customize", async ({ app }) => {
  await app.open();
  const page = app.page;
  const grid = page.getByTestId("home-grid");
  await page.getByTestId("home-customize").click();
  const order = () => grid.locator("[data-widget]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.widget));
  await expect.poll(order).toEqual(expect.arrayContaining(["needs-you", "working"]));
  expect((await order()).slice(0, 2)).toEqual(["needs-you", "working"]);

  const handle = grid.getByRole("button", { name: "Move Working now", exact: true });
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await order()).slice(0, 2)).toEqual(["working", "needs-you"]);
  // Focus stays on the widget that moved.
  await expect(grid.getByRole("button", { name: "Move Working now", exact: true })).toBeFocused();
  await page.keyboard.press("]");
  await expect(grid.locator('[data-widget="working"]')).toHaveAttribute("data-size", "l");
  await page.keyboard.press("Delete");
  await expect(grid.locator('[data-widget="working"]')).toHaveCount(0);
  await expect.poll(async () => ids((await app.stored("berth.prefs")) as Saved)).not.toContain("working");
  // Escape leaves Customize.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("home-customize")).toBeVisible();
});

test("a permission is allowed once from Home", async ({ app }) => {
  mockOnly("answers an agent");
  await app.open();
  const needs = app.page.getByTestId("home-grid").locator('[data-widget="needs-you"]');
  const allow = needs.getByRole("button", { name: "Allow once: Fix checkout webhook retries" });
  await expect(allow).toBeVisible();
  // A question is answered in the agent's own form, not here.
  await expect(needs.getByRole("button", { name: "Answer: Plan the checkout release" })).toBeVisible();
  await allow.click();
  // The row says it's resuming until the agent's state moves on, and then
  // leaves, so either way its Allow is gone (the question stays).
  await expect(allow).toBeHidden();
  await expect(needs.getByRole("button", { name: "Answer: Plan the checkout release" })).toBeVisible();
});

test("dragging a widget's heading moves it", async ({ app }) => {
  await app.open();
  const page = app.page;
  const grid = page.getByTestId("home-grid");
  await page.getByTestId("home-customize").click();
  const handle = grid.getByRole("button", { name: "Move Recently finished", exact: true });
  await handle.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 120);
  // The wheel scrolls after it returns: measure once the page is still.
  let last = "";
  await expect
    .poll(async () => {
      const now = JSON.stringify(await handle.boundingBox());
      const still = now === last;
      last = now;
      return still;
    })
    .toBe(true);
  const from = await handle.boundingBox();
  const to = await grid.locator('[data-widget="needs-you"]').boundingBox();
  if (!from || !to) throw new Error("no boxes");
  await page.mouse.move(from.x + 20, from.y + 10);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y - 20, { steps: 4 });
  await page.mouse.move(to.x + 60, to.y + 60, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => ((await app.stored("berth.prefs")) as Saved).home?.items[0]?.id).toBe("finished");
});
