import type { Locator } from "@playwright/test";
import { BOX, DIR, fakeAgent } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

test.beforeEach(() => mockOnly("isolated long lists and delayed Home data"));

function locations(count: number, longNames = false) {
  return Array.from({ length: count }, (_, index) => {
    const name = `project-${String(index).padStart(2, "0")}${longNames ? `-${"unbroken".repeat(16)}` : ""}`;
    const path = `/w/${name}`;
    return { name, path, repo: true, worktrees: [{ name, path, main: true, branch: "main" }] };
  });
}

async function boundedPopup(menu: Locator) {
  await expect(menu).toBeVisible();
  const size = await menu.boundingBox();
  if (!size) throw new Error("The open menu has no bounds.");
  expect(size.width).toBeLessThanOrEqual(353);
  expect(size.height).toBeLessThanOrEqual(321);
  expect(await menu.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
}

for (const theme of ["berth-light", "berth-dark"]) test(`long project actions stay bounded and keyboard-reachable in ${theme}`, async ({ app }) => {
  const agent = await fakeAgent();
  const projects = locations(28, true);
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/locations`, (route) => route.fulfill({ json: projects }));
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/sessions`, (route) => route.fulfill({ json: [] }));
  try {
    await app.open({ agent, theme });
    const sidebar = app.page.getByTestId("sidebar");
    const project = sidebar.locator("[draggable=true]").filter({ hasText: projects[0].name });
    await project.click({ button: "right" });
    const main = app.page.locator("[data-slot=context-menu-popup]");
    await boundedPopup(main);
    await app.page.getByRole("menuitem", { name: "Organise", exact: true }).focus();
    await app.page.keyboard.press("ArrowRight");
    const submenu = app.page.locator("[data-slot=menu-sub-content]");
    await boundedPopup(submenu);
    await app.page.keyboard.press("End");
    await expect(submenu.locator("[data-highlighted]")).toBeVisible();
    const focused = await submenu.locator("[data-highlighted]").boundingBox();
    const bounds = await submenu.boundingBox();
    if (!focused || !bounds) throw new Error("The highlighted final action has no bounds.");
    expect(focused.y + focused.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
    await app.page.keyboard.press("Escape");
    await app.page.keyboard.press("Escape");
    await expect(app.page.getByRole("menu")).toHaveCount(0);
  } finally { await agent.close(); }
});

test("long project lists load in batches and keep a restored selection beyond the first batch", async ({ app }) => {
  const agent = await fakeAgent();
  const projects = locations(25);
  await app.context.addInitScript(() => localStorage.setItem("berth.sidebar", JSON.stringify({ groupBy: "project", show: "all", expanded: {}, collapsed: {} })));
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/locations`, (route) => route.fulfill({ json: projects }));
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/sessions`, (route) => route.fulfill({ json: [] }));
  try {
    await app.open({ agent });
    const sidebar = app.page.getByTestId("sidebar");
    const rows = sidebar.getByTestId("worktree-row");
    await expect(rows).toHaveCount(12);
    const more = sidebar.getByTestId("sidebar-load-more");
    await expect(more).toHaveText("Load more projects (13)");
    await more.focus();
    await more.press("Enter");
    await expect(rows).toHaveCount(24);
    await more.press("Enter");
    await expect(rows).toHaveCount(25);
    await expect(sidebar.getByTestId("sidebar-show-fewer")).toBeFocused();
    const selected = app.worktree(`${BOX}/${projects[24].name}`);
    await selected.click();
    await expect(selected).toHaveAttribute("data-active", "true");
    await app.page.reload();
    await expect(selected).toBeVisible();
    await expect(selected).toHaveAttribute("data-active", "true");
    await expect(rows).toHaveCount(13);
    await expect(sidebar.getByTestId("nav-settings")).toBeVisible();
  } finally { await agent.close(); }
});

test("Home publishes completed agent activity before slow service data finishes", async ({ app }) => {
  const agent = await fakeAgent();
  let release: (() => void) | undefined;
  let serviceAsked = false;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/services`, async (route) => {
    serviceAsked = true;
    await blocked;
    await route.fulfill({ json: [] });
  });
  try {
    await app.open({ agent, prefs: { home: { version: 1, items: [{ id: "working", size: "m" }] } } });
    await expect.poll(() => serviceAsked).toBe(true);
    const working = app.page.getByTestId("home-grid").locator('[data-widget="working"]');
    await expect(working.getByRole("button", { name: /Fix the flaky checkout test/ })).toBeVisible();
    await expect(working).toContainText("shop / fix · devl");
    await expect(app.page.getByTestId("sidebar").getByTestId("worktree-row").first()).toBeVisible();
    await expect(working.getByRole("status", { name: "Loading", exact: true })).toHaveCount(0);
    expect(serviceAsked).toBe(true);
    release?.();
  } finally { release?.(); await agent.close(); }
});

test("section folds preserve loaded project and chat batches without hidden rows", async ({ app }) => {
  const agent = await fakeAgent();
  const projects = locations(25);
  const chats = Array.from({ length: 30 }, (_, index) => ({ name: `chat-${index}`, title: `Saved chat ${index}`, agent: "codex", dir: projects[0].path, created: new Date(Date.UTC(2026, 0, 1) - index * 1000).toISOString(), exited: true, attached: 0 }));
  await app.context.addInitScript(() => localStorage.setItem("berth.sidebar", JSON.stringify({ groupBy: "project", show: "active", expanded: {}, collapsed: {} })));
  await app.context.route(`${agent.url}/v1/app/projects`, (route) => route.fulfill({ json: { projects: projects.map((p) => ({ id: `name:${p.name}`, section: "Work" })), sections: ["Work"] } }));
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/locations`, (route) => route.fulfill({ json: projects }));
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/sessions`, (route) => route.fulfill({ json: chats }));
  try {
    await app.open({ agent });
    const section = app.page.getByTestId("sidebar").getByRole("group", { name: "Work", exact: true });
    const rows = section.locator('[draggable="true"]');
    await expect(rows).toHaveCount(12);
    await expect(section.getByTestId("project-chat")).toHaveCount(12);
    await section.getByRole("button", { name: "Load more projects (13)", exact: true }).focus();
    await app.page.keyboard.press("Enter");
    await expect(rows).toHaveCount(24);
    await section.getByRole("button", { name: "Load more chats (18)", exact: true }).focus();
    await app.page.keyboard.press("Enter");
    await expect(section.getByTestId("project-chat")).toHaveCount(24);
    const fold = section.getByRole("button", { name: /^Work\s*25$/ });
    await fold.click();
    await expect(rows).toHaveCount(0);
    await expect(section.getByTestId("project-chat")).toHaveCount(0);
    await fold.click();
    await expect(rows).toHaveCount(24);
    await expect(section.getByTestId("project-chat")).toHaveCount(24);
  } finally { await agent.close(); }
});

test("a failed metrics read keeps available agent counts in the machine's accessible label", async ({ app }) => {
  const agent = await fakeAgent();
  agent.session.agent_state = "waiting";
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/stats`, (route) => route.fulfill({ status: 503, json: { error: "Synthetic metrics unavailable" } }));
  try {
    await app.open({ agent, prefs: { home: { version: 1, items: [{ id: "boxes", size: "m" }] } } });
    const rows = app.page.getByTestId("home-machine-rows");
    await expect(rows.getByRole("button", { name: /0 working, 1 need you/ })).toBeVisible();
    await expect(rows).toContainText("1 need you");
    await expect(rows.getByRole("button")).not.toHaveAccessibleName(/Agent sessions unavailable/);
    await app.context.route(`${agent.url}/v1/status`, (route) => route.fulfill({ status: 503, json: { error: "Synthetic client disconnected" } }));
    agent.event({ type: "box.changed" });
    await expect(rows).toContainText("Agent unreachable");
    await expect(rows.getByRole("button")).toHaveAccessibleName(/Agent unreachable/);
    await expect(rows.getByRole("button")).not.toHaveAccessibleName(/Refresh failed/);
  } finally { await agent.close(); }
});

test("fresh machine readings remain visible when only the service list fails", async ({ app }) => {
  const agent = await fakeAgent();
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/services`, (route) => route.fulfill({ status: 503, json: { error: "Synthetic service failure" } }));
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/stats`, (route) => route.fulfill({ json: { cpus: 4, load: [1], memory: { used: 4 * 2 ** 30, total: 8 * 2 ** 30 }, disks: [{ mount: "/", used: 25, total: 100 }] } }));
  try {
    await app.open({ agent, prefs: { home: { version: 1, items: [{ id: "boxes", size: "m" }] } } });
    const rows = app.page.getByTestId("home-machine-rows");
    await expect(rows).toContainText("50%");
    await expect(rows).toContainText("0.25/CPU");
    await expect(rows).not.toContainText("Refresh failed");
  } finally { await agent.close(); }
});

test("a project refresh cannot discard an overlapping statistics failure", async ({ app }) => {
  const agent = await fakeAgent();
  let release: (() => void) | undefined;
  let markStats: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const statsAsked = new Promise<void>((resolve) => { markStats = resolve; });
  try {
    await app.open({ agent, prefs: { home: { version: 1, items: [{ id: "boxes", size: "m" }] } } });
    const rows = app.page.getByTestId("home-machine-rows");
    await expect(rows).toContainText("Load (1m)");
    await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/stats`, async (route) => {
      markStats?.();
      await blocked;
      await route.fulfill({ status: 503, json: { error: "Synthetic statistics failure" } });
    });
    agent.event({ type: "agent.changed" });
    await statsAsked;
    const refreshedProjects = app.page.waitForResponse((r) => r.url() === `${agent.url}/v1/boxes/${BOX}/api/locations`);
    agent.event({ type: "location.changed" });
    await refreshedProjects;
    release?.();
    await expect(rows).toContainText("Refresh failed");
    await expect(rows.getByRole("button")).toHaveAccessibleName(/Refresh failed/);
    const secondProjects = app.page.waitForResponse((r) => r.url() === `${agent.url}/v1/boxes/${BOX}/api/locations`);
    agent.event({ type: "location.changed" });
    await secondProjects;
    await expect(rows).toContainText("Refresh failed");
  } finally { release?.(); await agent.close(); }
});

test("a late project response cannot replace a newer project refresh", async ({ app }) => {
  const agent = await fakeAgent();
  let release: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  let markFirst: (() => void) | undefined;
  const firstAsked = new Promise<void>((resolve) => { markFirst = resolve; });
  let reads = 0;
  try {
    await app.open({ agent });
    await expect(app.page.getByTestId("sidebar").getByTestId("worktree-row").first()).toBeVisible();
    await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/locations`, async (route) => {
      const read = ++reads;
      if (read === 1) { markFirst?.(); await blocked; }
      await route.fulfill({ json: [{ name: read === 1 ? "old-project" : "fresh-project", path: "/w/fresh", repo: true, worktrees: [{ name: "fresh", path: "/w/fresh", main: true, branch: "main" }] }] });
    });
    agent.event({ type: "location.changed" });
    await firstAsked;
    agent.event({ type: "location.changed" });
    const sidebar = app.page.getByTestId("sidebar");
    await expect(sidebar).toContainText("fresh-project");
    const arrived = app.page.waitForResponse((response) => response.url() === `${agent.url}/v1/boxes/${BOX}/api/locations`);
    release?.();
    await arrived;
    await expect(sidebar).toContainText("fresh-project");
    await expect(sidebar).not.toContainText("old-project");
  } finally { release?.(); await agent.close(); }
});

test("live steps preserve computer/project context and service rows identify their machine", async ({ app }) => {
  const agent = await fakeAgent();
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/sessions/**/screen`, (route) => route.fulfill({ json: { screen: "⏺ Bash: git status\n✶ Working…" } }));
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/services`, (route) => route.fulfill({ json: [{ port: 5173, process: "vite", location: "shop", worktree: "fix", path: DIR, main: false }] }));
  try {
    await app.open({ agent, prefs: { home: { version: 1, items: [{ id: "working", size: "m" }, { id: "services", size: "m" }] } } });
    const grid = app.page.getByTestId("home-grid");
    const working = grid.locator('[data-widget="working"]');
    await expect(working).toContainText("git status");
    await expect(working).toContainText("shop / fix · devl");
    const services = grid.locator('[data-widget="services"]');
    await expect(services.getByRole("button", { name: /Open .* on devl, port 5173/ })).toBeVisible();
    await expect(services).toContainText("devl");
  } finally { await agent.close(); }
});

for (const theme of ["berth-light", "berth-dark"]) test(`a medium machine widget keeps readable units and one column in ${theme}`, async ({ app }) => {
  const agent = await fakeAgent();
  agent.session.agent_state = "waiting";
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/stats`, (route) => route.fulfill({ json: { cpus: 8, load: [4, 3, 2], memory: { used: 4 * 2 ** 30, total: 8 * 2 ** 30 }, disks: [{ mount: "/", used: 40, total: 100 }] } }));
  try {
    await app.open({ agent, theme, prefs: { home: { version: 1, items: [{ id: "boxes", size: "m" }] } } });
    const widget = app.page.getByTestId("home-grid").locator('[data-widget="boxes"]');
    await expect(widget).toContainText("Load (1m)");
    await expect(widget).toContainText("0.50/CPU");
    await expect(widget).toContainText("Disk /");
    await expect(widget).toContainText("1 need you");
    const rows = widget.getByTestId("home-machine-rows");
    expect((await rows.evaluate((el) => getComputedStyle(el).gridTemplateColumns)).trim().split(/\s+/)).toHaveLength(1);
    expect(await rows.evaluate((el) => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)).toBe(true);
  } finally { await agent.close(); }
});
