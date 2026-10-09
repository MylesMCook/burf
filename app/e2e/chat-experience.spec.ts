import { fakeAgent } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

test.beforeEach(() => mockOnly("isolated structured chat experience"));

for (const width of [1440, 720]) test(`scoped approvals and compact activity at ${width}px`, async ({ app }, info) => {
  await app.page.setViewportSize({ width, height: 900 });
  const agent = await fakeAgent();
  const decisions: unknown[] = [];
  const chat = { id: "experience", agent: "codex", mode: "chat", cwd: "C:\\Projects\\shop", state: "waiting", started_at: "2026-10-08T12:00:00Z", thread_id: "thread", turn_id: "turn", composer: true, options: { permission: "strict" }, items: [{ id: "u", kind: "user", text: "Inspect project" }, ...[1, 2, 3].map((n) => ({ id: `tool${n}`, kind: "tool", text: `git status ${n}`, status: "inProgress" }))], approvals: [1, 2].map((n) => ({ id: `${n}`, kind: "command", detail: `git status ${n}`, session_allowed: true, execpolicy: n === 1 ? ["git", "status"] : undefined })) };
  await app.context.route(`${agent.url}/v1/local**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/local") return route.fulfill({ json: { supported: true, name: "work-hp", home: chat.cwd, agents: [], sessions: [chat] } });
    if (path.endsWith("/conversations")) return route.fulfill({ json: [] });
    if (path.endsWith("/approvals")) { const body = route.request().postDataJSON(); decisions.push(body); chat.approvals = chat.approvals.filter((a) => a.id !== body.id); }
    return route.fulfill({ json: chat });
  });
  try {
    await app.open({ agent }); await app.page.getByTestId("nav-local").click(); await app.page.getByRole("button", { name: /Codex.*waiting/ }).click();
    const pane = app.page.getByTestId("local-chat");
    await expect(pane.getByText("2 pending approvals", { exact: true })).toBeVisible();
    await expect(pane.getByRole("button", { name: "3 tool calls", exact: true })).toBeVisible();
    await expect(pane.locator('[data-slot="tool-group-trigger-loader"]')).toBeVisible();
    await expect(pane.getByRole("button", { name: "3 tool calls", exact: true })).toHaveAttribute("aria-expanded", "false");
    await pane.getByRole("button", { name: "3 tool calls", exact: true }).click();
    await pane.getByRole("button", { name: /^Running tool: git status 1(?:\s|$)/ }).click();
    await expect(pane.locator('[data-slot="tool-fallback-trigger-icon"]').first()).toHaveClass(/animate-spin/);
    await expect(pane.locator('[data-slot="tool-fallback-content"]').first()).toContainText("git status 1");
    await pane.getByRole("button", { name: "3 tool calls", exact: true }).click();
    await expect(pane.getByText(/including other chats and projects/)).toBeVisible();
    expect(decisions).toEqual([]);
    await app.page.screenshot({ path: info.outputPath("chat-approval-queue.png"), animations: "disabled" });
    await pane.getByRole("button", { name: "Allow always", exact: true }).click();
    expect(decisions).toEqual([{ id: "1", decision: "acceptAlways" }]);
    await expect(pane.getByRole("button", { name: "Allow always", exact: true })).toHaveCount(0);
    await pane.getByRole("button", { name: "Allow for chat", exact: true }).click();
    expect(decisions).toEqual([{ id: "1", decision: "acceptAlways" }, { id: "2", decision: "acceptForSession" }]);
    expect(await app.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally { await agent.close(); }
});

test("older backends show disabled choices and keep unsupported options out of messages", async ({ app }) => {
  const agent = await fakeAgent(); const reads: string[] = []; const sent: unknown[] = [];
  const chat = { id: "old", agent: "codex", mode: "chat", cwd: "C:\\Projects\\shop", state: "running", started_at: "2026-10-08T12:00:00Z", thread_id: "thread", items: [], approvals: [] };
  await app.context.route(`${agent.url}/v1/local**`, async (route) => {
    const path = new URL(route.request().url()).pathname; reads.push(path);
    if (path === "/v1/local") return route.fulfill({ json: { supported: true, name: "work-hp", home: chat.cwd, agents: [], sessions: [chat] } });
    if (path.endsWith("/conversations")) return route.fulfill({ json: [] });
    if (path.endsWith("/models")) return route.fulfill({ status: 404, json: { error: "Model choices unavailable" } });
    if (path.endsWith("/messages")) sent.push(route.request().postDataJSON());
    return route.fulfill({ json: chat });
  });
  try {
    await app.open({ agent }); await app.page.getByTestId("nav-local").click(); await app.page.getByRole("button", { name: /Codex.*running/ }).click();
    const pane = app.page.getByTestId("local-chat");
    await expect(pane.getByRole("status")).toHaveText("Working");
    // A chat already at work is not a new chat: no greeting.
    await expect(pane.getByText("How can I help you today?", { exact: true })).toHaveCount(0);
    await expect(pane.getByLabel("Chat permissions")).toBeDisabled();
    await expect(pane.getByLabel("Chat model")).toBeDisabled();
    await expect(app.page.getByRole("radiogroup", { name: "Chat reasoning" })).toHaveCount(0);
    await pane.getByLabel("Chat model").locator("..").hover();
    await expect(app.page.locator("[data-slot=tooltip-popup]")).toHaveText("This chat cannot change model, reasoning or permissions. Its backend does not support chat options.");
    await expect.poll(() => reads.some((p) => p.endsWith("/models"))).toBe(true);
    chat.state = "idle";
    await pane.getByRole("button", { name: "Refresh chat", exact: true }).click();
    await pane.getByRole("textbox", { name: "Message Codex" }).fill("Keep default settings");
    await pane.getByRole("button", { name: "Send message", exact: true }).click();
    await expect.poll(() => sent).toEqual([{ text: "Keep default settings" }]);
  } finally { await agent.close(); }
});

test("a new chat offers the permission last chosen and an existing chat keeps its own", async ({ app }) => {
  await app.context.addInitScript(() => localStorage.setItem("berth.chat.permission", JSON.stringify("read-only")));
  const agent = await fakeAgent();
  const base = { agent: "codex", mode: "chat", cwd: "C:\\Projects\\shop", state: "idle", started_at: "2026-10-08T12:00:00Z", thread_id: "thread", composer: true, options: { permission: "strict" }, approvals: [] };
  const fresh = { ...base, id: "fresh", items: [] as unknown[] };
  const used = { ...base, id: "used", started_at: "2026-10-08T11:00:00Z", items: [{ id: "u", kind: "user", text: "Earlier" }] };
  const sent: unknown[] = [];
  await app.context.route(`${agent.url}/v1/local**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/local") return route.fulfill({ json: { supported: true, name: "work-hp", home: base.cwd, agents: [], sessions: [fresh, used] } });
    if (path.endsWith("/conversations")) return route.fulfill({ json: [] });
    if (path.endsWith("/models")) return route.fulfill({ json: [] });
    if (path.endsWith("/messages")) sent.push(route.request().postDataJSON());
    return route.fulfill({ json: path.includes("/used") ? used : fresh });
  });
  try {
    await app.open({ agent }); await app.page.getByTestId("nav-local").click();
    const pane = app.page.getByTestId("local-chat");
    await app.page.getByRole("button", { name: /Codex.*idle/ }).last().click();
    await expect(pane.getByRole("article", { name: "You" })).toContainText("Earlier");
    await expect(pane.getByLabel("Chat permissions")).toHaveText("Ask every time");
    await app.page.getByRole("button", { name: /Codex.*idle/ }).first().click();
    await expect(pane.getByText("How can I help you today?", { exact: true })).toBeVisible();
    await expect(pane.getByLabel("Chat permissions")).toHaveText("Read only");
    await pane.getByLabel("Chat permissions").hover();
    await expect(app.page.locator("[data-slot=tooltip-popup]")).toContainText("Current permission: Ask every time.");
    await pane.getByRole("textbox", { name: "Message Codex" }).fill("Look around");
    await pane.getByRole("button", { name: "Send message" }).click();
    await expect.poll(() => sent).toEqual([{ text: "Look around", options: { permission: "read-only" } }]);
  } finally { await agent.close(); }
});

test("a turn the provider refuses keeps the chat, the draft and the previous settings", async ({ app }) => {
  const agent = await fakeAgent();
  const chat = { id: "refused", agent: "codex", mode: "chat", cwd: "C:\\Projects\\shop", state: "idle", started_at: "2026-10-08T12:00:00Z", thread_id: "thread", composer: true, options: { permission: "strict" }, items: [] as unknown[], approvals: [], error: "" };
  let sends = 0;
  await app.context.route(`${agent.url}/v1/local**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/local") return route.fulfill({ json: { supported: true, name: "work-hp", home: chat.cwd, agents: [], sessions: [chat] } });
    if (path.endsWith("/conversations")) return route.fulfill({ json: [] });
    if (path.endsWith("/models")) return route.fulfill({ json: [{ model: "synthetic", displayName: "Synthetic model", defaultReasoningEffort: "medium", supportedReasoningEfforts: [{ reasoningEffort: "medium" }] }] });
    if (path.endsWith("/messages")) {
      if (++sends === 1) { chat.error = "Codex did not start this turn: unsupported model"; return route.fulfill({ status: 400, json: { error: chat.error } }); }
      chat.error = ""; chat.items = [{ id: "u", kind: "user", text: "Try this" }];
    }
    return route.fulfill({ json: chat });
  });
  try {
    await app.open({ agent }); await app.page.getByTestId("nav-local").click(); await app.page.getByRole("button", { name: /Codex.*idle/ }).click();
    const pane = app.page.getByTestId("local-chat");
    await pane.getByLabel("Chat model").click();
    await app.page.getByRole("option", { name: "Synthetic model", exact: true }).click();
    const draft = pane.getByRole("textbox", { name: "Message Codex" });
    await draft.fill("Try this");
    await pane.getByRole("button", { name: "Send message" }).click();
    await expect(pane.getByText(/Codex did not start this turn: unsupported model/).first()).toBeVisible();
    await expect(pane.getByRole("status")).toHaveText("Ready");
    await expect(draft).toHaveValue("Try this");
    await expect(pane.getByRole("article")).toHaveCount(0);
    await expect(pane.getByLabel("Chat model")).toHaveText("Synthetic modelmedium");
    expect(sends).toBe(1);
    await pane.getByRole("button", { name: "Send message" }).click();
    await expect(pane.getByRole("article", { name: "You" })).toContainText("Try this");
    await expect(draft).toHaveValue("");
    expect(sends).toBe(2);
  } finally { await agent.close(); }
});

test("full access is offered only where the backend lists it, warns before it applies and is remembered", async ({ app }) => {
  const agent = await fakeAgent();
  const base = { agent: "codex", mode: "chat", cwd: "C:\\Projects\\shop", state: "idle", started_at: "2026-10-08T12:00:00Z", thread_id: "thread", composer: true, options: { permission: "strict" } as { permission: string }, approvals: [] };
  const current = { ...base, id: "current", permissions: ["strict", "read-only", "workspace", "full-access"], items: [] as unknown[] };
  const earlier = { ...base, id: "earlier", started_at: "2026-10-08T11:00:00Z", items: [] as unknown[] };
  const sent: unknown[] = [];
  await app.context.route(`${agent.url}/v1/local**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/local") return route.fulfill({ json: { supported: true, name: "work-hp", home: base.cwd, agents: [], sessions: [current, earlier] } });
    if (path.endsWith("/conversations")) return route.fulfill({ json: [] });
    if (path.endsWith("/models")) return route.fulfill({ json: [] });
    if (path.endsWith("/messages")) { sent.push(route.request().postDataJSON()); current.options = { permission: "full-access" }; current.items = [{ id: "u", kind: "user", text: "Go" }]; }
    return route.fulfill({ json: path.includes("/earlier") ? earlier : current });
  });
  try {
    await app.open({ agent }); await app.page.getByTestId("nav-local").click();
    const pane = app.page.getByTestId("local-chat");
    await app.page.getByRole("button", { name: /Codex.*idle/ }).last().click();
    await pane.getByLabel("Chat permissions").click();
    await expect(app.page.locator('[data-slot="select-list"]').getByRole("option")).toHaveText(["Ask every time", "Read only", "Edit workspace"]);
    await app.page.keyboard.press("Escape");
    await app.page.getByRole("button", { name: /Codex.*idle/ }).first().click();
    await pane.getByLabel("Chat permissions").click();
    await expect(app.page.locator('[data-slot="select-list"]').getByRole("option")).toHaveText(["Ask every time", "Read only", "Edit workspace", "Full access"]);
    await app.page.keyboard.press("Escape");
    await pane.getByLabel("Chat permissions").click();
    await app.page.getByRole("option", { name: "Full access", exact: true }).click();
    await pane.getByLabel("Chat permissions").hover();
    await expect(app.page.locator("[data-slot=tooltip-popup]").filter({ hasText: /From your next message: Codex runs any command and changes any file/ })).toBeVisible();
    await expect(app.page.locator("[data-slot=tooltip-popup]")).toContainText("Current permission: Ask every time.");
    expect(sent).toEqual([]);
    await pane.getByRole("textbox", { name: "Message Codex" }).fill("Go");
    await pane.getByRole("button", { name: "Send message" }).click();
    await pane.getByLabel("Chat permissions").hover();
    await expect(app.page.locator("[data-slot=tooltip-popup]")).toContainText("Current permission: Full access.");
    expect(sent).toEqual([{ text: "Go", options: { permission: "full-access" } }]);
    expect(await app.stored("berth.chat.permission")).toBe("full-access");
    // The empty chat on a backend that does not list it is not offered the remembered mode.
    await app.page.reload(); await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Codex.*idle/ }).last().click();
    await expect(pane.getByText("How can I help you today?", { exact: true })).toBeVisible();
    await expect(pane.getByLabel("Chat permissions")).toHaveText("Ask every time");
  } finally { await agent.close(); }
});
