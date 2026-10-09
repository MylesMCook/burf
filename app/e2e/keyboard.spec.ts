import type { Locator, Page } from "@playwright/test";

import { openBrowser } from "./a11y-scenes";
import { agentWorktree, expect, mockOnly, test } from "./fixtures";

// The core flows with the keyboard alone: Tab and Shift-Tab, arrows, Enter,
// Esc and the documented shortcuts (lib/shortcuts.json). After every step
// the keyboard is somewhere (never on <body>), and where it is shows.
// Motion is reduced, so a focus ring is drawn at once.

test.use({ reducedMotion: "reduce" });

// focused says what has the keyboard, or null when it fell to <body>.
const focused = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a || a === document.body || !a.isConnected) return null;
    return { tag: a.tagName.toLowerCase(), label: a.getAttribute("aria-label") ?? "", testid: a.closest("[data-testid]")?.getAttribute("data-testid") ?? "" };
  });

async function notLost(page: Page) {
  await expect.poll(() => focused(page), { message: "the keyboard fell to <body>" }).not.toBeNull();
}

// shows says focusing what has the keyboard changes how it, its parent or
// their ::before and ::after look: a ring, an outline, a border, a fill.
const shows = (page: Page) =>
  page.evaluate(async () => {
    const el = document.activeElement as HTMLElement;
    const chain = [el, el.parentElement, el.parentElement?.parentElement].filter((e): e is HTMLElement => !!e);
    const snap = () =>
      chain
        .flatMap((e) => [getComputedStyle(e), getComputedStyle(e, "::before"), getComputedStyle(e, "::after")])
        .map((c) => [c.outlineStyle, c.outlineWidth, c.outlineColor, c.boxShadow, c.borderColor, c.backgroundColor, c.opacity].join("|"))
        .join("#");
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
    // Let finite transitions finish before comparing the focus ring.
    const settled = async () => {
      await frame();
      await Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {})));
    };
    await settled();
    const on = snap();
    el.blur();
    await settled();
    const off = snap();
    el.focus({ preventScroll: true });
    await frame();
    return on !== off;
  });

// press presses key until target has the keyboard, at most max times.
async function pressTo(page: Page, target: Locator, key = "Tab", max = 40) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement || el.contains(document.activeElement)).catch(() => false)) return;
    await page.keyboard.press(key);
  }
  throw new Error(`${key} never reached ${target}`);
}


test("⌘P opens a file in the editor, which takes the keyboard, and ⌘S saves it", async ({ app }) => {
  mockOnly("writes a file on a box");
  await app.open();
  await app.openWorktree("devl/checkout-fix");
  const page = app.page;
  await page.keyboard.press("ControlOrMeta+p");
  const picker = page.getByTestId("file-picker");
  await expect(picker.getByRole("combobox")).toBeFocused();
  await page.keyboard.type("webhook.ts");
  await page.keyboard.press("Enter");
  await expect(picker).toHaveCount(0);
  const editor = page.locator("[data-testid=file-pane] .cm-content").first();
  await expect(editor).toBeFocused();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("// read\n");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.getByTestId("file-saved")).toBeVisible();
  // Esc in the picker gives the keyboard back, not to <body>.
  await page.keyboard.press("ControlOrMeta+p");
  await expect(picker).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await notLost(page);
});

test("split, switch tabs and move between panes with the keyboard", async ({ app }) => {
  await app.open();
  await app.openWorktree(await agentWorktree(app, "devl/checkout-fix"));
  const page = app.page;
  await page.keyboard.press("ControlOrMeta+d");
  await expect(app.panes).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+Alt+ArrowLeft");
  await notLost(page);
  // Tabs: the strip's arrows move between them, Enter shows one.
  const tabs = page.locator("[data-tab-strip] [role=tab]");
  const count = await tabs.count();
  await page.keyboard.press("ControlOrMeta+1");
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  if (count > 1) {
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  }
  // Shift-F10 on a tab opens its menu, whose Close tab is a keyboard away.
  await tabs.first().focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: /Close tab/ })).toBeVisible();
  await page.keyboard.press("Escape");
  // Base UI menus sometimes keep the popover open for one Esc; a second
  // closes the menu surface when the first only dismissed a submenu layer.
  if (await page.getByRole("menu").count()) await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await notLost(page);
});

test("rename a worktree with F2; Enter and Esc give the row back the keyboard", async ({ app }) => {
  mockOnly("renames on a box");
  await app.open();
  const page = app.page;
  const row = app.worktree("devl/checkout-fix");
  await row.focus();
  await page.keyboard.press("F2");
  const field = page.getByRole("textbox", { name: "Display name for checkout-fix" });
  await expect(field).toBeFocused();
  await page.keyboard.type("Webhook retries");
  await page.keyboard.press("Enter");
  await expect(row).toContainText("Webhook retries");
  await expect(row).toBeFocused();
  await page.keyboard.press("F2");
  await expect(field).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(row).toBeFocused();
});

test("a project folds with ← and → on its row", async ({ app }) => {
  await app.open();
  const page = app.page;
  // A project's row (the More menu's button is expanded-able too, as a menu).
  const project = page.locator('[data-sidebar="menu-button"][aria-expanded]:not([aria-haspopup])').first();
  await project.focus();
  await expect(project).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(project).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("ArrowRight");
  await expect(project).toHaveAttribute("aria-expanded", "true");
});

test("the sidebar's edge resizes from the keyboard, and shows it has it", async ({ app }) => {
  await app.open();
  const page = app.page;
  const handle = page.getByRole("separator", { name: "Resize the sidebar" });
  // Reached with the keyboard: the sidebar's first stop, before Home.
  await page.getByTestId("nav-home").focus();
  await pressTo(page, handle, "Shift+Tab", 5);
  expect(await shows(page)).toBe(true);
  await page.keyboard.press("ArrowRight");
  await expect(handle).toHaveAttribute("aria-valuenow", "256");
});

test("⌘⌥I puts the keyboard in the console drawer; arrows switch its tabs", async ({ app }) => {
  mockOnly("loads a page through the proxy");
  await app.open();
  const page = app.page;
  const pane = await openBrowser(app);
  await page.keyboard.press("ControlOrMeta+Alt+KeyI");
  const drawer = pane.getByTestId("devtools-drawer");
  await expect(drawer).toBeVisible();
  const consoleTab = drawer.getByRole("tab", { name: /Console/ });
  await expect(consoleTab).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(drawer.getByRole("tab", { name: /Network/ })).toBeFocused();
  await expect(drawer.getByRole("tab", { name: /Network/ })).toHaveAttribute("aria-selected", "true");
  // Its edge sizes it from the keyboard too.
  const edge = drawer.getByRole("separator", { name: "Resize the drawer" });
  const before = Number(await edge.getAttribute("aria-valuenow"));
  await edge.focus();
  await page.keyboard.press("ArrowUp");
  await expect(edge).toHaveAttribute("aria-valuenow", String(before + 16));
  // ⌘⌥I again closes it and the keyboard goes home.
  await page.keyboard.press("ControlOrMeta+Alt+KeyI");
  await expect(drawer).toHaveCount(0);
  await notLost(page);
});

test("the shortcuts sheet traps the keyboard while open, and Esc gives it back", async ({ app }) => {
  await app.open();
  const page = app.page;
  await page.getByTestId("nav-home").focus();
  await page.keyboard.press("ControlOrMeta+Slash");
  const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(sheet).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    // The trap's own guards sit just outside the popup and send the keyboard
    // round to its start; anything else outside is a leak. On the way round
    // the keyboard is on the page itself for an instant, so this is where it
    // comes to rest, not where it is the moment Tab returns.
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[role=dialog], [data-floating-ui-focus-guard], [data-base-ui-focus-guard], span[aria-hidden=true]")), "Tab left the open sheet").toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId("nav-home")).toBeFocused();
});
