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
  await expect(summary(app)).toHaveText("evals on gpu · new worktree · Claude Code");
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
  for (const name of ["Project: evals", "Box: gpu", "Where: New worktree", "Provider: Claude Code", "Model: Default", "Reasoning: Default"]) {
    await expect(composer(app).getByRole("button", { name, exact: true })).toBeVisible();
  }
  await composer(app).getByRole("button", { name: "Provider: Claude Code", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: "Codex", exact: true }).click();
  await expect(summary(app)).toHaveText("evals on gpu · new worktree · Codex");
  await composer(app).getByRole("button", { name: "Project: evals", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: /^shop\b/ }).click();
  await expect(summary(app)).toHaveText("shop on devl · new worktree · Claude Code");
  await composer(app).getByRole("button", { name: "Box: devl", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: /^gpu\b/ }).click();
  await expect(summary(app)).toHaveText("shop on gpu · new worktree · Claude Code");
  await composer(app).getByRole("button", { name: "Where: New worktree", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: "Main checkout", exact: true }).click();
  await expect(summary(app)).toHaveText("shop on gpu · main checkout · Claude Code");
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
  await expect(summary(app)).toHaveText("evals on gpu · new worktree · Claude Code · Opus · High");
  await openTaskPickers(composer(app));
  await composer(app).getByRole("button", { name: "Model: Opus", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: "Default", exact: true }).click();
  await expect(summary(app)).toHaveText("evals on gpu · new worktree · Claude Code · High");
  await composer(app).getByRole("button", { name: "Reasoning: High", exact: true }).click();
  await app.page.getByRole("menuitemradio", { name: "Default", exact: true }).click();
  await expect(summary(app)).toHaveText("evals on gpu · new worktree · Claude Code");
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
    await expect(summary(app)).toHaveText("shop on devl · new worktree · Codex");
    await openTaskPickers(composer(app));
    await composer(app).getByRole("button", { name: "Permissions: Ask every time", exact: true }).click();
    await app.page.getByRole("menuitemradio", { name: "Edit workspace", exact: true }).click();
    await expect(summary(app)).toHaveText("shop on devl · new worktree · Codex · Edit workspace");
    await composer(app).getByRole("button", { name: "Permissions: Edit workspace", exact: true }).click();
    await app.page.getByRole("menuitemradio", { name: "Ask every time", exact: true }).click();
    await expect(summary(app)).toHaveText("shop on devl · new worktree · Codex");
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
