import { readFileSync } from "node:fs";

import { BOX, DIR, fakeAgent } from "./fake-agent";
import { expect, mockOnly, test, type App } from "./fixtures";
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
  const chat = { id: "remote-1", agent: "codex", mode: "chat", location: "shop/fix", cwd: DIR, state: "idle", started_at: "2026-10-08T12:00:00Z", thread_id: "remote-provider-thread", turn_id: "", items: [] as { id: string; kind: string; text: string }[], approvals: [] as { id: string; kind: string; detail: string }[] };
  // art: what the box keeps for the worktree (berthd artifact add), with each one's content. Unset, the box keeps none.
  const control = { listed: false, lostSend: false, lostStart: false, offline: false, startDelay: 0, art: undefined as { id: string; title: string; kind: string; format: string; body: string }[] | undefined, title: "" };
  await context.route(`${agent.url}${base}**`, async (route) => {
    const path = new URL(route.request().url()).pathname.slice(base.length);
    const method = route.request().method();
    calls.push({ method, path, body: route.request().postDataJSON() });
    if (path === "info") return route.fulfill({ json: { name: BOX, version: "test", capabilities: supported ? ["chat.codex", "transcript", ...(options ? ["chat.options"] : []), ...(fullAccess ? ["chat.full-access"] : []), ...(control.art ? ["artifacts"] : [])] : ["transcript"], agents: [{ id: "codex", name: "Codex", command: "codex" }, { id: "custom", name: "Custom Codex", command: "codex --model custom" }] } });
    if (path === "locations" && method === "GET" && control.title) {
      // The worktree as the box lists it once a person has named it.
      const listed = await (await route.fetch()).json() as { worktrees?: { path: string; title?: string }[] }[];
      for (const loc of listed) for (const wt of loc.worktrees ?? []) if (wt.path === DIR) wt.title = control.title;
      return route.fulfill({ json: listed });
    }
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
      control.listed = true;
      if (control.lostStart) return route.abort("connectionreset");
      if (control.startDelay) await new Promise((resolve) => setTimeout(resolve, control.startDelay));
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
    return route.fulfill({ json: chat });
  });
  return { agent, chat, calls, control };
}

test("new remote Codex uses structured requests and reload recovers the same chat", async ({ app }) => {
  const f = await fixture(app.context);
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("button", { name: "New Codex", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    await expect(app.page.getByRole("group", { name: "Show the agent as" })).toHaveCount(0);
    await app.page.getByRole("textbox", { name: "Message Codex" }).fill("Exactly once");
    await app.page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(app.page.getByRole("article", { name: "Codex", exact: true })).toContainText("Structured reply");
    await expect(app.page.getByRole("textbox", { name: "Message Codex" })).toHaveValue("");
    await app.page.reload();
    await openWorktree(app);
    await expect(app.page.getByRole("article", { name: "Codex", exact: true })).toContainText("Structured reply");
    await expect(app.page.getByRole("textbox", { name: "Message Codex" })).toHaveValue("");
    expect(f.calls.filter((c) => c.method === "POST" && c.path === "chats")).toEqual([{ method: "POST", path: "chats", body: { location: "shop/fix" } }]);
    expect(f.calls.filter((c) => c.path.endsWith("/messages"))).toHaveLength(1);
    expect(f.calls.some((c) => c.path.startsWith("sessions/") || c.method === "POST" && c.path === "sessions")).toBe(false);
    await app.page.getByRole("button", { name: "Stop chat", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat").getByRole("status")).toHaveText("Stopped");
  } finally { await f.agent.close(); }
});

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
  f.control.lostSend = true;
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("button", { name: "New Codex", exact: true }).click();
    const draft = app.page.getByRole("textbox", { name: "Message Codex" });
    await draft.fill("Do not replay");
    await app.page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(app.page.locator('[role="alert"]:not([data-testid^="announce"])')).toContainText("may have arrived");
    await expect(draft).toHaveValue("Do not replay");
    f.control.offline = true;
    await app.page.getByRole("button", { name: "Refresh chat", exact: true }).click();
    await expect(app.page.getByTestId("remote-chat").getByRole("status")).toHaveText("Disconnected");
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

test("a lost start is not retried and the owned chat can be recovered", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.lostStart = true;
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("button", { name: "New Codex", exact: true }).click();
    await expect(app.page.getByText(/Codex may have started/)).toBeVisible();
    await app.page.getByRole("button", { name: "Close pane", exact: true }).click();
    await app.page.getByRole("region", { name: "Codex chats" }).getByRole("button", { name: /Codex chat/ }).click();
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
    expect(f.calls.filter((c) => c.method === "POST" && c.path === "chats")).toHaveLength(1);
  } finally { await f.agent.close(); }
});

for (const custom of [false, true]) test(`${custom ? "custom commands" : "older boxes"} retain terminal launching`, async ({ app }) => {
  const f = await fixture(app.context, custom);
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("button", { name: custom ? "New Custom Codex" : "New Codex", exact: true }).click();
    await expect.poll(() => f.calls.some((c) => c.method === "POST" && c.path === "sessions")).toBe(true);
    expect(f.calls.some((c) => c.method === "POST" && c.path === "chats")).toBe(false);
    await expect(app.page.getByTestId("remote-chat")).toHaveCount(0);
  } finally { await f.agent.close(); }
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

test("new-worktree structured launch is explicitly blocked and preserves its draft", async ({ app }) => {
  const f = await fixture(app.context);
  try {
    await app.open({ agent: f.agent });
    const draft = app.page.getByRole("textbox", { name: "What should your agents work on?" });
    await draft.fill("Create something");
    await app.page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(app.page.getByText("Open a worktree first", { exact: true })).toBeVisible();
    await expect(draft).toHaveValue("Create something");
    expect(f.calls.some((c) => c.method === "POST" && ["tasks", "chats", "sessions"].includes(c.path))).toBe(false);
  } finally { await f.agent.close(); }
});

test("a slow start stays in Starting rather than pretending Codex is thinking", async ({ app }) => {
  const f = await fixture(app.context);
  f.control.startDelay = 1200;
  try {
    await app.open({ agent: f.agent });
    await openWorktree(app);
    await app.page.getByRole("button", { name: "New Codex", exact: true }).click();
    await expect(app.page.getByText("Starting Codex…", { exact: true })).toBeVisible();
    await expect(app.page.getByRole("textbox", { name: "Message Codex" })).toHaveCount(0);
    await expect(app.page.getByTestId("remote-chat")).toBeVisible();
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
    await expect(card.locator("[data-art-title]")).toHaveText("Search speed-up plan");
    await expect(card.locator("[data-art-version]")).toHaveText("v1");
    await expect(chat.locator("[data-art-card]")).toHaveCount(1);
    await expect(chat.getByText("“Not on the box” is no longer on the box")).toBeVisible();
    // The command stays readable under Tool activity, and the chat's header leads to the worktree's board.
    await expect(chat.getByText("Tool activity · 2")).toBeVisible();
    await expect(chat.getByRole("button", { name: "1 artifact in this worktree" })).toBeVisible();
    await app.page.screenshot({ path: test.info().outputPath("chat-artifact.png") });
    await card.getByRole("button", { name: "Open", exact: true }).click();
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
    await expect(chat.getByText("Tool activity · 1")).toBeVisible();
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
