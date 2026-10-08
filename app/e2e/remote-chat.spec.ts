import { BOX, DIR, fakeAgent } from "./fake-agent";
import { expect, mockOnly, test, type App } from "./fixtures";
import type { BrowserContext } from "@playwright/test";

test.beforeEach(() => mockOnly("isolated structured remote Codex chat"));

async function openWorktree(app: App) {
  const more = app.page.getByRole("button", { name: "1 more worktree", exact: true });
  if (await more.isVisible()) await more.click();
  await app.openWorktree(`${BOX}/fix`);
}

async function fixture(context: BrowserContext, supported = true, options = false, fullAccess = false) {
  const agent = await fakeAgent();
  const base = `/v1/boxes/${BOX}/api/`;
  const calls: { method: string; path: string; body: unknown }[] = [];
  const chat = { id: "remote-1", agent: "codex", mode: "chat", location: "shop/fix", cwd: DIR, state: "idle", started_at: "2026-10-08T12:00:00Z", thread_id: "remote-provider-thread", turn_id: "", items: [] as { id: string; kind: string; text: string }[], approvals: [] as { id: string; kind: string; detail: string }[] };
  const control = { listed: false, lostSend: false, lostStart: false, offline: false, startDelay: 0 };
  await context.route(`${agent.url}${base}**`, async (route) => {
    const path = new URL(route.request().url()).pathname.slice(base.length);
    const method = route.request().method();
    calls.push({ method, path, body: route.request().postDataJSON() });
    if (path === "info") return route.fulfill({ json: { name: BOX, version: "test", capabilities: supported ? ["chat.codex", "transcript", ...(options ? ["chat.options"] : []), ...(fullAccess ? ["chat.full-access"] : [])] : ["transcript"], agents: [{ id: "codex", name: "Codex", command: "codex" }, { id: "custom", name: "Custom Codex", command: "codex --model custom" }] } });
    if (path === "sessions") return route.fulfill({ json: method === "POST" ? { name: "legacy-codex" } : [] });
    if (!path.startsWith("chats")) return route.continue();
    if (control.offline) return route.abort("connectionreset");
    if (path === "chats/models") return route.fulfill({ json: [
      { model: "alpha", displayName: "Alpha", defaultReasoningEffort: "medium", supportedReasoningEfforts: [{ reasoningEffort: "medium" }, { reasoningEffort: "high" }] },
      { model: "beta", displayName: "Beta", defaultReasoningEffort: "low", supportedReasoningEfforts: [{ reasoningEffort: "low" }] },
    ] });
    if (path === "chats") {
      if (method === "GET") return route.fulfill({ json: { chats: control.listed ? [{ ...chat, items: null, approvals: null }] : [] } });
      control.listed = true;
      if (control.lostStart) return route.abort("connectionreset");
      if (control.startDelay) await new Promise((resolve) => setTimeout(resolve, control.startDelay));
      return route.fulfill({ status: 201, json: chat });
    }
    if (path.endsWith("/messages")) {
      const body = route.request().postDataJSON() as { text: string };
      chat.items = [{ id: "u", kind: "user", text: body.text }, { id: "a", kind: "assistant", text: "Structured reply from the remote box" }];
      if (control.lostSend) return route.abort("connectionreset");
    }
    if (path.endsWith("/approvals")) { chat.approvals = []; chat.state = "running"; }
    if (path.endsWith("/interrupt")) { chat.state = "idle"; chat.turn_id = ""; }
    if (method === "DELETE") chat.state = "exited";
    return route.fulfill({ json: chat });
  });
  return { agent, chat, calls, control };
}

test("new remote Codex uses structured requests and reload recovers the same chat", async ({ app }) => {
  const f = await fixture(app.context);
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("button", { name: "New Codex", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    await expect(app.page.getByRole("group", { name: "Show the agent as" })).toHaveCount(0);
    await app.page.getByRole("textbox", { name: "Message Codex" }).fill("Exactly once");
    await app.page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(app.page.getByRole("article", { name: "Codex", exact: true })).toContainText("Structured reply");
    await expect(app.page.getByRole("textbox", { name: "Message Codex" })).toHaveValue("");
    await app.page.reload();
    await openWorktree(app);
    await expect(app.page.getByRole("article", { name: "Codex", exact: true })).toContainText("Structured reply");
    await expect(app.page.getByRole("textbox", { name: "Message Codex" })).toHaveValue("");
    expect(f.calls.filter((c) => c.method === "POST" && c.path === "chats")).toEqual([{ method: "POST", path: "chats", body: { location: "shop/fix" } }]);
    expect(f.calls.filter((c) => c.path.endsWith("/messages"))).toHaveLength(1);
    expect(f.calls.some((c) => c.path.startsWith("sessions/") || c.method === "POST" && c.path === "sessions")).toBe(false);
    await app.page.getByRole("button", { name: "Stop chat", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat").getByRole("status")).toHaveText("Stopped");
  } finally { await f.agent.close(); }
});

for (const width of [1440, 720]) test(`existing remote chats expose approvals and interrupt at ${width}px`, async ({ app }, info) => {
  await app.page.setViewportSize({ width, height: 900 });
  const f = await fixture(app.context);
  f.control.listed = true;
  f.chat.state = "waiting"; f.chat.turn_id = "turn-1";
  f.chat.approvals = [{ id: "approval-1", kind: "command", detail: "git status" }];
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("region", { name: "Codex chats" }).getByRole("button", { name: /Codex chat/ }).click();
    await expect(app.page.getByRole("region", { name: "Approval required" })).toBeVisible();
    await app.page.screenshot({ path: info.outputPath("remote-chat-approval.png"), animations: "disabled" });
    expect(await app.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(app.page.getByRole("textbox", { name: "Message Codex" })).toBeInViewport();
    expect(f.calls.filter((c) => c.method !== "GET" && c.path.startsWith("chats"))).toHaveLength(0);
    await app.page.getByRole("button", { name: "Deny", exact: true }).click();
    await app.page.getByRole("button", { name: "Interrupt turn", exact: true }).click();
    expect(f.calls.filter((c) => c.path.endsWith("/approvals"))).toEqual([{ method: "POST", path: "chats/remote-1/approvals", body: { id: "approval-1", decision: "decline" } }]);
    expect(f.calls.filter((c) => c.path.endsWith("/interrupt"))).toHaveLength(1);
  } finally { await f.agent.close(); }
});

test("uncertain remote sends retain the draft and reconnect never replays it", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.lostSend = true;
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("button", { name: "New Codex", exact: true }).click();
    const draft = app.page.getByRole("textbox", { name: "Message Codex" });
    await draft.fill("Do not replay");
    await app.page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(app.page.getByRole("alert")).toContainText("may have arrived");
    await expect(draft).toHaveValue("Do not replay");
    f.control.offline = true;
    await app.page.getByRole("button", { name: "Refresh chat", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat").getByRole("status")).toHaveText("Disconnected");
    await expect(app.page.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
    f.control.offline = false;
    await app.page.getByRole("button", { name: "Refresh chat", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat").getByRole("status")).toHaveText("Ready");
    await expect(draft).toHaveValue("Do not replay");
    expect(f.calls.filter((c) => c.path.endsWith("/messages"))).toHaveLength(1);
    await app.page.reload();
    await openWorktree(app);
    await expect(app.page.getByRole("textbox", { name: "Message Codex" })).toHaveValue("Do not replay");
    expect(f.calls.filter((c) => c.path.endsWith("/messages"))).toHaveLength(1);
  } finally { await f.agent.close(); }
});

test("a lost start is not retried and the owned chat can be recovered", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.lostStart = true;
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("button", { name: "New Codex", exact: true }).click();
    await expect(app.page.getByText(/Codex may have started/)).toBeVisible();
    await app.page.getByRole("button", { name: "Close pane", exact: true }).click();
    await app.page.getByRole("region", { name: "Codex chats" }).getByRole("button", { name: /Codex chat/ }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    expect(f.calls.filter((c) => c.method === "POST" && c.path === "chats")).toHaveLength(1);
  } finally { await f.agent.close(); }
});

for (const custom of [false, true]) test(`${custom ? "custom commands" : "older boxes"} retain terminal launching`, async ({ app }) => {
  const f = await fixture(app.context, custom);
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("button", { name: custom ? "New Custom Codex" : "New Codex", exact: true }).click();
    await expect.poll(() => f.calls.some((c) => c.method === "POST" && c.path === "sessions")).toBe(true);
    expect(f.calls.some((c) => c.method === "POST" && c.path === "chats")).toBe(false);
    await expect(app.page.getByTestId("remote-chat")).toHaveCount(0);
  } finally { await f.agent.close(); }
});

test("the existing-worktree composer starts Codex with default settings without a terminal", async ({ app }) => {
  const f = await fixture(app.context);
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("textbox", { name: "What should your agents work on?" }).fill("Explain this repository");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    await expect(app.page.getByRole("article", { name: "You", exact: true })).toContainText("Explain this repository");
    expect(f.calls.filter((c) => c.method === "POST" && c.path === "chats")).toHaveLength(1);
    expect(f.calls.filter((c) => c.path.endsWith("/messages"))).toHaveLength(1);
    // Older daemons reject unknown fields: defaults send the text alone.
    expect(f.calls.find((c) => c.path.endsWith("/messages"))?.body).toEqual({ text: "Explain this repository" });
    expect(f.calls.some((c) => c.method === "POST" && c.path === "sessions")).toBe(false);
  } finally { await f.agent.close(); }
});

test("the composer carries a chosen effort into the first message on boxes that take options", async ({ app }) => {
  const f = await fixture(app.context, true, true);
  await app.context.addInitScript((box) => localStorage.setItem(`berth.composer.picks.${box}/shop`, JSON.stringify([{ agent: "codex", effort: "high" }])), BOX);
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("textbox", { name: "What should your agents work on?" }).fill("Think carefully");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    await expect(app.page.getByRole("article", { name: "You", exact: true })).toHaveCount(1);
    const sends = f.calls.filter((c) => c.path.endsWith("/messages"));
    expect(sends.map((c) => c.body)).toEqual([{ text: "Think carefully", options: { effort: "high" } }]);
    expect(f.calls.some((c) => c.method === "POST" && c.path === "sessions")).toBe(false);
  } finally { await f.agent.close(); }
});

test("the launcher offers the account's Codex models and a permission mode on boxes that take options", async ({ app }) => {
  const f = await fixture(app.context, true, true);
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    const composer = app.page.getByTestId("task-composer");
    await composer.getByRole("button", { name: "Model: Default", exact: true }).click();
    await app.page.getByRole("menuitemradio", { name: "Alpha", exact: true }).click();
    await composer.getByRole("button", { name: "Reasoning: Default", exact: true }).click();
    await app.page.getByRole("menuitemradio", { name: "High", exact: true }).click();
    // Beta lists no High: the choice does not follow it there.
    await composer.getByRole("button", { name: "Model: Alpha", exact: true }).click();
    await app.page.getByRole("menuitemradio", { name: "Beta", exact: true }).click();
    await expect(composer.getByRole("button", { name: "Reasoning: Default", exact: true })).toBeVisible();
    await composer.getByRole("button", { name: "Permissions: Ask every time", exact: true }).click();
    // This box does not say it takes full access, so it is not offered.
    await expect(app.page.getByRole("menuitemradio", { name: "Full access", exact: true })).toHaveCount(0);
    await app.page.getByRole("menuitemradio", { name: "Edit workspace", exact: true }).click();
    await composer.getByRole("textbox", { name: "What should your agents work on?" }).fill("Make the change");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    expect(f.calls.filter((c) => c.path.endsWith("/messages")).map((c) => c.body)).toEqual([{ text: "Make the change", options: { model: "beta", permission: "workspace" } }]);
    expect(f.calls.filter((c) => c.path === "chats/models")).toHaveLength(1);
    expect(await app.stored("berth.chat.permission")).toBe("workspace");
  } finally { await f.agent.close(); }
});

test("full access is an explicit launcher choice and is remembered like the other modes", async ({ app }) => {
  const f = await fixture(app.context, true, true, true);
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    const composer = app.page.getByTestId("task-composer");
    await composer.getByRole("button", { name: "Permissions: Ask every time", exact: true }).click();
    await app.page.getByRole("menuitemradio", { name: "Full access", exact: true }).click();
    await composer.getByRole("textbox", { name: "What should your agents work on?" }).fill("Do anything");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    expect(f.calls.filter((c) => c.path.endsWith("/messages")).map((c) => c.body)).toEqual([{ text: "Do anything", options: { permission: "full-access" } }]);
    expect(await app.stored("berth.chat.permission")).toBe("full-access");
  } finally { await f.agent.close(); }
});

test("a remembered full access falls back to asking on a box that does not take it", async ({ app }) => {
  const f = await fixture(app.context, true, true);
  await app.context.addInitScript(() => localStorage.setItem("berth.chat.permission", JSON.stringify("full-access")));
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    const composer = app.page.getByTestId("task-composer");
    await expect(composer.getByRole("button", { name: "Permissions: Ask every time", exact: true })).toBeVisible();
    await composer.getByRole("textbox", { name: "What should your agents work on?" }).fill("Stay careful");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    expect(f.calls.filter((c) => c.path.endsWith("/messages")).map((c) => c.body)).toEqual([{ text: "Stay careful" }]);
  } finally { await f.agent.close(); }
});

test("older boxes show no chat permission or provider model choices in the launcher", async ({ app }) => {
  const f = await fixture(app.context);
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    const composer = app.page.getByTestId("task-composer");
    await expect(composer.getByRole("button", { name: /^Provider: Codex/ })).toBeVisible();
    await expect(composer.getByRole("button", { name: /^Permissions:/ })).toHaveCount(0);
    await expect(composer.getByRole("button", { name: /^Model:/ })).toHaveCount(0);
    expect(f.calls.some((c) => c.path === "chats/models")).toBe(false);
  } finally { await f.agent.close(); }
});

for (const override of ["model", "effort"]) test(`the composer rejects an explicit ${override} override without losing its draft`, async ({ app }) => {
  const f = await fixture(app.context);
  await app.context.addInitScript(({ box, override }) => localStorage.setItem(`berth.composer.picks.${box}/shop`, JSON.stringify([{ agent: "codex", [override]: "custom" }])), { box: BOX, override });
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    const draft = app.page.getByRole("textbox", { name: "What should your agents work on?" });
    await draft.fill("Keep my choices");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByText("Choose Codex defaults", { exact: true })).toBeVisible();
    await expect(draft).toHaveValue("Keep my choices");
    expect(f.calls.some((c) => c.method === "POST" && (c.path === "chats" || c.path === "sessions"))).toBe(false);
  } finally { await f.agent.close(); }
});

test("new-worktree structured launch is explicitly blocked and preserves its draft", async ({ app }) => {
  const f = await fixture(app.context);
  try {
    await app.open({ agent: f.agent });
    const draft = app.page.getByRole("textbox", { name: "What should your agents work on?" });
    await draft.fill("Create something");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByText("Open a worktree first", { exact: true })).toBeVisible();
    await expect(draft).toHaveValue("Create something");
    expect(f.calls.some((c) => c.method === "POST" && ["tasks", "chats", "sessions"].includes(c.path))).toBe(false);
  } finally { await f.agent.close(); }
});

test("a slow start stays in Starting rather than pretending Codex is thinking", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.startDelay = 1200;
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("button", { name: "New Codex", exact: true }).click();
    await expect(app.page.getByText("Starting Codex…", { exact: true })).toBeVisible();
    await expect(app.page.getByRole("textbox", { name: "Message Codex" })).toHaveCount(0);
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
  } finally { await f.agent.close(); }
});

test("a composer send with a lost response opens the same chat and keeps the unsent draft", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.lostSend = true;
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("textbox", { name: "What should your agents work on?" }).fill("Recover this prompt");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    await expect(app.page.getByRole("textbox", { name: "Message Codex" })).toHaveValue("Recover this prompt");
    await expect(app.page.getByText("Could not confirm the message", { exact: true })).toBeVisible();
    expect(f.calls.filter((c) => c.method === "POST" && c.path === "chats")).toHaveLength(1);
    expect(f.calls.filter((c) => c.path.endsWith("/messages"))).toHaveLength(1);
  } finally { await f.agent.close(); }
});
