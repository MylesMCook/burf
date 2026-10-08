import { fakeAgent } from "./fake-agent";
import { expect, mockOnly, test, type App } from "./fixtures";

const cwd = "C:\\Projects\\shop";
const conversation = { id: "history-1", source: "codex", title: "Checkout history", cwd, updated_at: "2026-01-01T12:00:00Z", read_only: true };
const session = { id: "owned-1", agent: "claude", cwd, state: "running", started_at: "2026-01-01T12:00:00Z" };

async function localFixture(app: App, options: { supported?: boolean; available?: boolean; canFork?: boolean; failStart?: boolean; noBoxes?: boolean; mobile?: boolean; failHistory?: boolean; outputFailOnce?: boolean; inputFailOnce?: boolean; source?: "claude" | "codex"; forkGate?: Promise<void> } = {}) {
  const agent = await fakeAgent();
  const calls: { method: string; path: string; body: unknown }[] = [];
  let running = true;
  let started = false;
  let outputFailed = false;
  let inputFailed = false;
  let ownedSession = session;
  const history = { ...conversation, source: options.source ?? conversation.source };
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
      started = !options.failStart;
      status = options.failStart ? 400 : 200;
      body = options.failStart ? { error: "Project folder does not exist" } : ownedSession;
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
  return { agent, calls };
}

test.beforeEach(() => mockOnly("isolated local-computer API"));

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
    await expect(app.page.getByText("Earlier request", { exact: true })).toBeVisible();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  } finally { await agent.close(); }
});

test("explicit continuation opens an owned terminal without answering historical permissions", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { canFork: true });
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
    await app.page.getByRole("button", { name: "Continue in Berth", exact: true }).click();
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
    await app.page.getByRole("button", { name: "Continue in Berth", exact: true }).click();
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
    await app.page.getByRole("button", { name: "Continue in Berth", exact: true }).click();
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
    await expect(app.page.getByRole("alert")).toContainText("Terminal input may have arrived");
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
    await app.page.getByRole("button", { name: "Continue in Berth", exact: true }).click();
    await expect(app.page.getByRole("alert")).toContainText("Project folder does not exist");
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Continue in Berth", exact: true })).toBeEnabled();
    expect(calls.filter((c) => c.method === "POST" && c.path.endsWith("/fork"))).toHaveLength(1);
  } finally { await agent.close(); }
});

test("an older CLI keeps history readable but cannot continue it", async ({ app }) => {
  const { agent, calls } = await localFixture(app);
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: /Checkout history/ }).click();
    await expect(app.page.getByText("Saved response", { exact: true })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Continue in Berth", exact: true })).toBeDisabled();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  } finally { await agent.close(); }
});

test("terminal reconnect recovers output without starting another agent", async ({ app }) => {
  const { agent, calls } = await localFixture(app, { outputFailOnce: true });
  try {
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: "New agent", exact: true }).click();
    await app.page.getByRole("button", { name: "Start agent", exact: true }).click();
    await expect(app.page.getByRole("alert")).toContainText("Terminal temporarily unavailable");
    await app.page.getByRole("button", { name: "Reconnect terminal", exact: true }).click();
    await expect(app.page.locator("[data-testid=local-terminal] .xterm-rows")).toContainText("Local terminal ready");
    expect(calls.filter((c) => c.method === "POST" && c.path === "/v1/local/sessions")).toHaveLength(1);
  } finally { await agent.close(); }
});

test("launches and stops only a Berth-owned local terminal", async ({ app }, info) => {
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
    await expect(app.page.getByRole("heading", { name: "Welcome to Berth" })).toHaveCount(0);
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
    await expect(app.page.getByRole("alert")).toContainText("History scan failed");
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
    await expect(app.page.getByRole("alert")).toContainText("Project folder does not exist");
    await expect(app.page.getByLabel("Project directory")).toHaveValue(cwd);
  } finally { await agent.close(); }
});
