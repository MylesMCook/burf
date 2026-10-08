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
    await expect(pane.getByText("Tool activity · 3 · working", { exact: true })).toBeVisible();
    await expect(pane.getByText(/including other chats and projects/)).toBeVisible();
    expect(decisions).toEqual([]);
    await app.page.screenshot({ path: info.outputPath("chat-approval-queue.png"), animations: "disabled" });
    await pane.getByRole("button", { name: "Allow always", exact: true }).click();
    expect(decisions).toEqual([{ id: "1", decision: "acceptAlways" }]);
    await expect(pane.getByRole("button", { name: "Allow always", exact: true })).toHaveCount(0);
    await pane.getByRole("button", { name: "Always in this chat", exact: true }).click();
    expect(decisions).toEqual([{ id: "1", decision: "acceptAlways" }, { id: "2", decision: "acceptForSession" }]);
    expect(await app.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally { await agent.close(); }
});

test("composer sends supported choices and reconciles a pending prompt without replay", async ({ app }, info) => {
  const agent = await fakeAgent();
  const chat = { id: "composer", agent: "codex", mode: "chat", cwd: "C:\\Projects\\shop", state: "idle", started_at: "2026-10-08T12:00:00Z", thread_id: "thread", composer: true, options: { permission: "strict" }, items: [] as { id: string; kind: string; text: string }[], approvals: [] };
  let sends = 0; let sent: unknown; let modelReads = 0; let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await app.context.route(`${agent.url}/v1/local**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/local") return route.fulfill({ json: { supported: true, name: "work-hp", home: chat.cwd, agents: [], sessions: [chat] } });
    if (path.endsWith("/conversations")) return route.fulfill({ json: [] });
    if (path.endsWith("/models")) { modelReads++; return route.fulfill({ json: [{ model: "synthetic", displayName: "Synthetic model", defaultReasoningEffort: "medium", supportedReasoningEfforts: [{ reasoningEffort: "medium" }, { reasoningEffort: "high" }] }] }); }
    if (path.endsWith("/messages")) { sends++; sent = route.request().postDataJSON(); chat.state = "running"; chat.items = [{ id: "submitted", kind: "user", text: "Visible immediately" }]; await gate; }
    return route.fulfill({ json: chat });
  });
  try {
    await app.open({ agent }); await app.page.getByTestId("nav-local").click(); await app.page.getByRole("button", { name: /Codex.*idle/ }).click();
    const pane = app.page.getByTestId("local-chat");
    // The selectors sit in the composer; the provider's models are read once, after the chat is ready.
    await expect(pane.getByLabel("Chat permissions")).toHaveValue("strict");
    await expect(pane.getByRole("option", { name: "Synthetic model" })).toHaveCount(1);
    await pane.getByLabel("Chat model").selectOption("synthetic");
    await expect(pane.getByLabel("Chat reasoning")).toHaveValue("medium");
    await pane.getByLabel("Chat reasoning").selectOption("high");
    await pane.getByLabel("Chat permissions").selectOption("workspace");
    await expect(pane.locator("header").getByText("Ask every time", { exact: true })).toBeVisible();
    await expect(pane.getByText(/From your next message: Codex edits files in this workspace/)).toBeVisible();
    await app.page.screenshot({ path: info.outputPath("chat-composer-options.png"), animations: "disabled" });
    await pane.getByRole("textbox", { name: "Message Codex" }).fill("Visible immediately");
    await pane.getByRole("button", { name: "Send message" }).click();
    await expect(pane.getByRole("article").filter({ hasText: "Visible immediately" })).toHaveCount(1);
    await expect(pane.getByRole("status")).toHaveText("Working");
    await expect(pane.getByRole("article").filter({ hasText: "Visible immediately" })).toHaveCount(1);
    expect(sent).toEqual({ text: "Visible immediately", options: { model: "synthetic", effort: "high", permission: "workspace" } });
    release?.(); await expect(pane.getByRole("textbox", { name: "Message Codex" })).toHaveValue(""); expect(sends).toBe(1);
    expect(modelReads).toBe(1);
    expect(await app.stored("berth.chat.permission")).toBe("workspace");
  } finally { release?.(); await agent.close(); }
});

test("older backends retain chat without unsupported composer controls", async ({ app }) => {
  const agent = await fakeAgent(); const reads: string[] = [];
  const chat = { id: "old", agent: "codex", mode: "chat", cwd: "C:\\Projects\\shop", state: "running", started_at: "2026-10-08T12:00:00Z", thread_id: "thread", items: [], approvals: [] };
  await app.context.route(`${agent.url}/v1/local**`, async (route) => {
    const path = new URL(route.request().url()).pathname; reads.push(path);
    if (path === "/v1/local") return route.fulfill({ json: { supported: true, name: "work-hp", home: chat.cwd, agents: [], sessions: [chat] } });
    if (path.endsWith("/conversations")) return route.fulfill({ json: [] });
    return route.fulfill({ json: chat });
  });
  try {
    await app.open({ agent }); await app.page.getByTestId("nav-local").click(); await app.page.getByRole("button", { name: /Codex.*running/ }).click();
    const pane = app.page.getByTestId("local-chat");
    await expect(pane.getByRole("heading", { name: "Codex is working…" })).toBeVisible();
    await expect(pane.getByRole("heading", { name: "New chat" })).toHaveCount(0);
    await expect(pane.getByLabel("Chat permissions")).toHaveCount(0);
    await expect(pane.getByLabel("Chat model")).toHaveCount(0);
    expect(reads.some((p) => p.endsWith("/models"))).toBe(false);
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
    await expect(pane.getByLabel("Chat permissions")).toHaveValue("strict");
    await app.page.getByRole("button", { name: /Codex.*idle/ }).first().click();
    await expect(pane.getByRole("heading", { name: "New chat" })).toBeVisible();
    await expect(pane.getByLabel("Chat permissions")).toHaveValue("read-only");
    await expect(pane.locator("header").getByText("Ask every time", { exact: true })).toBeVisible();
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
    await pane.getByLabel("Chat model").selectOption("synthetic");
    const draft = pane.getByRole("textbox", { name: "Message Codex" });
    await draft.fill("Try this");
    await pane.getByRole("button", { name: "Send message" }).click();
    await expect(pane.getByText(/Codex did not start this turn: unsupported model/).first()).toBeVisible();
    await expect(pane.getByRole("status")).toHaveText("Ready");
    await expect(draft).toHaveValue("Try this");
    await expect(pane.getByRole("article")).toHaveCount(0);
    await expect(pane.getByLabel("Chat model")).toHaveValue("synthetic");
    expect(sends).toBe(1);
    await pane.getByRole("button", { name: "Send message" }).click();
    await expect(pane.getByRole("article", { name: "You" })).toContainText("Try this");
    await expect(draft).toHaveValue("");
    expect(sends).toBe(2);
  } finally { await agent.close(); }
});

test("full access is offered only where the backend lists it, warns before it applies and is not remembered", async ({ app }) => {
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
    await expect(pane.getByLabel("Chat permissions").getByRole("option")).toHaveText(["Ask every time", "Read only", "Edit workspace"]);
    await app.page.getByRole("button", { name: /Codex.*idle/ }).first().click();
    await expect(pane.getByLabel("Chat permissions").getByRole("option")).toHaveText(["Ask every time", "Read only", "Edit workspace", "Full access"]);
    await pane.getByLabel("Chat permissions").selectOption("full-access");
    await expect(pane.getByText(/From your next message: Codex runs any command and changes any file/)).toBeVisible();
    await expect(pane.locator("header").getByText("Ask every time", { exact: true })).toBeVisible();
    expect(sent).toEqual([]);
    await pane.getByRole("textbox", { name: "Message Codex" }).fill("Go");
    await pane.getByRole("button", { name: "Send message" }).click();
    await expect(pane.locator("header").getByText("Full access", { exact: true })).toBeVisible();
    expect(sent).toEqual([{ text: "Go", options: { permission: "full-access" } }]);
    expect(await app.stored("berth.chat.permission")).toBeNull();
  } finally { await agent.close(); }
});
