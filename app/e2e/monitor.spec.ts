import { fakeAgent } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

test.beforeEach(() => mockOnly("synthetic machine readings without providers"));

async function monitorFixture(app: import("./fixtures").App, processes = false, crowded = false) {
  const agent = await fakeAgent();
  await app.context.route(`${agent.url}/v1/status`, (route) => route.fulfill({ json: {
    boxes: ["alpha", "beta", "away", ...(crowded ? ["extra-1", "extra-2", "extra-3"] : [])].map((name) => ({ name, state: name === "away" ? "offline" : "online", address: "fixture", fingerprint: "fixture" })), forwards: [], routes: [], proxy: { port: 1377, url_port: 1377 },
  } }));
  await app.context.route(`${agent.url}/v1/boxes/*/api/**`, (route) => {
    const [, name, path] = new URL(route.request().url()).pathname.match(/\/v1\/boxes\/([^/]+)\/api\/(.*)/)!;
    const body = path === "stats" ? { hostname: name, cpus: 2, load: name === "alpha" ? [6] : [], memory: name === "alpha" ? { total: 8 * 2 ** 30, used: 0 } : { total: 0, used: 0 }, swap: { total: 0, used: 0 }, disks: name === "alpha" ? [{ mount: "/", total: 100, used: 20 }, { mount: "/data", total: 100, used: 90 }] : [], agents: processes && name === "alpha" ? [101, 102, 103].map((pid) => ({ pid, tool: "codex", path: "/repo", state: "running" })) : [], agents_available: processes || name !== "alpha", hooks: true }
      : path === "info" ? { name, os: name === "alpha" ? "darwin" : "linux", agents: [], capabilities: [] }
      : path === "locations" ? [{ name: "shop", path: "/repo", repo: true, worktrees: [{ name: "shop", main: true, path: "/repo", branch: "main" }] }]
      : path === "sessions" && processes && name === "alpha" ? [{ name: "known-session", title: "Known Burf task", agent: "codex", command: "codex", dir: "/repo", location: "shop/shop", created: "2026-01-01T12:00:00Z", exited: true, attached: 0 }]
      : [];
    return route.fulfill({ json: body });
  });
  await app.open({ agent, prefs: { home: { version: 1, items: [{ id: "boxes", size: "m" }] } } });
  return agent;
}

test("monitor distinguishes unknown readings from zero and keeps offline filters", async ({ app }) => {
  const agent = await monitorFixture(app);
  try {
    await app.page.getByRole("button", { name: "More", exact: true }).click();
    await app.page.getByRole("menuitem", { name: "Computer monitor", exact: true }).click();
    const alpha = app.page.locator('[data-slot="frame"]').filter({ has: app.page.locator('[data-slot="frame-panel-title"]').getByText("alpha", { exact: true }) });
    const beta = app.page.locator('[data-slot="frame"]').filter({ has: app.page.locator('[data-slot="frame-panel-title"]').getByText("beta", { exact: true }) });
    await expect(alpha).toContainText("0.0 GiB of 8.0 GiB");
    await expect(alpha).toContainText("RAM used (excludes cache)");
    await expect(alpha).toContainText("6.00 on 2 CPUs");
    await expect(alpha).toContainText("3.00/CPU");
    await expect(alpha).toContainText("Detected agent processes unavailable");
    await expect(beta).toContainText("Unavailable");
    await expect(beta).toContainText("0 detected agent processes");
    await expect(app.page.locator('[data-slot="frame"]').filter({ hasText: "away" })).toContainText("Offline");
    const filters = app.page.getByRole("group", { name: "Machines to monitor", exact: true });
    await filters.getByRole("button", { name: "beta", exact: true }).click();
    await expect(beta).toHaveCount(0);
    await app.page.reload();
    await app.page.getByRole("button", { name: "More", exact: true }).click();
    await app.page.getByRole("menuitem", { name: "Computer monitor", exact: true }).click();
    await expect(app.page.getByRole("heading", { name: "Computer monitor", exact: true })).toBeVisible();
    await expect(beta).toHaveCount(0);
    await expect(filters.getByRole("button", { name: "away", exact: true })).toBeVisible();
  } finally { await agent.close(); }
});

test("monitor makes detected processes findable without claiming they are Burf chats", async ({ app }) => {
  const agent = await monitorFixture(app, true);
  try {
    await app.page.getByRole("button", { name: "More", exact: true }).click();
    await app.page.getByRole("menuitem", { name: "Computer monitor", exact: true }).click();
    const card = app.page.locator('[data-slot="frame"]').filter({ has: app.page.locator('[data-slot="frame-panel-title"]').getByText("alpha", { exact: true }) });
    await card.locator("summary").filter({ hasText: "3 detected agent processes" }).click();
    for (const pid of [101, 102, 103]) await expect(card).toContainText(`PID ${pid}`);
    await expect(card).toContainText("agents started outside Burf");
    await expect(card.locator("summary").filter({ hasText: "0 open Burf agent sessions" })).toBeVisible();
    await expect(card.getByRole("button", { name: /^Open / })).toHaveCount(0);
    expect(agent.calls.filter((call) => call.startsWith("POST "))).toEqual([]);
  } finally { await agent.close(); }
});

test("Home machine filters persist and keep metrics honest at narrow width", async ({ app }) => {
  await app.page.setViewportSize({ width: 1024, height: 768 });
  const agent = await monitorFixture(app);
  try {
    const grid = app.page.getByTestId("home-grid");
    const fleet = grid.locator('[data-widget="boxes"]');
    await expect(fleet).toContainText("Load");
    await expect(fleet).toContainText("6.00");
    const loadReading = fleet.getByRole("group", { name: /^alpha:/ });
    await expect(loadReading).toHaveAttribute("aria-label", /Load \(1m\), not CPU utilization: 6\.00 on 2 CPUs · 3\.00\/CPU/);
    await expect(loadReading).toHaveAttribute("aria-label", /Disk \/data, fullest filesystem: 90%/);
    const filters = grid.getByRole("group", { name: "Machines for Home activity", exact: true });
    await filters.getByRole("button", { name: "beta", exact: true }).click();
    await expect(fleet.getByText("beta", { exact: true })).toHaveCount(0);
    expect(await app.stored("berth.home.hiddenMachines")).toEqual(["beta"]);
    await app.page.reload();
    await expect(fleet.getByText("beta", { exact: true })).toHaveCount(0);
    await app.page.setViewportSize({ width: 639, height: 768 });
    const readings = fleet.getByRole("group", { name: /^alpha:/ });
    await expect(readings).toBeVisible();
    expect(await readings.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const more = fleet.getByRole("button", { name: /more/ });
    await expect(fleet.getByText("away", { exact: true })).toBeVisible();
    await expect(more).toHaveCount(0);
    expect(await readings.evaluate((el) => {
      const widget = el.closest('[data-widget="boxes"]')!;
      return el.getBoundingClientRect().bottom <= widget.getBoundingClientRect().bottom;
    })).toBe(true);
    expect(await fleet.getByText("away", { exact: true }).evaluate((el) => {
      const widget = el.closest('[data-widget="boxes"]')!;
      return el.getBoundingClientRect().bottom <= widget.getBoundingClientRect().bottom;
    })).toBe(true);
  } finally { await agent.close(); }
});


test("compact Home fleet keeps overflow recovery reachable", async ({ app }) => {
  await app.page.setViewportSize({ width: 639, height: 768 });
  const agent = await monitorFixture(app, false, true);
  try {
    const fleet = app.page.getByTestId("home-grid").locator('[data-widget="boxes"]');
    const more = fleet.getByRole("button", { name: /more/ });
    await expect(more).toBeVisible();
    expect(await more.evaluate((el) => {
      const widget = el.closest('[data-widget="boxes"]')!;
      return el.getBoundingClientRect().bottom <= widget.getBoundingClientRect().bottom;
    })).toBe(true);
    await more.click();
    await expect(app.page.getByTestId("settings-boxes")).toBeVisible();
  } finally { await agent.close(); }
});
