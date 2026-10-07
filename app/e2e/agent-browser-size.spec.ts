import { expect, mockOnly, test } from "./fixtures";

// The agent's browser has a size the agent chooses (berthd browser resize),
// 1920×1080 by default. Watching it, the pane's bar says the size, and the
// page shows as large as the pane allows but never past its own size, where
// it would blur. The mock casts the checkout-fix worktree's browser on devl;
// window.__berthMockBrowser.resize stands in for an agent resizing it.

type MockBrowser = { __berthMockBrowser: { resize(wxh: string, scale?: number): void } };

test("the agent's view says the agent's page size and fits the page to the pane without blowing it up", async ({ app }) => {
  mockOnly("casts the demo's agent browser");
  await app.open();
  const page = app.page;
  await app.openWorktree("devl/checkout-fix");
  await page.getByRole("button", { name: "New tab" }).click();
  await page.getByRole("option", { name: /New browser tab/ }).click();
  const pane = page.locator("[data-testid=browser-pane]:visible");
  await pane.getByRole("button", { name: /Agent's view/ }).click();

  const size = pane.getByTestId("agent-size");
  const frame = pane.getByTestId("agent-frame");
  // The default, wider than the pane: scaled down to fit, and it says by how much.
  await expect(frame).toHaveAttribute("data-size", "1920×1080");
  await expect(size).toHaveText(/^1920×1080· \d+%$/);
  const space = (await frame.locator("..").boundingBox())!;
  let shown = (await frame.boundingBox())!;
  expect(shown.width).toBeLessThanOrEqual(space.width);
  expect(shown.height).toBeLessThanOrEqual(space.height);
  expect(shown.width / shown.height).toBeCloseTo(1920 / 1080, 1);
  const zoom = Number((await size.textContent())!.match(/(\d+)%/)![1]);
  expect(Math.abs(zoom - (shown.width / 1920) * 100)).toBeLessThanOrEqual(1);

  // A phone at 3x, as `berthd browser resize phone --scale 3` sets it.
  await page.evaluate(() => (window as unknown as MockBrowser).__berthMockBrowser.resize("390x844", 3));
  await expect(frame).toHaveAttribute("data-size", "390×844 @3x");
  await expect(size).toContainText("390×844 @3x");
  shown = (await frame.boundingBox())!;
  expect(shown.width / shown.height).toBeCloseTo(390 / 844, 1);
  expect(shown.height).toBeLessThanOrEqual(space.height);

  // A page smaller than the pane shows at its own size, not stretched, and
  // the bar has no zoom to report.
  await page.evaluate(() => (window as unknown as MockBrowser).__berthMockBrowser.resize("480x320", 2));
  await expect(size).toHaveText("480×320 @2x");
  await expect(frame).toHaveAttribute("data-size", "480×320 @2x");
  await expect.poll(async () => (await frame.boundingBox())!.width).toBe(480);
  shown = (await frame.boundingBox())!;
  expect(shown.height).toBe(320);
  // The image has the page's pixels at its scale: sharp at that size.
  expect(await frame.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([960, 640]);

  // Back to the default for the demo's other tests.
  await page.evaluate(() => (window as unknown as MockBrowser).__berthMockBrowser.resize("1920x1080", 1));
  await expect(size).toContainText("1920×1080");
});
