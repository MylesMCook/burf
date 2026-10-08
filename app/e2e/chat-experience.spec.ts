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
    expect(modelReads).toBe(0);
    await pane.getByRole("button", { name: "Chat options" }).click();
    await expect(pane.getByRole("option", { name: "Synthetic model" })).toHaveCount(1);
    await pane.getByLabel("Chat model").selectOption("synthetic");
    await expect(pane.getByLabel("Chat reasoning")).toHaveValue("medium");
    await pane.getByLabel("Chat reasoning").selectOption("high");
    await pane.getByLabel("Chat permissions").selectOption("workspace");
    await expect(pane.locator("header").getByText("Strict read-only", { exact: true })).toBeVisible();
    await app.page.screenshot({ path: info.outputPath("chat-composer-options.png"), animations: "disabled" });
    await pane.getByRole("textbox", { name: "Message Codex" }).fill("Visible immediately");
    await pane.getByRole("button", { name: "Send message" }).click();
    await expect(pane.getByRole("article").filter({ hasText: "Visible immediately" })).toHaveCount(1);
    await expect(pane.getByRole("status")).toHaveText("Working");
    await expect(pane.getByRole("article").filter({ hasText: "Visible immediately" })).toHaveCount(1);
    expect(sent).toEqual({ text: "Visible immediately", options: { model: "synthetic", effort: "high", permission: "workspace" } });
    release?.(); await expect(pane.getByRole("textbox", { name: "Message Codex" })).toHaveValue(""); expect(sends).toBe(1);
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
    await expect(pane.getByRole("button", { name: "Chat options" })).toHaveCount(0);
    expect(reads.some((p) => p.endsWith("/models"))).toBe(false);
  } finally { await agent.close(); }
});
