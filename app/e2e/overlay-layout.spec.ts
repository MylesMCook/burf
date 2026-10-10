import { fakeAgent } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

test.beforeEach(() => mockOnly("synthetic overlay layout"));

// Given a smaller desktop, connecting a box keeps its labels and actions
// inside a bounded dialog, with scrolling available for the longer form.
test("Add a box keeps machine labels and pairing controls reachable at 1024px", async ({ app }) => {
  await app.page.setViewportSize({ width: 1024, height: 768 });
  await app.open();
  await app.openSettings("boxes");
  await app.page.getByRole("button", { name: "Add a box", exact: true }).first().click();
  const dialog = app.page.getByRole("dialog", { name: "Add a box", exact: true });
  const machine = dialog.getByText("build-01", { exact: true });
  await expect(machine).toBeVisible();
  await expect(dialog.getByPlaceholder("berth://…  paste the link it printed")).toBeVisible();
  await expect.poll(async () => {
    const panel = await dialog.boundingBox();
    const label = await machine.boundingBox();
    return !!panel && !!label && panel.width <= 640 && panel.height <= 768 * 0.81 && label.x >= panel.x && label.x + label.width <= panel.x + panel.width;
  }).toBe(true);
  await dialog.hover();
  await app.page.mouse.wheel(0, 760);
  const pair = dialog.getByRole("button", { name: "Pair", exact: true });
  await expect.poll(async () => {
    const panel = await dialog.boundingBox();
    const action = await pair.boundingBox();
    return !!panel && !!action && action.y >= panel.y && action.y + action.height <= panel.y + panel.height;
  }).toBe(true);
  await dialog.getByText("Or let Burf set it up over SSH", { exact: true }).click();
  const host = dialog.getByLabel("SSH host, like me@my-box");
  await host.scrollIntoViewIfNeeded();
  await expect.poll(async () => {
    const panel = await dialog.boundingBox();
    const field = await host.boundingBox();
    return !!panel && !!field && field.x >= panel.x && field.x + field.width <= panel.x + panel.width && field.y >= panel.y && field.y + field.height <= panel.y + panel.height;
  }).toBe(true);
  await app.page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("notification rows fit their panel without horizontal scrolling", async ({ app }) => {
  const agent = await fakeAgent();
  const time = new Date().toISOString();
  await app.context.route(`${agent.url}/v1/app/notifications`, (route) => route.fulfill({ json: { version: 1, notes: Array.from({ length: 20 }, (_, i) => ({ id: `layout-${i}`, key: `layout-${i}`, category: "serviceFailed", tone: "error", title: "The development server could not start", box: "devl", project: "A project with a longer name", count: 1, time, last: time })) } }));
  try {
  await app.page.setViewportSize({ width: 1024, height: 768 });
  await app.open({ agent });
  await app.page.getByRole("button", { name: /^Notifications/ }).click();
  const dialog = app.page.getByRole("dialog", { name: "Notifications", exact: true });
  const viewport = dialog.locator('[data-slot="scroll-area-viewport"]');
  await expect(viewport).toBeVisible();
  await expect.poll(() => viewport.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await expect.poll(() => viewport.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const before = await viewport.evaluate((element) => element.scrollTop);
  await viewport.hover();
  await app.page.mouse.wheel(0, 500);
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(before);
  await dialog.getByRole("button", { name: "Show: All", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: /^Problems/ }).click();
  await expect(dialog.getByRole("button", { name: "Show: Problems", exact: true })).toBeVisible();
  } finally { await agent.close(); }
});
