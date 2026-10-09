import { BOX, DIR, SESSION, fakeAgent, type FakeAgent } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

let agent: FakeAgent;
test.beforeEach(async () => {
  mockOnly("chat-first acceptance uses an isolated synthetic agent");
  agent = await fakeAgent();
});
test.afterEach(async () => { await agent?.close(); });

function newChat() {
  agent.session = { agent_state: "idle", command: "claude", title: "" };
  agent.screen = () => ["─".repeat(80), "❯ ", "─".repeat(80)].join("\n");
  agent.transcript = () => ({ body: { source: "none", items: [], next: 0, crew: [] } });
}

test("a fresh profile opens a remote agent as chat without Labs", async ({ app }) => {
  await app.open({ agent, prefs: { labs: false, labsChosen: true, version: 3 } });
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.chat).toBeVisible();
  await expect(app.chat.getByText("The retry loop never backs off; fixed it.")).toBeVisible();
  await expect(app.composer.getByRole("textbox", { name: "Reply" })).toBeVisible();
  await expect(app.composer.getByRole("textbox", { name: "Reply" })).toBeFocused();
  await expect(app.page.getByRole("button", { name: "Chat", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("an existing terminal preference is preserved", async ({ app }) => {
  await app.open({ agent, prefs: { agentView: "terminal", version: 3 } });
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.page.getByRole("button", { name: "Terminal", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(app.chat).toHaveCount(0);
  await expect.poll(() => app.stored("berth.prefs")).toMatchObject({ agentView: "terminal" });
});

test("Codex opens as chat without requiring a demo override", async ({ app }) => {
  agent.session = { agent: "codex", command: "codex" };
  await app.open({ agent });
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.chat).toBeVisible();
  await expect(app.composer.getByRole("textbox", { name: "Reply" })).toBeVisible();
  await expect(app.composer.getByRole("textbox", { name: "Reply" })).toBeFocused();
});

for (const arrival of ["refresh", "split", "tab"] as const) {
  test(`a chat arriving by background ${arrival} keeps the keyboard in the current draft`, async ({ app }) => {
    let appeared = false;
    const background = "background-claude";
    await app.page.route(`${agent.url}/v1/boxes/${BOX}/api/sessions`, async (route) => {
      const sessions = await (await route.fetch()).json();
      await route.fulfill({ json: appeared ? [...sessions, { ...sessions[0], name: background, title: "", agent_state: "idle" }] : sessions });
    });
    await app.page.route(`${agent.url}/v1/boxes/${BOX}/api/sessions/${background}/transcript**`, (route) =>
      route.fulfill({ json: { source: "none", items: [], next: 0, crew: [] } }));
    await app.page.route(`${agent.url}/v1/boxes/${BOX}/api/sessions/${background}/screen`, (route) =>
      route.fulfill({ json: { screen: "" } }));
    await app.open({ agent });
    await app.openWorktree(`${BOX}/fix`);
    const reply = app.chat.filter({ hasText: "The retry loop never backs off; fixed it." }).getByRole("textbox", { name: "Reply" });
    await reply.fill("Keep writing here");
    const selected = app.page.locator("[data-tab-strip] [role=tab][aria-selected=true]");
    const tab = await selected.getAttribute("data-tab");
    await expect.poll(() => agent.calls.includes("GET /v1/events")).toBe(true);
    appeared = true;
    agent.event({ type: arrival === "refresh" ? "session.started" : "session.open", data: { name: background, location: "shop/fix", path: DIR, open: arrival === "refresh" ? undefined : arrival, agent: "claude" } });
    if (arrival === "split") {
      await expect(app.panes).toHaveCount(2);
      await expect(app.chat.getByRole("heading", { name: "New chat" })).toBeVisible();
    } else {
      await expect(app.page.locator("[data-tab-strip] [role=tab]")).toHaveCount(2);
      await expect(app.panes).toHaveCount(1);
    }
    await expect(selected).toHaveAttribute("data-tab", tab!);
    await expect(reply).toBeFocused();
    await app.page.keyboard.type(" without interruption");
    await expect(reply).toHaveValue("Keep writing here without interruption");
    expect(agent.sends).toEqual([]);
  });
}

test("a restored chat finishing its first read does not take the keyboard from a dialog", async ({ app }) => {
  newChat();
  await app.open({ agent });
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.composer.getByRole("textbox", { name: "Reply" })).toBeVisible();
  let release!: () => void;
  const reading = new Promise<void>((resolve) => { release = resolve; });
  let requested = false;
  agent.transcript = async () => {
    requested = true;
    await reading;
    return { body: { source: "none", items: [], next: 0, crew: [] } };
  };
  try {
    await app.page.reload();
    await expect.poll(() => requested).toBe(true);
    await app.page.keyboard.press("ControlOrMeta+k");
    const search = app.page.getByRole("combobox", { name: "Search sessions, worktrees and commands" });
    await search.fill("Settings");
    release();
    // Behind the dialog the composer has no role to find it by.
    await expect(app.composer.locator("textarea")).toBeVisible();
    await expect(search).toBeFocused();
    await app.page.keyboard.type(": Appearance");
    await expect(search).toHaveValue("Settings: Appearance");
  } finally { release(); }
});

// A chat is ready a moment after its pane opens. If the person has moved the
// keyboard anywhere else by then, even to a plain button, it stays there.
test("a chat that becomes ready later leaves the keyboard where the person moved it", async ({ app }) => {
  newChat();
  let release!: () => void;
  const reading = new Promise<void>((resolve) => { release = resolve; });
  let requested = false;
  agent.transcript = async () => {
    requested = true;
    await reading;
    return { body: { source: "none", items: [], next: 0, crew: [] } };
  };
  try {
    await app.open({ agent });
    await app.openWorktree(`${BOX}/fix`);
    await expect.poll(() => requested).toBe(true);
    const home = app.page.getByTestId("nav-home");
    await home.focus();
    release();
    await expect(app.composer.getByRole("textbox", { name: "Reply" })).toBeVisible();
    await expect(home).toBeFocused();
  } finally { release(); }
});

test("a chat without a composer focuses its recovery control", async ({ app }) => {
  agent.transcript = () => ({ status: 500, body: { error: "Synthetic unreadable transcript" } });
  await app.open({ agent });
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.panes.getByRole("button", { name: "Retry", exact: true })).toBeFocused();
  await expect(app.composer).toHaveCount(0);
});

test("an older box defaults to terminal but keeps an explicit chat choice", async ({ app }) => {
  agent.capabilities = ["turns"];
  await app.open({ agent });
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.page.getByRole("button", { name: "Terminal", exact: true })).toHaveAttribute("aria-pressed", "true");
  await app.page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(app.page.getByRole("button", { name: "Chat", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(app.page.getByRole("button", { name: "Show terminal", exact: true })).toBeVisible();
  await expect(app.composer).toHaveCount(0);
});

test("terminal fallback stays local to its pane and survives reload", async ({ app }) => {
  await app.open({ agent });
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.chat).toBeVisible();
  await app.page.getByRole("button", { name: "Terminal", exact: true }).click();
  await expect(app.chat).toHaveCount(0);
  await expect.poll(() => app.stored("berth.prefs")).toMatchObject({ agentView: "conversation" });
  await app.page.reload();
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.page.getByRole("button", { name: "Terminal", exact: true })).toHaveAttribute("aria-pressed", "true");
  await app.page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(app.chat.getByText("The retry loop never backs off; fixed it.")).toBeVisible();
});

test("the default chat view is a normal General setting", async ({ app }) => {
  await app.open({ agent, prefs: { labs: false, labsChosen: true, version: 3 } });
  const general = await app.openSettings("general");
  const choice = general.getByRole("group", { name: "Open supported agents as" });
  await expect(choice.getByRole("button", { name: "Chat", exact: true })).toHaveAttribute("aria-pressed", "true");
  await choice.getByRole("button", { name: "Terminal", exact: true }).click();
  await expect.poll(() => app.stored("berth.prefs")).toMatchObject({ agentView: "terminal" });
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.chat).toHaveCount(0);
});

for (const command of ["sh", "gemini"]) {
  test(`${command} remains a terminal rather than an unsupported chat`, async ({ app }) => {
    agent.session = { agent: command === "sh" ? "" : command, command };
    await app.open({ agent });
    await app.openWorktree(`${BOX}/fix`);
    await expect(app.panes).toBeVisible();
    await expect(app.chat).toHaveCount(0);
    await expect(app.page.getByRole("group", { name: "Show the agent as" })).toHaveCount(0);
  });
}

for (const width of [1440, 720, 390]) {
  test(`a new chat keeps its composer at the bottom at ${width}px`, async ({ app }, info) => {
    await app.page.setViewportSize({ width, height: 900 });
    newChat();
    await app.open({ agent });
    await app.openWorktree(`${BOX}/fix`);
    if (width < 600) await app.page.getByRole("button", { name: "Hide the sidebar", exact: true }).click();
    await expect(app.chat.getByRole("heading", { name: "New chat" })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Chat", exact: true })).toBeInViewport({ ratio: 1 });
    await expect(app.page.getByRole("button", { name: "Terminal", exact: true })).toBeInViewport({ ratio: 1 });
    const reply = app.composer.getByRole("textbox", { name: "Reply" });
    await expect(reply).toBeInViewport();
    const bounds = await reply.boundingBox();
    expect(bounds!.y).toBeGreaterThan(600);
    await reply.fill("A draft that is not sent");
    await expect(reply).toHaveValue("A draft that is not sent");
    expect(agent.calls.filter((c) => c.startsWith("POST") && c.includes("/send"))).toEqual([]);
    await app.page.screenshot({ path: info.outputPath(`chat-first-${width}.png`) });
  });
}

test("the first message is sent once and appears in the conversation", async ({ app }) => {
  newChat();
  const requests: unknown[] = [];
  await app.page.route(`${agent.url}/v1/boxes/${BOX}/api/sessions/${SESSION}/send`, async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { queued: false } });
  });
  await app.open({ agent });
  await app.openWorktree(`${BOX}/fix`);
  const reply = app.composer.getByRole("textbox", { name: "Reply" });
  await expect(app.chat.getByRole("heading", { name: "New chat" })).toBeVisible();
  await reply.fill("Write a focused regression test");
  await reply.press("Enter");
  await expect(app.chat.locator("[data-kind=user]")).toContainText("Write a focused regression test");
  await expect(reply).toHaveValue("");
  // One request, carrying the key that lets the box drop a deliberate resend of the same text.
  expect(requests).toEqual([{ text: "Write a focused regression test", enter: true, when: "idle", idem_key: expect.stringMatching(/^app-/) }]);
});

test("a failed first send restores the draft without retrying automatically", async ({ app }) => {
  newChat();
  let requests = 0;
  await app.page.route(`${agent.url}/v1/boxes/${BOX}/api/sessions/${SESSION}/send`, async (route) => {
    requests++;
    await route.fulfill({ status: 503, json: { error: "The box is unavailable" } });
  });
  await app.open({ agent });
  await app.openWorktree(`${BOX}/fix`);
  const reply = app.composer.getByRole("textbox", { name: "Reply" });
  await expect(app.chat.getByRole("heading", { name: "New chat" })).toBeVisible();
  await reply.fill("Keep this draft");
  await reply.press("Enter");
  await expect(app.page.getByText(`Can't reach ${BOX}`, { exact: true })).toBeVisible();
  await expect(reply).toHaveValue("Keep this draft");
  await expect(app.chat.locator("[data-kind=user]")).toHaveCount(0);
  expect(requests).toBe(1);
});
