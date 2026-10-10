import { fakeAgent } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

test.beforeEach(() => mockOnly("isolated sidebar machines"));

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
