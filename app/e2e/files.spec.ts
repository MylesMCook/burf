import { expect, mockOnly, test } from "./fixtures";

// ⌘P and File tabs (lib/files.ts) on the mock's shop repository
// (lib/mock-files.ts): its checkout-fix worktree has a Claude turn that
// changed four files. The mock's agent writes again through
// window.__berthMockFiles, and open tabs notice as they would on a box.

const WEBHOOK = "apps/web/lib/payments/webhook.ts";

interface MockFiles {
  agentEditsWebhook(): void;
  agentWrites(path: string, content: string | null): void;
  contentOf(path: string): string | undefined;
}
declare global {
  interface Window {
    __berthMockFiles: MockFiles;
  }
}

test.beforeEach(async ({ app }) => {
  mockOnly();
  await app.open();
  await app.openWorktree("devl/checkout-fix");
});

const picker = (app: { page: import("@playwright/test").Page }) => app.page.getByTestId("file-picker");

async function openPicker(app: { page: import("@playwright/test").Page }) {
  await app.page.keyboard.press("ControlOrMeta+p");
  await expect(picker(app)).toBeVisible();
  await expect(picker(app).getByRole("combobox")).toBeFocused();
}

// Opens webhook.ts from ⌘P and waits for its editor.
async function openWebhook(app: { page: import("@playwright/test").Page }) {
  await openPicker(app);
  await app.page.keyboard.type("paywh");
  await expect(picker(app).getByRole("option").first()).toHaveAttribute("data-path", WEBHOOK);
  await app.page.keyboard.press("Enter");
  const pane = app.page.locator(`[data-testid=file-pane][data-path="${WEBHOOK}"]`);
  await expect(pane.locator(".cm-content")).toBeVisible();
  return pane;
}

test("⌘P lists Claude's files first, filters fuzzily, and ↵ opens a File tab", async ({ app }) => {
  await openPicker(app);
  const p = picker(app);
  const agent = p.getByRole("group", { name: "Changed by Claude this turn" });
  await expect(agent.getByRole("option")).toHaveCount(4);
  await expect(agent.getByRole("option").first()).toHaveAttribute("data-path", WEBHOOK);
  await expect(agent.getByRole("option").first()).toContainText("+12");
  await expect(agent.getByRole("option").first()).toContainText("−2");
  await expect(agent.locator("[data-path$='idempotency.ts']")).toContainText("new");
  await expect(p.getByRole("group", { name: "Recently opened" }).getByRole("option").first()).toHaveAttribute("data-path", "apps/web/lib/checkout/createOrder.ts");
  // The preview column shows the highlighted file at Claude's first change.
  await expect(p.getByTestId("file-preview")).toHaveAttribute("data-path", WEBHOOK);
  await expect(p.getByTestId("file-preview")).toContainText("5 changes");

  // Typed: letters in the file's own name win, and are marked.
  await app.page.keyboard.type("paywh");
  await expect(p.getByRole("option").first()).toHaveAttribute("data-path", WEBHOOK);
  await expect(p.getByRole("option").first().locator("mark").first()).toBeVisible();
  await app.page.keyboard.type("zzz");
  await expect(p).toContainText("No file matches.");
  for (let i = 0; i < 3; i++) await app.page.keyboard.press("Backspace");

  await app.page.keyboard.press("Enter");
  await expect(p).toBeHidden();
  const tab = app.page.locator("[data-tab-strip] [data-tab][aria-selected=true]");
  await expect(tab).toContainText("webhook.ts");
  const pane = app.page.locator(`[data-testid=file-pane][data-path="${WEBHOOK}"]`);
  await expect(pane.getByTestId("file-crumbs")).toHaveAttribute("aria-label", WEBHOOK);
  await expect(pane.getByTestId("file-turn")).toContainText("Claude");
  await expect(pane.getByTestId("file-turn")).toContainText("+12 −2");
  await expect(pane.getByTestId("file-hunk")).toHaveText("1/5");
  await expect(pane.locator(".cm-agent-bar[data-mark=added]").first()).toBeVisible();
  await pane.getByRole("button", { name: "Next change" }).click();
  await expect(pane.getByTestId("file-hunk")).toHaveText("2/5");

  // Opening it again brings the same tab to the front.
  await openPicker(app);
  await app.page.keyboard.type("webhook.ts");
  await expect(picker(app).getByRole("option").first()).toHaveAttribute("data-path", WEBHOOK);
  await app.page.keyboard.press("Enter");
  await expect(app.page.locator("[data-tab-strip] [data-tab]", { hasText: "webhook.ts" })).toHaveCount(1);
});

test("⌥↵ opens the file beside the focused pane", async ({ app }) => {
  await expect(app.panes).toHaveCount(1);
  await openPicker(app);
  await app.page.keyboard.type("idempotency");
  await expect(picker(app).getByRole("option").first()).toHaveAttribute("data-path", "apps/web/lib/payments/idempotency.ts");
  await app.page.keyboard.press("Alt+Enter");
  await expect(app.panes).toHaveCount(2);
  await expect(app.page.locator("[data-testid=pane][data-pane-kind=file]:visible")).toHaveCount(1);
  await expect(app.page.locator("[data-testid=file-pane][data-path$='idempotency.ts'] .cm-content")).toContainText("claimEvent");
});

test("an edit marks the tab, and ⌘S saves it to the box", async ({ app }) => {
  const pane = await openWebhook(app);
  await pane.locator(".cm-content").click();
  await app.page.keyboard.press("ControlOrMeta+End");
  await app.page.keyboard.type("// reviewed\n");
  const tab = app.page.locator("[data-tab-strip] [data-tab][aria-selected=true]");
  await expect(tab.getByTestId("file-tab-dirty")).toBeVisible();
  await expect(pane.locator(".cm-agent-bar[data-mark=own]")).not.toHaveCount(0);
  await app.page.keyboard.press("ControlOrMeta+s");
  await expect(pane.getByTestId("file-saved")).toBeVisible();
  await expect(tab.getByTestId("file-tab-dirty")).toHaveCount(0);
  expect(await app.page.evaluate((p) => window.__berthMockFiles.contentOf(p), WEBHOOK)).toContain("// reviewed\n");
});

// You edit; the agent writes the same file: a banner, amber lines, a
// warning on the tab, and nothing overwritten either way.
async function conflict(app: { page: import("@playwright/test").Page }) {
  const pane = await openWebhook(app);
  await pane.locator(".cm-content").click();
  await app.page.keyboard.press("ControlOrMeta+End");
  await app.page.keyboard.type("// mine\n");
  await app.page.evaluate(() => window.__berthMockFiles.agentEditsWebhook());
  const banner = pane.getByTestId("file-conflict");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Claude changed this.");
  await expect(app.page.locator("[data-tab-strip] [data-tab][aria-selected=true]").getByTestId("file-tab-conflict")).toBeVisible();
  await expect(pane.locator(".cm-conflict-line")).not.toHaveCount(0);
  // ⌘S waits for a choice: the agent's version stays on the box.
  await app.page.keyboard.press("ControlOrMeta+s");
  expect(await app.page.evaluate((p) => window.__berthMockFiles.contentOf(p), WEBHOOK)).toContain("metrics.increment");
  return { pane, banner };
}

test("a conflict's Reload takes the agent's version", async ({ app }) => {
  const { pane, banner } = await conflict(app);
  await banner.getByRole("button", { name: "Reload" }).click();
  await expect(banner).toBeHidden();
  await expect(pane.locator(".cm-content")).toContainText("metrics.increment");
  await expect(pane.locator(".cm-content")).not.toContainText("// mine");
  await expect(app.page.locator("[data-tab-strip] [data-tab][aria-selected=true]").getByTestId("file-tab-conflict")).toHaveCount(0);
});

test("a conflict's Keep mine saves yours over the agent's, on purpose", async ({ app }) => {
  const { pane, banner } = await conflict(app);
  await banner.getByRole("button", { name: "Keep mine" }).click();
  await expect(banner).toBeHidden();
  await expect(pane.locator(".cm-content")).toContainText("// mine");
  await app.page.keyboard.press("ControlOrMeta+s");
  await expect(pane.getByTestId("file-saved")).toBeVisible();
  const disk = await app.page.evaluate((p) => window.__berthMockFiles.contentOf(p), WEBHOOK);
  expect(disk).toContain("// mine");
  expect(disk).not.toContain("metrics.increment");
});

test("a conflict's Compare shows yours beside the agent's", async ({ app }) => {
  const { pane, banner } = await conflict(app);
  await banner.getByRole("button", { name: "Compare" }).click();
  const compare = pane.getByTestId("file-compare");
  await expect(compare).toBeVisible();
  await expect(compare).toContainText("Yours");
  await expect(compare).toContainText("Claude's");
  await compare.getByRole("button", { name: "Take Claude's" }).click();
  await expect(compare).toBeHidden();
  await expect(pane.locator(".cm-content")).toContainText("metrics.increment");
});

test("a file too large or not text is refused with a reason; a picture shows", async ({ app }) => {
  await openPicker(app);
  await app.page.keyboard.type("orders-2026");
  await expect(picker(app).getByRole("option").first()).toHaveAttribute("data-path", "data/exports/orders-2026-09.csv");
  await app.page.keyboard.press("Enter");
  const big = app.page.locator("[data-testid=file-pane][data-path='data/exports/orders-2026-09.csv']");
  await expect(big.getByTestId("file-refusal")).toContainText("Too large to open here");
  await expect(big.getByTestId("file-refusal")).toContainText("14.2 MB");
  await expect(big.getByRole("button", { name: /Open in/ }).first()).toBeVisible();

  await openPicker(app);
  await app.page.keyboard.type("shop-sans");
  await app.page.keyboard.press("Enter");
  await expect(app.page.locator("[data-testid=file-pane][data-path$='shop-sans.woff2'] [data-testid=file-refusal]")).toContainText("Not a text file");

  await openPicker(app);
  await app.page.keyboard.type("logo.png");
  await app.page.keyboard.press("Enter");
  const img = app.page.locator("[data-testid=file-pane][data-path$='logo.png'] [data-testid=file-image] img");
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute("alt", "logo.png");
});
