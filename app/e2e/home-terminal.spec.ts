import { expect, mockOnly, test } from "./fixtures";

// A terminal on a box with no worktree in focus: ⌘T on Home asks which box
// (the fixtures have two online and one offline), then opens a shell in
// that box's home as a tab over Home.

test("⌘T on Home asks which box, then opens a terminal in its home over Home", async ({ app }) => {
  mockOnly("starts a session on a box");
  await app.open();
  const page = app.page;
  await expect(page.getByRole("heading", { name: "What should your agents work on?" })).toBeVisible();
  await expect(page.locator("[data-home-tab]")).toHaveCount(0);
  await expect(app.worktree("devl/checkout-fix")).toBeVisible();

  await page.keyboard.press("Meta+KeyT");
  const picker = page.getByRole("dialog", { name: "New terminal on a box" });
  await expect(picker).toBeVisible();
  // Every box, the offline one disabled with why.
  await expect(picker.locator("[data-box]")).toHaveCount(3);
  await expect(picker.locator("[data-box=old-vps]")).toHaveAttribute("data-disabled", /.*/);
  await expect(picker.locator("[data-box=old-vps]")).toContainText("offline");
  await expect(picker.locator("[data-box=devl]")).toContainText("ms");

  // Keyboard first: type to narrow, ↵ to open.
  await page.keyboard.type("gpu");
  await page.keyboard.press("Enter");
  await expect(picker).toBeHidden();

  // A terminal tab over Home, after its box's chip, in the same panes as a
  // worktree's tabs.
  const strip = page.locator("[data-tab-strip]");
  await expect(strip.locator("[data-home-box=gpu]")).toHaveText("gpu · ~");
  const tab = strip.locator("[data-tab][data-ws='gpu:~']");
  await expect(tab).toHaveCount(1);
  await expect(tab).toHaveAttribute("aria-selected", "true");
  const pane = page.locator("[data-testid=pane][data-pane-kind=terminal]:visible");
  await expect(pane).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "What should your agents work on?" })).toBeHidden();

  // The Home tab shows Home again; the terminal keeps its tab.
  await page.locator("[data-home-tab]").click();
  await expect(page.getByRole("heading", { name: "What should your agents work on?" })).toBeVisible();
  await expect(tab).toHaveAttribute("aria-selected", "false");

  // The pick is remembered: next time it is first, and ↵ opens it.
  await page.keyboard.press("Meta+KeyT");
  await expect(picker).toBeVisible();
  await expect(picker.locator("[data-box]").first()).toHaveAttribute("data-box", "gpu");
  await expect(picker.locator("[data-box=gpu]")).toContainText("last used");
  await page.keyboard.press("Escape");
  await expect(picker).toBeHidden();

  // Tabs persist like a worktree's.
  const saved = (await app.stored("berth.workspaces")) as { spaces: Record<string, { tabs: unknown[] }> };
  expect(saved.spaces["gpu:~"].tabs).toHaveLength(1);

  // Closing the last one leaves plain Home.
  await tab.click();
  await tab.locator("[data-tab-close]").click();
  const confirm = page.getByRole("alertdialog");
  if (await confirm.isVisible().catch(() => false)) await confirm.getByRole("button", { name: /Close/ }).click();
  await expect(page.locator("[data-home-tab]")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "What should your agents work on?" })).toBeVisible();
});

test("⌘T in a worktree still opens its terminal there", async ({ app }) => {
  mockOnly("starts a session on a box");
  await app.open();
  await app.openWorktree("devl/checkout-fix");
  const strip = app.page.locator("[data-tab-strip]");
  const before = await strip.locator("[data-tab]").count();
  await app.page.keyboard.press("Meta+KeyT");
  await expect(strip.locator("[data-tab]")).toHaveCount(before + 1);
  await expect(app.page.getByRole("dialog", { name: "New terminal on a box" })).toHaveCount(0);
  await expect(strip.locator("[data-tab]").last()).toHaveAttribute("data-ws", "devl:/home/me/work/shop-checkout-fix");
});
