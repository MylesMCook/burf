import { BOX, SESSION, fakeAgent, type FakeAgent } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

let agent: FakeAgent;
test.beforeEach(async () => {
  mockOnly("chat-first acceptance uses an isolated synthetic agent");
  agent = await fakeAgent();
});
test.afterEach(async () => { await agent?.close(); });

function newChat() {
  agent.session = { agent_state: "idle", command: "claude", title: "" };
  agent.screen = () => ["─".repeat(80), "❯ ", "─".repeat(80)].join("\n");
  agent.transcript = () => ({ body: { source: "none", items: [], next: 0, crew: [] } });
}

test("a fresh profile opens a remote agent as chat without Labs", async ({ app }) => {
  await app.open({ agent, prefs: { labs: false, labsChosen: true, version: 3 } });
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.chat).toBeVisible();
  await expect(app.chat.getByText("The retry loop never backs off; fixed it.")).toBeVisible();
  await expect(app.composer.getByRole("textbox", { name: "Reply" })).toBeVisible();
  await expect(app.page.getByRole("button", { name: "Chat", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("an existing terminal preference is preserved", async ({ app }) => {
  await app.open({ agent, prefs: { agentView: "terminal", version: 3 } });
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.page.getByRole("button", { name: "Terminal", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(app.chat).toHaveCount(0);
  await expect.poll(() => app.stored("berth.prefs")).toMatchObject({ agentView: "terminal" });
});

test("Codex opens as chat without requiring a demo override", async ({ app }) => {
  agent.session = { agent: "codex", command: "codex" };
  await app.open({ agent });
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.chat).toBeVisible();
  await expect(app.composer.getByRole("textbox", { name: "Reply" })).toBeVisible();
});

test("an older box defaults to terminal but keeps an explicit chat choice", async ({ app }) => {
  agent.capabilities = ["turns"];
  await app.open({ agent });
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.page.getByRole("button", { name: "Terminal", exact: true })).toHaveAttribute("aria-pressed", "true");
  await app.page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(app.page.getByRole("button", { name: "Chat", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(app.page.getByRole("button", { name: "Show terminal", exact: true })).toBeVisible();
  await expect(app.composer).toHaveCount(0);
});

test("terminal fallback stays local to its pane and survives reload", async ({ app }) => {
  await app.open({ agent });
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.chat).toBeVisible();
  await app.page.getByRole("button", { name: "Terminal", exact: true }).click();
  await expect(app.chat).toHaveCount(0);
  await expect.poll(() => app.stored("berth.prefs")).toMatchObject({ agentView: "conversation" });
  await app.page.reload();
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.page.getByRole("button", { name: "Terminal", exact: true })).toHaveAttribute("aria-pressed", "true");
  await app.page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(app.chat.getByText("The retry loop never backs off; fixed it.")).toBeVisible();
});

test("the default chat view is a normal General setting", async ({ app }) => {
  await app.open({ agent, prefs: { labs: false, labsChosen: true, version: 3 } });
  const general = await app.openSettings("general");
  const choice = general.getByRole("group", { name: "Open supported agents as" });
  await expect(choice.getByRole("button", { name: "Chat", exact: true })).toHaveAttribute("aria-pressed", "true");
  await choice.getByRole("button", { name: "Terminal", exact: true }).click();
  await expect.poll(() => app.stored("berth.prefs")).toMatchObject({ agentView: "terminal" });
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.chat).toHaveCount(0);
});

for (const command of ["sh", "gemini"]) {
  test(`${command} remains a terminal rather than an unsupported chat`, async ({ app }) => {
    agent.session = { agent: command === "sh" ? "" : command, command };
    await app.open({ agent });
    await app.openWorktree(`${BOX}/fix`);
    await expect(app.panes).toBeVisible();
    await expect(app.chat).toHaveCount(0);
    await expect(app.page.getByRole("group", { name: "Show the agent as" })).toHaveCount(0);
  });
}

for (const width of [1440, 720, 390]) {
  test(`a new chat keeps its composer at the bottom at ${width}px`, async ({ app }, info) => {
    await app.page.setViewportSize({ width, height: 900 });
    newChat();
    await app.open({ agent });
    await app.openWorktree(`${BOX}/fix`);
    if (width < 600) await app.page.getByRole("button", { name: "Hide the sidebar", exact: true }).click();
    await expect(app.chat.getByRole("heading", { name: "New chat" })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Chat", exact: true })).toBeInViewport({ ratio: 1 });
    await expect(app.page.getByRole("button", { name: "Terminal", exact: true })).toBeInViewport({ ratio: 1 });
    const reply = app.composer.getByRole("textbox", { name: "Reply" });
    await expect(reply).toBeInViewport();
    const bounds = await reply.boundingBox();
    expect(bounds!.y).toBeGreaterThan(600);
    await reply.fill("A draft that is not sent");
    await expect(reply).toHaveValue("A draft that is not sent");
    expect(agent.calls.filter((c) => c.startsWith("POST") && c.includes("/send"))).toEqual([]);
    await app.page.screenshot({ path: info.outputPath(`chat-first-${width}.png`) });
  });
}

test("the first message is sent once and appears in the conversation", async ({ app }) => {
  newChat();
  const requests: unknown[] = [];
  await app.page.route(`${agent.url}/v1/boxes/${BOX}/api/sessions/${SESSION}/send`, async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { queued: false } });
  });
  await app.open({ agent });
  await app.openWorktree(`${BOX}/fix`);
  const reply = app.composer.getByRole("textbox", { name: "Reply" });
  await expect(app.chat.getByRole("heading", { name: "New chat" })).toBeVisible();
  await reply.fill("Write a focused regression test");
  await reply.press("Enter");
  await expect(app.chat.locator("[data-kind=user]")).toContainText("Write a focused regression test");
  await expect(reply).toHaveValue("");
  expect(requests).toEqual([{ text: "Write a focused regression test", enter: true, when: "idle" }]);
});

test("a failed first send restores the draft without retrying automatically", async ({ app }) => {
  newChat();
  let requests = 0;
  await app.page.route(`${agent.url}/v1/boxes/${BOX}/api/sessions/${SESSION}/send`, async (route) => {
    requests++;
    await route.fulfill({ status: 503, json: { error: "The box is unavailable" } });
  });
  await app.open({ agent });
  await app.openWorktree(`${BOX}/fix`);
  const reply = app.composer.getByRole("textbox", { name: "Reply" });
  await expect(app.chat.getByRole("heading", { name: "New chat" })).toBeVisible();
  await reply.fill("Keep this draft");
  await reply.press("Enter");
  await expect(app.page.getByText(`Can't reach ${BOX}`, { exact: true })).toBeVisible();
  await expect(reply).toHaveValue("Keep this draft");
  await expect(app.chat.locator("[data-kind=user]")).toHaveCount(0);
  expect(requests).toBe(1);
});
