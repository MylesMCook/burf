import { expect, mockOnly, test } from "./fixtures";

test.beforeEach(async ({ app }) => {
  mockOnly("Windows client uses isolated mock capability responses");
  await app.context.addInitScript(() => Object.defineProperty(navigator, "platform", { value: "Win32", configurable: true }));
});

test("Windows pairs a remote box without local-box or interactive SSH choices", async ({ app }) => {
  await app.page.goto("/?mock=1&fresh=1&client=windows");
  await expect(app.page.getByRole("heading", { name: "Welcome to Berth" })).toBeVisible();
  await expect(app.page.getByRole("button", { name: "Start on this Mac" })).toHaveCount(0);
  await app.page.getByRole("button", { name: "Connect a box", exact: true }).click();
  await expect(app.page.getByText("Paste what it printed", { exact: true })).toBeVisible();
  await expect(app.page.getByText("Or let Berth set it up over SSH", { exact: true })).toHaveCount(0);
});

test("Windows command shortcuts use Control and show Windows labels", async ({ app }) => {
  await app.open({ params: { client: "windows" } });
  await app.page.keyboard.press("Control+/");
  const sheet = app.page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Keyboard shortcuts" })).toBeVisible();
  await expect(sheet.getByText("Ctrl+N", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Ctrl+Shift+N", { exact: true })).toBeVisible();
  await expect(sheet).not.toContainText("⌘");
});
