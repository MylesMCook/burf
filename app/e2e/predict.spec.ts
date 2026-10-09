import type { Page } from "@playwright/test";

import { expect, mockOnly, test } from "./fixtures";

// Predictive local echo (lib/predict): on a slow link a shell's terminal
// shows what you type before the box echoes it, on an overlay over the
// grid, and hands over to the box's own characters once they arrive. The
// mock holds every echo back (?echoDelay) to make the link slow.

const DELAY = "400";

// A shell on gpu's home, opened from Home with ⌘T.
async function openShell(page: Page) {
  await expect(page.getByRole("heading", { name: "What should your agents work on?" })).toBeVisible();
  await page.keyboard.press("Meta+KeyT");
  const picker = page.getByRole("dialog", { name: "New terminal on a box" });
  await expect(picker).toBeVisible();
  // Its field takes the keyboard a moment after the dialog shows; typed
  // before then, the box's name goes nowhere and Enter picks nothing.
  await expect(picker.getByPlaceholder("New terminal on…")).toBeFocused();
  await page.keyboard.type("gpu");
  // Enter opens the box the list has come down to, once it has.
  await expect(picker.locator("[data-box]")).toHaveCount(1);
  await expect(picker.locator("[data-box=gpu]")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(picker).toBeHidden();
  const pane = page.locator("[data-testid=pane][data-pane-kind=terminal]:visible");
  await expect(pane).toHaveCount(1);
  await expect.poll(() => screenText(page)).toContain("me@gpu:~$");
  return pane;
}

// The terminal's own screen (what the box drew), all lines joined.
function screenText(page: Page) {
  return page.evaluate(() => {
    const pane = [...document.querySelectorAll<HTMLElement>("[data-testid=pane]")].find((p) => p.offsetParent && p.querySelector("[data-terminal]"));
    const host = pane?.querySelector("[data-terminal] > div") as (HTMLElement & { __berthTerm?: { rows: number; buffer: { active: { length: number; getLine(y: number): { translateToString(trim: boolean): string } | undefined } } } }) | null;
    const b = host?.__berthTerm?.buffer.active;
    if (!b) return "";
    const lines: string[] = [];
    for (let y = 0; y < b.length; y++) lines.push(b.getLine(y)?.translateToString(true) ?? "");
    return lines.join("\n");
  });
}

const overlay = (page: Page) => page.locator("[data-testid=pane][data-pane-kind=terminal]:visible [data-predict-overlay]");

test("on a slow link, typing in a shell shows before the box echoes it", async ({ app }) => {
  mockOnly("the mock holds echoes back");
  await app.open({ params: { echoDelay: DELAY } });
  const page = app.page;
  await openShell(page);

  // The first key measures the round trip; nothing is guessed before the
  // box has confirmed one.
  await page.keyboard.type("e");
  await expect.poll(() => screenText(page)).toContain("me@gpu:~$ e");
  await expect(overlay(page)).toHaveAttribute("data-rtt", /^\d+$/);
  expect(Number(await overlay(page).getAttribute("data-rtt"))).toBeGreaterThanOrEqual(Number(DELAY) - 50);

  // The rest shows at once, underlined, while the box hasn't echoed it.
  await page.keyboard.type("cho hi", { delay: 20 });
  await expect(overlay(page)).toHaveAttribute("data-cells", /^[1-9]/);
  await expect(overlay(page)).toHaveAttribute("data-flagged", "true");
  await expect(overlay(page)).toBeVisible();
  expect(await screenText(page)).not.toContain("echo hi");

  // Then the echoes land, and the overlay hands over to them.
  await expect.poll(() => screenText(page)).toContain("me@gpu:~$ echo hi");
  await expect(overlay(page)).toHaveAttribute("data-cells", "0");
  await expect(overlay(page)).toBeHidden();

  // Backspace too.
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await expect(overlay(page)).toHaveAttribute("data-cells", /^[1-9]/);
  await expect.poll(() => screenText(page)).not.toContain("echo hi");
  await expect(overlay(page)).toHaveAttribute("data-cells", "0");
});

test("Settings › Terminal › Predict typing: Never shows nothing ahead of the box", async ({ app }) => {
  mockOnly("the mock holds echoes back");
  await app.open({ params: { echoDelay: DELAY }, prefs: { terminal: { predict: "never" } } });
  const page = app.page;
  await openShell(page);
  await page.keyboard.type("e");
  await expect.poll(() => screenText(page)).toContain("me@gpu:~$ e");
  await page.keyboard.type("cho hi", { delay: 20 });
  // Every frame until the echo lands: no guesses.
  const seen = await page.evaluate(async () => {
    const el = document.querySelector("[data-testid=pane][data-pane-kind=terminal] [data-predict-overlay]") as HTMLElement | null;
    let most = 0;
    const until = performance.now() + 600;
    while (performance.now() < until) {
      most = Math.max(most, Number(el?.dataset.cells ?? 0));
      await new Promise(requestAnimationFrame);
    }
    return most;
  });
  expect(seen).toBe(0);
  await expect.poll(() => screenText(page)).toContain("me@gpu:~$ echo hi");
});
