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
    await expect(settings.getByRole("switch", { name: "Install bundled agents automatically" })).not.toBeChecked();
    expect(agent.calls.some((call) => call.startsWith("POST /v1/boxes/") && call.includes("upgrade"))).toBe(false);
  } finally { await agent.close(); }
});

test("a failed build comparison is visible without claiming the online box is current", async ({ app }) => {
  const agent = await fakeAgent();
  let checks = 0;
  await app.context.route(`${agent.url}/v1/boxes/outdated**`, (route) => {
    checks++;
    return route.fulfill({ json: { boxes: [checks === 1 ? { box: BOX, error: "bundled daemon unavailable for darwin/arm64" } : { box: BOX, current: "e2e", available: "e2e", outdated: false }] } });
  });
  try {
    await app.open({ agent });
    const settings = await app.openSettings("boxes");
    await expect(settings.getByText("Build comparison unavailable", { exact: true })).toBeVisible();
    await expect(settings).not.toContainText("up to date");
    await settings.getByRole("button", { name: `${BOX} actions` }).click();
    await expect(app.page.getByRole("menuitem", { name: "Install bundled box agent" })).toBeDisabled();
    await app.page.keyboard.press("Escape");
    await settings.getByRole("button", { name: "Retry build check" }).click();
    await expect(settings.getByText("Build comparison unavailable", { exact: true })).toHaveCount(0);
    expect(checks).toBe(2);
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
