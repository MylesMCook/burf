import { expect, mockOnly, test } from "./fixtures";

// A worktree an agent handed off nests under the one it came from
// (Worktree.parent, lib/worktree-tree.ts). In the fixtures checkout-fix on
// devl handed off order-export, which handed off https-linear-app-acme.

test("handed-off worktrees nest under their parent and fold under its pill", async ({ app }) => {
  mockOnly();
  await app.open();
  const page = app.page;
  const child = app.worktree("devl/order-export");
  const grandchild = app.worktree("devl/https-linear-app-acme");
  await expect(child).toBeVisible();
  await expect(grandchild).toBeVisible();

  // Each parent says how many it handed off, and is open to start with.
  const pill = page.getByRole("button", { name: "Hide 1 child of checkout-fix" });
  await expect(pill).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Hide 1 child of order-export" })).toBeVisible();
  // Nested rows step in from their parent's.
  const x = async (w: string) => (await app.worktree(w).boundingBox())!.x;
  expect(await x("devl/order-export")).toBeGreaterThan(await x("devl/checkout-fix"));
  expect(await x("devl/https-linear-app-acme")).toBeGreaterThan(await x("devl/order-export"));

  // Folded, the whole branch goes, and stays folded after a reload.
  await pill.click();
  await expect(child).toBeHidden();
  await expect(grandchild).toBeHidden();
  const folded = page.getByRole("button", { name: "Show 1 child of checkout-fix" });
  await expect(folded).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(app.worktree("devl/checkout-fix")).toBeVisible();
  await expect(child).toBeHidden();

  // A fold never hides the worktree you have open.
  await folded.click();
  await grandchild.click();
  await page.getByRole("button", { name: "Hide 1 child of checkout-fix" }).click();
  await expect(grandchild).toBeVisible();
});
