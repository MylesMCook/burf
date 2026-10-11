import { BOX, fakeAgent } from "./fake-agent";
import { expect, mockOnly, openTaskPickers, test, type App } from "./fixtures";

test.beforeEach(() => mockOnly("synthetic new-task composer fixtures"));

const composer = (app: App) => app.page.getByTestId("task-composer");
const summary = (app: App) => composer(app).getByTestId("task-composer-summary");
const pickerNames = /^(Project|Box|Where|Provider|Agents|Model|Reasoning|Permissions):/;

async function home(app: App, params?: Record<string, string>) {
  await app.context.addInitScript(() => {
    if (!localStorage.getItem("berth.newWorktree.project.v2")) localStorage.setItem("berth.newWorktree.project.v2", JSON.stringify("name:evals"));
  });
  await app.open({ params });
  await expect(summary(app)).toHaveAccessibleName(new RegExp("^(?:Task options: )?evals on gpu · new worktree · Claude Code$"));
}

test("Home rests on the prompt and a summary of the task's current choices", async ({ app }) => {
  await home(app);
  await expect(composer(app).getByRole("textbox", { name: "What should your agents work on?" })).toBeVisible();
  await expect(summary(app)).toHaveAttribute("aria-expanded", "false");
  const controls = await summary(app).getAttribute("aria-controls");
  expect(controls).toBeTruthy();
  await expect(app.page.locator(`[id="${controls}"]`)).toBeHidden();
  await expect(composer(app).getByRole("button", { name: pickerNames })).toHaveCount(0);
  await expect(composer(app).getByRole("button", { name: "Options", exact: true })).toHaveCount(0);
  await expect(composer(app).getByRole("button", { name: /^Start:/ })).toBeVisible();
});

test("opening the summary restores the pickers and their choices update its words", async ({ app }) => {
  await home(app);
  await openTaskPickers(composer(app));
  await expect(summary(app)).toHaveText("Task options");
  for (const name of ["Project: evals", "Box: gpu", "Where: New worktree", "Provider: Claude Code", "Model: Default", "Reasoning: Default"]) {
    await expect(composer(app).getByRole("button", { name, exact: true })).toBeVisible();
  }
  await composer(app).getByRole("button", { name: "Provider: Claude Code", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: "Codex", exact: true }).click();
  await expect(summary(app)).toHaveAccessibleName(new RegExp("^(?:Task options: )?evals on gpu · new worktree · Codex$"));
  await composer(app).getByRole("button", { name: "Project: evals", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: /^shop\b/ }).click();
  await expect(summary(app)).toHaveAccessibleName(new RegExp("^(?:Task options: )?shop on devl · new worktree · Claude Code$"));
  await composer(app).getByRole("button", { name: "Box: devl", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: /^gpu\b/ }).click();
  await expect(summary(app)).toHaveAccessibleName(new RegExp("^(?:Task options: )?shop on gpu · new worktree · Claude Code$"));
  await composer(app).getByRole("button", { name: "Where: New worktree", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: "Main checkout", exact: true }).click();
  await expect(summary(app)).toHaveAccessibleName(new RegExp("^(?:Task options: )?shop on gpu · main checkout · Claude Code$"));
  await summary(app).click();
  await expect(composer(app).getByRole("button", { name: pickerNames })).toHaveCount(0);
});

test("both open and folded picker preferences survive a reload", async ({ app }) => {
  await home(app);
  await openTaskPickers(composer(app));
  await expect.poll(() => app.stored("berth.prefs")).toMatchObject({ taskComposerExpanded: true });
  await app.page.reload();
  await expect(summary(app)).toHaveAttribute("aria-expanded", "true");
  await expect(composer(app).getByRole("button", { name: "Project: evals", exact: true })).toBeVisible();
  await summary(app).click();
  await expect.poll(() => app.stored("berth.prefs")).toMatchObject({ taskComposerExpanded: false });
  await app.page.reload();
  await expect(summary(app)).toHaveAttribute("aria-expanded", "false");
  await expect(composer(app).getByRole("button", { name: pickerNames })).toHaveCount(0);
});

for (const key of ["Enter", "Space"]) test(`${key} opens the pickers from the prompt's next Tab stop without moving focus`, async ({ app }) => {
  await home(app);
  await composer(app).getByRole("textbox").focus();
  await app.page.keyboard.press("Tab");
  await expect(summary(app)).toBeFocused();
  await app.page.keyboard.press(key);
  await expect(summary(app)).toHaveAttribute("aria-expanded", "true");
  await expect(summary(app)).toBeFocused();
  await app.page.keyboard.press("Tab");
  await expect(composer(app).getByRole("button", { name: "Project: evals", exact: true })).toBeFocused();
  await summary(app).focus();
  await app.page.keyboard.press(key);
  await expect(summary(app)).toHaveAttribute("aria-expanded", "false");
  await expect(summary(app)).toBeFocused();
});

test("only explicit model and reasoning choices appear in the summary", async ({ app }) => {
  await home(app);
  await openTaskPickers(composer(app));
  await composer(app).getByRole("button", { name: "Model: Default", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: "Opus", exact: true }).click();
  await composer(app).getByRole("button", { name: "Reasoning: Default", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: "High", exact: true }).click();
  await summary(app).click();
  await expect(summary(app)).toHaveAccessibleName(new RegExp("^(?:Task options: )?evals on gpu · new worktree · Claude Code · Opus · High$"));
  await openTaskPickers(composer(app));
  await composer(app).getByRole("button", { name: "Model: Opus", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: "Default", exact: true }).click();
  await expect(summary(app)).toHaveAccessibleName(new RegExp("^(?:Task options: )?evals on gpu · new worktree · Claude Code · High$"));
  await composer(app).getByRole("button", { name: "Reasoning: High", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: "Default", exact: true }).click();
  await expect(summary(app)).toHaveAccessibleName(new RegExp("^(?:Task options: )?evals on gpu · new worktree · Claude Code$"));
});

const missingRequirements: Record<string, string>[] = [{ agents: "none" }, { tmux: "missing" }];
for (const params of missingRequirements) test(`missing ${Object.keys(params)[0]} exposes configuration without changing the folded preference`, async ({ app }) => {
  await home(app, params);
  await expect(summary(app)).toHaveAttribute("aria-expanded", "true");
  await expect(composer(app).getByRole("button", { name: "Project: evals", exact: true })).toBeVisible();
  await expect(composer(app).getByRole("button", { name: "Provider: Claude Code", exact: true })).toBeVisible();
  await expect(composer(app).getByRole("button", { name: /^Start:/ })).toBeDisabled();
  await summary(app).click();
  await expect(summary(app)).toHaveAttribute("aria-expanded", "true");
  await expect.poll(() => app.stored("berth.prefs")).toMatchObject({ taskComposerExpanded: false });
});

test("a missing project exposes the project picker and the existing add-project action", async ({ app }) => {
  const agent = await fakeAgent();
  try {
    await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/locations`, (route) => route.fulfill({ json: [] }));
    await app.open({ agent });
    await expect(summary(app)).toHaveAttribute("aria-expanded", "true");
    await expect(composer(app).getByRole("textbox")).toBeVisible();
    await expect(composer(app).getByRole("button", { name: "Start: Add a project first", exact: true })).toBeDisabled();
    await expect(composer(app).getByRole("button", { name: "Add a project", exact: true })).toBeVisible();
    await composer(app).getByRole("button", { name: "Project: No project", exact: true }).click();
    await expect(app.page.getByRole("menuitem", { name: "Add a project…", exact: true })).toBeVisible();
  } finally { await agent.close(); }
});

test("structured Codex keeps its permissions picker and summarizes only non-default permission", async ({ app }) => {
  const agent = await fakeAgent();
  try {
    await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/info`, (route) => route.fulfill({ json: {
      name: BOX, version: "test", capabilities: ["chat.codex", "chat.options"],
      agents: [{ id: "codex", name: "Codex", command: "codex" }],
    } }));
    await app.open({ agent });
    await expect(summary(app)).toHaveAccessibleName(new RegExp("^(?:Task options: )?shop on devl · new worktree · Codex$"));
    await openTaskPickers(composer(app));
    await composer(app).getByRole("button", { name: "Permissions: Ask every time", exact: true }).click();
    await app.page.getByRole("menuitemradio", { name: "Edit workspace", exact: true }).click();
    await expect(summary(app)).toHaveAccessibleName(new RegExp("^(?:Task options: )?shop on devl · new worktree · Codex · Edit workspace$"));
    await composer(app).getByRole("button", { name: "Permissions: Edit workspace", exact: true }).click();
    await app.page.getByRole("menuitemradio", { name: "Ask every time", exact: true }).click();
    await expect(summary(app)).toHaveAccessibleName(new RegExp("^(?:Task options: )?shop on devl · new worktree · Codex$"));
  } finally { await agent.close(); }
});

test("the New task dialog shares Home's folded and open preference", async ({ app }) => {
  await home(app);
  await app.page.keyboard.press("ControlOrMeta+n");
  const dialog = app.page.getByRole("dialog");
  const dialogComposer = dialog.getByTestId("task-composer");
  await expect(dialogComposer.getByTestId("task-composer-summary")).toHaveAttribute("aria-expanded", "false");
  await expect(dialogComposer.getByRole("button", { name: pickerNames })).toHaveCount(0);
  await openTaskPickers(dialogComposer);
  await expect(dialogComposer.getByRole("button", { name: "Project: evals", exact: true })).toBeVisible();
  await app.page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(summary(app)).toHaveAttribute("aria-expanded", "true");
});

// Given Home at a supported smaller desktop size with expanded loop details,
// When the task configuration opens and its provider changes,
// Then the loop panel does not cover task entry, choices, or Start.
test("Home task configuration remains usable beside expanded loop details at 1024px", async ({ app }) => {
  await app.page.setViewportSize({ width: 1024, height: 768 });
  await app.context.addInitScript(() => {
    localStorage.setItem("berth.loops.folded", "false");
    localStorage.setItem("berth.runs.dismissed", "[]");
  });
  await home(app);
  // The run watcher may start before mock box capabilities arrive. Resume
  // the page so its ordinary poller reads the now-ready synthetic runs.
  await app.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  const loops = app.page.getByRole("region", { name: "Loops", exact: true });
  await expect(loops.getByRole("button", { name: "Open session", exact: true })).toBeVisible();
  await openTaskPickers(composer(app));
  await expect.poll(async () => {
    const panel = await loops.boundingBox();
    const task = await composer(app).boundingBox();
    return panel && task ? panel.y + panel.height <= task.y : false;
  }, { message: "loop details stay above the task composer" }).toBe(true);
  await composer(app).getByRole("button", { name: "Provider: Claude Code", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: "Codex", exact: true }).click();
  await expect(summary(app)).toHaveAccessibleName(new RegExp("^(?:Task options: )?evals on gpu · new worktree · Codex$"));
  await composer(app).getByRole("textbox").fill("A synthetic task, kept in the composer.");
  await expect(composer(app).getByRole("button", { name: "Start", exact: true })).toBeEnabled();
});


// Expanded task choices keep distinct click targets and stay inside the card,
// including the narrow viewport produced by desktop zoom.
for (const width of [639, 640, 1024]) test(`expanded Home pickers remain separate and reachable at ${width}px`, async ({ app }) => {
  await app.page.setViewportSize({ width, height: 900 });
  await home(app);
  await openTaskPickers(composer(app));
  const pickers = composer(app).getByRole("button", { name: pickerNames });
  await expect(pickers).toHaveCount(6);
  await expect.poll(async () => {
    const card = await composer(app).boundingBox();
    const boxes = await pickers.evaluateAll((buttons) => buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }));
    if (!card || boxes.some((box) => box.height < 28 || box.width < 28 || box.x < card.x || box.x + box.width > card.x + card.width + 1)) return false;
    return boxes.every((box, i) => boxes.slice(i + 1).every((other) =>
      box.x + box.width <= other.x + 1 || other.x + other.width <= box.x + 1 ||
      box.y + box.height <= other.y + 1 || other.y + other.height <= box.y + 1));
  }, { message: "picker click targets have usable height, do not overlap, and stay inside task entry" }).toBe(true);
  await composer(app).getByRole("button", { name: "Provider: Claude Code", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: "Codex", exact: true }).click();
  await expect(summary(app)).toHaveAccessibleName(new RegExp("^(?:Task options: )?evals on gpu · new worktree · Codex$"));
});

test("Home leaves the default background empty", async ({ app }) => {
  await home(app);
  await expect(app.page.getByTestId("chat-background")).toHaveCount(0);
});

test("Home draws the saved background without blocking task entry", async ({ app }) => {
  await app.context.addInitScript(() => {
    const prefs = JSON.parse(localStorage.getItem("berth.prefs") ?? "{}");
    localStorage.setItem("berth.prefs", JSON.stringify({ ...prefs, chatBackground: { source: "builtin", builtin: "contours" } }));
  });
  await home(app);
  const background = app.page.getByTestId("chat-background");
  await expect(background).toHaveAttribute("data-drawn", "true");
  await expect.poll(() => background.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    if (!canvas.width || !canvas.height) return false;
    return canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0);
  }), { message: "the saved background paints actual pixels" }).toBe(true);
  const input = composer(app).getByRole("textbox");
  await input.click();
  await expect(input).toBeFocused();
  await input.fill("A draft over the configured Home background.");
  await expect(input).toHaveValue("A draft over the configured Home background.");
  await app.page.reload();
  await expect(background).toHaveAttribute("data-drawn", "true");
});

for (const width of [639, 640]) test(`Home's floating composer keeps the feed and final widget reachable at ${width}px`, async ({ app }) => {
  await app.page.setViewportSize({ width, height: 700 });
  await home(app);
  const input = composer(app).getByRole("textbox");
  await input.fill("Keep this draft while the feed scrolls.");
  await openTaskPickers(composer(app));
  const overlay = app.page.getByTestId("home-composer-overlay");
  const feed = app.page.getByTestId("home-scroll");
  await expect.poll(() => app.page.evaluate(() => {
    const scroll = document.querySelector('[data-testid="home-scroll"]')!;
    const overlay = document.querySelector('[data-testid="home-composer-overlay"]')!;
    const css = getComputedStyle(overlay);
    return css.position === "absolute" && css.pointerEvents === "none" && css.backgroundColor === "rgba(0, 0, 0, 0)" && getComputedStyle(scroll).paddingBottom !== "0px";
  })).toBe(true);
  await feed.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect.poll(async () => {
    const last = await app.page.getByTestId("home-grid").locator('[data-widget]:visible').last().boundingBox();
    const entry = await overlay.boundingBox();
    return !!last && !!entry && last.y + last.height <= entry.y + 1;
  }, { message: "the final widget clears expanded task entry at the end of the feed" }).toBe(true);
  await expect(input).toHaveValue("Keep this draft while the feed scrolls.");
  await summary(app).focus();
  await app.page.keyboard.press("Space");
  await expect(summary(app)).toBeFocused();
  await expect(summary(app)).toHaveAttribute("aria-expanded", "false");
});

test("Home activity facets intersect, persist and recover without filtering machine readings", async ({ app }) => {
  const agent = await fakeAgent();
  try {
    const since = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
    await app.context.route(`${agent.url}/v1/boxes/devl/api/sessions`, (route) => route.fulfill({ json: [
      { name: "waiting", title: "Waiting fixture", agent: "claude", agent_state: "waiting", location: "shop/fix", dir: "/w/shop-fix", created: since(1), state_since: since(0.5) },
      { name: "working", title: "Working fixture", agent: "codex", agent_state: "running", location: "shop/fix", dir: "/w/shop-fix", created: since(1), state_since: since(0.5) },
      { name: "finished", title: "Old fixture", agent: "claude", agent_state: "finished", location: "shop/fix", dir: "/w/shop-fix", created: since(30), state_since: since(25) },
    ] }));
    await app.context.route(`${agent.url}/v1/boxes/devl/api/stats`, (route) => route.fulfill({ json: { cpus: 4, load: [0], memory: { used: 0, total: 8 * 2 ** 30 }, disks: [{ mount: "/", used: 0, total: 16 * 2 ** 30 }] } }));
    await app.open({ agent });
    const grid = app.page.getByTestId("home-grid");
    await expect(grid.getByText("Waiting fixture", { exact: true })).toBeVisible();
    const disclosure = app.page.getByRole("button", { name: /^Activity filters(?::|$)/ });
    await expect(disclosure).toHaveAccessibleName("Activity filters");
    await expect(disclosure).toHaveAttribute("aria-expanded", "false");
    await disclosure.click();
    const choose = async (name: string, option: string) => {
      await app.page.getByLabel(`Home activity ${name}`, { exact: true }).click();
      await app.page.getByRole("option", { name: option, exact: true }).click();
    };
    await choose("state changed", "Last hour");
    await expect(grid.getByText("Old fixture", { exact: true })).toHaveCount(0);
    await choose("state", "Working");
    await expect(grid.getByText("Waiting fixture", { exact: true })).toHaveCount(0);
    await choose("provider", "Codex");
    await choose("project", "shop · devl");
    await expect(disclosure).toHaveAccessibleName("Activity filters: Last hour · Working · Codex · shop · devl");
    await expect(grid.getByText("Working fixture", { exact: true })).toBeVisible();
    await expect(app.page.getByTestId("home-filters")).toContainText("1 of 3 known agent tasks match.");
    await choose("provider", "Claude Code");
    await expect(app.page.getByTestId("home-filters")).toContainText("No matching agent activity.");
    expect(await app.stored("berth.home.activityFilters")).toMatchObject({ state: "running", window: "hour", provider: "claude", project: JSON.stringify(["devl", "shop"]) });
    await app.page.reload();
    await expect(app.page.getByTestId("home-filters")).toContainText("No matching agent activity.");
    await app.page.getByTestId("status-fleet").click();
    const machine = app.page.getByRole("dialog", { name: "Computers and status bar" }).locator('[data-box="devl"]');
    await expect(machine).toContainText("0 B of 8.0 GiB in use");
    await expect(machine).toContainText("3 sessions");
    await app.page.keyboard.press("Escape");
    await app.page.getByRole("button", { name: "Reset activity filters", exact: true }).click();
    await expect(grid.getByText("Waiting fixture", { exact: true })).toBeVisible();
    await expect(grid.getByText("Working fixture", { exact: true })).toBeVisible();
    expect(await app.stored("berth.home.activityFilters")).toEqual({ window: "all", state: "all", provider: "", project: "" });
  } finally { await agent.close(); }
});
