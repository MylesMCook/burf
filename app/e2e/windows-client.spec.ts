import { expect, mockOnly, test } from "./fixtures";

test.beforeEach(async ({ app }) => {
  mockOnly("Windows client uses isolated mock capability responses");
  await app.context.addInitScript(() => Object.defineProperty(navigator, "platform", { value: "Win32", configurable: true }));
});

test("Windows pairs a remote box without local-box or interactive SSH choices", async ({ app }) => {
  await app.page.goto("/?mock=1&fresh=1&client=windows");
  await expect(app.page.getByRole("heading", { name: "Welcome to Burf" })).toBeVisible();
  await expect(app.page.getByRole("button", { name: "Start on this Mac" })).toHaveCount(0);
  await app.page.getByRole("button", { name: "Connect a box", exact: true }).click();
  await expect(app.page.getByRole("heading", { name: "Paste what it printed", exact: true })).toBeVisible();
  await expect(app.page.getByText("Or let Burf set it up over SSH", { exact: true })).toHaveCount(0);
  await expect(app.page.getByRole("button", { name: /^Set up / })).toHaveCount(0);
  await app.page.getByRole("textbox", { name: "Pairing link" }).fill("berth://100.64.0.42:7444?code=test&fp=test");
  await app.page.getByRole("textbox", { name: "Name in Burf" }).fill("windows-box");
  await app.page.getByRole("button", { name: "Pair", exact: true }).click();
  await expect(app.page.getByText("Paired with windows-box", { exact: true })).toBeVisible();
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
