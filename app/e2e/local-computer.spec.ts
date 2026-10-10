import { fakeAgent } from "./fake-agent";
import { expect, mockOnly, test, type App } from "./fixtures";

const cwd = "C:\\Projects\\shop";
const conversation = { id: "history-1", source: "codex" as const, title: "Checkout history", cwd, updated_at: "2026-01-01T12:00:00Z", read_only: true as const, can_continue: true };
const session: { id: string; agent: "claude" | "codex"; cwd: string; state: "starting" | "running" | "idle" | "waiting" | "exited"; started_at: string; mode?: "chat" } = { id: "owned-1", agent: "claude", cwd, state: "running", started_at: "2026-01-01T12:00:00Z" };

async function localFixture(app: App, options: { supported?: boolean; available?: boolean; canFork?: boolean; continueReason?: string; failStart?: boolean; noBoxes?: boolean; mobile?: boolean; failHistory?: boolean; outputFailOnce?: boolean; inputFailOnce?: boolean; source?: "claude" | "codex"; forkGate?: Promise<void>; forkResponseFailOnce?: boolean; forkError?: { status: number; message: string }; agents?: { id: "claude" | "codex"; available: boolean; can_chat?: boolean; can_fork?: boolean }[]; conversations?: (typeof conversation)[]; sessions?: (typeof session)[]; startGate?: Promise<void>; failMessage?: boolean } = {}) {
  const agent = await fakeAgent();
  const calls: { method: string; path: string; body: unknown }[] = [];
  let running = true;
  let started = false;
  let outputFails = 0;
  let inputFailed = false;
  let forkResponseFailed = false;
  let launches = 0;
  let ownedSession: typeof session = { ...session, agent: "claude", state: "running" };
  let chat: (typeof session & { thread_id: string; items: { id: string; kind: string; text: string }[]; approvals: never[] }) | undefined;
  const history = { ...conversation, source: options.source ?? conversation.source, can_continue: !options.continueReason, continue_reason: options.continueReason };
  if (options.noBoxes) await app.context.route(`${agent.url}/v1/status`, (route) => route.fulfill({ json: { boxes: [], forwards: [], routes: [], proxy: { port: 1377, url_port: 1377 } } }));
  await app.context.route(`${agent.url}/v1/local**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    calls.push({ method: req.method(), path: url.pathname + url.search, body: req.postDataJSON() });
    let body: unknown;
    let status = 200;
    if (url.pathname === "/v1/local") body = { supported: options.supported ?? true, name: "work-hp", home: cwd, agents: options.agents ?? [{ id: "claude", available: options.available ?? true, can_fork: options.canFork ?? false, can_chat: options.canFork ?? false }, { id: "codex", available: options.canFork ?? false, can_fork: options.canFork ?? false, can_chat: options.canFork ?? false }], sessions: [...(options.sessions ?? []), ...(started ? [{ ...ownedSession, state: running ? ownedSession.state : "exited" }] : [])] };
    else if (url.pathname === "/v1/local/conversations") { status = options.failHistory ? 500 : 200; body = options.failHistory ? { error: "History scan failed" } : options.conversations ?? [history]; }
    else if (url.pathname === "/v1/local/conversations/history-1") body = url.searchParams.has("before")
      ? { items: [{ kind: "user", id: "older", off: 0, text: "Earlier request" }], more: false, start: 0 }
      : { items: [{ kind: "user", id: "u1", off: 100, text: "My saved request" }, { kind: "text", id: "a1", off: 200, text: "Saved response" }, { kind: "ask", id: "ask1", off: 300, tool: "Run", detail: "Historical permission", choices: [{ key: "yes", label: "Allow" }] }], more: true, start: 100 };
    else if ((url.pathname === "/v1/local/sessions" || url.pathname === "/v1/local/chats" || url.pathname.endsWith("/fork") || url.pathname.endsWith("/continue")) && req.method() === "POST") {
      const posted = req.postDataJSON() ?? {};
      const continuing = url.pathname.endsWith("/continue");
      if (url.pathname.endsWith("/fork") || url.pathname === "/v1/local/chats" || continuing) {
        if (options.forkGate) await options.forkGate;
      }
      if (url.pathname === "/v1/local/sessions") ownedSession = { ...ownedSession, agent: posted.agent, cwd: posted.cwd };
      if (url.pathname === "/v1/local/chats" || continuing) {
        chat = { ...ownedSession, id: "chat-1", agent: continuing ? history.source : posted.agent === "claude" ? "claude" : "codex", mode: "chat", cwd: posted.cwd ?? history.cwd, state: "idle", thread_id: continuing ? "forked-thread" : "thread-1", items: [], approvals: [] };
        ownedSession = chat;
      }
      if (url.pathname.endsWith("/fork")) ownedSession = { ...session, agent: history.source };
      if (options.startGate) await options.startGate;
      const failure = url.pathname.endsWith("/fork") || url.pathname === "/v1/local/chats" || url.pathname.endsWith("/continue") ? options.forkError : undefined;
      if (!options.failStart && !failure) {
        if (!started) launches++;
        started = true;
      }
      status = failure?.status ?? (options.failStart ? 400 : 200);
      body = failure ? { error: failure.message } : options.failStart ? { error: "Project folder does not exist" } : ownedSession;
      if ((url.pathname.endsWith("/fork") || url.pathname === "/v1/local/chats" || url.pathname.endsWith("/continue")) && options.forkResponseFailOnce && !forkResponseFailed) {
        forkResponseFailed = true;
        await route.abort("connectionreset");
        return;
      }
    } else if (url.pathname === "/v1/local/chats/chat-1/messages" && req.method() === "POST" && chat) {
      if (options.failMessage) { status = 400; body = { error: "Message refused" }; }
      else { chat.items = [{ id: "u1", kind: "user", text: req.postDataJSON().text }, { id: "a1", kind: "assistant", text: "Structured reply" }]; body = {}; }
    } else if (url.pathname === "/v1/local/chats/chat-1" && chat) body = chat;
    else if (url.pathname.endsWith("/input") && options.inputFailOnce && !inputFailed) {
      inputFailed = true;
      await route.abort("connectionreset");
      return;
    } else if (url.pathname.endsWith("/output")) {
      // Production preview mounts once: fail the first read so Reconnect can succeed.
      if (options.outputFailOnce && outputFails < 1) { outputFails++; status = 503; body = { error: "Terminal temporarily unavailable" }; }
      else body = { data: url.searchParams.get("after") === "0" ? Buffer.from("Local terminal ready\r\n").toString("base64") : "", next: 22, reset: false, state: running ? "running" : "exited" };
    }
    else if (req.method() === "DELETE") { running = false; body = {}; }
    else body = {};
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  await app.open({ agent });
  if (options.mobile) await app.page.getByRole("button", { name: "Hide the sidebar", exact: true }).click();
  return { agent, calls, launches: () => launches };
}

async function expandComposer(app: App) {
  const summary = app.page.getByRole("dialog").getByTestId("task-composer-summary");
  await expect(summary).toContainText("on work-hp · this folder");
  if (await summary.getAttribute("aria-expanded") === "false") await summary.click();
}

async function enterFolder(app: App, path: string) {
  await expandComposer(app);
  await app.page.getByRole("dialog").getByRole("button", { name: /^Project:/ }).click();
  await app.page.getByRole("menuitem", { name: "Type folder path…", exact: true }).click();
  await app.page.getByLabel("Project directory").fill(path);
}

// Chats nest under This computer in the sidebar; the main pane is the thread
// or the inline composer (no middle conversation column).
async function openLocalHistory(app: App, title: RegExp | string = /Checkout history/i) {
  await app.page.getByTestId("nav-local").click();
  await expect(app.page.getByTestId("local-chat-row").filter({ hasText: title })).toBeVisible();
  await app.page.getByTestId("local-chat-row").filter({ hasText: title }).click();
}

function localComposer(app: App) {
  return app.page.getByTestId("task-composer");
}

async function expandLocalComposer(app: App) {
  const summary = localComposer(app).getByTestId("task-composer-summary");
  await expect(summary).toContainText("on work-hp · this folder");
  if ((await summary.getAttribute("aria-expanded")) === "false") await summary.click();
}

async function enterLocalFolder(app: App, path: string) {
  await expandLocalComposer(app);
  await localComposer(app).getByRole("button", { name: /^Project:/ }).click();
  await app.page.getByRole("menuitem", { name: "Type folder path…", exact: true }).click();
  await app.page.getByLabel("Project directory").fill(path);
}

async function openLocalNewAgent(app: App) {
  await app.page.getByTestId("nav-local").click();
  await app.page.getByTestId("local-new-agent").click();
  await expect(localComposer(app)).toBeVisible();
}

async function chooseLocalAtHome(app: App) {
  await app.page.getByTestId("nav-home").click();
  const composer = app.page.getByTestId("task-composer");
  const summary = composer.getByTestId("task-composer-summary");
  if (await summary.getAttribute("aria-expanded") === "false") await summary.click();
  await composer.getByRole("button", { name: /^Place:/ }).click();
  await app.page.getByRole("menuitemradio", { name: "work-hp · This computer", exact: true }).click();
  await expect(composer.getByTestId("task-composer-summary")).toContainText("on work-hp · this folder");
  return composer;
}

test.beforeEach(() => mockOnly("isolated local-computer API"));

for (const reason of [
  "Its folder, shop, is a relative path. Use a full folder path to continue here.",
  "Its folder, /Users/example/shop, uses a path for another operating system.",
  `Its folder, ${cwd}, is not on this computer.`,
  `Its path, ${cwd}, is a file, not a folder.`,
]) {
  test(`unavailable history stays readable without a launch: ${reason}`, async ({ app }) => {
    const { agent, calls } = await localFixture(app, { canFork: true, continueReason: reason });
    try {
      await openLocalHistory(app);
      await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
      const start = app.page.getByRole("button", { name: "Continue in Burf", exact: true });
      await expect(start).toBeDisabled();
      await expect(start).toHaveAccessibleDescription(reason);
      await expect(app.page.getByRole("status").filter({ hasText: reason })).toBeVisible();
      await start.evaluate((button) => { if (button instanceof HTMLButtonElement) button.click(); });
      expect(calls.filter((c) => c.method === "POST")).toEqual([]);
      await app.context.route(`${agent.url}/v1/local/conversations`, (route) => route.fulfill({ json: [conversation] }));
      await app.page.getByRole("button", { name: "Refresh local conversations", exact: true }).click();
      await expect(start).toBeEnabled();
      await expect(app.page.getByText(reason, { exact: true })).toHaveCount(0);
      expect(calls.filter((c) => c.method === "POST")).toEqual([]);
    } finally { await agent.close(); }
  });
}

test("a backend that does not say whether a folder is usable still offers to continue", async ({ app }) => {
  const { agent } = await localFixture(app, { canFork: true });
  // As an older backend lists a conversation: without can_continue.
  const { can_continue: _, ...older } = conversation;
  await app.context.route(`${agent.url}/v1/local/conversations`, (route) => route.fulfill({ json: [older] }));
  const listed = app.page.waitForResponse((r) => r.url().endsWith("/v1/local/conversations"));
  try {
    await openLocalHistory(app);
    await listed;
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Continue in Burf", exact: true })).toBeEnabled();
  } finally { await agent.close(); }
});

test("a folder removed after listing gives a plain launch error and keeps history readable", async ({ app }) => {
  const reason = `Its folder, ${cwd}, is not on this computer.`;
  const { agent, calls } = await localFixture(app, { canFork: true, forkError: { status: 400, message: reason } });
  try {
    await openLocalHistory(app);
    await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText(reason);
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/conversations/history-1/continue")).toHaveLength(1);
  } finally { await agent.close(); }
});

test("a history tool step with artifact-looking text draws no artifact card", async ({ app }) => {
  const { agent, calls } = await localFixture(app);
  const text = "Artifact 1a2b3c4d5e v1 · chart · Someone else's chart";
  await app.context.route(`${agent.url}/v1/local/conversations/history-1`, (route) => route.fulfill({ json: {
    items: [{ kind: "user", id: "u1", text: "Read the notes" }, { kind: "tools", id: "tool-1", verb: "Run", items: [{ id: "call-1", verb: "Run", target: text }], done: true }], more: false,
  } }));
  try {
    await openLocalHistory(app);
    const history = app.page.getByTestId("local-history");
    await expect(history.getByRole("article", { name: "Codex", exact: true })).toBeVisible();
    await expect(history.getByTestId("art-card")).toHaveCount(0);
    await expect(history.getByTestId("art-update")).toHaveCount(0);
    await expect(history.getByRole("button", { name: "Open", exact: true })).toHaveCount(0);
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  } finally { await agent.close(); }
});

test("local computer opens read-only history and older messages without session mutations", async ({ app }, info) => {
  const { agent, calls } = await localFixture(app);
  try {
    await openLocalHistory(app);
    await expect(app.page.getByRole("heading", { name: "work-hp" })).toBeVisible();
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    await expect(app.page.getByText("Read-only", { exact: true })).toBeVisible();
    await app.page.screenshot({ path: info.outputPath("local-history.png") });
    await expect(app.page.getByRole("button", { name: "Allow", exact: true })).toHaveCount(0);
    await expect(app.page.getByTestId("composer")).toHaveCount(0);
    await app.page.getByRole("button", { name: "Load earlier messages" }).click();
    await expect.poll(() => calls.some((c) => c.path === "/v1/local/conversations/history-1?before=100")).toBe(true);
    // Older messages join the same thread, each named for who said it.
    const history = app.page.getByTestId("local-history");
    await expect(history.getByRole("article", { name: "You", exact: true }).filter({ hasText: "Earlier request" })).toBeVisible();
    await expect(history.getByRole("article", { name: "You", exact: true }).locator("[data-prompt-text]")).toHaveText(["Earlier request", "My saved request"]);
    await expect(history.getByRole("article", { name: "Codex", exact: true })).toContainText("Saved response");
    await expect(history).toContainText("Historical permission");
    // A record that ended on an unanswered question is not an agent at work.
    await expect(history.getByLabel("Assistant is working")).toHaveCount(0);
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  } finally { await agent.close(); }
});

test("saved Claude history uses the shared read-only chat and stock tool group", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { source: "claude" });
  await app.context.route(`${agent.url}/v1/local/conversations/history-1**`, (route) => route.fulfill({ json: new URL(route.request().url()).searchParams.has("before")
    ? { items: [{ kind: "user", id: "older", off: 0, text: "Earlier request" }], more: false, start: 0 }
    : { items: [
      { kind: "user", id: "u", off: 100, text: "My saved request" },
      { kind: "text", id: "a", off: 200, text: "Saved Claude response" },
      { kind: "tools", id: "tools", off: 250, verb: "Run", done: true, items: [{ id: "call", verb: "Bash", target: "git status", output: "Saved tool output" }] },
      { kind: "ask", id: "ask", off: 300, tool: "Run", detail: "Historical permission" },
    ], more: true, start: 100 },
  }));
  try {
    await openLocalHistory(app);
    const history = app.page.getByTestId("local-history");
    await expect(history.getByRole("article", { name: "Claude Code", exact: true })).toContainText("Saved Claude response");
    await expect(history.locator(".aui-thread-root")).toHaveCount(1);
    await expect(history.getByRole("textbox")).toHaveCount(0);
    await expect(history.getByTestId("composer")).toHaveCount(0);
    const group = history.locator('[data-slot="tool-group-root"]');
    await group.getByRole("button", { name: "1 tool call", exact: true }).click();
    await group.getByRole("button", { name: "Used tool: Bash", exact: true }).click();
    await expect(group).toContainText("git status");
    await expect(group).toContainText("Saved tool output");
    await expect(history).toContainText("Recorded permission · Run · Historical permission · Not answered");
    await expect(history.getByRole("region", { name: "Approval required" })).toHaveCount(0);
    await expect(history.getByLabel("Assistant is working")).toHaveCount(0);
    await history.getByRole("button", { name: "Load earlier messages", exact: true }).click();
    await expect(history.getByRole("article", { name: "You", exact: true }).filter({ hasText: "Earlier request" })).toBeVisible();
    await expect(history).not.toContainText("Codex");
    await expect(app.page.getByRole("button", { name: "Continue in Burf", exact: true })).toBeVisible();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  } finally { await agent.close(); }
});

test("repeated continuation clicks and returning to history reuse the owned session", async ({ app }) => {
  let release!: () => void;
  const forkGate = new Promise<void>((resolve) => { release = resolve; });
  const { agent, calls, launches } = await localFixture(app, { canFork: true, forkGate });
  try {
    await openLocalHistory(app);
    const start = app.page.getByRole("button", { name: /Continue in Burf|Starting/ });
    await start.evaluate((button) => { if (button instanceof HTMLButtonElement) { button.click(); button.click(); } });
    await expect.poll(() => calls.filter((c) => c.path === "/v1/local/conversations/history-1/continue").length).toBe(1);
    await expect(app.page.getByRole("button", { name: /Continue in Burf|Starting/ })).toBeDisabled();
    release();
    await expect(app.page.getByTestId("local-chat")).toBeVisible();
    await app.page.getByTestId("local-chat-row").filter({ hasText: /Checkout history/i }).click();
    await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
    await expect(app.page.getByTestId("local-chat")).toBeVisible();
    expect(calls.filter((c) => c.path === "/v1/local/conversations/history-1/continue")).toHaveLength(2);
    expect(launches()).toBe(1);
    expect(calls.filter((c) => c.path.includes("/output?"))).toHaveLength(0);
  } finally { release(); await agent.close(); }
});

test("an interrupted continuation response is uncertain and refresh finds its owned session without replay", async ({ app }, info) => {
  const { agent, calls, launches } = await localFixture(app, { canFork: true, forkResponseFailOnce: true });
  try {
    await openLocalHistory(app);
    await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("The agent may have started");
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    await app.page.screenshot({ path: info.outputPath("continuation-uncertain.png") });
    await app.page.getByRole("button", { name: "Refresh local conversations", exact: true }).click();
    await expect(app.page.locator('[data-testid="local-chat-row"][data-chat^="session:"]')).toBeVisible();
    await app.page.locator('[data-testid="local-chat-row"][data-chat^="session:"]').first().click();
    await expect(app.page.getByTestId("local-chat")).toBeVisible();
    expect(calls.filter((c) => c.path === "/v1/local/conversations/history-1/continue")).toHaveLength(1);
    expect(calls.filter((c) => c.path.endsWith("/input"))).toHaveLength(0);
    expect(launches()).toBe(1);
  } finally { await agent.close(); }
});

for (const reason of ["Local conversation no longer exists", "Local conversation was replaced"]) {
  test(`refused continuation keeps readable history: ${reason}`, async ({ app }) => {
    const { agent, calls, launches } = await localFixture(app, { canFork: true, forkError: { status: 404, message: reason } });
    try {
      await openLocalHistory(app);
      await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
      await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText(reason);
      await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
      await app.page.getByRole("button", { name: "Refresh local conversations", exact: true }).click();
      expect(calls.filter((c) => c.path === "/v1/local/conversations/history-1/continue")).toHaveLength(1);
      expect(launches()).toBe(0);
    } finally { await agent.close(); }
  });
}

test("late transcript response never replaces a newly selected conversation", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { canFork: true });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let pending = false;
  await app.context.route(`${agent.url}/v1/local/conversations`, (route) => route.fulfill({ json: [conversation, { ...conversation, id: "history-2", source: "claude", title: "Second history" }] }));
  await app.context.route(`${agent.url}/v1/local/conversations/history-1`, async (route) => { pending = true; await gate; await route.fulfill({ json: { items: [{ kind: "text", id: "old-response", text: "Old late response" }], more: false } }); });
  await app.context.route(`${agent.url}/v1/local/conversations/history-2`, (route) => route.fulfill({ json: { items: [{ kind: "text", id: "second-response", text: "Second saved response" }], more: false } }));
  try {
    await openLocalHistory(app);
    await expect.poll(() => pending).toBe(true);
    await app.page.getByTestId("local-chat-row").filter({ hasText: /Second history/i }).click();
    await expect(app.page.getByText("Second saved response", { exact: true })).toBeVisible();
    release();
    await expect(app.page.getByRole("heading", { name: "Second history", exact: true })).toBeVisible();
    await expect(app.page.getByText("Old late response", { exact: true })).toHaveCount(0);
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  } finally { release(); await agent.close(); }
});

test("explicit continuation opens a chat and does not answer historical permissions", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { canFork: true });
  try {
    await openLocalHistory(app);
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
    await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
    await expect(app.page.getByTestId("local-chat")).toBeVisible();
    await expect(app.page.getByRole("textbox", { name: "Message Codex" })).toBeVisible();
    await expect(app.page.getByTestId("local-terminal")).toHaveCount(0);
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/conversations/history-1/continue")).toHaveLength(1);
    expect(calls.filter((c) => c.method === "POST" && c.path.endsWith("/fork"))).toHaveLength(0);
  } finally { await agent.close(); }
});

test("Claude continuation uses the selected history source", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { source: "claude", canFork: true });
  try {
    await openLocalHistory(app);
    await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
    await expect(app.page.getByTestId("local-chat")).toBeVisible();
    await expect(app.page.getByRole("textbox", { name: "Message Claude Code" })).toBeVisible();
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/conversations/history-1/continue")).toHaveLength(1);
    expect(calls.filter((c) => c.path.endsWith("/input"))).toHaveLength(0);
  } finally { await agent.close(); }
});

test("leaving a pending continuation keeps the newly selected view", async ({ app }) => {
  let release!: () => void;
  const forkGate = new Promise<void>((resolve) => { release = resolve; });
  const { agent, calls } = await localFixture(app, { canFork: true, forkGate });
  try {
    await openLocalHistory(app);
    await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
    await expect.poll(() => calls.filter((c) => c.path === "/v1/local/conversations/history-1/continue").length).toBe(1);
    await app.page.getByTestId("local-new-agent").click();
    await expect(localComposer(app).getByTestId("task-composer-summary")).toContainText("on work-hp · this folder");
    release();
    await expect(localComposer(app).getByTestId("task-composer-summary")).toContainText("on work-hp · this folder");
    await expect(app.page.getByRole("heading", { name: "New task", exact: true })).toHaveCount(0);
    await expect(app.page.getByTestId("local-terminal")).toHaveCount(0);
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/sessions")).toHaveLength(0);
  } finally { release(); await agent.close(); }
});

test("lost input response warns of uncertain delivery and reconnect never replays it", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { inputFailOnce: true });
  try {
    await openLocalNewAgent(app);
    await expect(localComposer(app).getByTestId("task-composer-summary")).toContainText("on work-hp · this folder");
    await expect(localComposer(app).getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await localComposer(app).getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.locator("[data-testid=local-terminal] .xterm-rows")).toContainText("Local terminal ready");
    await app.page.locator("[data-testid=local-terminal] textarea").fill("hello");
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("Terminal input may have arrived");
    const delivered = calls.filter((c) => c.path.endsWith("/input")).length;
    expect(delivered).toBeGreaterThan(0);
    await app.page.getByRole("button", { name: "Reconnect terminal", exact: true }).click();
    await expect(app.page.locator("[data-testid=local-terminal] .xterm-rows")).toContainText("Local terminal ready");
    expect(calls.filter((c) => c.path.endsWith("/input"))).toHaveLength(delivered);
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/sessions")).toHaveLength(1);
  } finally { await agent.close(); }
});

test("failed continuation preserves readable history and permits retry", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { canFork: true, failStart: true });
  try {
    await openLocalHistory(app);
    await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("Project folder does not exist");
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Continue in Burf", exact: true })).toBeEnabled();
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/conversations/history-1/continue")).toHaveLength(1);
  } finally { await agent.close(); }
});

test("an older CLI keeps history readable but cannot continue it", async ({ app }) => {
  const { agent, calls } = await localFixture(app);
  try {
    await openLocalHistory(app);
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Continue in Burf", exact: true })).toBeDisabled();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  } finally { await agent.close(); }
});

test("terminal reconnect recovers output without starting another agent", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { outputFailOnce: true });
  try {
    await openLocalNewAgent(app);
    await expect(localComposer(app).getByTestId("task-composer-summary")).toContainText("on work-hp · this folder");
    await expect(localComposer(app).getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await localComposer(app).getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("Terminal temporarily unavailable");
    await app.page.getByRole("button", { name: "Reconnect terminal", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toHaveCount(0);
    await expect.poll(async () => app.page.locator("[data-testid=local-terminal] .xterm-rows").innerText()).toContain("Local terminal ready");
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/sessions")).toHaveLength(1);
  } finally { await agent.close(); }
});

test("reconnecting a missing terminal reports the error without recreating its agent", async ({ app }) => {
  const { agent, calls } = await localFixture(app);
  let reads = 0;
  await app.context.route(`${agent.url}/v1/local/sessions/owned-1/output**`, (route) => {
    reads++;
    return route.fulfill({ status: 404, json: { error: "Local session no longer exists" } });
  });
  try {
    await openLocalNewAgent(app);
    await expect(localComposer(app).getByTestId("task-composer-summary")).toContainText("on work-hp · this folder");
    await expect(localComposer(app).getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await localComposer(app).getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("Local session no longer exists");
    await app.page.getByRole("button", { name: "Reconnect terminal", exact: true }).click();
    await expect.poll(() => reads).toBeGreaterThanOrEqual(2);
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("Local session no longer exists");
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/sessions")).toHaveLength(1);
    expect(calls.filter((c) => c.path.endsWith("/fork") || c.path.endsWith("/input"))).toHaveLength(0);
  } finally { await agent.close(); }
});

test("launches and stops only a Burf-owned local terminal", async ({ app }, info) => {
  const { agent, calls } = await localFixture(app);
  try {
    await openLocalNewAgent(app);
    await expect(localComposer(app).getByTestId("task-composer-summary")).toContainText("on work-hp · this folder");
    await enterLocalFolder(app, cwd);
    await expect(app.page.getByLabel("Project directory")).toHaveValue(cwd);
    await expect(localComposer(app).getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await localComposer(app).getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByTestId("local-terminal")).toBeVisible();
    await expect.poll(() => calls.some((c) => c.path.endsWith("/output?after=0"))).toBe(true);
    await expect(app.page.locator("[data-testid=local-terminal] .xterm-rows")).toContainText("Local terminal ready");
    await expect.poll(() => calls.some((c) => c.path.endsWith("/resize"))).toBe(true);
    await app.page.screenshot({ path: info.outputPath("local-terminal.png") });
    await app.page.locator("[data-testid=local-terminal] textarea").fill("hello");
    await expect.poll(() => calls.some((c) => c.path.endsWith("/input"))).toBe(true);
    await app.page.getByRole("button", { name: "Stop agent", exact: true }).click();
    await expect.poll(() => calls.some((c) => c.method === "DELETE" && c.path === "/v1/local/sessions/owned-1")).toBe(true);
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/sessions")).toHaveLength(1);
    expect(calls.find((c) => c.method === "POST" && c.path === "/v1/local/sessions")?.body).toEqual({ agent: "claude", cwd });
  } finally { await agent.close(); }
});

test("local-only computer does not require remote pairing first", async ({ app }) => {
  const { agent } = await localFixture(app, { noBoxes: true });
  try {
    await expect(app.page.getByRole("heading", { name: "work-hp" })).toBeVisible();
    await expect(app.page.getByRole("heading", { name: "Welcome to Burf" })).toHaveCount(0);
    await expect(app.page.getByTestId("nav-local")).toBeVisible();
  } finally { await agent.close(); }
});

test("no installed CLI disables launch without hiding local history", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { available: false });
  try {
    await app.page.getByTestId("nav-local").click();
    await expect(app.page.getByTestId("local-chat-row").filter({ hasText: /Checkout history/i })).toBeVisible();
    await app.page.getByTestId("local-new-agent").click();
    await expect(localComposer(app).getByTestId("task-composer-summary")).toContainText("on work-hp · this folder");
    await expect(localComposer(app).getByRole("button", { name: "Start", exact: true })).toBeDisabled();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  } finally { await agent.close(); }
});

test("failed history scan does not block starting an installed agent", async ({ app }) => {
  const { agent } = await localFixture(app, { failHistory: true });
  try {
    await app.page.getByTestId("nav-local").click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("History scan failed");
    await app.page.getByTestId("local-new-agent").click();
    await expect(localComposer(app).getByTestId("task-composer-summary")).toContainText("on work-hp · this folder");
    await expect(localComposer(app).getByRole("button", { name: "Start", exact: true })).toBeEnabled();
  } finally { await agent.close(); }
});

test("narrow window keeps history readable with chats nested in the sidebar", async ({ app }, info) => {
  await app.page.setViewportSize({ width: 480, height: 800 });
  const { agent } = await localFixture(app);
  try {
    await openLocalHistory(app);
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    expect(await app.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const badge = await app.page.getByText("Read-only", { exact: true }).boundingBox();
    expect(badge && badge.x + badge.width).toBeLessThanOrEqual(480);
    await app.page.screenshot({ path: info.outputPath("local-history-narrow.png") });
    await app.page.getByTestId("local-new-agent").click();
    await expect(localComposer(app)).toBeVisible();
    await expect(app.page.getByTestId("local-chat-row").filter({ hasText: /Checkout history/i })).toBeVisible();
  } finally { await agent.close(); }
});

test("unsupported local hosting stays out of the sidebar", async ({ app }) => {
  const { agent } = await localFixture(app, { supported: false });
  try { await expect(app.page.getByTestId("nav-local")).toHaveCount(0); }
  finally { await agent.close(); }
});

test("unavailable agent cannot start and a failed launch keeps its error", async ({ app }) => {
  const { agent } = await localFixture(app, { failStart: true });
  try {
    await openLocalNewAgent(app);
    await expect(localComposer(app).getByTestId("task-composer-summary")).toContainText("on work-hp · this folder");
    await expandLocalComposer(app);
    await expect(localComposer(app).getByRole("button", { name: "Provider: Claude Code", exact: true })).toBeVisible();
    await expect(app.page.getByRole("menuitemradio", { name: "Codex", exact: true })).toHaveCount(0);
    await enterLocalFolder(app, cwd);
    await expect(localComposer(app).getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await localComposer(app).getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("Project folder does not exist");
    await expect(app.page.getByLabel("Project directory")).toHaveValue(cwd);
  } finally { await agent.close(); }
});

for (const supported of [true, false]) test(`Home offers This computer only when supported: ${supported}`, async ({ app }) => {
  const { agent, calls } = await localFixture(app, { supported });
  try {
    await app.page.getByTestId("nav-home").click();
    const composer = app.page.getByTestId("task-composer");
    const summary = composer.getByTestId("task-composer-summary");
    if (await summary.getAttribute("aria-expanded") === "false") await summary.click();
    if (supported) {
      await composer.getByRole("button", { name: /^Place:/ }).click();
      await expect(app.page.getByRole("menuitemradio", { name: "work-hp · This computer", exact: true })).toBeVisible();
      await expect(app.page.getByRole("menuitemradio", { name: "devl", exact: true })).toBeVisible();
    } else {
      await expect(composer.getByRole("button", { name: /^Place:/ })).toHaveCount(0);
      await expect(composer).not.toContainText("This computer");
    }
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  } finally { await agent.close(); }
});

test("the local project picker lists recent history and live folders newest first", async ({ app }) => {
  const recent = "C:\\Projects\\recent";
  const live = "C:\\Projects\\live";
  const { agent, calls } = await localFixture(app, {
    conversations: [
      { ...conversation, updated_at: "2026-01-01T12:00:00Z" },
      { ...conversation, id: "recent", cwd: recent, updated_at: "2026-01-03T12:00:00Z" },
      { ...conversation, id: "duplicate", cwd, updated_at: "2026-01-02T12:00:00Z" },
    ],
    sessions: [
      { ...session, agent: "claude", state: "running", cwd: live, started_at: "2026-01-04T12:00:00Z" },
      { ...session, id: "exited", agent: "claude", state: "exited", cwd: "C:\\ignored", started_at: "2026-01-05T12:00:00Z" },
    ],
  });
  try {
    const composer = await chooseLocalAtHome(app);
    await expect(composer.getByTestId("task-composer-summary")).toContainText("live on work-hp · this folder · Claude Code");
    await composer.getByRole("button", { name: /^Project:/ }).click();
    await expect(app.page.getByRole("menuitem", { name: "Type folder path…", exact: true })).toBeVisible();
    const folders = app.page.getByRole("menuitemradio");
    await expect(folders).toHaveText([/live/, /recent/, /shop/]);
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  } finally { await agent.close(); }
});

test("a new local task defaults to home without history and offers only installed providers", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { conversations: [] });
  try {
    await openLocalNewAgent(app);
    await expandLocalComposer(app);
    const composer = localComposer(app);
    await expect(composer.getByTestId("task-composer-summary")).toContainText("shop on work-hp · this folder · Claude Code");
    await expect(composer.getByRole("button", { name: "Place: work-hp", exact: true })).toBeVisible();
    await expect(composer.getByRole("button", { name: /^Where:/ })).toHaveCount(0);
    await expect(composer.getByRole("button", { name: "Provider: Claude Code", exact: true })).toBeVisible();
    await expect(app.page.getByRole("menuitemradio", { name: "Codex", exact: true })).toHaveCount(0);
    await expect(app.page.getByRole("button", { name: /Compare agents/ })).toHaveCount(0);
    await app.page.keyboard.press("Escape");
    await enterLocalFolder(app, cwd);
    await expect(app.page.getByLabel("Project directory")).toHaveValue(cwd);
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  } finally { await agent.close(); }
});

test("Home starts Codex in a typed folder with one chat and one first message", async ({ app }) => {
  const typed = "C:\\Projects\\typed-folder";
  const { agent, calls } = await localFixture(app, { agents: [{ id: "codex", available: true, can_chat: true }] });
  try {
    const composer = await chooseLocalAtHome(app);
    await composer.getByRole("button", { name: /^Project:/ }).click();
    await app.page.getByRole("menuitem", { name: "Type folder path…", exact: true }).click();
    await app.page.getByLabel("Project directory").fill(typed);
    await composer.getByRole("textbox", { name: "What should your agents work on?", exact: true }).fill("Fix checkout");
    await expect(composer.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await composer.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByRole("heading", { name: "work-hp", exact: true })).toBeVisible();
    await expect(app.page.getByTestId("local-chat")).toBeVisible();
    await expect(app.page.getByTestId("local-terminal")).toHaveCount(0);
    await expect(app.page.getByText("Structured reply", { exact: true })).toBeVisible();
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/chats")).toEqual([{ method: "POST", path: "/v1/local/chats", body: { cwd: typed } }]);
    expect(calls.filter((c) => c.path.endsWith("/messages"))).toEqual([{ method: "POST", path: "/v1/local/chats/chat-1/messages", body: { text: "Fix checkout" } }]);
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/sessions")).toHaveLength(0);
    expect(calls.filter((c) => c.path.endsWith("/input"))).toHaveLength(0);
  } finally { await agent.close(); }
});

test("Home starts a terminal agent once, types nothing into it, and leaves the prompt on the clipboard", async ({ app }) => {
  const { agent, calls } = await localFixture(app);
  try {
    const composer = await chooseLocalAtHome(app);
    await composer.getByRole("textbox", { name: "What should your agents work on?", exact: true }).fill("Check checkout\nReport results");
    await expect(composer.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await composer.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByRole("heading", { name: "work-hp", exact: true })).toBeVisible();
    await expect(app.page.getByTestId("local-terminal")).toBeVisible();
    await expect(app.page.locator("[data-testid=local-terminal] .xterm-rows")).toContainText("Local terminal ready");
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/sessions")).toEqual([{ method: "POST", path: "/v1/local/sessions", body: { agent: "claude", cwd } }]);
    // What the agent's screen asks as it starts is not known: nothing is
    // typed or confirmed for the person.
    expect(calls.filter((c) => c.path.endsWith("/input"))).toEqual([]);
    await expect(app.page.getByText("Prompt copied: paste it into Claude Code's terminal", { exact: true })).toBeVisible();
    // The composer may normalize the line break when the prompt is copied.
    expect(await app.page.evaluate(() => navigator.clipboard.readText())).toMatch(/^Check checkout[\n ]Report results$/);
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/chats")).toHaveLength(0);
  } finally { await agent.close(); }
});

for (const structured of [true, false]) test(`a failed local start keeps its prompt without retry: structured=${structured}`, async ({ app }) => {
  const { agent, calls } = await localFixture(app, { failStart: true, agents: structured ? [{ id: "codex", available: true, can_chat: true }] : [{ id: "claude", available: true }] });
  try {
    const composer = await chooseLocalAtHome(app);
    const prompt = composer.getByRole("textbox", { name: "What should your agents work on?", exact: true });
    await prompt.fill("Keep this request");
    await expect(composer.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await composer.getByRole("button", { name: "Start", exact: true }).click();
    await expect(composer.getByRole("alert")).toContainText("Project folder does not exist");
    await expect(prompt).toHaveValue("Keep this request");
    await expect(composer.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(calls.filter((c) => c.path.endsWith("/messages") || c.path.endsWith("/input"))).toHaveLength(0);
  } finally { await agent.close(); }
});

for (const structured of [true, false]) test(`a double press starts one local agent: structured=${structured}`, async ({ app }) => {
  let release!: () => void;
  const startGate = new Promise<void>((resolve) => { release = resolve; });
  const { agent, calls } = await localFixture(app, { startGate, agents: structured ? [{ id: "codex", available: true, can_chat: true }] : [{ id: "claude", available: true }] });
  try {
    const composer = await chooseLocalAtHome(app);
    await composer.getByRole("textbox", { name: "What should your agents work on?", exact: true }).fill("Once only");
    const start = composer.getByRole("button", { name: "Start", exact: true });
    await expect(start).toBeEnabled();
    await start.evaluate((button) => { if (button instanceof HTMLButtonElement) { button.click(); button.click(); } });
    await expect(start).toBeDisabled();
    const path = structured ? "/v1/local/chats" : "/v1/local/sessions";
    await expect.poll(() => calls.filter((c) => c.method === "POST" && c.path === path).length).toBe(1);
    release();
    await expect(app.page.getByTestId(structured ? "local-chat" : "local-terminal")).toBeVisible();
    expect(calls.filter((c) => c.method === "POST" && c.path === path)).toHaveLength(1);
    // A structured chat is sent its prompt once; a terminal is typed nothing.
    expect(calls.filter((c) => c.path.endsWith("/messages"))).toHaveLength(structured ? 1 : 0);
    expect(calls.filter((c) => c.path.endsWith("/input"))).toHaveLength(0);
  } finally { release(); await agent.close(); }
});

test("a refused first message keeps the draft and opens the started chat without relaunching", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { failMessage: true, agents: [{ id: "codex", available: true, can_chat: true }] });
  try {
    const composer = await chooseLocalAtHome(app);
    const prompt = composer.getByRole("textbox", { name: "What should your agents work on?", exact: true });
    await prompt.fill("Keep the first message");
    await expect(composer.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await composer.getByRole("button", { name: "Start", exact: true }).click();
    await expect(composer.getByRole("alert")).toContainText("Message refused");
    await expect(prompt).toHaveValue("Keep the first message");
    await expect(composer.getByRole("button", { name: "Start", exact: true })).toBeDisabled();
    await composer.getByRole("button", { name: "Open started chat", exact: true }).click();
    await expect(app.page.getByTestId("local-chat")).toBeVisible();
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/chats")).toHaveLength(1);
    expect(calls.filter((c) => c.path.endsWith("/messages"))).toHaveLength(1);
  } finally { await agent.close(); }
});

test("choosing a local provider replaces the previous provider", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { agents: [{ id: "claude", available: true }, { id: "codex", available: true, can_chat: true }] });
  try {
    const composer = await chooseLocalAtHome(app);
    await expect(composer.getByTestId("task-composer-summary")).toContainText("this folder · Codex");
    await composer.getByRole("button", { name: "Provider: Codex", exact: true }).click();
    await app.page.getByRole("menuitemradio", { name: "Claude Code", exact: true }).click();
    await expect(composer.getByTestId("task-composer-summary")).toContainText("this folder · Claude Code");
    await expect(composer.getByTestId("task-composer-summary")).not.toContainText("Codex");
    await composer.getByRole("button", { name: "Provider: Claude Code", exact: true }).click();
    await expect(app.page.getByRole("menuitemradio", { name: "Claude Code", exact: true })).toBeChecked();
    await expect(app.page.getByRole("button", { name: /Compare agents/ })).toHaveCount(0);
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  } finally { await agent.close(); }
});
