import { fakeAgent } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

test.beforeEach(() => mockOnly("synthetic plugin workflow actions without account setup"));

async function openBuiltin(app: import("./fixtures").App, name: string) {
  await app.page.getByRole("button", { name: "More", exact: true }).click();
  await app.page.getByRole("menuitem", { name, exact: true }).click();
}

test("Dev servers keeps compatible configuration details behind an explicit disclosure", async ({ app }) => {
  const agent = await fakeAgent();
  await app.context.route(`${agent.url}/v1/boxes/devl/api/services`, (route) => route.fulfill({ json: [] }));
  try {
    await app.open({ agent });
    await openBuiltin(app, "Dev servers");
    await expect(app.page.getByText("Nothing is listening", { exact: true })).toBeVisible();
    await expect(app.page.getByText("Start a dev server in a project. Burf will show it here when it is listening.", { exact: true })).toBeVisible();
    await expect(app.page.getByText(".berth/config.json", { exact: true })).toHaveCount(0);
    await app.page.getByRole("button", { name: "Configure a project service", exact: true }).click();
    await expect(app.page.getByText(".berth/config.json", { exact: true })).toBeVisible();
    expect(agent.calls.filter((call) => /^(POST|PUT|PATCH|DELETE) .*\/(sessions|services|locations|config)(\/|$)/.test(call))).toEqual([]);
  } finally { await agent.close(); }
});

test("GitHub Issues empty state opens the existing Add project flow", async ({ app }) => {
  const agent = await fakeAgent();
  try {
    await app.open({ agent });
    await openBuiltin(app, "GitHub Issues");
    await expect(app.page.getByText("No GitHub projects yet", { exact: true })).toBeVisible();
    await app.page.getByRole("button", { name: "Add project", exact: true }).click();
    await expect(app.page.getByRole("dialog")).toContainText("Add a project");
    expect(agent.calls.filter((call) => /^POST .*\/(?:locations|sessions|pair)/.test(call))).toEqual([]);
  } finally { await agent.close(); }
});

for (const failure of [
  { name: "sign-in", exit_code: 1, output: "To authenticate, run gh auth login", title: "gh isn't logged in on devl" },
  { name: "missing GitHub CLI", exit_code: 127, output: "gh: command not found", title: "gh isn't installed on devl" },
]) {
  test(`GitHub Issues ${failure.name} recovery opens only a plain shell on the affected computer`, async ({ app }) => {
    const agent = await fakeAgent();
    const shellStarts: unknown[] = [];
    const queries: { command: string }[] = [];
    let ready = false;
    await app.context.route(`${agent.url}/v1/boxes/devl/api/locations`, (route) => route.fulfill({ json: [{ name: "shop", path: "/w/shop", slug: "acme/shop", remote: "git@github.com:acme/shop.git", repo: true, worktrees: [{ name: "shop", path: "/w/shop", branch: "main", main: true }] }] }));
    await app.context.route(`${agent.url}/v1/boxes/devl/api/info`, (route) => route.fulfill({ json: { name: "devl", agents: [], capabilities: ["session.home"] } }));
    await app.context.route(`${agent.url}/v1/boxes/devl/api/exec`, (route) => {
      queries.push(route.request().postDataJSON());
      return route.fulfill({ json: ready ? { exit_code: 0, output: JSON.stringify({ viewer: "fixture", repo: "acme/shop", enabled: true, total: 0, issues: [] }) } : failure });
    });
    await app.context.route(`${agent.url}/v1/boxes/devl/api/sessions`, (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      shellStarts.push(route.request().postDataJSON());
      return route.fulfill({ status: 503, json: { error: "Synthetic terminal unavailable" } });
    });
    try {
      await app.open({ agent });
      await openBuiltin(app, "GitHub Issues");
      await expect(app.page.getByText(failure.title, { exact: true })).toBeVisible();
      expect(shellStarts).toEqual([]);
      expect(queries.length).toBeGreaterThan(0);
      expect(queries.some((query) => query.command.includes("gh api graphql "))).toBe(true);
      expect(queries.some((query) => /\bgh (?:auth login|issue (?:create|close|comment))\b/.test(query.command))).toBe(false);
      await app.page.getByRole("button", { name: "Open terminal on devl", exact: true }).click();
      await expect(app.page.getByText("Couldn't start it", { exact: true })).toBeVisible();
      await app.page.getByRole("button", { name: "Details", exact: true }).click();
      await expect(app.page.getByRole("dialog")).toContainText("Synthetic terminal unavailable");
      await app.page.keyboard.press("Escape");
      expect(shellStarts).toEqual([{ home: true }]);
      // Returning and refreshing is an explicit read, never a login replay.
      ready = true;
      await openBuiltin(app, "GitHub Issues");
      await app.page.getByRole("button", { name: "Refresh shop", exact: true }).click();
      await expect(app.page.getByText("No open issues. Nice.", { exact: true })).toBeVisible();
      expect(shellStarts).toHaveLength(1);
      expect(queries.some((query) => query.command.includes("gh api graphql "))).toBe(true);
      expect(queries.some((query) => /\bgh (?:auth login|issue (?:create|close|comment))\b/.test(query.command))).toBe(false);
    } finally { await agent.close(); }
  });
}

test("Monitor offers computer discovery beside its paired computer filter", async ({ app }) => {
  const agent = await fakeAgent();
  try {
    await app.context.route(`${agent.url}/v1/status`, (route) => route.fulfill({ json: { boxes: ["devl", "away"].map((name) => ({ name, state: name === "devl" ? "online" : "offline", address: "fixture", fingerprint: "fixture" })), forwards: [], routes: [], proxy: { port: 1377, url_port: 1377 } } }));
    await app.open({ agent });
    await openBuiltin(app, "Computer monitor");
    await expect(app.page.getByRole("group", { name: "Machines to monitor", exact: true })).toBeVisible();
    await app.page.getByRole("button", { name: "Discover or pair a computer", exact: true }).last().click();
    await expect(app.page.getByRole("dialog")).toContainText("Add a box");
    expect(agent.calls.filter((call) => /^POST .*\/(?:pair|install|sessions)/.test(call))).toEqual([]);
  } finally { await agent.close(); }
});

test("an issue detail sign-in failure offers local setup and retries only the detail read", async ({ app }) => {
  const agent = await fakeAgent();
  const queries: { command: string }[] = [];
  const shellStarts: unknown[] = [];
  let ready = false;
  const issue = { number: 17, title: "Fixture issue", author: "fixture", createdAt: "2026-10-10T12:00:00Z", updatedAt: "2026-10-10T12:00:00Z", labels: [], assignees: [], comments: 0, prs: [] };
  await app.context.route(`${agent.url}/v1/boxes/devl/api/locations`, (route) => route.fulfill({ json: [{ name: "shop", path: "/w/shop", slug: "acme/shop", remote: "git@github.com:acme/shop.git", repo: true, worktrees: [{ name: "shop", path: "/w/shop", branch: "main", main: true }] }] }));
  await app.context.route(`${agent.url}/v1/boxes/devl/api/exec`, (route) => {
    const query = route.request().postDataJSON() as { command: string };
    queries.push(query);
    const detail = query.command.includes("-F number=17");
    return route.fulfill({ json: detail && !ready ? { exit_code: 1, output: "Run gh auth login" } : { exit_code: 0, output: JSON.stringify(detail
      ? { ...issue, url: "https://github.com/acme/shop/issues/17", state: "OPEN", body: "Recovered synthetic issue detail", comments: [], totalComments: 0 }
      : { viewer: "fixture", repo: "acme/shop", enabled: true, total: 1, issues: [issue] }) } });
  });
  await app.context.route(`${agent.url}/v1/boxes/devl/api/sessions`, (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    shellStarts.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, json: { error: "Synthetic terminal unavailable" } });
  });
  try {
    await app.open({ agent });
    await openBuiltin(app, "GitHub Issues");
    await expect(app.page.getByText("gh isn't logged in on devl", { exact: true })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Open terminal on devl", exact: true })).toBeVisible();
    expect(shellStarts).toEqual([]);
    const listsBefore = queries.filter((q) => !q.command.includes("-F number=17")).length;
    ready = true;
    await app.page.getByRole("button", { name: "Refresh issue", exact: true }).click();
    await expect(app.page.getByText("Recovered synthetic issue detail", { exact: true })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Open terminal on devl", exact: true })).toHaveCount(0);
    expect(queries.filter((q) => !q.command.includes("-F number=17"))).toHaveLength(listsBefore);
    expect(queries.some((q) => q.command.includes("gh api graphql "))).toBe(true);
    expect(queries.some((q) => /\bgh (?:auth login|issue (?:create|close|comment))\b/.test(q.command))).toBe(false);
    expect(shellStarts).toEqual([]);
  } finally { await agent.close(); }
});
