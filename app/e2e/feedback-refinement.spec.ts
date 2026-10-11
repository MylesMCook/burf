import { fakeAgent } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

test.beforeEach(() => mockOnly("isolated feedback refinement"));

for (const theme of ["berth-light", "berth-dark"]) test(`shared action icons stay consistent in ${theme}`, async ({ app }) => {
  await app.open({ theme });
  await expect(app.page.locator("html")).toHaveClass(theme === "berth-dark" ? /dark/ : /^(?!.*\bdark\b).*$/);
  const sidebar = app.page.getByTestId("sidebar");
  for (const name of ["Discover or pair a computer", "Settings", "Hide the sidebar"]) {
    const svg = sidebar.getByRole("button", { name, exact: true }).locator("svg").first();
    await expect(svg).toHaveCSS("width", "16px");
    await expect(svg).toHaveCSS("height", "16px");
  }
  await app.page.getByRole("button", { name: "More", exact: true }).click();
  await app.page.getByRole("menuitem", { name: "GitHub Issues", exact: true }).click();
  const refresh = app.page.getByRole("button", { name: "Refresh", exact: true }).first();
  await expect(refresh.locator("svg").first()).toHaveCSS("width", "16px");
});

test("General does not promise an unimplemented login feature", async ({ app }) => {
  await app.open();
  const settings = await app.openSettings("general");
  await expect(settings).not.toContainText("Open Burf at login");
  await expect(settings.getByRole("switch").first()).toBeVisible();
});

test("failed startup provides visible plugin recovery without activating unknown replacements", async ({ app }) => {
  const agent = await fakeAgent();
  let unavailable = true;
  await app.context.route(`${agent.url}/v1/plugins`, (route) => route.fulfill(unavailable ? { status: 503, json: { error: "Synthetic catalog unavailable" } } : { json: [] }));
  try {
    await app.open({ agent });
    const recovery = app.page.getByRole("alert", { name: "Plugin loading", exact: true });
    await expect(recovery).toBeVisible();
    unavailable = false;
    await recovery.getByRole("button", { name: "Retry plugin loading", exact: true }).click();
    await expect(recovery).toHaveCount(0);
    await app.page.getByRole("button", { name: "More", exact: true }).click();
    await expect(app.page.getByRole("menuitem", { name: "GitHub Issues", exact: true })).toBeVisible();
  } finally { await agent.close(); }
});

test("project history shows its useful name and count and folds with the keyboard", async ({ app }) => {
  const agent = await fakeAgent();
  const cwd = "C:\\Users\\Synthetic\\A long parent folder\\important-project";
  const writes: string[] = [];
  await app.context.route(`${agent.url}/v1/local**`, (route) => {
    if (route.request().method() !== "GET") writes.push(route.request().method());
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith("/local") ? { name: "Test PC", supported: true, os: "windows", home: "C:\\Users\\Synthetic", agents: [{ id: "codex", available: true, can_chat: true }], sessions: [] }
      : path.endsWith("/conversations") ? [{ id: "history-1", source: "codex", title: "Project question", cwd, updated_at: new Date().toISOString(), read_only: true, can_continue: true }] : {};
    return route.fulfill({ json });
  });
  try {
    await app.open({ agent });
    const project = app.page.getByRole("region", { name: cwd, exact: true });
    const fold = project.locator("summary");
    await expect(fold).toContainText("important-project");
    await expect(fold).toContainText("1");
    await fold.focus(); await app.page.keyboard.press("Enter");
    await expect(project.getByRole("button", { name: "Project question", exact: true })).toBeHidden();
    await app.page.keyboard.press("Enter");
    await expect(project.getByRole("button", { name: "Project question", exact: true })).toBeVisible();
    expect(writes).toEqual([]);
  } finally { await agent.close(); }
});

test("plugin recovery remains reachable in the collapsed sidebar", async ({ app }) => {
  const agent = await fakeAgent();
  let unavailable = true;
  await app.context.route(`${agent.url}/v1/plugins`, (route) => route.fulfill(unavailable ? { status: 503, json: { error: "Synthetic unavailable catalog" } } : { json: [] }));
  try {
    await app.open({ agent });
    await expect(app.page.getByRole("alert", { name: "Plugin loading", exact: true })).toBeVisible();
    await app.page.getByRole("button", { name: "Hide the sidebar", exact: true }).click();
    const rail = app.page.getByTestId("sidebar-rail");
    const retry = rail.getByRole("button", { name: "Retry plugin loading", exact: true });
    await expect(retry).toBeVisible();
    unavailable = false;
    await retry.click();
    await expect(retry).toHaveCount(0);
  } finally { await agent.close(); }
});
