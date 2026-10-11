import { fakeAgent } from "./fake-agent";
import { expect, mockOnly, test, type App } from "./fixtures";

const cwd = "C:\\Projects\\shop";
const conversation = { id: "history-1", source: "codex" as const, title: "Checkout history", cwd, updated_at: "2026-01-01T12:00:00Z", read_only: true as const, can_continue: true };
const session: { id: string; agent: "claude" | "codex"; cwd: string; state: "starting" | "running" | "idle" | "waiting" | "exited"; started_at: string; mode?: "chat" } = { id: "owned-1", agent: "claude", cwd, state: "running", started_at: "2026-01-01T12:00:00Z" };

async function localFixture(app: App, options: { theme?: string; name?: string; home?: string; structuredContinue?: boolean; supported?: boolean; available?: boolean; canFork?: boolean; continueReason?: string; failStart?: boolean; noBoxes?: boolean; mobile?: boolean; failHistory?: boolean; outputUnavailable?: boolean; inputFailOnce?: boolean; source?: "claude" | "codex"; forkGate?: Promise<void>; forkResponseFailOnce?: boolean; forkError?: { status: number; message: string }; forkErrorOnce?: boolean; messageResponseFailOnce?: boolean; hideRecoverySession?: boolean; agents?: { id: "claude" | "codex"; available: boolean; can_terminal?: boolean; can_chat?: boolean; can_fork?: boolean }[]; conversations?: (Omit<typeof conversation, "source"> & { source: "claude" | "codex" })[]; sessions?: (typeof session)[]; startGate?: Promise<void>; failMessage?: boolean; chatOptions?: boolean; firstTurnRunning?: boolean } = {}) {
  const agent = await fakeAgent();
  const calls: { method: string; path: string; body: unknown }[] = [];
  let running = true;
  let started = false;
  let outputUnavailable = options.outputUnavailable ?? false;
  let inputFailed = false;
  let forkResponseFailed = false;
  let continuationRefused = false;
  let messageResponseFailed = false;
  let launches = 0;
  let ownedSession: typeof session = { ...session, agent: "claude", state: "running" };
  let chat: (typeof session & { thread_id: string; composer?: boolean; permissions?: string[]; history_id?: string; history_before?: number; items: { id: string; kind: string; text: string }[]; approvals: never[] }) | undefined;
  const history = { ...conversation, source: options.source ?? conversation.source, can_continue: !options.continueReason, continue_reason: options.continueReason };
  if (options.noBoxes) await app.context.route(`${agent.url}/v1/status`, (route) => route.fulfill({ json: { boxes: [], forwards: [], routes: [], proxy: { port: 1377, url_port: 1377 } } }));
  await app.context.route(`${agent.url}/v1/local**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    calls.push({ method: req.method(), path: url.pathname + url.search, body: req.postDataJSON() });
    let body: unknown;
    let status = 200;
    if (url.pathname === "/v1/local") body = { client_scope: "fixture-owner", supported: options.supported ?? true, name: options.name ?? "work-hp", home: options.home ?? cwd, agents: options.agents ?? [{ id: "claude", available: options.available ?? true, can_fork: options.canFork ?? false, can_continue_chat: options.structuredContinue }, { id: "codex", available: options.canFork ?? false, can_fork: options.canFork ?? false, can_continue_chat: options.structuredContinue }], sessions: [...(options.sessions ?? []), ...(started && !options.hideRecoverySession ? [{ ...ownedSession, state: running ? ownedSession.state : "exited" }] : [])] };
    else if (url.pathname === "/v1/local/conversations") { status = options.failHistory ? 500 : 200; body = options.failHistory ? { error: "History scan failed" } : options.conversations ?? [history]; }
    else if (url.pathname === "/v1/local/conversations/history-1") body = url.searchParams.has("before") && url.searchParams.get("before") !== "500"
      ? { items: [{ kind: "user", id: "older", off: 0, text: "Earlier request" }], more: false, start: 0 }
      : { items: [{ kind: "user", id: "u1", off: 100, text: "My saved request" }, { kind: "text", id: "a1", off: 200, text: "Saved response" }, { kind: "ask", id: "ask1", off: 300, tool: "Run", detail: "Historical permission", choices: [{ key: "yes", label: "Allow" }] }], more: true, start: 100 };
    else if ((url.pathname === "/v1/local/sessions" || url.pathname === "/v1/local/chats" || url.pathname === "/v1/local/conversations/history-1/fork" || url.pathname === "/v1/local/conversations/history-1/continue") && req.method() === "POST") {
      if ((url.pathname.endsWith("/fork") || url.pathname.endsWith("/continue"))) {
        ownedSession = { ...session, agent: history.source };
        if (options.forkGate) await options.forkGate;
      }
      if (url.pathname === "/v1/local/sessions") ownedSession = { ...ownedSession, agent: req.postDataJSON().agent, cwd: req.postDataJSON().cwd };
      if (url.pathname === "/v1/local/chats") {
        chat = { ...ownedSession, id: "chat-1", agent: "codex", mode: "chat", cwd: req.postDataJSON().cwd, state: "idle", thread_id: "thread-1", items: [], approvals: [], ...(options.chatOptions ? { composer: true, permissions: ["strict", "read-only", "workspace"] } : {}) };
        ownedSession = chat;
      }
      if (url.pathname.endsWith("/continue")) {
        chat = { ...ownedSession, id: "chat-1", agent: history.source, mode: "chat", state: "idle", history_id: history.id, history_before: 500, thread_id: "independent-fork", items: [], approvals: [] };
        ownedSession = chat;
      }
      if (options.startGate) await options.startGate;
      const failure = (url.pathname.endsWith("/fork") || url.pathname.endsWith("/continue")) && !(options.forkErrorOnce && continuationRefused) ? options.forkError : undefined;
      if (failure) continuationRefused = true;
      if (!options.failStart && !failure) {
        if (!started) launches++;
        started = true;
      }
      status = failure?.status ?? (options.failStart ? 400 : 200);
      body = failure ? { error: failure.message } : options.failStart ? { error: "Project folder does not exist" } : ownedSession;
      if ((url.pathname.endsWith("/fork") || url.pathname.endsWith("/continue")) && options.forkResponseFailOnce && !forkResponseFailed) {
        forkResponseFailed = true;
        await route.abort("connectionreset");
        return;
      }
    } else if (url.pathname === "/v1/local/chats/chat-1/models" && options.chatOptions) body = [{ model: "fixture-model", displayName: "Fixture model", defaultReasoningEffort: "high", supportedReasoningEfforts: [{ reasoningEffort: "high" }] }];
    else if (url.pathname === "/v1/local/chats/chat-1/messages" && req.method() === "POST" && chat) {
      if (options.failMessage) { status = 400; body = { error: "Message refused" }; }
      else {
        if (options.firstTurnRunning) chat.state = !chat.items.length ? "running" : "idle";
        chat.items = [{ id: "u1", kind: "user", text: req.postDataJSON().text }, { id: "a1", kind: "assistant", text: "Structured reply" }]; body = {};
        if (options.messageResponseFailOnce && !messageResponseFailed) { messageResponseFailed = true; await route.abort("connectionreset"); return; }
      }
    } else if (url.pathname === "/v1/local/chats/chat-1" && chat) body = chat;
    else if (url.pathname.endsWith("/input") && options.inputFailOnce && !inputFailed) {
      inputFailed = true;
      await route.abort("connectionreset");
      return;
    } else if (url.pathname.endsWith("/output")) {
      if (outputUnavailable) { status = 503; body = { error: "Terminal temporarily unavailable" }; }
      else body = { data: url.searchParams.get("after") === "0" ? Buffer.from("Local terminal ready\r\n").toString("base64") : "", next: 22, reset: false, state: running ? "running" : "exited" };
    }
    else if (req.method() === "DELETE") { running = false; body = {}; }
    else body = {};
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  await app.open({ agent, theme: options.theme });
  if (options.mobile) await app.page.getByRole("button", { name: "Hide the sidebar", exact: true }).click();
  return { agent, calls, launches: () => launches, restoreOutput: () => { outputUnavailable = false; }, finishTurn: () => { if (chat) chat.state = "idle"; } };
}

async function expandComposer(app: App) {
  const summary = app.page.getByTestId("task-composer-summary");
  await expect(summary).toHaveAccessibleName(new RegExp("Project: .* on work-hp.*Folder:"));
  if (await summary.getAttribute("aria-expanded") === "false") await summary.click();
}

test("Agents separates local installation from chat support without a paired computer", async ({ app }) => {
  mockOnly("local agent capabilities without launching a provider");
  const { agent, calls } = await localFixture(app, { noBoxes: true, agents: [
    { id: "codex", available: true, can_chat: true },
    { id: "claude", available: true, can_terminal: true },
  ] });
  try {
    const settings = await app.openSettings("agents");
    await expect(settings.getByRole("columnheader", { name: "This computer", exact: true })).toBeVisible();
    const codex = settings.getByRole("row").filter({ has: app.page.getByText("Codex", { exact: true }) });
    await expect(codex).toContainText("Installed");
    await expect(codex).toContainText("Chat supported");
    const claude = settings.getByRole("row").filter({ has: app.page.getByText("Claude Code", { exact: true }) });
    await expect(claude).toContainText("Installed");
    await expect(claude).toContainText("Terminal only");
    const gemini = settings.getByRole("row").filter({ has: app.page.getByText("Gemini CLI", { exact: true }) });
    await expect(gemini).toContainText("Status unavailable");
    expect(calls.filter((call) => call.method === "POST")).toEqual([]);
  } finally { await agent.close(); }
});

test("unsupported local terminal continuation stays readable with a visible reason", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { agents: [{ id: "codex", available: true, can_fork: true, can_chat: false, can_terminal: false }] });
  try {
    await app.page.getByRole("button", { name: "Checkout history", exact: true }).click();
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    const action = app.page.getByRole("button", { name: "Continue in Burf", exact: true });
    await expect(action).toBeDisabled();
    await expect(action).toHaveAccessibleDescription("This computer cannot start a terminal continuation for this provider.");
    expect(calls.filter((call) => call.method === "POST")).toEqual([]);
  } finally { await agent.close(); }
});

async function enterFolder(app: App, path: string) {
  await expandComposer(app);
  await app.page.getByTestId("task-composer").getByRole("button", { name: /^Project:/ }).click();
  await app.page.getByRole("menuitem", { name: "Type folder path…", exact: true }).click();
  await app.page.getByLabel("Project directory").fill(path);
}

async function chooseLocalAtHome(app: App) {
  await app.page.getByTestId("nav-home").click();
  const composer = app.page.getByTestId("task-composer");
  const summary = composer.getByTestId("task-composer-summary");
  if (await summary.getAttribute("aria-expanded") === "false") await summary.click();
  await composer.getByRole("button", { name: /^Place:/ }).click();
  await app.page.getByRole("menuitemradio", { name: "work-hp · This computer", exact: true }).click();
  await expect(composer.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("on work-hp"));
  return composer;
}

test.beforeEach(() => mockOnly("isolated local-computer API"));

for (const source of ["codex", "claude"] as const) test(`${source} history continues in an independent structured chat`, async ({ app }) => {
  const { agent, calls, launches } = await localFixture(app, { source, canFork: true, structuredContinue: true });
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: "Checkout history", exact: true }).click();
    const history = app.page.getByTestId("local-history");
    const continuation = history.getByRole("region", { name: "Continue this conversation", exact: true });
    await expect(continuation).toContainText("Sending starts an independent chat");
    const draft = history.getByRole("textbox", { name: `Message ${source === "codex" ? "Codex" : "Claude Code"}`, exact: true });
    await expect(draft).toBeFocused();
    await draft.fill("New question");
    expect(calls.filter((call) => call.method === "POST")).toEqual([]);
    await history.getByRole("button", { name: "Send message", exact: true }).click();
    const chat = app.page.getByTestId("local-chat");
    await expect(chat).toBeVisible();
    await expect(chat.getByText("Saved response", { exact: true })).toBeVisible();
    await expect(chat.getByText("Structured reply", { exact: true })).toBeVisible();
    expect(calls.filter((c) => c.path.endsWith("/continue"))).toHaveLength(1);
    expect(calls.filter((c) => c.path.endsWith("/fork"))).toHaveLength(0);
    expect(calls.filter((c) => c.path.endsWith("/messages"))).toHaveLength(1);
    expect(calls.some((c) => c.path === "/v1/local/conversations/history-1?before=500")).toBe(true);
    await app.page.getByRole("button", { name: "Checkout history", exact: true }).click();
    await expect(app.page.getByTestId("local-history").getByText("Saved response", { exact: true })).toBeVisible();
    expect(launches()).toBe(1);
  } finally { await agent.close(); }
});

async function refuseDraftStorage(app: App, stage: "journal" | "transfer") {
  await app.page.evaluate((stage) => {
    const original = Storage.prototype.setItem;
    Reflect.set(window, "restoreDraftStorage", () => { Storage.prototype.setItem = original; });
    Storage.prototype.setItem = function (key, value) {
      const drafts = key === "berth.workspaces" ? JSON.parse(value).localChatDrafts ?? {} : {};
      const hasTarget = Object.keys(drafts).some((key) => JSON.parse(key)[1] === "chat-1");
      if (key === "berth.workspaces" && (stage === "journal" || hasTarget)) throw new DOMException("Synthetic storage refusal", "QuotaExceededError");
      original.call(this, key, value);
    };
  }, stage);
}

async function restoreDraftStorage(app: App) {
  await app.page.evaluate(() => { const restore = Reflect.get(window, "restoreDraftStorage"); if (typeof restore === "function") restore(); });
}

test("refused history journal keeps input and launches nothing until an explicit saved retry", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { canFork: true, structuredContinue: true });
  try {
    await app.page.getByRole("button", { name: "Checkout history", exact: true }).click();
    const history = app.page.getByTestId("local-history");
    const input = history.getByRole("textbox");
    await input.fill("Keep this draft when storage is full");
    await refuseDraftStorage(app, "journal");
    await history.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(history).toContainText("Burf could not save the chat draft");
    await expect(history).toContainText("Keep this window open");
    await expect(input).toHaveValue("Keep this draft when storage is full");
    expect(calls.filter((call) => call.path.endsWith("/continue") || call.path.endsWith("/messages"))).toEqual([]);
    await restoreDraftStorage(app);
    await history.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(app.page.getByTestId("local-chat").getByText("Structured reply", { exact: true })).toBeVisible();
    expect(calls.filter((call) => call.path.endsWith("/continue"))).toHaveLength(1);
    expect(calls.filter((call) => call.path.endsWith("/messages"))).toHaveLength(1);
  } finally { await restoreDraftStorage(app); await agent.close(); }
});

test("refused history transfer preserves its source journal and recovers without sending", async ({ app }) => {
  let release!: () => void;
  const forkGate = new Promise<void>((resolve) => { release = resolve; });
  const { agent, calls } = await localFixture(app, { canFork: true, structuredContinue: true, forkGate });
  try {
    await app.page.getByRole("button", { name: "Checkout history", exact: true }).click();
    const history = app.page.getByTestId("local-history");
    const input = history.getByRole("textbox");
    await input.fill("First held message");
    await refuseDraftStorage(app, "transfer");
    await history.getByRole("button", { name: "Send message", exact: true }).click();
    await expect.poll(() => calls.filter((call) => call.path.endsWith("/continue")).length).toBe(1);
    await input.fill("Following held text");
    release();
    await expect(history).toContainText("Burf could not save the chat draft");
    await expect(input).toHaveValue("First held message\n\nFollowing held text");
    await expect(history.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
    await expect.poll(() => app.stored("berth.workspaces")).toEqual(expect.objectContaining({ localChatDrafts: expect.objectContaining({
      [JSON.stringify(["fixture-owner", "history:history-1", "codex", cwd, "saved-history"])]: expect.objectContaining({ text: "Following held text", launch: expect.any(String), pending: expect.objectContaining({ text: "First held message" }) }),
    }) }));
    await history.getByRole("button", { name: "Find started chat", exact: true }).click();
    await expect(history.getByRole("region", { name: "Continue this conversation", exact: true })).toContainText("Burf could not save the chat draft");
    await expect(input).toHaveValue("First held message\n\nFollowing held text");
    await expect(app.page.getByTestId("local-chat")).toHaveCount(0);
    expect(calls.filter((call) => call.path.endsWith("/continue"))).toHaveLength(1);
    expect(calls.filter((call) => call.path.endsWith("/messages"))).toHaveLength(0);
    await restoreDraftStorage(app);
    await history.getByRole("button", { name: "Find started chat", exact: true }).click();
    const chat = app.page.getByTestId("local-chat");
    await expect(chat.getByRole("textbox")).toHaveValue("First held message\n\nFollowing held text");
    expect(calls.filter((call) => call.path.endsWith("/messages"))).toHaveLength(0);
    await chat.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(chat.getByText("Structured reply", { exact: true })).toBeVisible();
    expect(calls.filter((call) => call.path.endsWith("/continue"))).toHaveLength(1);
    expect(calls.filter((call) => call.path.endsWith("/messages"))).toHaveLength(1);
  } finally { release(); await restoreDraftStorage(app); await agent.close(); }
});

test("history first Send journals the draft before launch and preserves following text", async ({ app }) => {
  let release!: () => void;
  const forkGate = new Promise<void>((resolve) => { release = resolve; });
  const { agent, calls } = await localFixture(app, { canFork: true, structuredContinue: true, forkGate });
  try {
    await app.page.getByRole("button", { name: "Checkout history", exact: true }).click();
    const history = app.page.getByTestId("local-history");
    const input = history.getByRole("textbox", { name: "Message Codex", exact: true });
    await input.fill("First explicit message");
    await history.getByRole("button", { name: "Send message", exact: true }).evaluate((button) => { if (button instanceof HTMLButtonElement) { button.click(); button.click(); } });
    await expect.poll(() => calls.filter((call) => call.path.endsWith("/continue")).length).toBe(1);
    await expect.poll(() => app.stored("berth.workspaces")).toEqual(expect.objectContaining({ localChatDrafts: expect.objectContaining({
      [JSON.stringify(["fixture-owner", "history:history-1", "codex", cwd, "saved-history"])]: expect.objectContaining({ launch: expect.any(String), pending: expect.objectContaining({ text: "First explicit message" }) }),
    }) }));
    await input.fill("Following draft");
    release();
    const chat = app.page.getByTestId("local-chat");
    await expect(chat.getByText("Structured reply", { exact: true })).toBeVisible();
    await expect(chat.getByRole("textbox")).toHaveValue("Following draft");
    expect(calls.filter((call) => call.path.endsWith("/continue"))).toHaveLength(1);
    expect(calls.filter((call) => call.path.endsWith("/messages"))).toEqual([expect.objectContaining({ body: { text: "First explicit message" } })]);
  } finally { release(); await agent.close(); }
});

test("a definite history launch rejection keeps a retryable draft", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { canFork: true, structuredContinue: true, forkError: { status: 400, message: "Project folder does not exist" }, forkErrorOnce: true });
  try {
    await app.page.getByRole("button", { name: "Checkout history", exact: true }).click();
    const history = app.page.getByTestId("local-history");
    const input = history.getByRole("textbox");
    await input.fill("Retry this message");
    await history.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(history).toContainText("Project folder does not exist");
    await expect(input).toHaveValue("Retry this message");
    await expect(history.getByRole("button", { name: "Send message", exact: true })).toBeEnabled();
    expect(calls.filter((call) => call.path.endsWith("/messages"))).toHaveLength(0);
    await history.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(app.page.getByTestId("local-chat").getByText("Structured reply", { exact: true })).toBeVisible();
    expect(calls.filter((call) => call.path.endsWith("/continue"))).toHaveLength(2);
    expect(calls.filter((call) => call.path.endsWith("/messages"))).toHaveLength(1);
  } finally { await agent.close(); }
});

test("a crashed history launch journal restores held text once before the composer saves", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { canFork: true, structuredContinue: true });
  try {
    await app.page.evaluate(({ folder }) => {
      const current = JSON.parse(localStorage.getItem("berth.workspaces") ?? "{}");
      const key = JSON.stringify(["fixture-owner", "history:history-1", "codex", folder, "saved-history"]);
      current.localChatDrafts = { ...current.localChatDrafts, [key]: { text: "Following draft", options: {}, queue: [], launch: "unfinished-launch", pending: { id: "unfinished-launch", text: "Possibly launched", options: {} } } };
      localStorage.setItem("berth.workspaces", JSON.stringify(current));
    }, { folder: cwd });
    await app.page.reload();
    await app.page.getByRole("button", { name: "Checkout history", exact: true }).click();
    let history = app.page.getByTestId("local-history");
    await expect(history.getByRole("textbox")).toHaveValue("Possibly launched\n\nFollowing draft");
    await expect(history.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
    await app.page.getByTestId("nav-home").click();
    await app.page.getByRole("button", { name: "Checkout history", exact: true }).click();
    history = app.page.getByTestId("local-history");
    await expect(history.getByRole("textbox")).toHaveValue("Possibly launched\n\nFollowing draft");
    expect(calls.filter((call) => call.method === "POST")).toEqual([]);
  } finally { await agent.close(); }
});

for (const missing of [false, true]) test(`a lost history launch response holds the draft across reopening and ${missing ? "never relaunches without a matching session" : "recovers without sending"}`, async ({ app }) => {
  const { agent, calls } = await localFixture(app, { canFork: true, structuredContinue: true, forkResponseFailOnce: true, hideRecoverySession: missing });
  try {
    await app.page.getByRole("button", { name: "Checkout history", exact: true }).click();
    let history = app.page.getByTestId("local-history");
    await history.getByRole("textbox").fill("Held continuation message");
    await history.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(history).toContainText("A continuation may have started");
    await expect(history.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
    await app.page.getByTestId("nav-home").click();
    await app.page.reload();
    await app.page.getByRole("button", { name: "Checkout history", exact: true }).click();
    history = app.page.getByTestId("local-history");
    await expect(history.getByRole("textbox")).toHaveValue("Held continuation message");
    await expect(history.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
    await history.getByRole("button", { name: "Find started chat", exact: true }).click();
    if (missing) {
      await expect(history).toContainText("No matching chat was found");
      await expect(history.getByRole("textbox")).toHaveValue("Held continuation message");
      await expect(history.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
    } else {
      const chat = app.page.getByTestId("local-chat");
      await expect(chat.getByRole("textbox")).toHaveValue("Held continuation message");
      await expect(chat).toContainText("nothing was resent automatically");
    }
    expect(calls.filter((call) => call.path.endsWith("/continue"))).toHaveLength(1);
    expect(calls.filter((call) => call.path.endsWith("/messages"))).toHaveLength(0);
  } finally { await agent.close(); }
});

for (const uncertain of [false, true]) test(`history first-message ${uncertain ? "response loss" : "rejection"} keeps held text without replay`, async ({ app }) => {
  const { agent, calls } = await localFixture(app, { canFork: true, structuredContinue: true, failMessage: !uncertain, messageResponseFailOnce: uncertain });
  try {
    await app.page.getByRole("button", { name: "Checkout history", exact: true }).click();
    const history = app.page.getByTestId("local-history");
    await history.getByRole("textbox").fill("Keep this first message");
    await history.getByRole("button", { name: "Send message", exact: true }).click();
    const chat = app.page.getByTestId("local-chat");
    await expect(chat.getByRole("textbox")).toHaveValue("Keep this first message");
    await expect(chat).toContainText(uncertain ? "The request may have arrived" : "Message refused");
    await chat.getByRole("button", { name: "Refresh chat", exact: true }).click();
    expect(calls.filter((call) => call.path.endsWith("/continue"))).toHaveLength(1);
    expect(calls.filter((call) => call.path.endsWith("/messages"))).toHaveLength(1);
    await app.page.getByRole("button", { name: "Checkout history", exact: true }).click();
    await expect(app.page.getByTestId("local-history").getByText("Saved response", { exact: true })).toBeVisible();
    expect(calls.filter((call) => call.path.endsWith("/messages"))).toHaveLength(1);
  } finally { await agent.close(); }
});

test("local sidebar can be searched and folded with the keyboard", async ({ app }) => {
  const { agent } = await localFixture(app);
  try {
    const row = app.page.getByTestId("nav-local");
    const history = app.page.getByRole("button", { name: "Checkout history", exact: true });
    await expect(history).toBeVisible();
    await row.focus();
    await row.press("ArrowLeft");
    await expect(history).toBeHidden();
    await row.press("ArrowRight");
    await expect(history).toBeVisible();
    await app.page.getByRole("textbox", { name: "Search local conversations" }).fill("no match");
    await expect(history).toBeHidden();
    await app.page.getByRole("textbox", { name: "Search local conversations" }).fill("shop");
    await history.click();
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    await row.click();
    await expect(app.page.getByTestId("local-history")).toBeHidden();
  } finally { await agent.close(); }
});

test("local sidebar groups owned sessions and saved projects with provider and date", async ({ app }) => {
  const otherFolder = "C:\\Projects\\notes";
  const { agent, calls } = await localFixture(app, { sessions: [session], conversations: [
    conversation,
    { ...conversation, id: "history-2", title: "Writing history", cwd: otherFolder, source: "claude", updated_at: "2026-02-02T12:00:00Z" },
  ] });
  try {
    await expect(app.page.getByRole("region", { name: "Started in Burf", exact: true })).toBeVisible();
    const saved = app.page.getByRole("region", { name: "Existing conversations", exact: true });
    const shop = saved.getByRole("region", { name: cwd, exact: true });
    const notes = saved.getByRole("region", { name: otherFolder, exact: true });
    const machine = app.page.getByTestId("nav-local");
    await expect(machine).toHaveAttribute("data-sidebar", "menu-button");
    await expect(machine).toHaveAccessibleName("This computer: work-hp");
    const summary = shop.locator("summary");
    const summaryBounds = await summary.boundingBox();
    const folderBounds = await summary.locator("svg.lucide-folder").boundingBox();
    const labelBounds = await summary.getByText("shop", { exact: true }).boundingBox();
    if (!summaryBounds || !folderBounds || !labelBounds) throw new Error("The saved project's disclosure has no bounds.");
    expect(summaryBounds.height).toBeLessThanOrEqual(30);
    const middle = summaryBounds.y + summaryBounds.height / 2;
    expect(Math.abs(folderBounds.y + folderBounds.height / 2 - middle)).toBeLessThanOrEqual(1);
    expect(Math.abs(labelBounds.y + labelBounds.height / 2 - middle)).toBeLessThanOrEqual(1);
    await summary.focus();
    await summary.press("Enter");
    await expect(shop.getByRole("button", { name: "Checkout history", exact: true })).toBeHidden();
    await summary.press("Space");
    await expect(shop.getByRole("button", { name: "Checkout history", exact: true })).toBeVisible();
    await expect(shop.getByRole("button", { name: "Checkout history", exact: true })).toHaveAccessibleDescription(/Codex/);
    await expect(shop.locator("time")).toHaveAttribute("datetime", conversation.updated_at);
    await expect(notes.getByRole("button", { name: "Writing history", exact: true })).toHaveAccessibleDescription(/Claude Code/);
    await expect(notes.locator("time")).toHaveAttribute("datetime", "2026-02-02T12:00:00Z");
    const search = app.page.getByRole("textbox", { name: "Search local conversations", exact: true });
    await search.fill("claude");
    await expect(shop).toHaveCount(0);
    await expect(notes).toBeVisible();
    await search.fill("2026-01-01");
    await expect(shop).toBeVisible();
    await expect(notes).toHaveCount(0);
    await search.fill("no match");
    await expect(app.page.getByRole("status").filter({ hasText: "No matching conversations." })).toBeVisible();
    expect(calls.filter((call) => call.method !== "GET")).toEqual([]);
  } finally { await agent.close(); }
});

test("local sidebar disclosure is a keyboard button and does not navigate", async ({ app }) => {
  const { agent, calls } = await localFixture(app);
  try {
    await expect(app.page.getByRole("button", { name: "Checkout history", exact: true })).toBeVisible();
    const disclosure = app.page.getByRole("button", { name: "Hide local conversations", exact: true });
    await disclosure.focus();
    await disclosure.press("Enter");
    const show = app.page.getByRole("button", { name: "Show local conversations", exact: true });
    await expect(show).toBeFocused();
    await expect(show).toHaveAttribute("aria-expanded", "false");
    await expect(app.page.getByRole("button", { name: "Checkout history", exact: true })).toBeHidden();
    await show.press("Space");
    await expect(app.page.getByRole("button", { name: "Checkout history", exact: true })).toBeVisible();
    await expect(app.page.getByTestId("local-history")).toHaveCount(0);
    await expect(app.page.getByTestId("nav-local")).not.toHaveAttribute("aria-current", "page");
    expect(calls.filter((call) => call.method !== "GET")).toEqual([]);
  } finally { await agent.close(); }
});

for (const theme of ["light", "dark"]) test(`history composer remains visible at the foot of a long ${theme} thread`, async ({ app }) => {
  await app.page.setViewportSize({ width: 900, height: 560 });
  const { agent, calls } = await localFixture(app, { canFork: true, structuredContinue: true, theme: `berth-${theme}` });
  await app.context.route(`${agent.url}/v1/local/conversations/history-1`, (route) => route.fulfill({ json: {
    items: Array.from({ length: 40 }, (_, index) => ({ id: `message-${index}`, kind: index % 2 ? "text" : "user", text: `Saved message ${index}` })), more: false,
  } }));
  try {
    await expect(app.page.locator("html")).toHaveClass(theme === "dark" ? /(^|\s)dark(\s|$)/ : /^(?!.*(^|\s)dark(\s|$))/);
    await app.page.getByRole("button", { name: "Checkout history", exact: true }).click();
    const history = app.page.getByTestId("local-history");
    const footer = history.locator(".aui-thread-viewport-footer");
    const action = footer.getByRole("textbox", { name: "Message Codex", exact: true });
    await expect(action).toBeInViewport();
    await expect(footer.getByRole("region", { name: "Continue this conversation", exact: true })).toContainText("The saved conversation stays unchanged.");
    await history.locator('[data-slot="aui_thread-viewport"]').evaluate((viewport) => { viewport.scrollTop = 0; });
    await expect(action).toBeInViewport();
    await expect(history.locator(".aui-thread-root")).toHaveCount(1);
    expect(calls.filter((call) => call.method !== "GET")).toEqual([]);
  } finally { await agent.close(); }
});

test("an unpaired Mac opens local messages directly and sends once", async ({ app }) => {
  const macFolder = "/Users/example/project";
  const { agent, calls } = await localFixture(app, {
    name: "myles-macbook-pro", home: macFolder, conversations: [],
    agents: [{ id: "codex", available: true, can_chat: true, can_terminal: false }],
  });
  try {
    await app.page.getByTestId("nav-local").click();
    const composer = app.page.getByTestId("task-composer");
    await expect(composer.getByRole("textbox")).toBeVisible();
    await expect(composer.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("project on myles-macbook-pro · Codex"));
    await expect(app.page.getByRole("dialog")).toHaveCount(0);
    await expect(app.page.getByText("Local agents are unavailable on this computer.", { exact: true })).toHaveCount(0);
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
    await composer.getByRole("textbox").fill("Test local messages");
    await expect(composer.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await composer.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByTestId("local-chat").getByText("Structured reply", { exact: true })).toBeVisible();
    expect(calls.filter((call) => call.method === "POST" && call.path === "/v1/local/chats")).toEqual([{ method: "POST", path: "/v1/local/chats", body: { cwd: macFolder } }]);
    expect(calls.filter((call) => call.path.endsWith("/messages"))).toEqual([{ method: "POST", path: "/v1/local/chats/chat-1/messages", body: { text: "Test local messages" } }]);
    expect(calls.filter((call) => call.path === "/v1/local/sessions")).toHaveLength(0);
    expect(agent.calls.filter((c) => c.startsWith("POST /v1/boxes/local"))).toHaveLength(0);
  } finally { await agent.close(); }
});

test("local entry keeps the loaded machine when a later capability read fails", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { conversations: [], agents: [{ id: "codex", available: true, can_chat: true }] });
  try {
    await app.context.route(`${agent.url}/v1/local`, async (route) => {
      if (await app.page.getByRole("heading", { name: "work-hp", exact: true }).count()) return route.fulfill({ status: 503, json: { error: "Capability read unavailable" } });
      return route.fallback();
    });
    await app.page.getByTestId("nav-local").click();
    const composer = app.page.getByTestId("task-composer");
    await expect(composer.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("on work-hp · Codex"));
    await expect(composer.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await expect(app.page.getByRole("dialog")).toHaveCount(0);
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
  } finally { await agent.close(); }
});

for (const reason of [
  "Its folder, shop, is a relative path. Use a full folder path to continue here.",
  "Its folder, /Users/example/shop, uses a path for another operating system.",
  `Its folder, ${cwd}, is not on this computer.`,
  `Its path, ${cwd}, is a file, not a folder.`,
]) {
  test(`unavailable history stays readable without a launch: ${reason}`, async ({ app }) => {
    const { agent, calls } = await localFixture(app, { canFork: true, continueReason: reason });
    try {
      await app.page.getByTestId("nav-local").click();
      await app.page.getByRole("button", { name: /Checkout history/ }).click();
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
    await app.page.getByTestId("nav-local").click();
    await listed;
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Continue in Burf", exact: true })).toBeEnabled();
  } finally { await agent.close(); }
});

test("a folder removed after listing gives a plain launch error and keeps history readable", async ({ app }) => {
  const reason = `Its folder, ${cwd}, is not on this computer.`;
  const { agent, calls } = await localFixture(app, { canFork: true, forkError: { status: 400, message: reason } });
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
    await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText(reason);
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    expect(calls.filter((c) => c.method === "POST" && c.path.endsWith("/fork"))).toHaveLength(1);
  } finally { await agent.close(); }
});

test("a history tool step with artifact-looking text draws no artifact card", async ({ app }) => {
  const { agent, calls } = await localFixture(app);
  const text = "Artifact 1a2b3c4d5e v1 · chart · Someone else's chart";
  await app.context.route(`${agent.url}/v1/local/conversations/history-1`, (route) => route.fulfill({ json: {
    items: [{ kind: "user", id: "u1", text: "Read the notes" }, { kind: "tools", id: "tool-1", verb: "Run", items: [{ id: "call-1", verb: "Run", target: text }], done: true }], more: false,
  } }));
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
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
    await app.page.getByTestId("nav-local").click();
    await expect(app.page.getByRole("heading", { name: "work-hp" })).toBeVisible();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
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
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
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
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
    const start = app.page.getByRole("button", { name: "Continue in Burf", exact: true });
    await expect(start).toBeEnabled();
    await start.evaluate((button) => { if (button instanceof HTMLButtonElement) { button.click(); button.click(); } });
    await expect(app.page.getByRole("button", { name: "Starting...", exact: true })).toBeDisabled();
    await expect.poll(() => calls.filter((c) => c.path.endsWith("/fork")).length).toBe(1);
    release();
    await expect(app.page.getByTestId("local-terminal")).toBeVisible();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
    await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
    await expect(app.page.getByTestId("local-terminal")).toBeVisible();
    expect(calls.filter((c) => c.path.endsWith("/fork"))).toHaveLength(2);
    expect(launches()).toBe(1);
    expect(new Set(calls.filter((c) => c.path.includes("/output?")).map((c) => c.path.split("/output?")[0]))).toEqual(new Set(["/v1/local/sessions/owned-1"]));
  } finally { release(); await agent.close(); }
});

test("an interrupted continuation response is uncertain and refresh finds its owned session without replay", async ({ app }, info) => {
  const { agent, calls, launches } = await localFixture(app, { canFork: true, forkResponseFailOnce: true });
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
    await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("The agent may have started");
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    await app.page.screenshot({ path: info.outputPath("continuation-uncertain.png") });
    await app.page.getByRole("button", { name: "Refresh local conversations", exact: true }).click();
    await app.page.getByRole("button", { name: /^Codex.*running$/ }).click();
    await expect(app.page.locator("[data-testid=local-terminal] .xterm-rows")).toContainText("Local terminal ready");
    expect(calls.filter((c) => c.path.endsWith("/fork"))).toHaveLength(1);
    expect(calls.filter((c) => c.path.endsWith("/input"))).toHaveLength(0);
    expect(launches()).toBe(1);
  } finally { await agent.close(); }
});

for (const reason of ["Local conversation no longer exists", "Local conversation was replaced"]) {
  test(`refused continuation keeps readable history: ${reason}`, async ({ app }) => {
    const { agent, calls, launches } = await localFixture(app, { canFork: true, forkError: { status: 404, message: reason } });
    try {
      await app.page.getByTestId("nav-local").click();
      await app.page.getByRole("button", { name: /Checkout history/ }).click();
      await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
      await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText(reason);
      await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
      await app.page.getByRole("button", { name: "Refresh local conversations", exact: true }).click();
      expect(calls.filter((c) => c.path.endsWith("/fork"))).toHaveLength(1);
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
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
    await expect.poll(() => pending).toBe(true);
    await app.page.getByRole("button", { name: /Second history/ }).click();
    await expect(app.page.getByText("Second saved response", { exact: true })).toBeVisible();
    release();
    await expect(app.page.getByRole("heading", { name: "Second history", exact: true })).toBeVisible();
    await expect(app.page.getByText("Old late response", { exact: true })).toHaveCount(0);
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  } finally { release(); await agent.close(); }
});

test("explicit continuation opens an owned terminal without answering historical permissions", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { canFork: true });
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
    await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
    await expect(app.page.getByTestId("local-terminal")).toBeVisible();
    await expect(app.page.getByRole("heading", { name: "Codex", exact: true })).toBeVisible();
    await expect(app.page.locator("[data-testid=local-terminal] .xterm-rows")).toContainText("Local terminal ready");
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/conversations/history-1/fork")).toHaveLength(1);
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/sessions")).toHaveLength(0);
  } finally { await agent.close(); }
});

test("Claude continuation uses the selected history source", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { source: "claude", canFork: true });
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
    await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
    await expect(app.page.getByTestId("local-terminal")).toBeVisible();
    await expect(app.page.getByRole("heading", { name: "Claude Code", exact: true })).toBeVisible();
    expect(calls.filter((c) => c.method === "POST" && c.path.endsWith("/fork"))).toHaveLength(1);
    expect(calls.filter((c) => c.path.endsWith("/input"))).toHaveLength(0);
  } finally { await agent.close(); }
});

test("leaving a pending continuation keeps the newly selected view", async ({ app }) => {
  let release!: () => void;
  const forkGate = new Promise<void>((resolve) => { release = resolve; });
  const { agent, calls } = await localFixture(app, { canFork: true, forkGate });
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
    await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
    await expect.poll(() => calls.filter((c) => c.path.endsWith("/fork")).length).toBe(1);
    await app.page.getByRole("button", { name: "New chat", exact: true }).click();
    await expect(app.page.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("on work-hp"));
    release();
    await expect(app.page.getByTestId("task-composer").getByRole("textbox")).toBeVisible();
    await expect(app.page.getByRole("dialog")).toHaveCount(0);
    await expect(app.page.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("on work-hp"));
    await expect(app.page.getByTestId("local-terminal")).toHaveCount(0);
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/sessions")).toHaveLength(0);
  } finally { release(); await agent.close(); }
});

test("lost input response warns of uncertain delivery and reconnect never replays it", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { inputFailOnce: true });
  try {
    await app.page.getByTestId("nav-local").click();
    await expect(app.page.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("on work-hp"));
    await expect(app.page.getByTestId("task-composer").getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await app.page.getByTestId("task-composer").getByRole("button", { name: "Start", exact: true }).click();
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
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
    await app.page.getByRole("button", { name: "Continue in Burf", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("Project folder does not exist");
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Continue in Burf", exact: true })).toBeEnabled();
    expect(calls.filter((c) => c.method === "POST" && c.path.endsWith("/fork"))).toHaveLength(1);
  } finally { await agent.close(); }
});

test("an older CLI keeps history readable but cannot continue it", async ({ app }) => {
  const { agent, calls } = await localFixture(app);
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    const action = app.page.getByRole("button", { name: "Continue in Burf", exact: true });
    await expect(action).toBeDisabled();
    await expect(action).toHaveAccessibleDescription("Installed CLI does not support continuing a copy.");
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  } finally { await agent.close(); }
});

test("terminal reconnect recovers output without starting another agent", async ({ app }) => {
  const { agent, calls, restoreOutput } = await localFixture(app, { outputUnavailable: true });
  try {
    await app.page.getByTestId("nav-local").click();
    await expect(app.page.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("on work-hp"));
    await expect(app.page.getByTestId("task-composer").getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await app.page.getByTestId("task-composer").getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("Terminal temporarily unavailable");
    restoreOutput();
    await app.page.getByRole("button", { name: "Reconnect terminal", exact: true }).click();
    await expect(app.page.locator("[data-testid=local-terminal] .xterm-rows")).toContainText("Local terminal ready");
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
    await app.page.getByTestId("nav-local").click();
    await expect(app.page.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("on work-hp"));
    await expect(app.page.getByTestId("task-composer").getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await app.page.getByTestId("task-composer").getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("Local session no longer exists");
    const beforeReconnect = reads;
    await app.page.getByRole("button", { name: "Reconnect terminal", exact: true }).click();
    await expect.poll(() => reads).toBe(beforeReconnect + 1);
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("Local session no longer exists");
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/sessions")).toHaveLength(1);
    expect(calls.filter((c) => c.path.endsWith("/fork") || c.path.endsWith("/input"))).toHaveLength(0);
  } finally { await agent.close(); }
});

test("launches and stops only a Burf-owned local terminal", async ({ app }, info) => {
  const { agent, calls } = await localFixture(app);
  try {
    await app.page.getByTestId("nav-local").click();
    await expect(app.page.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("on work-hp"));
    await enterFolder(app, cwd);
    await expect(app.page.getByLabel("Project directory")).toHaveValue(cwd);
    await expect(app.page.getByTestId("task-composer").getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await app.page.getByTestId("task-composer").getByRole("button", { name: "Start", exact: true }).click();
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
    await expect(app.page.getByRole("button", { name: /Checkout history/ })).toBeVisible();
    await expect(app.page.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("on work-hp"));
    await expect(app.page.getByTestId("task-composer").getByRole("button", { name: "Start: No installed agent available", exact: true })).toBeDisabled();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  } finally { await agent.close(); }
});

test("failed history scan does not block starting an installed agent", async ({ app }) => {
  const { agent } = await localFixture(app, { failHistory: true });
  try {
    await app.page.getByTestId("nav-local").click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("History scan failed");
    await expect(app.page.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("on work-hp"));
    await expect(app.page.getByTestId("task-composer").getByRole("button", { name: "Start", exact: true })).toBeEnabled();
  } finally { await agent.close(); }
});

test("narrow window can return from history to its local conversation list", async ({ app }, info) => {
  await app.page.setViewportSize({ width: 480, height: 800 });
  const { agent } = await localFixture(app, { mobile: true });
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    expect(await app.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const badge = await app.page.getByText("Read-only", { exact: true }).boundingBox();
    expect(badge && badge.x + badge.width).toBeLessThanOrEqual(480);
    await app.page.screenshot({ path: info.outputPath("local-history-narrow.png") });
    await app.page.getByRole("button", { name: "Conversations", exact: true }).click();
    await expect(app.page.getByRole("button", { name: /Checkout history/ })).toBeVisible();
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
    await app.page.getByTestId("nav-local").click();
    await expect(app.page.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("on work-hp"));
    await expandComposer(app);
    await app.page.getByTestId("task-composer").getByRole("button", { name: "Provider: Claude Code", exact: true }).click();
    await expect(app.page.getByRole("menuitemradio", { name: "Codex", exact: true })).toHaveCount(0);
    await expect(app.page.getByRole("menuitemradio", { name: "Claude Code", exact: true })).toBeVisible();
    await app.page.keyboard.press("Escape");
    await enterFolder(app, cwd);
    await expect(app.page.getByTestId("task-composer").getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await app.page.getByTestId("task-composer").getByRole("button", { name: "Start", exact: true }).click();
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
    await expect(composer.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("live on work-hp · Claude Code"));
    await composer.getByRole("button", { name: /^Project:/ }).click();
    const folders = app.page.getByRole("menuitemradio");
    await expect(folders).toHaveText([/live/, /recent/, /shop/]);
    await expect(folders.nth(0)).toContainText(live);
    await expect(folders.nth(1)).toContainText(recent);
    await expect(folders.nth(2)).toContainText(cwd);
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  } finally { await agent.close(); }
});

test("a new local task defaults to home without history and offers only installed providers", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { conversations: [] });
  try {
    await app.page.getByTestId("nav-local").click();
    await expandComposer(app);
    const composer = app.page.getByTestId("task-composer");
    await expect(composer.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("shop on work-hp · Claude Code"));
    await expect(composer.getByRole("button", { name: "Place: work-hp · This computer", exact: true })).toBeVisible();
    await expect(composer.getByRole("button", { name: /^Where:/ })).toHaveCount(0);
    await composer.getByRole("button", { name: "Provider: Claude Code", exact: true }).click();
    await expect(app.page.getByRole("menuitemradio")).toHaveText(["Claude Code"]);
    await expect(app.page.getByRole("menuitem", { name: /Compare agents/ })).toHaveCount(0);
    await app.page.keyboard.press("Escape");
    await enterFolder(app, cwd);
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
    expect(await app.page.evaluate(() => navigator.clipboard.readText())).toBe("Check checkout\nReport results");
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

for (const uncertain of [false, true]) for (const edited of [false, true]) test(`a first-message ${uncertain ? "lost response" : "refusal"} survives opening its started chat${edited ? " after editing" : ""} without replay`, async ({ app }) => {
  const { agent, calls } = await localFixture(app, { failMessage: !uncertain, messageResponseFailOnce: uncertain, agents: [{ id: "codex", available: true, can_chat: true }] });
  try {
    const composer = await chooseLocalAtHome(app);
    const prompt = composer.getByRole("textbox", { name: "What should your agents work on?", exact: true });
    await prompt.fill("Keep the first message");
    await expect(composer.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
    await composer.getByRole("button", { name: "Start", exact: true }).click();
    await expect(composer.getByRole("alert")).toContainText(uncertain ? "The request may have arrived" : "Message refused");
    await expect(prompt).toHaveValue("Keep the first message");
    await expect(composer.getByRole("button", { name: "Start: Open the agent already started", exact: true })).toBeDisabled();
    if (edited) await prompt.fill("Edited first message");
    const recovered = edited ? uncertain ? "Keep the first message\n\nEdited first message" : "Edited first message" : "Keep the first message";
    await composer.getByRole("button", { name: "Open started chat", exact: true }).click();
    const chat = app.page.getByTestId("local-chat");
    await expect(chat).toBeVisible();
    await expect(chat.getByRole("textbox", { name: "Message Codex", exact: true })).toHaveValue(recovered);
    await expect(chat).toContainText(uncertain ? "The request may have arrived" : "Message refused");
    await chat.getByRole("button", { name: "Refresh chat", exact: true }).click();
    await expect(chat.getByRole("textbox", { name: "Message Codex", exact: true })).toHaveValue(recovered);
    await app.page.getByTestId("nav-local").click();
    await app.page.getByTestId("sidebar").getByRole("button", { name: /^Codex .*idle$/ }).click();
    await expect(app.page.getByTestId("local-chat").getByRole("textbox", { name: "Message Codex", exact: true })).toHaveValue(recovered);
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/chats")).toHaveLength(1);
    expect(calls.filter((c) => c.path.endsWith("/messages"))).toHaveLength(1);
  } finally { await agent.close(); }
});

test("choosing a local provider replaces the previous provider", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { agents: [{ id: "claude", available: true }, { id: "codex", available: true, can_chat: true }] });
  try {
    const composer = await chooseLocalAtHome(app);
    await expect(composer.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("on work-hp · Codex"));
    await composer.getByRole("button", { name: "Provider: Codex", exact: true }).click();
    await app.page.getByRole("menuitemradio", { name: "Claude Code", exact: true }).click();
    await expect(composer.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("on work-hp · Claude Code"));
    await expect(composer.getByTestId("task-composer-summary")).not.toHaveAccessibleName(new RegExp("Codex"));
    await composer.getByRole("button", { name: "Provider: Claude Code", exact: true }).click();
    await expect(app.page.getByRole("menuitemradio", { checked: true })).toHaveText("Claude Code");
    await expect(app.page.getByRole("menuitem", { name: /Compare agents/ })).toHaveCount(0);
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  } finally { await agent.close(); }
});


test("Agents opens the existing local composer with the selected chat provider without launching it", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { noBoxes: true, agents: [
    { id: "claude", available: true, can_chat: true },
    { id: "codex", available: true, can_chat: true },
  ] });
  try {
    const settings = await app.openSettings("agents");
    await settings.getByRole("button", { name: "Start chat with Claude Code on This computer", exact: true }).click();
    const dialog = app.page.getByRole("dialog");
    await expect(dialog.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("on work-hp · Claude Code"));
    await expect(dialog.getByRole("textbox", { name: "What should your agents work on?", exact: true })).toBeFocused();
    expect(calls.filter((call) => call.method === "POST")).toEqual([]);
    await app.page.keyboard.press("Escape");
    await expect(settings).toBeVisible();
    await expect(settings.getByRole("button", { name: "Start chat with Claude Code on This computer", exact: true })).toBeFocused();
  } finally { await agent.close(); }
});

test("a missing local CLI gives provider installation guidance without an install or chat action", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { noBoxes: true, agents: [{ id: "codex", available: false, can_chat: true }] });
  try {
    const settings = await app.openSettings("agents");
    const row = settings.getByRole("row").filter({ has: app.page.getByText("Codex", { exact: true }) });
    await expect(row).toContainText("Not installed");
    await expect(row).toContainText("Install Codex and sign in on This computer.");
    await expect(row.getByRole("button", { name: "Codex installation guide for This computer", exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: /Start chat/ })).toHaveCount(0);
    expect(calls.filter((call) => call.method === "POST")).toEqual([]);
  } finally { await agent.close(); }
});

test("Agents pins a paired chat to its computer and main checkout despite a remembered different project", async ({ app }) => {
  const { agent, calls } = await localFixture(app);
  try {
    await app.context.route(`${agent.url}/v1/boxes/devl/api/info`, (route) => route.fulfill({ json: { name: "devl", agents: [{ id: "claude", name: "Claude Code", command: "claude" }], capabilities: ["chat.claude"] } }));
    await app.context.route(`${agent.url}/v1/status`, (route) => route.fulfill({ json: { boxes: ["devl", "other"].map((name) => ({ name, state: "online", address: "fixture", fingerprint: "fixture" })), forwards: [], routes: [], proxy: { port: 1377, url_port: 1377 } } }));
    await app.context.route(`${agent.url}/v1/boxes/other/api/**`, (route) => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith("/locations") ? [{ name: "elsewhere", path: "/other", repo: true, worktrees: [{ name: "elsewhere", main: true, path: "/other", branch: "main" }] }] : new URL(route.request().url()).pathname.endsWith("/info") ? { name: "other", agents: [{ id: "claude", name: "Claude Code", command: "claude" }], capabilities: ["chat.claude"] } : [] }));
    // Reopening reconnects the isolated fixture so the declared capabilities load.
    await app.context.addInitScript(() => localStorage.setItem("berth.newWorktree.project.v2", JSON.stringify("name:elsewhere")));
    await app.page.reload();
    const settings = await app.openSettings("agents");
    await settings.getByRole("button", { name: "Start chat with Claude Code on devl", exact: true }).click();
    const dialog = app.page.getByRole("dialog");
    await expect(dialog.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("shop on devl · main checkout · Claude Code"));
    expect(agent.calls.filter((call) => /^(POST|PUT|DELETE) .*\/(sessions|chats)(\/|$)/.test(call))).toEqual([]);
    expect(calls.filter((call) => call.method === "POST")).toEqual([]);
  } finally { await agent.close(); }
});


test("a chat-capable paired computer without projects offers Add project before Start chat", async ({ app }) => {
  const { agent, calls } = await localFixture(app);
  try {
    await app.context.route(`${agent.url}/v1/boxes/devl/api/info`, (route) => route.fulfill({ json: { name: "devl", agents: [{ id: "claude", name: "Claude Code", command: "claude" }], capabilities: ["chat.claude"] } }));
    await app.context.route(`${agent.url}/v1/boxes/devl/api/locations`, (route) => route.fulfill({ json: [] }));
    await app.page.reload();
    const settings = await app.openSettings("agents");
    const start = settings.getByRole("button", { name: "Start chat with Claude Code on devl", exact: true });
    await expect(start).toBeDisabled();
    await expect(start).toHaveAccessibleDescription("Add a project on devl first.");
    await settings.getByRole("button", { name: "Add a project on devl for Claude Code", exact: true }).click();
    await expect(app.page.getByRole("dialog")).toContainText("devl");
    expect(calls.filter((call) => call.method === "POST")).toEqual([]);
    expect(agent.calls.filter((call) => /^(POST|PUT|DELETE) .*\/(sessions|chats|locations)(\/|$)/.test(call))).toEqual([]);
  } finally { await agent.close(); }
});


test("a local Start chat entry never offers remote work while local status reloads", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { agents: [{ id: "claude", available: true, can_chat: true }] });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  try {
    const settings = await app.openSettings("agents");
    const start = settings.getByRole("button", { name: "Start chat with Claude Code on This computer", exact: true });
    await expect(start).toBeVisible();
    await app.context.route(`${agent.url}/v1/local`, async (route) => { await gate; await route.fallback(); });
    await start.click();
    const dialog = app.page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText("shop on devl");
    await expect(dialog.getByRole("button", { name: /^Start(?::|$)/, disabled: false })).toHaveCount(0);
    expect(agent.calls.filter((call) => /^(POST|PUT|DELETE) .*\/(sessions|chats)(\/|$)/.test(call))).toEqual([]);
    release();
    await expect(dialog.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("on work-hp · Claude Code"));
    expect(calls.filter((call) => call.method === "POST")).toEqual([]);
  } finally { release(); await agent.close(); }
});

// Accepted native feedback: computer, folder, provider, then Start; changing a
// folder is directly reachable and retains the task draft.
test("local task entry exposes folder editing in computer-first order", async ({ app }) => {
  const local = await localFixture(app, { noBoxes: true, conversations: [], agents: [{ id: "codex", available: true, can_chat: true }] });
  try {
    await app.page.getByTestId("nav-local").click();
    const composer = app.page.getByTestId("task-composer");
    await composer.getByTestId("task-composer-summary").click();
    const field = composer.getByRole("textbox", { name: "What should your agents work on?" });
    await field.fill("Keep this draft while changing the folder");
    const names = await composer.locator('[data-slot="launch-toolbar"] button').evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") || button.textContent?.trim() || ""));
    expect(names.filter((name) => /^(Place|Project|Provider):/.test(name)).map((name) => name.split(":")[0])).toEqual(["Place", "Project", "Provider"]);
    await composer.getByRole("button", { name: "Change folder", exact: true }).click();
    const folder = composer.getByRole("textbox", { name: "Project directory" });
    await expect(folder).toBeFocused();
    await folder.fill("C:\\Projects\\other");
    await expect(field).toHaveValue("Keep this draft while changing the folder");
    await expect(composer.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("other on work-hp"));
    expect(local.calls.filter((call) => call.method === "POST")).toEqual([]);
    } finally { await local.agent.close(); }
});

test("local Chat options opens the shared composer and holds its draft until explicit send", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { chatOptions: true, agents: [{ id: "codex", available: true, can_chat: true }] });
  try {
    const composer = await chooseLocalAtHome(app);
    await composer.getByRole("textbox", { name: "What should your agents work on?", exact: true }).fill("Choose options before this first message");
    await composer.getByRole("button", { name: "Chat options", exact: true }).click();
    const chat = app.page.getByTestId("local-chat");
    await expect(chat).toBeVisible();
    await expect(chat.getByRole("textbox", { name: "Message Codex", exact: true })).toHaveValue("Choose options before this first message");
    await expect(chat.getByLabel("Chat model")).toBeEnabled();
    await chat.getByLabel("Chat model").click();
    await app.page.getByRole("option", { name: "Fixture model", exact: true }).click();
    await chat.getByLabel("Chat model").click();
    await app.page.getByRole("radiogroup", { name: "Chat reasoning" }).getByRole("radio", { name: "high", exact: true }).click();
    await chat.getByLabel("Chat permissions").click();
    await app.page.getByRole("option", { name: "Edit workspace", exact: true }).click();
    expect(calls.filter((call) => call.method === "POST" && call.path === "/v1/local/chats")).toHaveLength(1);
    expect(calls.filter((call) => call.path.endsWith("/messages"))).toEqual([]);
    await chat.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(app.page.getByText("Structured reply", { exact: true })).toBeVisible();
    expect(calls.filter((call) => call.path.endsWith("/messages"))).toEqual([{ method: "POST", path: "/v1/local/chats/chat-1/messages", body: { text: "Choose options before this first message", options: { model: "fixture-model", effort: "high", permission: "workspace" } } }]);
  } finally { await agent.close(); }
});


for (const viewport of [{ width: 1386, height: 892 }, { width: 860, height: 640 }]) test(`long project pickers retain their glyphs and Send inset at ${viewport.width}px`, async ({ app }) => {
  const name = "now-watching-imessage-with-a-long-project-name-that-needs-to-truncate";
  const { agent, calls } = await localFixture(app, { home: "C:\\Projects\\" + name, conversations: [], agents: [{ id: "codex", available: true, can_chat: true }] });
  try {
    await app.page.setViewportSize(viewport);
    await app.page.getByTestId("nav-local").click();
    await expandComposer(app);
    const composer = app.page.getByTestId("task-composer");
    const project = composer.getByRole("button", { name: "Project: " + name, exact: true });
    await expect(project).toBeVisible();
    const bounds = await project.evaluate((button) => {
      const box = button.getBoundingClientRect();
      const label = button.querySelector('[data-slot="picker-label"]');
      if (!(label instanceof HTMLElement)) throw new Error("Picker label missing");
      return { clipped: label.scrollWidth > label.clientWidth + 1, content: [...button.querySelectorAll('svg, [data-slot="picker-label"]')].map((node) => { const r = node.getBoundingClientRect(); return { left: r.left - box.left, right: box.right - r.right, top: r.top - box.top, bottom: box.bottom - r.bottom }; }) };
    });
    expect(bounds.clipped).toBe(true);
    expect(bounds.content).toHaveLength(3);
    for (const part of bounds.content) for (const gap of Object.values(part)) expect(gap).toBeGreaterThanOrEqual(-0.5);
    const frame = await composer.boundingBox();
    const send = await composer.getByRole("button", { name: "Start", exact: true }).boundingBox();
    expect(frame).not.toBeNull(); expect(send).not.toBeNull();
    expect(frame!.x + frame!.width - send!.x - send!.width).toBeGreaterThanOrEqual(4);
    expect(frame!.y + frame!.height - send!.y - send!.height).toBeGreaterThanOrEqual(4);
    await composer.getByTestId("task-composer-summary").click();
    await expect(composer.locator('[data-slot="composer-toolbar"]')).toBeHidden();
    const collapsed = await composer.boundingBox();
    const collapsedSend = await composer.getByRole("button", { name: "Start", exact: true }).boundingBox();
    if (!collapsed || !collapsedSend) throw new Error("The collapsed task entry has no bounds.");
    expect(collapsed.x + collapsed.width - collapsedSend.x - collapsedSend.width).toBeGreaterThanOrEqual(4);
    expect(collapsed.y + collapsed.height - collapsedSend.y - collapsedSend.height).toBeGreaterThanOrEqual(4);
    expect(calls.filter((call) => call.method === "POST")).toEqual([]);
  } finally { await agent.close(); }
});

test("successful initial local Start releases a follow-up queued during its working turn", async ({ app }) => {
  const f = await localFixture(app, { firstTurnRunning: true, agents: [{ id: "codex", available: true, can_chat: true }] });
  try {
    const composer = await chooseLocalAtHome(app);
    await composer.getByRole("textbox", { name: "What should your agents work on?", exact: true }).fill("Initial task");
    await composer.getByRole("button", { name: "Start", exact: true }).click();
    const chat = app.page.getByTestId("local-chat");
    await expect(chat.getByRole("status", { name: "Chat status", exact: true })).toHaveText("Working");
    await chat.getByRole("textbox", { name: "Message Codex", exact: true }).fill("Queued follow-up");
    await chat.getByRole("button", { name: "Queue message", exact: true }).click();
    await expect(chat.locator('[data-slot="message-queue"]').getByText("Queued follow-up", { exact: true })).toBeVisible();
    expect(f.calls.filter((call) => call.path.endsWith("/messages"))).toHaveLength(1);
    f.finishTurn();
    await chat.getByRole("button", { name: "Refresh chat", exact: true }).click();
    await expect.poll(() => f.calls.filter((call) => call.path.endsWith("/messages")).map((call) => call.body)).toEqual([{ text: "Initial task" }, { text: "Queued follow-up" }]);
    await expect(chat.locator('[data-slot="message-queue"]')).toHaveCount(0);
    expect(f.calls.filter((call) => call.method === "POST" && call.path === "/v1/local/chats")).toHaveLength(1);
  } finally { await f.agent.close(); }
});
