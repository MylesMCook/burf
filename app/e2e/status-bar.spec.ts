import { fakeAgent } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

test.beforeEach(() => mockOnly("status bar uses isolated synthetic computers"));

test("fleet includes offline computers and distinguishes zero memory from no reading", async ({ app }) => {
  const agent = await fakeAgent();
  try {
    await app.context.route(`${agent.url}/v1/status`, (route) => route.fulfill({ json: {
      boxes: ["devl", "no-sample", "offline"].map((name) => ({ name, state: name === "offline" ? "offline" : "online", address: "fixture", fingerprint: "fixture" })),
      forwards: [], routes: [], proxy: { port: 1377, url_port: 1377 },
    } }));
    await app.context.route(`${agent.url}/v1/boxes/devl/api/stats`, (route) => route.fulfill({ json: { cpus: 4, load: [0], memory: { used: 0, total: 8 * 1024 ** 3 }, disks: [{ mount: "/", used: 0, total: 16 * 2 ** 30 }], agents: [] } }));
    await app.context.route(`${agent.url}/v1/boxes/no-sample/api/**`, (route) => {
      const routePath = new URL(route.request().url()).pathname.split("/api/")[1];
      return route.fulfill({ json: routePath === "info" ? { name: "no-sample", tools: [], capabilities: [] } : routePath === "stats" ? {} : [] });
    });
    await app.open({ agent });
    const trigger = app.page.getByTestId("status-fleet");
    await expect(trigger).toContainText("2/3 computers online");
    await trigger.click();
    const dialog = app.page.getByRole("dialog", { name: "Computers and status bar" });
    await expect(dialog.getByTestId("status-machine")).toHaveCount(3);
    const zero = dialog.locator('[data-testid="status-machine"][data-box="devl"]');
    await expect(zero).toContainText("0%");
    await expect(zero).toContainText("0 B of 8.0 GiB in use");
    await expect(zero).toContainText("0.00 on 4 CPUs");
    await expect(zero).toContainText("Fullest disk · /");
    await expect(zero).toContainText("0% used · 0 B of 16.0 GiB");
    await expect(zero).toContainText("1 session");
    await expect(dialog.locator('[data-box="no-sample"]')).toContainText("Unavailable: no reading");
    await expect(dialog.locator('[data-box="offline"]')).toContainText("Unavailable: computer offline");
    await app.page.keyboard.press("Escape");
    await app.context.route(`${agent.url}/v1/boxes/devl/api/stats`, (route) => route.fulfill({ status: 500, json: { error: "fixture refresh failed" } }));
    await app.page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(app.page.getByTestId("status-bar")).toContainText("devl · Memory unavailable");
    await trigger.click();
    await expect(zero).toContainText("Unavailable: refresh failed");
    await expect(zero).not.toContainText("0%");
    await expect(zero).not.toContainText("0.00 on 4 CPUs");
    await dialog.getByRole("button", { name: "Open projects on no-sample", exact: true }).click();
    await expect(app.page.getByRole("heading", { name: "Worktrees on no-sample", exact: true })).toBeVisible();
    await expect(dialog).toBeHidden();
  } finally { await agent.close(); }
});

test("memory visibility persists without hiding the computer from the fleet", async ({ app }) => {
  await app.open();
  const footer = app.page.getByTestId("status-bar");
  await expect(footer.getByTestId("box-meter-devl")).toBeVisible();
  await app.page.getByTestId("status-fleet").click();
  const dialog = app.page.getByRole("dialog", { name: "Computers and status bar" });
  await dialog.getByRole("checkbox", { name: "Show devl memory in status bar", exact: true }).uncheck();
  await app.page.keyboard.press("Escape");
  await expect(footer.getByTestId("box-meter-devl")).toHaveCount(0);
  expect(await app.stored("berth.prefs")).toMatchObject({ statusBarHiddenBoxes: ["devl"] });
  await app.page.reload();
  await app.page.getByTestId("status-fleet").click();
  await expect(dialog.locator('[data-box="devl"]')).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "Show devl memory in status bar", exact: true })).not.toBeChecked();
  await dialog.getByRole("checkbox", { name: "Show devl memory in status bar", exact: true }).check();
  await app.page.keyboard.press("Escape");
  await expect(footer.getByTestId("box-meter-devl")).toBeVisible();
});

for (const theme of ["berth-light", "berth-dark"]) {
  test(`narrow ${theme} fleet opens with keyboard and restores focus`, async ({ app }) => {
    await app.page.setViewportSize({ width: 900, height: 650 });
    await app.open({ theme });
    const trigger = app.page.getByTestId("status-fleet");
    await expect(trigger).toBeInViewport();
    expect(await app.page.getByTestId("status-bar").evaluate((el) => el.getBoundingClientRect().height)).toBe(26);
    await trigger.focus();
    await app.page.keyboard.press("Enter");
    const dialog = app.page.getByRole("dialog", { name: "Computers and status bar" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-box="devl"]')).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Computer settings", exact: true })).toBeInViewport();
    await app.page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}

test("fleet memory retains the existing browsers and sessions action", async ({ app }) => {
  await app.open();
  await app.page.getByTestId("status-fleet").click();
  const dialog = app.page.getByRole("dialog", { name: "Computers and status bar" });
  await dialog.getByTestId("box-meter-devl").click();
  await expect(app.page.getByTestId("box-processes")).toBeVisible();
  await expect(app.page.getByTestId("box-processes")).toContainText("Playwright tests in shop/https-linear-app-acme");
  await app.page.getByTestId("box-processes").getByRole("button", { name: "Box settings", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(app.page.getByTestId("settings-boxes")).toBeVisible();
});

test("a computer without process support closes the fleet panel before opening settings", async ({ app }) => {
  const agent = await fakeAgent();
  try {
    await app.context.route(`${agent.url}/v1/boxes/devl/api/stats`, (route) => route.fulfill({ json: { memory: { total: 8 * 2 ** 30, used: 2 * 2 ** 30 }, agents: [] } }));
    await app.open({ agent });
    await app.page.getByTestId("status-fleet").click();
    const dialog = app.page.getByRole("dialog", { name: "Computers and status bar" });
    await dialog.getByRole("button", { name: /devl.*%/ }).click();
    await expect(dialog).toBeHidden();
    await expect(app.page.getByTestId("settings-boxes")).toBeVisible();
  } finally { await agent.close(); }
});
