
import { type App, expect } from "./fixtures";

// The app's screens and states, as the accessibility checks (a11y.spec.ts)
// visit them: each scene opens the app on the mock fixtures and gets one
// surface showing. Stable hooks only (data-testid, roles), as elsewhere.

export interface Scene {
  id: string;
  // The checks that need the whole app on screen; contrast runs these in
  // every built-in theme.
  key?: boolean;
  run(app: App, theme: string): Promise<void>;
}

const chat = async (app: App, theme: string, wt: string, params: Record<string, string> = {}) => {
  await app.open({ theme, params: { view: "conversation", ...params } });
  await app.openWorktree(wt);
  await expect(app.chat).toBeVisible();
};

export async function openBrowser(app: App) {
  await app.openWorktree("devl/checkout-fix");
  await app.page.getByRole("button", { name: "New tab" }).click();
  await app.page.getByRole("option", { name: /New browser tab/ }).click();
  const pane = app.page.locator("[data-testid=browser-pane]:visible");
  const address = pane.getByRole("textbox", { name: "Address" });
  await address.fill("http://checkout-fix.shop.devl.localhost:1377/cart");
  await address.press("Enter");
  await expect(pane.frameLocator("iframe").locator("h1")).toBeVisible();
  return pane;
}

const CART = `<!doctype html><html lang="en"><title>Cart</title><body><h1>Cart</h1><script>console.error("checkout failed: 500");</script></body></html>`;

const settings = (section: string): Scene => ({
  id: `settings-${section}`,
  key: section === "appearance" || section === "general",
  async run(app, theme) {
    await app.open({ theme });
    await app.openSettings(section);
  },
});

export const scenes: Scene[] = [
  {
    id: "home",
    key: true,
    async run(app, theme) {
      await app.open({ theme });
    },
  },
  {
    id: "palette",
    key: true,
    async run(app, theme) {
      await app.open({ theme });
      await app.page.keyboard.press("Meta+k");
      await expect(app.page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    id: "shortcuts-sheet",
    async run(app, theme) {
      await app.open({ theme });
      await app.page.keyboard.press("Meta+Slash");
      await expect(app.page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    id: "notifications",
    async run(app, theme) {
      await app.open({ theme });
      await app.page.keyboard.press("Meta+Shift+n");
      await expect(app.page.getByRole("dialog").or(app.page.getByTestId("notification-center"))).toBeVisible();
    },
  },
  {
    id: "chat-permission-tasks",
    key: true,
    async run(app, theme) {
      await chat(app, theme, "devl/checkout-fix");
    },
  },
  {
    id: "chat-question",
    async run(app, theme) {
      await chat(app, theme, "gpu/shop");
      await expect(app.chat.getByTestId("question-form")).toBeVisible();
    },
  },
  {
    id: "chat-crew",
    async run(app, theme) {
      await chat(app, theme, "gpu/judge-v2");
    },
  },
  {
    id: "chat-agent-messages",
    async run(app, theme) {
      await chat(app, theme, "gpu/ci-flake");
    },
  },
  {
    id: "terminal",
    async run(app, theme) {
      await app.open({ theme });
      await app.openWorktree("devl/checkout-fix");
      await expect(app.panes.first()).toBeVisible();
    },
  },
  {
    id: "browser-devtools",
    async run(app, theme) {
      await app.context.route(/^https?:\/\/[^/]+\.localhost:1377(?:\/|$)/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: CART }));
      await app.open({ theme });
      const pane = await openBrowser(app);
      await app.page.keyboard.press("Meta+Alt+KeyI");
      await expect(pane.getByTestId("devtools-drawer")).toBeVisible();
    },
  },
  {
    id: "preview",
    async run(app, theme) {
      await app.open({ theme });
      await app.openWorktree("devl/checkout-fix");
      await app.page.getByRole("button", { name: "New tab" }).click();
      await app.page.getByRole("option", { name: /^Preview/ }).click();
      await expect(app.page.locator("[data-testid=preview-pane]:visible")).toBeVisible();
    },
  },
  {
    id: "compare",
    async run(app, theme) {
      await chat(app, theme, "devl/checkout-fix");
      await app.page.keyboard.press("Meta+Alt+KeyC");
      const input = app.page.getByPlaceholder("Compare checkout-fix with…");
      await input.fill("search-perf");
      await input.press("Enter");
      await expect(app.page.getByRole("toolbar", { name: /^Compare / })).toBeVisible();
    },
  },
  {
    id: "file-picker",
    async run(app, theme) {
      await app.open({ theme });
      await app.openWorktree("devl/checkout-fix");
      await app.page.keyboard.press("Meta+p");
      await expect(app.page.getByTestId("file-picker")).toBeVisible();
    },
  },
  {
    id: "file-tab",
    async run(app, theme) {
      await app.open({ theme });
      await app.openWorktree("devl/checkout-fix");
      await app.page.keyboard.press("Meta+p");
      await expect(app.page.getByTestId("file-picker")).toBeVisible();
      await app.page.keyboard.press("Enter");
      await expect(app.page.getByTestId("file-crumbs")).toBeVisible();
    },
  },
  {
    id: "files-panel",
    async run(app, theme) {
      await app.open({ theme });
      await app.openWorktree("devl/checkout-fix");
      await app.page.keyboard.press("Meta+Shift+E");
      await expect(app.page.getByTestId("files-panel")).toBeVisible();
    },
  },
  {
    id: "review",
    key: true,
    async run(app, theme) {
      await app.open({ theme });
      await app.page.getByTestId("nav-review").click();
      await expect(app.page.getByTestId("nav-review")).toHaveAttribute("data-active", "true");
    },
  },
  {
    id: "first-run",
    async run(app, theme) {
      await app.open({ theme, params: { fresh: "1" } }).catch(() => {});
      await expect(app.page.locator("body")).toBeVisible();
    },
  },
  {
    id: "team-page",
    async run(app, theme) {
      await app.open({ theme, params: { team: "acme", "team-link": "acme" } });
      await expect(app.page.getByTestId("team-page")).toContainText("Published by Acme");
    },
  },
  {
    id: "guided-install",
    async run(app, theme) {
      const { page } = app;
      await app.open({ theme, params: { team: "acme", "team-page": "acme" } });
      await page.getByRole("button", { name: "Add a box" }).locator("visible=true").first().click();
      await page.getByText("Or let Berth set it up over SSH").click();
      await page.getByLabel("SSH host, like me@my-box").fill("dev@acme-box");
      await page.getByTestId("ssh-set-up").click();
      await expect(page.getByTestId("install-plan")).toBeVisible();
    },
  },
  ...["general", "notifications", "appearance", "terminal", "boxes", "computers", "phone", "agents", "plugins", "shortcuts", "labs", "about", "developer"].map(settings),
  {
    id: "sidebar-rename",
    async run(app, theme) {
      await app.open({ theme });
      const row = app.worktree("devl/checkout-fix");
      await row.focus();
      await app.page.keyboard.press("F2");
      await expect(app.page.getByRole("textbox", { name: /name/i }).first()).toBeVisible();
    },
  },
  {
    id: "worktree-menu",
    async run(app, theme) {
      await app.open({ theme });
      await app.worktree("devl/checkout-fix").click({ button: "right" });
      await expect(app.page.getByRole("menu")).toBeVisible();
    },
  },
  {
    id: "new-tab-menu",
    async run(app, theme) {
      await app.open({ theme });
      await app.openWorktree("devl/checkout-fix");
      await app.page.getByRole("button", { name: "New tab" }).click();
      await expect(app.page.getByRole("option").first()).toBeVisible();
    },
  },
  {
    id: "rail",
    async run(app, theme) {
      await app.open({ theme });
      await app.page.getByRole("button", { name: "Hide the sidebar" }).click();
      await expect(app.page.getByRole("navigation", { name: "Agents" })).toBeVisible();
    },
  },
  {
    id: "new-task",
    async run(app, theme) {
      await app.open({ theme });
      await app.page.keyboard.press("Meta+n");
      await expect(app.page.getByRole("dialog")).toBeVisible();
    },
  },
];

