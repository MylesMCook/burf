import type { Page } from "@playwright/test";

import { type App, expect, mockOnly, test } from "./fixtures";

// Adding a box through the compact checklist, including skipping root-only
// lingering and choosing the agents to install. The terminal stays absent
// unless a step requires it.

test.beforeEach(() => mockOnly("the quick install's terminal is a mock fixture"));
test.describe.configure({ timeout: 60_000 });

const dialog = (page: Page) => page.getByTestId("quick-install");
const step = (page: Page, id: string) => dialog(page).getByTestId(`quick-step-${id}`);

// watchTerminal notes, from now on, whether the dialog's terminal ever
// showed, and which steps were running when it did.
async function watchTerminal(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __terminalSeen: string[][] };
    w.__terminalSeen = [];
    let shown = false;
    new MutationObserver(() => {
      const t = document.querySelector("[data-testid=quick-terminal]");
      if (t && !shown) w.__terminalSeen.push([...document.querySelectorAll("[data-testid^=quick-step-][data-state=running]")].map((e) => e.getAttribute("data-testid")!.replace("quick-step-", "")));
      shown = !!t;
    }).observe(document.body, { childList: true, subtree: true });
  });
}
const terminalSeen = (page: Page) => page.evaluate(() => (window as unknown as { __terminalSeen: string[][] }).__terminalSeen);

async function addBox(app: App, host: string) {
  const { page } = app;
  await app.open();
  await app.openSettings("boxes");
  await page.getByRole("button", { name: "Add a box" }).first().click();
  await page.getByText("Or let Burf set it up over SSH").click();
  await page.getByLabel("SSH host, like me@my-box").fill(host);
  await watchTerminal(page);
  await page.getByTestId("ssh-set-up").click();
  await expect(dialog(page)).toBeVisible();
  // No plan, full screen or otherwise.
  await expect(page.getByTestId("guided-install")).toHaveCount(0);
}

test("adding a box is quiet: a short checklist, no plan, no terminal, and it's ready", async ({ app }) => {
  const { page } = app;
  await addBox(app, "demo@my-box");
  await expect(dialog(page)).toContainText("Setting up my-box");
  await expect(dialog(page)).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
  await expect(dialog(page)).toContainText("my-box is ready");
  for (const id of ["connect", "berthd", "linger", "tools", "agents", "integrations", "pair"]) await expect(step(page, id)).toHaveAttribute("data-state", "done");
  // Lingering went on without sudo; nothing needed a password.
  await expect(step(page, "linger")).toContainText("on, without sudo");
  await expect(dialog(page).getByText("sudo", { exact: true })).toHaveCount(0);
  expect(await terminalSeen(page)).toEqual([]);
  await dialog(page).getByTestId("quick-continue").click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByTestId("settings-boxes")).toContainText("my-box");
});

test("lingering alone needs root: it asks first, and Skip goes on without a terminal", async ({ app }) => {
  const { page } = app;
  await addBox(app, "demo@rootlinger-box");
  await expect(dialog(page)).toHaveAttribute("data-needs", "ask", { timeout: 15_000 });
  const choice = step(page, "linger").getByTestId("quick-linger");
  await expect(choice).toContainText("needs root to keep berthd running after you log out");
  await choice.getByTestId("quick-linger-skip").click();
  await expect(step(page, "linger")).toHaveAttribute("data-state", "skip");
  await expect(step(page, "linger")).toContainText("berthd stops when you log out");
  await expect(dialog(page)).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
  expect(await terminalSeen(page)).toEqual([]);
});

