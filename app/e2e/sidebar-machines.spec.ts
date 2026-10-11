import { fakeAgent } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

test.beforeEach(() => mockOnly("isolated sidebar machines"));

test("sidebar discovery opens the existing tailnet flow without pairing a machine", async ({ app }) => {
  await app.open();
  await app.page.getByRole("button", { name: "Discover or pair a computer", exact: true }).click();
  const dialog = app.page.getByRole("dialog", { name: "Add a box", exact: true });
  await expect(dialog.getByText("build-01", { exact: true })).toBeVisible();
  await expect(dialog.getByPlaceholder("berth://…  paste the link it printed")).toBeVisible();
  await app.page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(app.page.getByRole("button", { name: "Discover or pair a computer", exact: true })).toBeFocused();
});

test("every paired computer opens its projects without changing saved filters", async ({ app }) => {
  const agent = await fakeAgent();
  try {
    await app.context.addInitScript(() => localStorage.setItem("berth.worktrees.hiddenBoxes", JSON.stringify(["devl"])));
    await app.context.route(`${agent.url}/v1/boxes/devl/api/worktrees`, (route) => route.fulfill({ json: [{ name: "fix", location: "shop", path: "/w/shop-fix", branch: "fix", behind: 0, changed: 0, untracked: 0 }] }));
    await app.open({ agent });
    await app.page.getByRole("button", { name: "Open computer devl", exact: true }).click();
    await expect(app.page.getByRole("heading", { name: "Worktrees on devl", exact: true })).toBeVisible();
    await expect(app.page.getByRole("option", { name: "fix", exact: true })).toBeVisible();
    expect(await app.stored("berth.worktrees.hiddenBoxes")).toEqual(["devl"]);
    await app.page.getByRole("button", { name: "Open computer devl", exact: true }).focus();
    await app.page.keyboard.press("Shift+F10");
    await app.page.getByRole("menuitem", { name: /Add a project/ }).click();
    await expect(app.page.getByRole("dialog")).toBeVisible();
    await expect(app.page.getByRole("dialog")).toContainText("devl");
  } finally { await agent.close(); }
});

test("a shared checkout path keeps each chat on its own machine", async ({ app }) => {
  const agent = await fakeAgent();
  try {
    await app.context.route(`${agent.url}/v1/status`, (route) => route.fulfill({ json: {
      boxes: ["left", "right"].map((name) => ({ name, state: "online", address: "fixture", fingerprint: "fixture" })), forwards: [], routes: [], proxy: { port: 1377, url_port: 1377 },
    } }));
    await app.context.route(`${agent.url}/v1/boxes/*/api/**`, (route) => {
      const [, box, path] = new URL(route.request().url()).pathname.match(/\/v1\/boxes\/([^/]+)\/api\/(.*)/)!;
      const session = { name: `${box}-chat`, title: `${box} chat`, dir: "/repo", command: "codex", agent: "codex", created: "2026-01-01T12:00:00Z", exited: box === "right", attached: 0 };
      const body = path === "info" ? { name: box, tools: [], capabilities: [] }
        : path === "locations" ? [{ name: "shop", path: "/repo", repo: true, worktrees: [{ name: "shop", main: true, path: "/repo", branch: "main" }] }]
        : path === "sessions" ? [session]
        : path === "stats" ? { agents: [], memory: { total: 8, used: 1 }, disk: { total: 100, used: 1 }, cpu: 0 } : [];
      return route.fulfill({ json: body });
    });
    await app.open({ agent });
    const right = app.page.getByTestId("project-chat").filter({ hasText: "right chat" });
    await expect(right).toBeVisible();
    await expect(right).toHaveAttribute("data-box", "right");
    await right.click();
    await expect(app.page.getByRole("tab", { name: "right chat, shop", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(app.page.getByRole("region", { name: "Codex, shop", exact: true })).toContainText("shop on right");
  } finally { await agent.close(); }
});

test("a paired Mac opens its own worktrees without changing global filters", async ({ app }) => {
  const agent = await fakeAgent();
  try {
    await app.context.addInitScript(() => localStorage.setItem("berth.worktrees.hiddenBoxes", JSON.stringify(["devl"])));
    await app.context.route(`${agent.url}/v1/local`, (route) => route.fulfill({ json: { supported: false, name: "", agents: [], sessions: [] } }));
    await app.context.route(`${agent.url}/v1/boxes/local`, (route) => route.fulfill({ json: { supported: true, available: true, installed: true, running: true, owned: true, name: "this-mac", box: "devl" } }));
    await app.context.route(`${agent.url}/v1/boxes/devl/api/worktrees`, (route) => route.fulfill({ json: [{ name: "fix", location: "shop", path: "/w/shop-fix", branch: "fix", behind: 0, changed: 0, untracked: 0 }] }));
    await app.open({ agent });
    await app.page.getByTestId("nav-local").click();
    await expect(app.page.getByRole("heading", { name: "Worktrees on devl", exact: true })).toBeVisible();
    await expect(app.page.getByRole("option", { name: "fix", exact: true })).toBeVisible();
    expect(await app.stored("berth.worktrees.hiddenBoxes")).toEqual(["devl"]);
  } finally { await agent.close(); }
});


test("machine header opens a pinned composer and leaves the project filter intact", async ({ app }) => {
  const agent = await fakeAgent();
  try {
    await app.context.addInitScript(() => {
      localStorage.setItem("berth.newWorktree.project.v2", JSON.stringify("name:elsewhere"));
      localStorage.setItem("berth.worktrees.hiddenBoxes", JSON.stringify(["devl"]));
    });
    await app.context.route(`${agent.url}/v1/boxes/devl/api/worktrees`, (route) => route.fulfill({ json: [{ name: "fix", location: "shop", path: "/w/shop-fix", branch: "fix", behind: 0, changed: 0, untracked: 0 }] }));
    await app.context.route(`${agent.url}/v1/status`, (route) => route.fulfill({ json: { boxes: ["devl", "other"].map((name) => ({ name, state: "online", address: "fixture", fingerprint: "fixture" })), forwards: [], routes: [], proxy: { port: 1377, url_port: 1377 } } }));
    await app.context.route(`${agent.url}/v1/boxes/other/api/**`, (route) => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith("/locations") ? [{ name: "elsewhere", path: "/other", repo: true, worktrees: [{ name: "elsewhere", main: true, path: "/other", branch: "main" }] }] : new URL(route.request().url()).pathname.endsWith("/info") ? { name: "other", agents: [{ id: "claude", name: "Claude Code", command: "claude" }], capabilities: ["chat.claude"] } : [] }));
    await app.open({ agent });
    await app.page.getByRole("button", { name: "Open computer devl", exact: true }).click();
    await expect(app.page.getByText("Connected to devl.", { exact: false })).toBeVisible();
    await app.page.getByRole("button", { name: "New task on devl", exact: true }).click();
    const dialog = app.page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "New task", exact: true })).toBeVisible();
    await expect(dialog.getByTestId("task-composer-summary")).toHaveAccessibleName(new RegExp("shop on devl"));
    await dialog.getByRole("textbox", { name: "What should your agents work on?", exact: true }).fill("Keep the scoped request");
    expect(agent.calls.filter((call) => /^(POST|PUT|DELETE) .*\/(sessions|chats)(\/|$)/.test(call))).toEqual([]);
    await app.page.keyboard.press("Escape");
    await expect(app.page.getByRole("heading", { name: "Worktrees on devl", exact: true })).toBeVisible();
    expect(await app.stored("berth.worktrees.hiddenBoxes")).toEqual(["devl"]);
    await app.page.getByRole("main").getByRole("button", { name: "Add a project on devl", exact: true }).click();
    await expect(app.page.getByRole("dialog")).toContainText("devl");
    expect(agent.calls.filter((call) => /^(POST|PUT|DELETE) .*\/locations$/.test(call))).toEqual([]);
  } finally { await agent.close(); }
});

test("an empty machine offers its project action and cannot start work elsewhere", async ({ app }) => {
  const agent = await fakeAgent();
  try {
    await app.context.route(`${agent.url}/v1/boxes/devl/api/locations`, (route) => route.fulfill({ json: [] }));
    await app.context.route(`${agent.url}/v1/boxes/devl/api/worktrees`, (route) => route.fulfill({ json: [] }));
    await app.open({ agent });
    await app.page.getByRole("button", { name: "Open computer devl", exact: true }).click();
    await expect(app.page.getByText("No projects on devl", { exact: true })).toBeVisible();
    const start = app.page.getByRole("button", { name: "New task on devl", exact: true });
    await expect(start).toBeDisabled();
    await expect(start).toHaveAccessibleDescription(/Add a project on devl before starting work/);
    await app.page.getByRole("button", { name: "Add a project on devl", exact: true }).last().click();
    await expect(app.page.getByRole("dialog")).toContainText("devl");
    expect(agent.calls.filter((call) => /^(POST|PUT|DELETE) /.test(call))).toEqual([]);
  } finally { await agent.close(); }
});

test("an offline machine keeps a connection recovery action and disables new work", async ({ app }) => {
  const agent = await fakeAgent();
  agent.online.state = "offline";
  try {
    await app.open({ agent });
    await app.page.getByRole("button", { name: "Open computer devl", exact: true }).click();
    await expect(app.page.getByText("devl is offline", { exact: true })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "New task on devl", exact: true })).toBeDisabled();
    await expect(app.page.getByRole("button", { name: "Add a project on devl", exact: true })).toBeDisabled();
    await app.page.getByRole("button", { name: "Paired computers", exact: true }).click();
    await expect(app.page.getByTestId("settings-boxes")).toBeVisible();
    expect(agent.calls.filter((call) => /^(POST|PUT|DELETE) /.test(call))).toEqual([]);
  } finally { await agent.close(); }
});
