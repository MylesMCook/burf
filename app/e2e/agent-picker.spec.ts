import { BOX, fakeAgent } from "./fake-agent";
import { expect, mockOnly, test, type App } from "./fixtures";

test.beforeEach(() => mockOnly("isolated launch picker"));

const presets = [
  { id: "codex", name: "Codex", command: "codex", model_flag: "--model", models: ["codex-test"], effort_flag: "--effort", efforts: ["low", "high"] },
  { id: "claude", name: "Claude Code", command: "claude", model_flag: "--model", models: ["sonnet", "opus"], effort_flag: "--effort", efforts: ["high"] },
  { id: "cursor", name: "Cursor Agent", command: "agent", model_flag: "--model", models: ["cursor-test"] },
  { id: "other", name: "Other Agent", command: "other" },
];

async function fixture(app: App) {
  const agent = await fakeAgent();
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/info`, (route) => route.fulfill({ json: { name: BOX, version: "test", capabilities: ["runs"], agents: presets } }));
  await app.open({ agent });
  return agent;
}

const composer = (app: App) => app.page.getByTestId("task-composer");
async function choose(app: App, provider: string) {
  await composer(app).getByRole("button", { name: /^Provider:/ }).click();
  await app.page.getByRole("menuitemradio", { name: provider, exact: true }).click();
}

test("switching provider is single-select and becomes the next chat's default", async ({ app }) => {
  const agent = await fixture(app);
  try {
    await composer(app).getByRole("textbox").fill("Preserve this task");
    await choose(app, "Cursor Agent");
    await expect(composer(app).getByRole("button", { name: "Provider: Cursor Agent", exact: true })).toBeVisible();
    await expect(composer(app).getByRole("textbox")).toHaveValue("Preserve this task");
    await expect(composer(app).getByRole("region", { name: /attempts/i })).toHaveCount(0);
    await expect(composer(app).getByText("Judge", { exact: true })).toHaveCount(0);
    await expect.poll(() => app.stored(`berth.composer.default.${BOX}/shop`)).toEqual({ agent: "cursor", model: "", effort: "" });
    await app.page.reload();
    await expect(composer(app).getByRole("button", { name: "Provider: Cursor Agent", exact: true })).toBeVisible();
  } finally { await agent.close(); }
});

test("model and reasoning are separate single choices retained per provider", async ({ app }) => {
  const agent = await fixture(app);
  try {
    await choose(app, "Claude Code");
    await composer(app).getByRole("button", { name: /^Model:/ }).click();
    await app.page.getByRole("menuitemradio", { name: "Opus", exact: true }).click();
    await composer(app).getByRole("button", { name: /^Reasoning:/ }).click();
    await app.page.getByRole("menuitemradio", { name: "High", exact: true }).click();
    await choose(app, "Cursor Agent");
    await expect(composer(app).getByRole("button", { name: /^Reasoning:/ })).toHaveCount(0);
    await composer(app).getByRole("button", { name: /^Model:/ }).click();
    await expect(app.page.getByRole("menuitemradio", { name: "Default", exact: true })).toBeVisible();
    await expect(app.page.getByRole("menuitemradio", { name: "Opus", exact: true })).toHaveCount(0);
    await app.page.keyboard.press("Escape");
    await expect(app.page.getByRole("menu")).toHaveCount(0);
    await choose(app, "Claude Code");
    await expect(composer(app).getByRole("button", { name: "Model: Opus" })).toBeVisible();
    await expect(composer(app).getByRole("button", { name: "Reasoning: High" })).toBeVisible();
    await app.page.reload();
    await expect(composer(app).getByRole("button", { name: "Model: Opus" })).toBeVisible();
  } finally { await agent.close(); }
});

test("comparison requires opt-in and returning to one agent restores the normal choice", async ({ app }) => {
  const agent = await fixture(app);
  try {
    await choose(app, "Cursor Agent");
    await composer(app).getByRole("button", { name: /^Provider:/ }).click();
    await app.page.getByRole("menuitem", { name: "Compare agents…", exact: true }).click();
    await expect(composer(app).getByRole("button", { name: /^Agents:/ })).toBeVisible();
    await expect(composer(app).getByText("Judge", { exact: true })).toBeVisible();
    await composer(app).getByRole("button", { name: /^Agents:/ }).click();
    await app.page.getByRole("menuitem", { name: "Use one agent", exact: true }).click();
    await expect(composer(app).getByRole("button", { name: "Provider: Cursor Agent", exact: true })).toBeVisible();
    await expect(composer(app).getByText("Judge", { exact: true })).toHaveCount(0);
    await expect.poll(() => app.stored(`berth.composer.default.${BOX}/shop`)).toEqual({ agent: "cursor", model: "", effort: "" });
  } finally { await agent.close(); }
});

test("legacy multi-picks restore only after deliberate comparison without overwriting storage", async ({ app }) => {
  const old = [{ agent: "claude", model: "opus", effort: "high" }, { agent: "cursor", model: "cursor-test", effort: "" }];
  await app.context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: `berth.composer.picks.${BOX}/shop`, value: old });
  const agent = await fixture(app);
  try {
    await expect(composer(app).getByRole("button", { name: "Provider: Claude Code", exact: true })).toBeVisible();
    await expect(composer(app).getByText("Judge", { exact: true })).toHaveCount(0);
    expect(await app.stored(`berth.composer.picks.${BOX}/shop`)).toEqual(old);
    await composer(app).getByRole("button", { name: /^Provider:/ }).click();
    await app.page.getByRole("menuitem", { name: "Compare agents…", exact: true }).click();
    await expect(composer(app).getByRole("button", { name: /^Agents: Claude Code.*Cursor Agent/ })).toBeVisible();
    expect(await app.stored(`berth.composer.picks.${BOX}/shop`)).toEqual(old);
  } finally { await agent.close(); }
});

test("worktree-only does not forget the provider and other installed agents remain reachable", async ({ app }) => {
  const agent = await fixture(app);
  try {
    await choose(app, "Claude Code");
    await composer(app).getByRole("button", { name: /^Provider:/ }).click();
    await expect(app.page.getByRole("menuitemradio", { name: "Grok", exact: true })).toHaveCount(0);
    await app.page.getByRole("menuitemradio", { name: "No agent · Worktree only", exact: true }).click();
    await expect(composer(app).getByRole("button", { name: /^Model:/ })).toHaveCount(0);
    await choose(app, "Claude Code");
    await composer(app).getByRole("button", { name: /^Provider:/ }).click();
    await app.page.getByRole("menuitem", { name: "Other providers", exact: true }).hover();
    await app.page.getByRole("menuitemradio", { name: "Other Agent", exact: true }).click();
    await expect(composer(app).getByRole("button", { name: "Provider: Other Agent", exact: true })).toBeVisible();
  } finally { await agent.close(); }
});
