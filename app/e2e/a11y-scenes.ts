
import { type App, expect } from "./fixtures";

// The app's screens and states, as the accessibility checks (a11y.spec.ts)
// visit them: each scene opens the app on the mock fixtures and gets one
// surface showing. Stable hooks only (data-testid, roles), as elsewhere.

export interface Scene {
  id: string;
  // Another state of a screen another scene already checks: run only with
  // A11Y_FULL=1, to keep CI quick.
  extra?: boolean;
  run(app: App, theme: string): Promise<void>;
}


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

const P95 = "d2e8f1a0b3";
const VD = "46ab3c4e1b";
const CLEAR = "39fdf22244";
const artPane = (app: App) => app.page.locator("[data-testid=pane][data-pane-kind=artifact]:visible");

async function openBoard(app: App, theme: string) {
  await app.open({ theme });
  await app.openWorktree("devl/search-perf");
  await app.page.getByTestId("art-board-button").click();
}

async function openArt(app: App, theme: string, id: string) {
  await openBoard(app, theme);
  await app.page.locator(`[data-art-tile="${id}"]`).getByRole("button", { name: /^Open / }).last().click();
  return artPane(app);
}

// atRest takes the pointer off the board's tiles: a chart under it shows
// that segment and dims the rest (bklit's hover), which isn't how it rests.
async function atRest(app: App) {
  await app.page.mouse.move(1, 1);
  // And its thumbnails done drawing.
  await app.page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity), null, { timeout: 5000 }).catch(() => {});
}

const settings = (section: string): Scene => ({
  id: `settings-${section}`,
  async run(app, theme) {
    await app.open({ theme });
    await app.openSettings(section);
  },
});

export const scenes: Scene[] = [
  {
    id: "home",
    async run(app, theme) {
      await app.open({ theme });
    },
  },
  {
    id: "palette",
    async run(app, theme) {
      await app.open({ theme });
      await app.page.keyboard.press("ControlOrMeta+k");
      await expect(app.page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    // What's new (components/whats-new), its first and its key-hint slide.
    id: "whats-new",
    async run(app, theme) {
      await app.open({ theme });
      await app.openSettings("about");
      await app.page.getByTestId("about-whats-new").click();
      await expect(app.page.getByTestId("whats-new")).toBeVisible();
      await app.page.keyboard.press("ArrowRight");
      await app.page.keyboard.press("ArrowRight");
      await expect(app.page.getByRole("tab", { name: "Console and network" })).toHaveAttribute("aria-selected", "true");
    },
  },
  {
    id: "whats-new-nudge",
    async run(app, theme) {
      await app.open({ theme, prefs: { whatsNewSeen: "0.3.9", version: 3 }, params: { version: "0.3.10" } });
      await expect(app.page.getByTestId("whats-new-nudge")).toBeVisible();
    },
  },
  {
    id: "shortcuts-sheet",
    async run(app, theme) {
      await app.open({ theme });
      await app.page.keyboard.press("ControlOrMeta+Slash");
      await expect(app.page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    id: "notifications",
    async run(app, theme) {
      await app.open({ theme });
      await app.page.keyboard.press("ControlOrMeta+Shift+n");
      await expect(app.page.getByRole("dialog").or(app.page.getByTestId("notification-center"))).toBeVisible();
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
      await app.page.keyboard.press("ControlOrMeta+Alt+KeyI");
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
    id: "file-picker",
    async run(app, theme) {
      await app.open({ theme });
      await app.openWorktree("devl/checkout-fix");
      await app.page.keyboard.press("ControlOrMeta+p");
      await expect(app.page.getByTestId("file-picker")).toBeVisible();
    },
  },
  {
    id: "file-tab",
    async run(app, theme) {
      await app.open({ theme });
      await app.openWorktree("devl/checkout-fix");
      await app.page.keyboard.press("ControlOrMeta+p");
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
      await app.page.keyboard.press("ControlOrMeta+Shift+E");
      await expect(app.page.getByTestId("files-panel")).toBeVisible();
    },
  },
  {
    id: "review",
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
    id: "rail",
    async run(app, theme) {
      await app.open({ theme });
      await app.page.getByRole("button", { name: "Hide the sidebar" }).click();
      await expect(app.page.getByRole("navigation", { name: "Agents" })).toBeVisible();
    },
  },
  {
    id: "artifact-versions",
    extra: true,
    async run(app, theme) {
      const pane = await openArt(app, theme, P95);
      await app.page.evaluate(() => (window as unknown as { __art: { bump(): Promise<void> } }).__art.bump());
      await pane.getByTestId("art-versions").getByRole("radio", { name: /v1/ }).click();
      await expect(pane.getByTestId("art-old")).toContainText("Showing v1");
    },
  },
  {
    id: "artifact-source",
    extra: true,
    async run(app, theme) {
      const pane = await openArt(app, theme, P95);
      await pane.getByTestId("art-source-toggle").click();
      await expect(pane.getByTestId("art-source")).toBeVisible();
    },
  },
  {
    id: "artifact-table",
    extra: true,
    async run(app, theme) {
      await openBoard(app, theme);
      const board = app.page.getByTestId("artifact-board");
      await board.locator("[data-filter=table]").click();
      await board.getByRole("button", { name: "Open Search test results", exact: true }).last().click();
      await expect(artPane(app).locator("[data-art-table]")).toBeVisible();
    },
  },
  {
    id: "artifact-heatmap",
    async run(app, theme) {
      const pane = await openArt(app, theme, "b7c2a9e1f0");
      await expect(pane.locator("[data-heatmap]")).toBeVisible();
    },
  },
  {
    id: "artifact-diagram",
    extra: true,
    async run(app, theme) {
      const pane = await openArt(app, theme, "a1f3c0d2e4");
      await expect(pane.locator("[data-art-diagram] svg").first()).toBeVisible();
    },
  },
  {
    id: "artifact-notes",
    extra: true,
    async run(app, theme) {
      const pane = await openArt(app, theme, "c4d9e2b7a1");
      await expect(pane.locator("[data-art-notes]")).toBeVisible();
    },
  },
  {
    id: "artifact-compare-lane",
    extra: true,
    async run(app, theme) {
      await app.open({ theme });
      await app.openWorktree("devl/search-perf");
      await app.page.keyboard.press("ControlOrMeta+Alt+KeyC");
      const input = app.page.getByPlaceholder("Compare search-perf with…");
      await input.fill("checkout-fix");
      await input.press("Enter");
      await expect(app.page.getByRole("toolbar", { name: /^Compare / })).toBeVisible();
      await app.page.keyboard.press("Alt+Digit5");
      await expect(app.page.locator("[data-pane-area] [data-compare-side]:visible [data-testid=artifact-board]")).toHaveCount(2);
      await atRest(app);
    },
  },
  {
    id: "visual-diff",
    async run(app, theme) {
      const pane = await openArt(app, theme, VD);
      await expect(pane.locator("[data-vd-canvas]").first()).toBeVisible();
      // A change chosen, so its caption and loud region show too.
      await pane.getByRole("button", { name: "Next change" }).locator("visible=true").click();
      await expect(pane.locator("[data-vd-caption]")).toBeVisible();
    },
  },
  {
    id: "visual-diff-side-by-side",
    extra: true,
    async run(app, theme) {
      const pane = await openArt(app, theme, VD);
      await pane.locator("[data-vd-mode=side]").click();
      await expect(pane.locator("[data-vd-stage=side] [data-vd-canvas]")).toHaveCount(2);
    },
  },
  {
    id: "visual-diff-onion",
    extra: true,
    async run(app, theme) {
      const pane = await openArt(app, theme, VD);
      await pane.locator("[data-vd-mode=onion]").click();
      await expect(pane.locator("[data-vd-stage=onion]")).toBeVisible();
    },
  },
  {
    id: "visual-diff-all-shots",
    extra: true,
    async run(app, theme) {
      const pane = await openArt(app, theme, VD);
      await pane.locator("[data-vd-all]").click();
      await expect(pane.locator("[data-vd-grid] [data-vd-cell]").first()).toBeVisible();
    },
  },
  {
    id: "visual-diff-older",
    async run(app, theme) {
      const pane = await openArt(app, theme, VD);
      await pane.getByTestId("art-versions").getByRole("radio", { name: /v1/ }).click();
      await expect(pane.locator("[data-vd-banner=bad]")).toBeVisible();
    },
  },
  {
    id: "visual-diff-accept",
    extra: true,
    async run(app, theme) {
      const pane = await openArt(app, theme, VD);
      await pane.locator("[data-vd-accept]").click();
      await expect(pane.locator("[data-vd-accept-ask]")).toBeVisible();
    },
  },
  {
    id: "visual-diff-all-clear",
    extra: true,
    async run(app, theme) {
      const pane = await openArt(app, theme, CLEAR);
      await expect(pane.locator("[data-vd-all-clear]")).toBeVisible();
    },
  },
  {
    id: "agent-browser-size",
    async run(app, theme) {
      await app.open({ theme });
      await app.openWorktree("devl/checkout-fix");
      await app.page.getByRole("button", { name: "New tab" }).click();
      await app.page.getByRole("option", { name: /New browser tab/ }).click();
      const pane = app.page.locator("[data-testid=browser-pane]:visible");
      await pane.getByRole("button", { name: /Agent's view/ }).click();
      await expect(pane.getByTestId("agent-size")).toContainText("1920×1080");
    },
  },
  {
    id: "new-task",
    async run(app, theme) {
      await app.open({ theme });
      await app.page.keyboard.press("ControlOrMeta+n");
      await expect(app.page.getByRole("dialog")).toBeVisible();
    },
  },
];

