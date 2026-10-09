import { readFileSync } from "node:fs";

import { BOX, DIR, fakeAgent } from "./fake-agent";
import { expect, mockOnly, openTaskPickers, test, type App } from "./fixtures";
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
  const chat = { id: "remote-1", agent: "codex", mode: "chat", location: "shop/fix", cwd: DIR, state: "idle", started_at: "2026-10-08T12:00:00Z", thread_id: "remote-provider-thread", turn_id: "", items: [] as { id: string; kind: string; text: string }[], approvals: [] as { id: string; kind: string; detail: string }[], reports: undefined as Record<string, object[]> | undefined };
  // art: what the box keeps for the worktree (berthd artifact add), with each one's content. Unset, the box keeps none.
  const control = { listed: false, lostSend: false, lostStart: false, worktreeError: false, startError: false, runs: false, offline: false, readHeld: undefined as Promise<void> | undefined, art: undefined as { id: string; title: string; kind: string; format: string; body: string }[] | undefined, title: "" };
  let createdWorktree: { name: string; path: string; branch: string } | undefined;
  await context.route(`${agent.url}${base}**`, async (route) => {
    const path = new URL(route.request().url()).pathname.slice(base.length);
    const method = route.request().method();
    calls.push({ method, path, body: route.request().postDataJSON() });
    if (path === "info") return route.fulfill({ json: { name: BOX, version: "test", capabilities: supported ? ["chat.codex", "transcript", ...(options ? ["chat.options"] : []), ...(fullAccess ? ["chat.full-access"] : []), ...(control.art ? ["artifacts"] : []), ...(control.runs ? ["runs"] : [])] : ["transcript"], agents: [{ id: "codex", name: "Codex", command: "codex" }, { id: "custom", name: "Custom Codex", command: "codex --model custom" }] } });
    if (path === "locations" && method === "GET" && (control.title || createdWorktree)) {
      // The worktree as the box lists it once a person has named it.
      const listed = await (await route.fetch()).json() as { name: string; worktrees?: { path: string; title?: string }[] }[];
      for (const loc of listed) {
        if (loc.name === "shop" && createdWorktree) loc.worktrees?.push(createdWorktree);
        for (const wt of loc.worktrees ?? []) if (wt.path === DIR && control.title) wt.title = control.title;
      }
      return route.fulfill({ json: listed });
    }
    if (path === "locations/shop/worktrees" && method === "POST") {
      if (control.worktreeError) return route.fulfill({ status: 400, json: { error: "The branch already exists" } });
      const body = route.request().postDataJSON() as { name: string; branch?: string };
      createdWorktree = { name: body.name, path: `/w/shop-${body.name}`, branch: body.branch || `me/${body.name}` };
      return route.fulfill({ json: createdWorktree });
    }
    if (path === "tasks" && method === "POST") return route.fulfill({ json: { session: { name: "legacy-codex" } } });
    if (path === "runs" && control.runs) return route.fulfill({ json: method === "POST" ? { id: "compare-1" } : [] });
    if (path === "sessions") return route.fulfill({ json: method === "POST" ? { name: "legacy-codex" } : [] });
    const art = control.art && /^locations\/([^/]+)\/worktrees\/([^/]+)\/artifacts(?:\/([0-9a-f]+)\/v\/1)?$/.exec(path);
    if (art?.[3]) return route.fulfill({ contentType: "text/plain", body: control.art!.find((a) => a.id === art[3])?.body ?? "" });
    if (art) return route.fulfill({ json: control.art!.map(({ body, ...a }) => ({ ...a, location: decodeURIComponent(art[1]), worktree: decodeURIComponent(art[2]), path: DIR, by: { agent: "codex" }, created: "2026-10-08T12:00:00Z", updated: "2026-10-08T12:00:00Z", versions: [{ n: 1, at: "2026-10-08T12:00:00Z", size: body.length, sha256: "test" }] })) });
    if (!path.startsWith("chats")) return route.continue();
    if (control.offline) return route.abort("connectionreset");
    if (path === "chats/models") return route.fulfill({ json: [
      { model: "alpha", displayName: "Alpha", defaultReasoningEffort: "medium", supportedReasoningEfforts: [{ reasoningEffort: "medium" }, { reasoningEffort: "high" }] },
      { model: "beta", displayName: "Beta", defaultReasoningEffort: "low", supportedReasoningEfforts: [{ reasoningEffort: "low" }] },
    ] });
    if (path === "chats") {
      if (method === "GET") return route.fulfill({ json: { chats: control.listed ? [{ ...chat, items: null, approvals: null }] : [] } });
      if (control.startError) return route.fulfill({ status: 400, json: { error: "Codex could not start" } });
      chat.location = (route.request().postDataJSON() as { location: string }).location;
      chat.cwd = createdWorktree?.path ?? (chat.location === "shop" ? "/w/shop" : DIR);
      control.listed = true;
      if (control.lostStart) return route.abort("connectionreset");
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
    // A read the box is slow to answer.
    if (method === "GET") await control.readHeld;
    return route.fulfill({ json: chat });
  });
  return { agent, chat, calls, control };
}

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
  f.control.listed = true;
  f.control.lostSend = true;
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("region", { name: "Codex chats" }).getByRole("button", { name: /Codex chat/ }).click();
    const draft = app.page.getByRole("textbox", { name: "Message Codex" });
    await draft.fill("Do not replay");
    await app.page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("may have arrived");
    await expect(draft).toHaveValue("Do not replay");
    f.control.offline = true;
    await app.page.getByRole("button", { name: "Refresh chat", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat").getByRole("status")).toHaveText("Connection lost. The run kept going on the server.Reconnect");
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

test("a structured chat's failed first read focuses Refresh chat and recovery keeps that focus", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.listed = true;
  const read = `${f.agent.url}/v1/boxes/${BOX}/api/chats/${f.chat.id}`;
  await app.page.route(read, (route) => route.fulfill({ status: 503, json: { error: "Synthetic first-read failure" } }));
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("region", { name: "Codex chats" }).getByRole("button", { name: /Codex chat/ }).click();
    const refresh = app.page.getByRole("button", { name: "Refresh chat", exact: true });
    const message = app.page.getByRole("textbox", { name: "Message Codex" });
    await expect(app.page.getByTestId("remote-chat").getByRole("alert")).toContainText("Synthetic first-read failure");
    await expect(message).toBeDisabled();
    await expect(refresh).toBeFocused();
    await app.page.unroute(read);
    await refresh.press("Enter");
    await expect(message).toBeEnabled();
    await expect(refresh).toBeFocused();
  } finally { await f.agent.close(); }
});

// The first read can fail and the next succeed with nobody touching anything
// (a slow box, a chat still being made). The keyboard was only parked on
// Refresh; it goes on to the composer once there is one to type in.
test("a first read that fails and then recovers by itself ends with the keyboard in the composer", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.listed = true;
  const read = `${f.agent.url}/v1/boxes/${BOX}/api/chats/${f.chat.id}`;
  await app.page.route(read, (route) => route.fulfill({ status: 503, json: { error: "Synthetic first-read failure" } }), { times: 1 });
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("region", { name: "Codex chats" }).getByRole("button", { name: /Codex chat/ }).click();
    const message = app.page.getByRole("textbox", { name: "Message Codex" });
    await expect(app.page.getByRole("button", { name: "Refresh chat", exact: true })).toBeFocused();
    await expect(message).toBeEnabled();
    await expect(message).toBeFocused();
  } finally { await f.agent.close(); }
});

test("a first read slow enough for the window to rescue the keyboard still ends with it in the composer", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.listed = true;
  let release = () => {};
  f.control.readHeld = new Promise<void>((resolve) => { release = resolve; });
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("region", { name: "Codex chats" }).getByRole("button", { name: /Codex chat/ }).click();
    const message = app.page.getByRole("textbox", { name: "Message Codex" });
    // The listed chat opens before its composer is ready, so focus starts
    // on the pane's recovery control.
    await expect(app.page.getByRole("button", { name: "Refresh chat", exact: true })).toBeFocused();
    release();
    await expect(message).toBeEnabled();
    await expect(message).toBeFocused();
  } finally { release(); await f.agent.close(); }
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

// What a Start asked the box to do: every POST but Home's own read of the
// person's pull requests, which it makes through exec whenever it is shown.
const started = (calls: { method: string; path: string; body: unknown }[]) =>
  calls.filter((c) => c.method === "POST" && !(c.path === "exec" && String((c.body as { command?: string } | null)?.command ?? "").endsWith("# berth-home:prs")));

test("Home creates a worktree then starts structured Codex and sends once without a terminal", async ({ app }) => {
  const f = await fixture(app.context);
  try {
    await app.open({ agent: f.agent });
    const draft = app.page.getByRole("textbox", { name: "What should your agents work on?" });
    await draft.fill("Create something");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    await expect(app.page.getByRole("article", { name: "You", exact: true })).toHaveCount(1);
    expect(started(f.calls)).toEqual([
      { method: "POST", path: "locations/shop/worktrees", body: { name: "create-something" } },
      { method: "POST", path: "chats", body: { location: "shop/create-something" } },
      { method: "POST", path: "chats/remote-1/messages", body: { text: "Create something" } },
    ]);
  } finally { await f.agent.close(); }
});

test("Home's main checkout still starts structured Codex without creating a worktree", async ({ app }) => {
  const f = await fixture(app.context);
  try {
    await app.open({ agent: f.agent });
    const composer = app.page.getByTestId("task-composer");
    await openTaskPickers(composer);
    await composer.getByRole("button", { name: "Where: New worktree", exact: true }).click();
    await app.page.getByRole("menuitemradio", { name: "Main checkout", exact: true }).click();
    await composer.getByRole("textbox", { name: "What should your agents work on?" }).fill("Explain the main checkout");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    expect(started(f.calls)).toEqual([
      { method: "POST", path: "chats", body: { location: "shop" } },
      { method: "POST", path: "chats/remote-1/messages", body: { text: "Explain the main checkout" } },
    ]);
  } finally { await f.agent.close(); }
});

for (const source of [{ pr: 42 }, { ref: "refs/merge-requests/42/head" }]) test(`Home carries the resolved ${"pr" in source ? "PR" : "ref"} and edited worktree details into creation`, async ({ app }) => {
  const f = await fixture(app.context);
  await app.page.route(`${f.agent.url}/v1/boxes/${BOX}/api/locations/shop/resolve`, (route) => route.fulfill({ json: { kind: "pr", name: "review-42", branch: "review-branch", base: "main", ...source } }));
  try {
    await app.open({ agent: f.agent });
    const composer = app.page.getByTestId("task-composer");
    await openTaskPickers(composer);
    await composer.getByRole("button", { name: "Options", exact: true }).click();
    await composer.getByRole("textbox", { name: "Start from", exact: true }).fill("#42");
    await expect(composer.getByRole("textbox", { name: "Folder", exact: true })).toHaveValue("review-42");
    await composer.getByRole("textbox", { name: "Folder", exact: true }).fill("chosen-folder");
    await composer.getByRole("textbox", { name: "Branch", exact: true }).fill("chosen-branch");
    await composer.getByRole("textbox", { name: "From", exact: true }).fill("chosen-base");
    await composer.getByRole("textbox", { name: "What should your agents work on?" }).fill("Review these changes");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    expect(started(f.calls)).toEqual([
      { method: "POST", path: "locations/shop/worktrees", body: { name: "chosen-folder", branch: "chosen-branch", base: "chosen-base", ...source } },
      { method: "POST", path: "chats", body: { location: "shop/chosen-folder" } },
      { method: "POST", path: "chats/remote-1/messages", body: { text: "Review these changes" } },
    ]);
  } finally { await f.agent.close(); }
});

test("Home applies model, reasoning and permission to the first message in its new worktree", async ({ app }) => {
  const f = await fixture(app.context, true, true);
  try {
    await app.open({ agent: f.agent });
    const composer = app.page.getByTestId("task-composer");
    await openTaskPickers(composer);
    await composer.getByRole("button", { name: "Model: Default", exact: true }).click();
    await app.page.getByRole("menuitemradio", { name: "Alpha", exact: true }).click();
    await composer.getByRole("button", { name: "Reasoning: Default", exact: true }).click();
    await app.page.getByRole("menuitemradio", { name: "High", exact: true }).click();
    await composer.getByRole("button", { name: "Permissions: Ask every time", exact: true }).click();
    await app.page.getByRole("menuitemradio", { name: "Edit workspace", exact: true }).click();
    await composer.getByRole("textbox", { name: "What should your agents work on?" }).fill("Make the change");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    expect(started(f.calls)).toEqual([
      { method: "POST", path: "locations/shop/worktrees", body: { name: "make-the-change" } },
      { method: "POST", path: "chats", body: { location: "shop/make-the-change" } },
      { method: "POST", path: "chats/remote-1/messages", body: { text: "Make the change", options: { model: "alpha", effort: "high", permission: "workspace" } } },
    ]);
  } finally { await f.agent.close(); }
});

for (const override of ["model", "effort"]) test(`Home refuses a chosen ${override} without chat.options before creating a worktree`, async ({ app }) => {
  const f = await fixture(app.context);
  await app.context.addInitScript(({ box, override }) => localStorage.setItem(`berth.composer.picks.${box}/shop`, JSON.stringify([{ agent: "codex", [override]: "custom" }])), { box: BOX, override });
  try {
    await app.open({ agent: f.agent });
    const draft = app.page.getByRole("textbox", { name: "What should your agents work on?" });
    await draft.fill("Keep my choices");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByText("Choose Codex defaults", { exact: true })).toBeVisible();
    await expect(draft).toHaveValue("Keep my choices");
    expect(started(f.calls)).toEqual([]);
  } finally { await f.agent.close(); }
});

test("Home keeps a custom Codex command on the terminal task path", async ({ app }) => {
  const f = await fixture(app.context);
  await app.context.addInitScript((box) => localStorage.setItem(`berth.composer.picks.${box}/shop`, JSON.stringify([{ agent: "custom" }])), BOX);
  try {
    await app.open({ agent: f.agent });
    await app.page.getByRole("textbox", { name: "What should your agents work on?" }).fill("Use my command");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect.poll(() => started(f.calls).map((c) => ({ path: c.path, body: c.body }))).toEqual([
      { path: "tasks", body: { location: "shop", name: "use-my-command", agent: "custom", prompt: "Use my command" } },
    ]);
    await expect(app.page.getByTestId("remote-chat")).toHaveCount(0);
  } finally { await f.agent.close(); }
});

test("Home comparison keeps the terminal attempts path", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.runs = true;
  await app.context.addInitScript((box) => localStorage.setItem(`berth.composer.picks.${box}/shop`, JSON.stringify([{ agent: "codex" }, { agent: "custom" }])), BOX);
  try {
    await app.open({ agent: f.agent });
    const composer = app.page.getByTestId("task-composer");
    await openTaskPickers(composer);
    await composer.getByRole("button", { name: /^Provider:/ }).click();
    await app.page.getByRole("menuitem", { name: "Compare agents…", exact: true }).click();
    await composer.getByRole("textbox", { name: "What should your agents work on?" }).fill("Compare these agents");
    await app.page.getByRole("button", { name: "Try 2 ways", exact: true }).click();
    await expect(app.page.getByText(`Trying 2 ways on ${BOX}`, { exact: true })).toBeVisible();
    const mutations = started(f.calls);
    expect(mutations.map((c) => c.path)).toEqual(["runs"]);
    expect(mutations[0].body).toMatchObject({ template: "attempts", params: { prompt: "Compare these agents", attempts: [{ agent: "codex" }, { agent: "custom" }] } });
    await expect(app.page.getByTestId("remote-chat")).toHaveCount(0);
  } finally { await f.agent.close(); }
});

test("Home keeps the prompt and attempts nothing else when worktree creation fails", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.worktreeError = true;
  try {
    await app.open({ agent: f.agent });
    const draft = app.page.getByRole("textbox", { name: "What should your agents work on?" });
    await draft.fill("Keep this prompt");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByText("Couldn't create the worktree", { exact: true })).toBeVisible();
    await expect(draft).toHaveValue("Keep this prompt");
    expect(started(f.calls).map((c) => c.path)).toEqual(["locations/shop/worktrees"]);
    await expect(app.page.getByTestId("remote-chat")).toHaveCount(0);
  } finally { await f.agent.close(); }
});

for (const lost of [false, true]) test(`Home retains its worktree and prompt after a ${lost ? "lost" : "refused"} chat start and reuses the worktree on manual retry`, async ({ app }) => {
  const f = await fixture(app.context);
  f.control.startError = !lost;
  f.control.lostStart = lost;
  try {
    await app.open({ agent: f.agent });
    const draft = app.page.getByRole("textbox", { name: "What should your agents work on?" });
    await draft.fill("Keep this worktree");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByText("Couldn't start Codex", { exact: true })).toBeVisible();
    await expect(app.page.getByText(`The worktree is at /w/shop-keep-this-worktree on ${BOX}. Start again to use it without creating another worktree.`, { exact: true })).toBeVisible();
    if (lost) await expect(app.page.getByText(/Codex may have started/)).toBeVisible();
    await expect(draft).toHaveValue("Keep this worktree");
    expect(started(f.calls).map((c) => c.path)).toEqual(["locations/shop/worktrees", "chats"]);
    f.control.startError = false;
    f.control.lostStart = false;
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    expect(started(f.calls).map((c) => c.path)).toEqual(["locations/shop/worktrees", "chats", "chats", "chats/remote-1/messages"]);
    expect(f.calls.filter((c) => c.method === "POST" && c.path === "chats").map((c) => c.body)).toEqual([{ location: "shop/keep-this-worktree" }, { location: "shop/keep-this-worktree" }]);
  } finally { await f.agent.close(); }
});

test("Home opens its new chat with the prompt kept after a lost first-message response and never resends", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.lostSend = true;
  try {
    await app.open({ agent: f.agent });
    await app.page.getByRole("textbox", { name: "What should your agents work on?" }).fill("Do not resend this");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    await expect(app.page.getByRole("textbox", { name: "Message Codex" })).toHaveValue("Do not resend this");
    await expect(app.page.getByText("Could not confirm the message", { exact: true })).toBeVisible();
    await expect(app.page.getByRole("article", { name: "You", exact: true })).toContainText("Do not resend this");
    await app.page.getByRole("button", { name: "Refresh chat", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat").getByRole("status")).toHaveText("Ready");
    await expect(app.page.getByRole("textbox", { name: "Message Codex" })).toHaveValue("Do not resend this");
    expect(started(f.calls)).toEqual([
      { method: "POST", path: "locations/shop/worktrees", body: { name: "do-not-resend-this" } },
      { method: "POST", path: "chats", body: { location: "shop/do-not-resend-this" } },
      { method: "POST", path: "chats/remote-1/messages", body: { text: "Do not resend this" } },
    ]);
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

test("the launcher's pickers say their whole value and wrap as aligned rows", async ({ app }) => {
  const f = await fixture(app.context, true, true);
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    const composer = app.page.getByTestId("task-composer");
    const pickers = composer.locator('[data-slot="launch-agent"]').getByRole("button", { name: /^(Provider|Model|Reasoning|Permissions):/ });
    // A model that takes an effort brings the fourth picker, as in the app with Codex.
    await composer.getByRole("button", { name: "Model: Default", exact: true }).click();
    await app.page.getByRole("menuitemradio", { name: "Alpha", exact: true }).click();
    for (const width of [1280, 820, 620]) {
      await app.page.setViewportSize({ width, height: 900 });
      await expect(pickers).toHaveCount(4);
      const boxes = await pickers.evaluateAll((buttons) =>
        buttons.map((button) => {
          const label = button.querySelector(".truncate") as HTMLElement;
          const r = button.getBoundingClientRect();
          return { name: button.getAttribute("aria-label"), top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), cut: label.scrollWidth > label.clientWidth + 1 };
        }),
      );
      // Nothing is cut short: "Permissions: Ask every time" reads in full, and so does where the work runs.
      expect(boxes.filter((b) => b.cut).map((b) => b.name), `width ${width}`).toEqual([]);
      const place = await composer.locator('[data-slot="launch-place"] .truncate').evaluateAll((labels) => labels.filter((label) => (label as HTMLElement).scrollWidth > (label as HTMLElement).clientWidth + 1).map((label) => label.textContent));
      expect(place, `width ${width}`).toEqual([]);
      // Every row of the toolbar starts at its left edge, and nothing on a row overlaps: not two picks, not a pick and Send.
      const bar = await composer.locator('[data-slot="launch-toolbar"]').boundingBox();
      const items = await composer.locator('[data-slot="launch-toolbar"]').evaluate((toolbar) =>
        [...toolbar.querySelectorAll(':scope > [data-slot] > *')].map((el) => {
          const r = el.getBoundingClientRect();
          return { mid: Math.round(r.top + r.height / 2), left: Math.round(r.left), right: Math.round(r.right) };
        }),
      );
      expect(items.length, `width ${width}`).toBeGreaterThanOrEqual(6);
      const rows: (typeof items)[] = [];
      for (const item of [...items].sort((a, b) => a.mid - b.mid || a.left - b.left)) {
        const row = rows.at(-1);
        if (row && Math.abs(row[0].mid - item.mid) <= 6) row.push(item);
        else rows.push([item]);
      }
      for (const row of rows) {
        expect(row[0].left - Math.round(bar!.x), `row start at width ${width}`).toBeLessThanOrEqual(1);
        for (let i = 1; i < row.length; i++) expect(row[i].left, `width ${width}`).toBeGreaterThanOrEqual(row[i - 1].right);
        expect(row.at(-1)!.right, `width ${width}`).toBeLessThanOrEqual(Math.round(bar!.x + bar!.width) + 1);
      }
      // Send ends the last row.
      const send = await composer.locator('[data-slot="launch-agent"] > span').last().boundingBox();
      expect(Math.round(send!.x + send!.width / 2), `width ${width}`).toBe(Math.round((rows.at(-1)!.at(-1)!.left + rows.at(-1)!.at(-1)!.right) / 2));
      await composer.screenshot({ path: test.info().outputPath(`launcher-${width}.png`) });
    }
    // A provider's icon sits beside its name, on one line.
    await composer.getByRole("button", { name: /^Provider:/ }).click();
    const item = app.page.getByRole("menuitemradio", { name: "Codex", exact: true });
    await expect(item).toBeVisible();
    const parts = await item.evaluate((el) => {
      const icon = el.querySelector("svg:not([aria-hidden])") ?? el.querySelectorAll("svg")[el.querySelectorAll("svg").length - 1];
      const name = [...el.querySelectorAll("span")].find((span) => span.textContent === "Codex")!;
      const a = icon.getBoundingClientRect();
      const b = name.getBoundingClientRect();
      return { iconMid: a.top + a.height / 2, nameTop: b.top, nameBottom: b.bottom, height: el.getBoundingClientRect().height };
    });
    expect(parts.iconMid).toBeGreaterThan(parts.nameTop);
    expect(parts.iconMid).toBeLessThan(parts.nameBottom);
    expect(parts.height).toBeLessThan(40);
    await app.page.screenshot({ path: test.info().outputPath("launcher-provider-menu.png"), clip: { x: 0, y: 0, width: 620, height: 900 } });
  } finally { await f.agent.close(); }
});

test("an artifact Codex adds shows as a card in its chat and opens from there", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.listed = true;
  f.control.art = [{ id: "a1b2c3d4e5", title: "Search speed-up plan", kind: "notes", format: "markdown", body: "# Plan\n\nIndex first, then cache." }];
  f.chat.items = [
    { id: "u", kind: "user", text: "Write the plan down" },
    { id: "t1", kind: "tool", text: 'berthd artifact add notes/plan.md --title "Search speed-up plan"\nArtifact a1b2c3d4e5 v1 · notes · Search speed-up plan\nShown in your chat and on fix\'s board.' },
    // A line in the right form for something the box does not keep shows no card of it.
    { id: "t2", kind: "tool", text: "cat build.log\nArtifact 0000000000 v1 · page · Not on the box" },
    { id: "a", kind: "assistant", text: "The plan is on the board." },
  ];
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("region", { name: "Codex chats" }).getByRole("button", { name: /Codex chat/ }).click();
    const chat = app.page.getByTestId("remote-chat");
    const card = chat.locator('[data-art-card="a1b2c3d4e5"]');
    await expect(card.getByText("Search speed-up plan", { exact: true })).toBeVisible();
    await expect(card.locator("p").last()).toHaveText("Notes · v1");
    await expect(chat.locator("[data-art-card]")).toHaveCount(1);
    await expect(chat.getByText("“Not on the box” is no longer on the box")).toBeVisible();
    // The command stays readable under the stock tool group, and the chat's header leads to the worktree's board.
    await expect(chat.getByRole("button", { name: "2 tool calls", exact: true })).toBeVisible();
    await expect(chat.getByRole("button", { name: "1 artifact in this worktree" })).toBeVisible();
    await app.page.screenshot({ path: test.info().outputPath("chat-artifact.png") });
    await chat.getByRole("button", { name: "Open Search speed-up plan", exact: true }).click();
    const pane = app.page.locator("[data-testid=pane][data-pane-kind=artifact]:visible");
    await expect(pane.getByRole("heading", { name: "Search speed-up plan" })).toBeVisible();
    await expect(pane).toContainText("Index first, then cache.");
    // Reading a chat and its artifacts changes nothing on the box.
    expect(f.calls.filter((c) => c.method !== "GET" && (c.path.startsWith("chats") || c.path.includes("/artifacts")))).toEqual([]);
  } finally { await f.agent.close(); }
});

test("a box that keeps no artifacts shows the command and no card", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.listed = true;
  f.chat.items = [{ id: "t1", kind: "tool", text: "berthd artifact add notes/plan.md\nArtifact a1b2c3d4e5 v1 · notes · Search speed-up plan" }];
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("region", { name: "Codex chats" }).getByRole("button", { name: /Codex chat/ }).click();
    const chat = app.page.getByTestId("remote-chat");
    await expect(chat.getByRole("button", { name: "1 tool call", exact: true })).toBeVisible();
    await expect(chat.locator("[data-art-card], [data-testid=art-chip]")).toHaveCount(0);
    await expect(chat.getByText("no longer on the box")).toHaveCount(0);
  } finally { await f.agent.close(); }
});

test("Send to agent from the browser's console reaches the worktree's Codex chat", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.listed = true;
  // The page a Browser tab asks for, with the proxy's own console script in it (internal/proxy/devtools.js).
  const script = readFileSync(new URL("../../internal/proxy/devtools.js", import.meta.url), "utf8");
  await app.context.route(/^https?:\/\/[^/]+\.localhost:1377(?:\/|$)/, (route) => route.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><html><head>${new URL(route.request().url()).searchParams.has("__berth_devtools") ? `<script>${script}</script>` : ""}<title>Cart</title></head><body><h1>Cart</h1><script>console.error("checkout failed: 500");</script></body></html>` }));
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("button", { name: /^New browser tab/ }).click();
    const pane = app.page.locator("[data-testid=browser-pane]:visible");
    const address = pane.getByRole("textbox", { name: "Address" });
    await address.fill("http://fix.shop.devl.localhost:1377/cart");
    await address.press("Enter");
    await expect(pane.frameLocator("iframe").getByRole("heading", { name: "Cart" })).toBeVisible();
    await app.page.keyboard.press("ControlOrMeta+Alt+KeyI");
    const drawer = app.page.getByTestId("devtools-drawer");
    const row = drawer.getByTestId("console-row").filter({ hasText: "checkout failed: 500" });
    await row.hover();
    await row.getByRole("button", { name: "Send to agent" }).click();
    const sender = drawer.getByTestId("devtools-sender");
    // Codex is between turns: the note is open, not "No agent runs in this worktree".
    const note = sender.getByRole("textbox", { name: "A note for the agent" });
    await expect(note).toBeEnabled();
    await note.fill("It breaks checkout");
    await sender.getByRole("button", { name: "Send to agent" }).click();
    await expect(app.page.getByText("Sent to the agent")).toBeVisible();
    const sent = f.calls.filter((c) => c.path.endsWith("/messages"));
    expect(sent).toHaveLength(1);
    expect(sent[0].path).toBe("chats/remote-1/messages");
    expect((sent[0].body as { text: string }).text).toContain("checkout failed: 500");
    expect((sent[0].body as { text: string }).text).toContain("It breaks checkout");
    expect(Object.keys(sent[0].body as object)).toEqual(["text"]);
    // While Codex works, nothing is sent and the field says why.
    f.chat.state = "running";
    await row.hover();
    await row.getByRole("button", { name: "Send to agent" }).click();
    await expect(sender.getByPlaceholder("Codex is working. Send this when its turn ends")).toBeDisabled();
    await expect(sender.getByRole("button", { name: "Send to agent" })).toBeDisabled();
    expect(f.calls.filter((c) => c.path.endsWith("/messages"))).toHaveLength(1);
  } finally { await f.agent.close(); }
});

test("a Codex chat is headed by the name its worktree was given", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.listed = true;
  f.control.title = "Fix checkout totals";
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("region", { name: "Codex chats" }).getByRole("button", { name: /Codex chat/ }).click();
    const header = app.page.getByTestId("remote-chat").locator("header");
    await expect(header).toContainText("Fix checkout totals");
    // The folder is still there to read, on hover.
    await expect(header.getByText("Fix checkout totals", { exact: true })).toHaveAttribute("title", DIR);
    await expect(header).not.toContainText(DIR);
  } finally { await f.agent.close(); }
});

test("Burf's own tool asks in the chat before it acts, once or not at all", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.listed = true;
  f.chat.state = "waiting"; f.chat.turn_id = "turn-1";
  f.chat.items = [{ id: "u", kind: "user", text: "Deploy it" }];
  f.chat.approvals = [{ id: "tool-1", kind: "tool", detail: "berth_exec\nlocation: shop/fix\n$ make deploy" }];
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("region", { name: "Codex chats" }).getByRole("button", { name: /Codex chat/ }).click();
    const ask = app.page.getByRole("region", { name: "Approval required" });
    // The question is in the person's words, with exactly what would run.
    await expect(ask.getByRole("group", { name: "Run this command outside the sandbox?" })).toBeVisible();
    await expect(ask.locator("pre")).toHaveText("location: shop/fix\n$ make deploy");
    await expect(ask).toContainText("outside Codex's sandbox");
    // No standing yes for a tool.
    await expect(ask.getByRole("button", { name: "Allow for chat" })).toHaveCount(0);
    await expect(ask.getByRole("button", { name: "Allow always" })).toHaveCount(0);
    await expect(ask.getByRole("button", { name: "Deny", exact: true })).toBeVisible();
    await ask.getByRole("button", { name: "Allow once", exact: true }).click();
    expect(f.calls.filter((c) => c.path.endsWith("/approvals"))).toEqual([{ method: "POST", path: "chats/remote-1/approvals", body: { id: "tool-1", decision: "accept" } }]);
  } finally { await f.agent.close(); }
});

test("what became of work the chat started arrives as Burf's card, not as the person's message", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.listed = true;
  const text = '<berth-notification>\nThis comes from Burf, not from the user.\n<report kind="task" session="shop-api-claude" worktree="shop/api" status="finished"><answer>The checkout test passes now.</answer></report>\n</berth-notification>';
  f.chat.items = [
    { id: "u", kind: "user", text: "Have another agent fix the checkout test" },
    { id: "a", kind: "assistant", text: "Started. I will hear back." },
    { id: "r1", kind: "report", text },
    // A report this app cannot read still shows as Burf's, in plain words.
    { id: "r2", kind: "report", text: "A run ended." },
  ];
  f.chat.reports = { r1: [{ kind: "task", session: "shop-api-claude", worktree: "shop/api", status: "finished", answer: "The checkout test passes now." }] };
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("region", { name: "Codex chats" }).getByRole("button", { name: /Codex chat/ }).click();
    const chat = app.page.getByTestId("remote-chat");
    const fromBurf = chat.getByRole("region", { name: "From Burf" });
    await expect(fromBurf).toHaveCount(2);
    const card = fromBurf.first().getByRole("group", { name: "Burf: api finished" });
    await expect(card).toBeVisible();
    await expect(fromBurf.first()).not.toContainText("berth-notification");
    await expect(fromBurf.nth(1)).toContainText("A run ended.");
    // It is not shown as something the person said.
    await expect(chat.getByRole("article", { name: "You", exact: true })).toHaveCount(1);
    await expect(chat.getByRole("article", { name: "Codex", exact: true })).toHaveCount(1);
    await app.page.screenshot({ path: test.info().outputPath("chat-report.png") });
  } finally { await f.agent.close(); }
});
