import { expect, mockOnly, test } from "./fixtures";

// Themes, terminal rendering, and every section of Settings.

const rootVar = (page: import("@playwright/test").Page, name: string) => page.evaluate((n) => document.documentElement.style.getPropertyValue(n), name);

test("themes switch the whole app and are remembered", async ({ app }) => {
  await app.open();
  const appearance = await app.openSettings("appearance");
  const seen = new Set<string>();
  for (const [id, dark] of [
    ["berth-light", false],
    ["dracula", true],
    ["catppuccin-latte", false],
    ["nord", true],
    ["berth-dark", true],
  ] as const) {
    const card = appearance.locator(`[data-testid=theme-option][data-theme-id="${id}"]`);
    await card.click();
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(appearance.locator("[data-testid=theme-option][aria-pressed=true]")).toHaveCount(1);
    await expect(app.page.locator("html")).toHaveClass(dark ? /(^|\s)dark(\s|$)/ : /^(?!.*(^|\s)dark(\s|$))/);
    await expect.poll(() => app.stored("berth.ui")).toEqual({ themeId: id });
    seen.add(await rootVar(app.page, "--background"));
  }
  // Each theme brought its own background.
  expect(seen.size).toBe(5);
  // Found by name, too.
  await appearance.getByRole("searchbox", { name: "Find a theme" }).fill("tokyo");
  await expect(appearance.locator("[data-testid=theme-option]")).toHaveCount(1);
  await expect(appearance.locator("[data-testid=theme-option]")).toHaveAttribute("data-theme-id", "tokyo-night");
});

test("a worktree's service runs in a terminal tab of its own", async ({ app }) => {
  mockOnly("attaches a terminal");
  await app.open();
  await app.openWorktree("devl/checkout-fix");
  // The dev server's own tab (svc-…-web), next to the agent's.
  await app.page.locator("[data-tab-strip] [data-tab]").filter({ hasText: "Next.js" }).click();
  const term = app.page.locator("[data-testid=pane][data-pane-kind=terminal]:visible");
  await expect(term).toHaveCount(1);
  // ghostty-web draws on a canvas; no fallback to xterm.js.
  await expect(term.locator("canvas").first()).toBeVisible();
  await expect(term.locator(".xterm")).toHaveCount(0);
});

test("a service terminal reads the same in xterm.js", async ({ app }) => {
  mockOnly("attaches a terminal");
  await app.open({ prefs: { terminal: { renderer: "xterm" } } });
  await app.openWorktree("devl/checkout-fix");
  await app.page.locator("[data-tab-strip] [data-tab]").filter({ hasText: "Next.js" }).click();
  const rows = app.page.locator("[data-testid=pane][data-pane-kind=terminal]:visible .xterm-rows");
  await expect(rows).toContainText("next dev --turbopack");
  await expect(rows).toContainText("Ready in");
});

test("every Settings section opens", async ({ app }) => {
  await app.open();
  await app.openSettings("general");
  const ids = await app.page.locator("[data-testid^=settings-nav-]").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.replace("settings-nav-", "")));
  expect(ids).toEqual(expect.arrayContaining(["general", "appearance", "terminal", "boxes", "agents", "plugins", "labs", "about"]));
  const titles = new Set<string>();
  for (const id of ids) {
    await app.page.getByTestId(`settings-nav-${id}`).click();
    await expect(app.page.getByTestId(`settings-nav-${id}`)).toHaveAttribute("aria-current", "page");
    const body = app.page.getByTestId(`settings-${id}`);
    await expect(body).toBeVisible();
    await expect(body).not.toBeEmpty();
    // Its title goes to the view's strip: "Settings / <section>".
    const heading = app.page.getByRole("heading", { level: 1, name: /^Settings \/ \S/ });
    // A new one for each section, not the last one's still showing.
    for (const t of titles) await expect(heading).not.toHaveText(t);
    titles.add((await heading.textContent()) ?? "");
  }
  expect(titles.size).toBe(ids.length);
  await expect(app.page.getByText(/Burf hit an error|Something went wrong/)).toHaveCount(0);
});
