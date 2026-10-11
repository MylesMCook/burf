import { BOX, fakeAgent } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

test.beforeEach(() => mockOnly("isolated box build checks and editor setup"));

test("different bundled builds do not claim version ordering or update automatically", async ({ app }) => {
  const agent = await fakeAgent();
  await app.context.route(`${agent.url}/v1/boxes/outdated**`, (route) => route.fulfill({ json: { boxes: [{ box: BOX, current: "e2e", available: "bundled", outdated: true }] } }));
  try {
    await app.open({ agent });
    const settings = await app.openSettings("boxes");
    await expect(settings.getByText("Different build", { exact: true })).toBeVisible();
    await expect(settings).toContainText("Build IDs do not indicate which is newer.");
    await expect(settings).not.toContainText("older berthd");
    await expect(settings).not.toContainText("only connects");
    await expect(settings.getByRole("switch", { name: "Update Burf on paired computers automatically" })).not.toBeChecked();
    expect(agent.calls.some((call) => call.startsWith("POST /v1/boxes/") && call.includes("upgrade"))).toBe(false);
  } finally { await agent.close(); }
});

test("a failed build comparison is visible without claiming the online box is current", async ({ app }) => {
  const agent = await fakeAgent();
  // The comparison fails until the bundled daemon is back. The app also checks on its own (on connect, and when the
  // online boxes change), so how many checks precede Settings is not fixed.
  let checks = 0;
  let failing = true;
  await app.context.route(`${agent.url}/v1/boxes/outdated**`, (route) => {
    checks++;
    return route.fulfill({ json: { boxes: [failing ? { box: BOX, error: "bundled daemon unavailable for darwin/arm64" } : { box: BOX, current: "e2e", available: "e2e", outdated: false }] } });
  });
  try {
    await app.open({ agent });
    const settings = await app.openSettings("boxes");
    await expect(settings.getByText("Build comparison unavailable", { exact: true })).toBeVisible();
    await expect(settings).not.toContainText("up to date");
    await settings.getByRole("button", { name: `${BOX} actions` }).click();
    await expect(app.page.getByRole("menuitem", { name: "Install bundled box agent" })).toBeDisabled();
    await app.page.keyboard.press("Escape");
    failing = false;
    const before = checks;
    await settings.getByRole("button", { name: "Retry build check" }).click();
    await expect(settings.getByText("Build comparison unavailable", { exact: true })).toHaveCount(0);
    // Retry asked again; nothing was assumed from the failed answer.
    expect(checks).toBeGreaterThan(before);
  } finally { await agent.close(); }
});

test("Windows editor setup previews compatibility hosts before explicitly writing SSH config", async ({ app }, info) => {
  const agent = await fakeAgent();
  let writes = 0;
  await app.context.addInitScript(() => Object.defineProperty(navigator, "platform", { value: "Win32", configurable: true }));
  await app.context.route(`${agent.url}/v1/editors`, (route) => route.fulfill({ json: [{ id: "vscode", name: "VS Code", installed: true, cli: true, lines: true }] }));
  await app.context.route(`${agent.url}/v1/ssh-config`, (route) => {
    if (route.request().method() === "POST") writes++;
    return route.fulfill({ json: { hosts: [{ box: BOX, host: `berth-${BOX}`, local: false }], changes: writes ? [] : [{ path: "C:\\Users\\tester\\.ssh\\berth\\devl.conf", action: "create", diff: "+ Host berth-devl\n+   User tester" }] } });
  });
  try {
    await app.open({ agent });
    const settings = await app.openSettings("boxes");
    await expect(settings).toContainText("Optional: open remote projects in an external editor. Chats and agents in Burf do not need SSH editor setup.");
    await expect(settings).toContainText("Ctrl-click");
    await expect(settings).not.toContainText("⌘");
    await expect(settings).toContainText("Host berth-devl");
    await app.page.screenshot({ path: info.outputPath("windows-editor-setup.png"), animations: "disabled" });
    expect(writes).toBe(0);
    await settings.getByRole("button", { name: "Write SSH configuration", exact: true }).click();
    await expect(settings.getByText("Configuration saved", { exact: false })).toBeVisible();
    expect(writes).toBe(1);
  } finally { await agent.close(); }
});

test("the editor SSH prompt reviews settings without writing configuration", async ({ app }) => {
  const agent = await fakeAgent();
  let writes = 0;
  await app.context.addInitScript(() => Object.defineProperty(navigator, "platform", { value: "Win32", configurable: true }));
  await app.context.route(`${agent.url}/v1/editors`, (route) => route.fulfill({ json: [{ id: "vscode", name: "VS Code", installed: true, cli: true, lines: true }] }));
  await app.context.route(`${agent.url}/v1/editors/open`, (route) => route.fulfill({ status: 409, json: { error: "SSH configuration required", code: "ssh_setup" } }));
  await app.context.route(`${agent.url}/v1/ssh-config`, (route) => {
    if (route.request().method() === "POST") writes++;
    return route.fulfill({ json: { hosts: [], changes: [] } });
  });
  try {
    await app.open({ agent });
    await app.openWorktree(`${BOX}/fix`);
    await app.page.keyboard.press("Control+Shift+O");
    await expect(app.page.getByText("External editor needs SSH setup", { exact: true })).toBeVisible();
    await app.page.getByRole("button", { name: "Review setup", exact: true }).click();
    await expect(app.page.getByTestId("settings-boxes")).toBeVisible();
    expect(writes).toBe(0);
  } finally { await agent.close(); }
});


test("paired computer details are optional and opening them does not change a computer", async ({ app }) => {
  const agent = await fakeAgent();
  try {
    await app.open({ agent });
    const settings = await app.openSettings("boxes");
    const details = settings.locator("details").filter({ has: app.page.getByText(`Details for ${BOX}`, { exact: true }) });
    await expect(details).not.toHaveAttribute("open", "");
    await expect(settings.getByText(BOX, { exact: true }).first()).toBeVisible();
    const before = agent.calls.filter((call) => /^(POST|PUT|DELETE) /.test(call));
    await details.locator("summary").click();
    await expect(details).toHaveAttribute("open", "");
    expect(agent.calls.filter((call) => /^(POST|PUT|DELETE) /.test(call))).toEqual(before);
    await expect(settings).toContainText("does not update Codex or Claude Code");
  } finally { await agent.close(); }
});

test("unavailable computer information stays visible and retry can recover it", async ({ app }) => {
  const agent = await fakeAgent();
  let failing = true;
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/info`, async (route) => {
    if (failing) return route.fulfill({ status: 503, json: { error: "information unavailable" } });
    return route.fallback();
  });
  try {
    await app.open({ agent });
    const settings = await app.openSettings("boxes");
    await expect(settings).toContainText("Computer information unavailable");
    failing = false;
    await settings.getByRole("button", { name: "Retry information", exact: true }).click();
    await expect(settings.getByRole("button", { name: "Retry information", exact: true })).toHaveCount(0);
    expect(agent.calls.some((call) => call.startsWith("POST ") && call.includes("upgrade"))).toBe(false);
  } finally { await agent.close(); }
});


test("settings separate paired agent hosts from trusted computer access without changing IDs", async ({ app }) => {
  const agent = await fakeAgent();
  try {
    await app.open({ agent });
    const paired = await app.openSettings("boxes");
    await expect(app.page.getByRole("heading", { name: "Paired computers", exact: true })).toBeVisible();
    await expect(paired).toContainText("Start local chats from This computer in the sidebar");
    await expect(app.page.getByTestId("settings-nav-boxes")).toHaveAccessibleName("Paired computers");
    await app.page.getByRole("button", { name: "Computer access", exact: true }).click();
    const access = app.page.getByTestId("settings-computers");
    await expect(app.page.getByRole("heading", { name: "Computer access", exact: true })).toBeVisible();
    await expect(access.getByRole("button", { name: "Add another computer", exact: true })).toBeVisible();
    await expect(access.getByRole("button", { name: "Use a join link", exact: true })).toBeVisible();
    expect(agent.calls.filter((call) => /^(POST|PUT|DELETE) /.test(call))).toEqual([]);
  } finally { await agent.close(); }
});
