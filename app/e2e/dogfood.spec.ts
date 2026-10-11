import { readFileSync } from "node:fs";
import { fakeAgent } from "./fake-agent";
import { type App, expect, mockOnly, test } from "./fixtures";

const scenarios = [...readFileSync(new URL("./dogfood.feature", import.meta.url), "utf8").matchAll(/^  Scenario: (.+)$/gm)].map((m) => m[1]);
const bound: string[] = [];
function scenario(name: string, body: (fixtures: { app: App }) => Promise<void>) {
  if (!scenarios.includes(name)) throw new Error(`Unknown dogfood scenario: ${name}`);
  bound.push(name);
  test(name, body);
}

scenario("Worktree filters and sorting fit a small desktop window", async ({ app }) => {
  mockOnly();
  await app.page.setViewportSize({ width: 900, height: 560 });
  await app.open();
  await app.page.getByTestId("nav-worktrees").click();
  const sort = app.page.getByRole("combobox", { name: "Sort worktrees", exact: true });
  await expect(sort).toBeVisible({ timeout: 1000 });
  await expect.poll(async () => {
    const box = await sort.boundingBox();
    return !!box && box.x >= 240 && box.x + box.width <= 900;
  }).toBe(true);
  await app.page.getByRole("button", { name: "Behind", exact: true }).click();
  // The empty state also offers recovery; this is the first, toolbar action.
  const clear = app.page.getByRole("button", { name: "Clear filters", exact: true }).first();
  await expect.poll(async () => {
    const box = await clear.boundingBox();
    return !!box && box.x >= 240 && box.x + box.width <= 900;
  }).toBe(true);
  await sort.click();
  await app.page.getByRole("option", { name: "Name", exact: true }).click();
  await expect(sort).toHaveText("Name");
  await clear.click();
  await expect(app.page.getByRole("listbox", { name: "Worktrees in shop on devl" })).toBeVisible();
});

scenario("Background loops start compact while preserving their actions", async ({ app }) => {
  mockOnly();
  await app.page.setViewportSize({ width: 900, height: 560 });
  await app.open();
  await app.page.getByTestId("nav-settings").click();
  const loops = app.page.getByRole("region", { name: "Loops", exact: true });
  // Mock run discovery can precede the boxes' capability responses. Resume
  // discovery as those responses arrive; the assertion starts with a live loop.
  await expect.poll(async () => {
    await app.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    return loops.count();
  }, { timeout: 3000 }).toBe(1);
  const compact = loops.getByRole("button", { name: /1 loop/ });
  await expect(compact).toBeVisible({ timeout: 1000 });
  await expect(loops.getByRole("button", { name: "Open session", exact: true })).toHaveCount(0);
  await compact.click();
  await expect(loops.getByRole("button", { name: "Open session", exact: true })).toBeVisible();
  await loops.getByRole("button", { name: "Fold", exact: true }).click();
  await expect(compact).toBeVisible();
});

scenario("An automation opens with the keyboard without toggling it", async ({ app }) => {
  mockOnly();
  await app.open();
  await app.page.getByTestId("nav-automations").click();
  const row = app.page.getByRole("button", { name: /^Post to Slack when setup fails When setup/ });
  const toggle = row.getByRole("switch");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await row.focus();
  await app.page.keyboard.press("Space");
  await expect(app.page.getByRole("textbox", { name: "Flow name", exact: true })).toBeVisible({ timeout: 1000 });
  await app.page.getByRole("main").getByRole("button", { name: "Automations", exact: true }).click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.focus();
  await app.page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(app.page.getByRole("textbox", { name: "Flow name", exact: true })).toHaveCount(0);
});

scenario("Computer setup explains its scope", async ({ app }) => {
  mockOnly();
  await app.open();
  await app.openSettings("boxes");
  await app.page.getByRole("button", { name: "Add computer", exact: true }).click();
  const dialog = app.page.getByRole("dialog", { name: "Add computer", exact: true });
  await expect(dialog).toBeVisible({ timeout: 1000 });
  await expect(dialog.getByText(/only watches/)).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Inspect over SSH", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Inspect over SSH", exact: true }).click();
  await expect(app.page.getByRole("dialog", { name: "Inspect over SSH", exact: true })).toBeVisible();
  await expect(app.page.getByRole("textbox", { name: "SSH target", exact: true })).toBeVisible();
});

scenario("Wide service records keep inventory controls inside their sheet", async ({ app }) => {
  mockOnly();
  const agent = await fakeAgent();
  const at = new Date().toISOString();
  const machine = { id: "wide-inventory", name: "devl", routes: [{ kind: "paired", target: "e2e" }], updated_at: at };
  await app.context.route(`${agent.url}/v1/machines**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/machines") return route.fulfill({ json: [machine] });
    return route.fulfill({ json: { machine, at, coverage: [{ source: "docker", state: "ok", at }], services: [{ id: "wide", machine_id: machine.id, key: "wide", source: "docker", name: "a-service-with-an-unusually-long-name-that-still-needs-to-be-inspected", state: "running", ports: Array.from({ length: 30 }, (_, i) => 3000 + i), observed_at: at }] } });
  });
  try {
    await app.open({ agent });
    await app.page.getByRole("button", { name: "Open computer devl", exact: true }).click();
    await app.page.getByRole("button", { name: "Services on devl", exact: true }).click();
    const dialog = app.page.getByRole("dialog");
    await expect(dialog.getByTestId("inventory-service")).toBeVisible();
    await expect.poll(async () => {
      const sheet = await dialog.boundingBox();
      const scan = await dialog.getByRole("button", { name: "Scan now", exact: true }).boundingBox();
      return !!sheet && !!scan && scan.x >= sheet.x && scan.x + scan.width <= sheet.x + sheet.width;
    }, { timeout: 1000 }).toBe(true);
    const frame = dialog.locator('[data-slot="table-container"]');
    await expect.poll(() => frame.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  } finally { await agent.close(); }
});

scenario("Search results keep their computer identity visible", async ({ app }) => {
  mockOnly();
  await app.page.setViewportSize({ width: 900, height: 560 });
  await app.open();
  await app.page.getByRole("complementary", { name: "Sidebar" }).getByRole("button", { name: /^Search/ }).click();
  const dialog = app.page.getByRole("dialog", { name: "Search and commands", exact: true });
  const result = dialog.getByRole("option").filter({ hasText: "checkout-fix" }).first();
  await expect(result).toContainText("devl");
  await expect.poll(async () => {
    const box = await dialog.boundingBox();
    if (!box) return false;
    return result.evaluate((el, bounds) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const start = node.textContent?.indexOf("devl") ?? -1;
        if (start < 0) continue;
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + 4);
        const r = range.getBoundingClientRect();
        return r.left >= bounds.left && r.right <= bounds.right;
      }
      return false;
    }, { left: box.x, right: box.x + box.width });
  }, { timeout: 1000 }).toBe(true);
});

scenario("Known database listeners do not promise a web page", async ({ app }) => {
  mockOnly();
  await app.open();
  await app.page.getByRole("button", { name: "10 servers", exact: true }).click();
  const redis = app.page.locator("li").filter({ hasText: "redis-server *:6379" }).first();
  await expect(redis).toBeVisible();
  await expect(redis.getByRole("button", { name: "Open in tab", exact: true })).toHaveCount(0, { timeout: 1000 });
  await redis.getByRole("button", { name: "Copy address", exact: true }).click();
  expect(await app.page.evaluate(() => navigator.clipboard.readText())).toBe("localhost:6379");
  await expect(redis).not.toContainText("6379.devl.localhost");
  const web = app.page.locator("li").filter({ hasText: "vite" }).first();
  await expect(web.getByRole("button", { name: "Open in tab", exact: true })).toBeVisible();
  // A common database port does not establish the protocol of an unknown process.
  const agent = await fakeAgent();
  await app.context.route(`${agent.url}/v1/boxes/devl/api/services`, (route) => route.fulfill({ json: [
    { port: 5432, process: "custom-web-server", path: "/w/shop" },
  ] }));
  try {
    await app.open({ agent });
    await app.page.getByRole("button", { name: "More", exact: true }).click();
    await app.page.getByRole("menuitem", { name: "Dev servers", exact: true }).click();
    const unknown = app.page.locator("li").filter({ hasText: "custom-web-server" }).first();
    await expect(unknown.getByRole("button", { name: "Open in tab", exact: true })).toBeVisible();
  } finally { await agent.close(); }
});

test("every dogfood scenario has an acceptance check", () => {
  expect([...bound].sort()).toEqual([...scenarios].sort());
});
