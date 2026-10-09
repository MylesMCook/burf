import { fakeAgent } from "./fake-agent";
import { expect, mockOnly, test, type App } from "./fixtures";

const cwd = "C:\\Projects\\shop";
const conversation = { id: "history-1", source: "codex", title: "Checkout history", cwd, updated_at: "2026-01-01T12:00:00Z", read_only: true, can_continue: true };
const session = { id: "owned-1", agent: "claude", cwd, state: "running", started_at: "2026-01-01T12:00:00Z" };

async function localFixture(app: App, options: { supported?: boolean; available?: boolean; canFork?: boolean; continueReason?: string; failStart?: boolean; noBoxes?: boolean; mobile?: boolean; failHistory?: boolean; outputFailOnce?: boolean; inputFailOnce?: boolean; source?: "claude" | "codex"; forkGate?: Promise<void>; forkResponseFailOnce?: boolean; forkError?: { status: number; message: string } } = {}) {
  const agent = await fakeAgent();
  const calls: { method: string; path: string; body: unknown }[] = [];
  let running = true;
  let started = false;
  let outputFailed = false;
  let inputFailed = false;
  let forkResponseFailed = false;
  let launches = 0;
  let ownedSession = session;
  const history = { ...conversation, source: options.source ?? conversation.source, can_continue: !options.continueReason, continue_reason: options.continueReason };
  if (options.noBoxes) await app.context.route(`${agent.url}/v1/status`, (route) => route.fulfill({ json: { boxes: [], forwards: [], routes: [], proxy: { port: 1377, url_port: 1377 } } }));
  await app.context.route(`${agent.url}/v1/local**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    calls.push({ method: req.method(), path: url.pathname + url.search, body: req.postDataJSON() });
    let body: unknown;
    let status = 200;
    if (url.pathname === "/v1/local") body = { supported: options.supported ?? true, name: "work-hp", home: cwd, agents: [{ id: "claude", available: options.available ?? true, can_fork: options.canFork ?? false }, { id: "codex", available: options.canFork ?? false, can_fork: options.canFork ?? false }], sessions: started ? [{ ...ownedSession, state: running ? "running" : "exited" }] : [] };
    else if (url.pathname === "/v1/local/conversations") { status = options.failHistory ? 500 : 200; body = options.failHistory ? { error: "History scan failed" } : [history]; }
    else if (url.pathname === "/v1/local/conversations/history-1") body = url.searchParams.has("before")
      ? { items: [{ kind: "user", id: "older", off: 0, text: "Earlier request" }], more: false, start: 0 }
      : { items: [{ kind: "user", id: "u1", off: 100, text: "My saved request" }, { kind: "text", id: "a1", off: 200, text: "Saved response" }, { kind: "ask", id: "ask1", off: 300, tool: "Run", detail: "Historical permission", choices: [{ key: "yes", label: "Allow" }] }], more: true, start: 100 };
    else if ((url.pathname === "/v1/local/sessions" || url.pathname === "/v1/local/conversations/history-1/fork") && req.method() === "POST") {
      if (url.pathname.endsWith("/fork")) {
        ownedSession = { ...session, agent: history.source };
        if (options.forkGate) await options.forkGate;
      }
      const failure = url.pathname.endsWith("/fork") ? options.forkError : undefined;
      if (!options.failStart && !failure) {
        if (!started) launches++;
        started = true;
      }
      status = failure?.status ?? (options.failStart ? 400 : 200);
      body = failure ? { error: failure.message } : options.failStart ? { error: "Project folder does not exist" } : ownedSession;
      if (url.pathname.endsWith("/fork") && options.forkResponseFailOnce && !forkResponseFailed) {
        forkResponseFailed = true;
        await route.abort("connectionreset");
        return;
      }
    } else if (url.pathname.endsWith("/input") && options.inputFailOnce && !inputFailed) {
      inputFailed = true;
      await route.abort("connectionreset");
      return;
    } else if (url.pathname.endsWith("/output")) {
      if (options.outputFailOnce && !outputFailed) { outputFailed = true; status = 503; body = { error: "Terminal temporarily unavailable" }; }
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
    await app.page.getByRole("button", { name: "Load older messages" }).click();
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

test("repeated continuation clicks and returning to history reuse the owned session", async ({ app }) => {
  let release!: () => void;
  const forkGate = new Promise<void>((resolve) => { release = resolve; });
  const { agent, calls, launches } = await localFixture(app, { canFork: true, forkGate });
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
    const start = app.page.getByRole("button", { name: "Continue in Burf", exact: true });
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
    await app.page.getByRole("button", { name: "New agent", exact: true }).click();
    release();
    await expect(app.page.getByRole("heading", { name: "New local agent" })).toBeVisible();
    await expect(app.page.getByTestId("local-terminal")).toHaveCount(0);
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/sessions")).toHaveLength(0);
  } finally { release(); await agent.close(); }
});

test("lost input response warns of uncertain delivery and reconnect never replays it", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { inputFailOnce: true });
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: "New agent", exact: true }).click();
    await app.page.getByRole("button", { name: "Start agent", exact: true }).click();
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
    await expect(app.page.getByRole("button", { name: "Continue in Burf", exact: true })).toBeDisabled();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  } finally { await agent.close(); }
});

test("terminal reconnect recovers output without starting another agent", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { outputFailOnce: true });
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: "New agent", exact: true }).click();
    await app.page.getByRole("button", { name: "Start agent", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("Terminal temporarily unavailable");
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
    await app.page.getByRole("button", { name: "New agent", exact: true }).click();
    await app.page.getByRole("button", { name: "Start agent", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("Local session no longer exists");
    await app.page.getByRole("button", { name: "Reconnect terminal", exact: true }).click();
    await expect.poll(() => reads).toBe(2);
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("Local session no longer exists");
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/sessions")).toHaveLength(1);
    expect(calls.filter((c) => c.path.endsWith("/fork") || c.path.endsWith("/input"))).toHaveLength(0);
  } finally { await agent.close(); }
});

test("launches and stops only a Burf-owned local terminal", async ({ app }, info) => {
  const { agent, calls } = await localFixture(app);
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: "New agent", exact: true }).click();
    await expect(app.page.getByLabel("Project directory")).toHaveValue(cwd);
    await app.page.getByRole("button", { name: "Start agent", exact: true }).click();
    await expect(app.page.getByTestId("local-terminal")).toBeVisible();
    await expect.poll(() => calls.some((c) => c.path.endsWith("/output?after=0"))).toBe(true);
    await expect(app.page.locator("[data-testid=local-terminal] .xterm-rows")).toContainText("Local terminal ready");
    await expect.poll(() => calls.some((c) => c.path.endsWith("/resize"))).toBe(true);
    await app.page.screenshot({ path: info.outputPath("local-terminal.png") });
    await app.page.locator("[data-testid=local-terminal] textarea").fill("hello");
    await expect.poll(() => calls.some((c) => c.path.endsWith("/input"))).toBe(true);
    await app.page.getByRole("button", { name: "Stop agent", exact: true }).click();
    await expect.poll(() => calls.some((c) => c.method === "DELETE" && c.path === "/v1/local/sessions/owned-1")).toBe(true);
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
    await app.page.getByRole("button", { name: "New agent", exact: true }).click();
    await expect(app.page.getByRole("button", { name: "Start agent", exact: true })).toBeDisabled();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  } finally { await agent.close(); }
});

test("failed history scan does not block starting an installed agent", async ({ app }) => {
  const { agent } = await localFixture(app, { failHistory: true });
  try {
    await app.page.getByTestId("nav-local").click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("History scan failed");
    await app.page.getByRole("button", { name: "New agent", exact: true }).click();
    await expect(app.page.getByRole("button", { name: "Start agent", exact: true })).toBeEnabled();
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
    await app.page.getByRole("button", { name: "New agent", exact: true }).click();
    await expect(app.page.getByRole("option", { name: "Codex (not installed)" })).toHaveJSProperty("disabled", true);
    await app.page.getByRole("button", { name: "Start agent", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("Project folder does not exist");
    await expect(app.page.getByLabel("Project directory")).toHaveValue(cwd);
  } finally { await agent.close(); }
});
