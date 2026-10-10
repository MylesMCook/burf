import { fakeAgent } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

test.beforeEach(() => mockOnly("isolated structured local chat"));

for (const provider of ["codex", "claude"] as const) test(`a new local ${provider} chat sends messages without terminal input and reconnects without replay`, async ({ app }) => {
  const name = provider === "claude" ? "Claude Code" : "Codex";
  const agent = await fakeAgent();
  const starts: unknown[] = [];
  const calls: string[] = [];
  let disconnected = false;
  const chat = { id: "chat-1", agent: provider, cwd: "C:\\Projects\\shop", state: "idle", started_at: "2026-10-08T12:00:00Z", mode: "chat", thread_id: "provider-thread", items: [] as { id: string; kind: string; text: string }[], approvals: [] };
  await app.context.route(`${agent.url}/v1/local**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    calls.push(`${method} ${path}`);
    if (path === "/v1/local") return route.fulfill({ json: { supported: true, name: "work-hp", home: chat.cwd, agents: provider === "codex" ? [{ id: "claude", available: true }, { id: "codex", available: true, can_chat: true }] : [{ id: provider, available: true, can_chat: true }], sessions: calls.includes("POST /v1/local/chats") ? [chat] : [] } });
    if (path === "/v1/local/conversations") return route.fulfill({ json: [] });
    if (path === "/v1/local/chats" && method === "POST") starts.push(route.request().postDataJSON());
    if (path.endsWith("/models")) return route.fulfill({ json: [] });
    if (path === "/v1/local/chats/chat-1" && disconnected) return route.abort("connectionreset");
    if (path.endsWith("/messages")) {
      chat.items = [{ id: "u", kind: "user", text: `Hello ${name}` }, { id: "a", kind: "assistant", text: `Hello from structured ${name}` }];
    }
    return route.fulfill({ json: chat });
  });
  try {
    await app.open({ agent });
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: "New agent", exact: true }).click();
    const composer = app.page.getByRole("dialog").getByTestId("task-composer");
    await expect(composer.getByTestId("task-composer-summary")).toContainText(`on work-hp · this folder · ${name}`);
    await composer.getByRole("button", { name: "Start ⏎", exact: true }).click();
    await expect(app.page.getByTestId("local-chat")).toBeVisible();
    await expect(app.page.getByTestId("local-terminal")).toHaveCount(0);
    await app.page.getByRole("textbox", { name: `Message ${name}` }).fill(`Hello ${name}`);
    await app.page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(app.page.getByText(`Hello from structured ${name}`, { exact: true })).toBeVisible();
    await app.page.getByRole("button", { name: "Refresh local conversations", exact: true }).click();
    disconnected = true;
    await app.page.getByRole("button", { name: "Refresh chat", exact: true }).click();
    await expect(app.page.getByTestId("local-chat").getByRole("status", { name: "Chat status", exact: true })).toHaveText("Disconnected");
    disconnected = false;
    await app.page.getByRole("button", { name: "Refresh chat", exact: true }).click();
    await expect(app.page.getByTestId("local-chat").getByRole("status", { name: "Chat status", exact: true })).toHaveText("Ready");
    expect(starts).toEqual([{ cwd: chat.cwd, ...(provider === "claude" ? { agent: provider } : {}) }]);
    expect(calls.filter((c) => c.endsWith("/messages"))).toHaveLength(1);
    expect(calls.some((c) => c.endsWith("/input") || c === "POST /v1/local/sessions")).toBe(false);
  } finally { await agent.close(); }
});

for (const width of [1440, 720]) test(`local approvals are explicit and the composer stays usable at ${width}px`, async ({ app }, info) => {
  await app.page.setViewportSize({ width, height: 900 });
  const agent = await fakeAgent();
  const calls: { method: string; path: string; body: unknown }[] = [];
  const chat = { id: "chat-2", agent: "codex", mode: "chat", cwd: "C:\\Projects\\shop", state: "waiting", started_at: "2026-10-08T12:00:00Z", thread_id: "owned-thread", turn_id: "turn-1", items: [{ id: "u", kind: "user", text: "Check this project" }, { id: "a", kind: "assistant", text: "I need your approval before running this command." }], approvals: [{ id: "7", kind: "command", detail: "npm test\nDirectory: C:\\Projects\\shop", reason: "Run the project tests" }] };
  await app.context.route(`${agent.url}/v1/local**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    calls.push({ method, path, body: route.request().postDataJSON() });
    if (path === "/v1/local") return route.fulfill({ json: { supported: true, name: "work-hp", home: chat.cwd, agents: [{ id: "codex", available: true, can_chat: true }], sessions: [chat] } });
    if (path === "/v1/local/conversations") return route.fulfill({ json: [] });
    if (path.endsWith("/approvals")) { chat.approvals = []; chat.state = "running"; }
    if (path.endsWith("/interrupt")) { chat.state = "idle"; chat.turn_id = ""; }
    return route.fulfill({ json: chat });
  });
  try {
    await app.open({ agent });
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Codex.*waiting/ }).click();
    await expect(app.page.getByRole("region", { name: "Approval required" })).toBeVisible();
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
    await app.page.screenshot({ path: info.outputPath("local-chat-approval.png"), animations: "disabled" });
    const composer = app.page.getByRole("textbox", { name: "Message Codex" });
    const box = await composer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(300);
    expect(box!.y).toBeGreaterThan(650);
    expect(box!.y + box!.height).toBeLessThan(900);
    expect(await app.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await app.page.getByRole("button", { name: "Deny", exact: true }).click();
    await expect(app.page.getByRole("region", { name: "Approval required" })).toHaveCount(0);
    expect(calls.filter((c) => c.path.endsWith("/approvals"))).toEqual([{ method: "POST", path: "/v1/local/chats/chat-2/approvals", body: { id: "7", decision: "decline" } }]);
    await app.page.getByRole("button", { name: "Stop generating", exact: true }).click();
    await expect(app.page.getByRole("button", { name: "Send message", exact: true })).toBeVisible();
    expect(calls.filter((c) => c.path.endsWith("/interrupt"))).toHaveLength(1);
  } finally { await agent.close(); }
});

for (const failure of ["connectionreset", "rejected"] as const) test(`a ${failure} local chat send preserves the draft without replay`, async ({ app }) => {
  const agent = await fakeAgent();
  let sends = 0;
  const chat = { id: "chat-3", agent: "codex", mode: "chat", cwd: "C:\\Projects\\shop", state: "idle", started_at: "2026-10-08T12:00:00Z", thread_id: "owned-thread", items: [] as { id: string; kind: string; text: string }[], approvals: [] };
  await app.context.route(`${agent.url}/v1/local**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/local") return route.fulfill({ json: { supported: true, name: "work-hp", home: chat.cwd, agents: [{ id: "codex", available: true, can_chat: true }], sessions: [chat] } });
    if (path === "/v1/local/conversations") return route.fulfill({ json: [] });
    if (path.endsWith("/messages")) {
      sends++;
      if (failure === "rejected") return route.fulfill({ status: 400, json: { error: "Chat is not ready for a message" } });
      chat.items = [{ id: "u", kind: "user", text: "Exactly once" }]; return route.abort("connectionreset");
    }
    return route.fulfill({ json: chat });
  });
  try {
    await app.open({ agent });
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Codex.*idle/ }).click();
    await app.page.getByRole("textbox", { name: "Message Codex" }).fill("Exactly once");
    await app.page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText(failure === "rejected" ? "Chat is not ready" : "may have arrived");
    if (failure === "connectionreset") await expect(app.page.getByRole("article", { name: "You", exact: true })).toContainText("Exactly once");
    await app.page.getByRole("button", { name: "Refresh chat", exact: true }).click();
    await expect(app.page.getByRole("textbox", { name: "Message Codex" })).toHaveValue("Exactly once");
    expect(sends).toBe(1);
  } finally { await agent.close(); }
});
