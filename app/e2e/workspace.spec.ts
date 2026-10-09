import { agentWorktree, expect, live, mockOnly, test } from "./fixtures";

// The workspace: tabs, groups of worktrees, splits, and the panes a tab
// can hold.

test.beforeEach(async ({ app }) => {
  await app.open();
});

test("the Diff panel shows the worktree's changes", async ({ app }) => {
  mockOnly("the Diff panel runs its git script on the box");
  await app.openWorktree("devl/checkout-fix");
  await app.page.getByRole("button", { name: "New tab" }).click();
  await app.page.getByRole("option", { name: "Diff", exact: true }).click();
  const panel = app.page.locator("[data-testid=panel][data-panel^='diff/']:visible");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("me/fix-payment-retries");
  await expect(panel).toContainText("24 files");
  await expect(panel.getByText("retry.ts", { exact: true }).first()).toBeVisible();
  // The first file's diff, drawn and highlighted.
  await expect(panel.locator("diffs-container").first()).toBeAttached();
  await expect(panel.locator("diffs-container [style*='--diffs-token']").first()).toBeAttached();
  await expect(app.page.locator("[data-tab-strip] [data-tab]").filter({ hasText: "Diff" })).toBeVisible();
});

test("a browser tab shows a worktree's dev server in a frame", async ({ app }) => {
  const wt = await agentWorktree(app, "devl/checkout-fix");
  await app.openWorktree(wt);
  await app.page.getByRole("button", { name: "New tab" }).click();
  await app.page.getByRole("option", { name: /New browser tab/ }).click();
  const pane = app.page.locator("[data-testid=browser-pane]:visible");
  // Outside the Burf app there is no native webview: the page is an iframe.
  await expect(pane).toHaveAttribute("data-mode", "iframe");
  if (live) return;
  // A port typed in the address bar opens that worktree's server through
  // the laptop's proxy (served here by a stand-in page).
  await expect(pane).toContainText("Running in this worktree");
  const address = pane.locator("form input").first();
  await address.fill("3001");
  await address.press("Enter");
  const frame = pane.locator("iframe");
  // The frame asks the proxy for the console script (internal/proxy/devtools.go).
  await expect(frame).toHaveAttribute("src", "http://checkout-fix.shop.devl.localhost:1377/?__berth_devtools=1");
  await expect(pane.frameLocator("iframe").getByRole("heading", { name: "Stub dev server" })).toBeVisible();
});

test("an older terminal chat layout opens its terminal and drops the chat preference", async ({ app }) => {
  mockOnly("saved terminal chat layout");
  await app.context.addInitScript(() => {
    if (sessionStorage.getItem("e2e.terminal-layout")) return;
    sessionStorage.setItem("e2e.terminal-layout", "1");
    const key = "devl:/home/me/work/shop-checkout-fix";
    localStorage.setItem("berth.workspaces", JSON.stringify({ current: key, shown: [key], spaces: {
      [key]: { ref: { box: "devl", location: "shop", worktree: "checkout-fix", path: "/home/me/work/shop-checkout-fix" }, hidden: [], known: ["checkout-fix-claude"], active: "restored", tabs: [
        { id: "restored", focus: "terminal", root: { kind: "leaf", id: "terminal", content: { kind: "terminal", box: "devl", session: "checkout-fix-claude", agent: "claude", view: "conversation" } } },
      ] },
    } }));
  });
  await app.open({ prefs: { agentView: "conversation", chatDrafts: true }, params: { view: "conversation" } });
  await app.openWorktree("devl/checkout-fix");
  await expect(app.page.locator("[data-terminal]:visible").first()).toBeVisible();
  await expect(app.page.getByRole("group", { name: "Show the agent as", exact: true })).toHaveCount(0);
  await expect(app.page.getByTestId("chat")).toHaveCount(0);
  const prefs = await app.stored("berth.prefs") as Record<string, unknown>;
  expect(prefs).not.toHaveProperty("agentView");
  expect(prefs).not.toHaveProperty("chatDrafts");
});
