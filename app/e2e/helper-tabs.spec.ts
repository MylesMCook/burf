import type { Page } from "@playwright/test";

import { expect, mockOnly, test } from "./fixtures";

// A helper's own conversation as a tab (components/conversation/
// helper-pane.tsx): opened from the crew beside its chat, focused when it is
// already open, beside the chat with ⌘-click, kept from the sheet's peek
// with Open in tab, there again after a reload, and honest when the box no
// longer has its record. The demo's helpers are its crew (window.__berthCrew,
// lib/mock-conversation; lib/mock-history reads them).

const BOX = "gpu";
const AGENT = "judge-v2-claude";

type Hired = { id: string; name: string; doing: string; state: "running" | "finished"; ago: number; back?: number };
const CREW: Hired[] = [
  { id: "a1", name: "Map the acme retry paths", doing: "Reading retry.ts", state: "running", ago: 40 },
  { id: "a2", name: "Explore: idempotency in tests", doing: "Done", state: "finished", ago: 60, back: 20 },
];
const setCrew = (page: Page, members: Hired[]) =>
  page.evaluate(([b, s, m]) => (window as unknown as { __berthCrew: { set(b: string, s: string, m: unknown): void } }).__berthCrew.set(b as string, s as string, m), [BOX, AGENT, members] as const);

const strip = (page: Page) => page.locator("[data-tab-strip] [data-tab]");
const row = (page: Page, id: string) => page.locator(`[data-testid=pane]:visible [data-crew] [data-helper="${id}"]`);
const helperPane = (page: Page) => page.locator("[data-testid=pane][data-pane-kind=helper]:visible");

test.beforeEach(async ({ app }) => {
  mockOnly("drives the demo's crew");
  await app.open({ params: { view: "conversation" } });
  await app.openWorktree("gpu/judge-v2");
  await setCrew(app.page, CREW);
  await expect(app.chat.locator("[data-crew]")).toHaveAttribute("data-open", "");
});

test("a helper in the crew opens as a tab beside its chat, working, with its parent named", async ({ app }) => {
  const page = app.page;
  const before = await strip(page).count();
  const chatId = await strip(page).and(page.locator("[aria-selected=true]")).getAttribute("data-tab");
  const chatTab = page.locator(`[data-tab-strip] [data-tab="${chatId}"]`);
  const chatIndex = await strip(page).evaluateAll((els) => els.findIndex((e) => e.getAttribute("aria-selected") === "true"));
  await row(page, "a1").click();
  await expect(strip(page)).toHaveCount(before + 1);
  // Just after the chat's tab, in front, named after the helper and working.
  const tab = strip(page).nth(chatIndex + 1);
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(tab).toContainText("Map the acme retry paths");
  await expect(tab.getByRole("img", { name: /working/i })).toBeVisible();
  const pane = helperPane(page);
  await expect(pane.getByTestId("helper")).toHaveAttribute("data-state", "running");
  await expect(pane.getByRole("heading", { name: "Map the acme retry paths" })).toBeVisible();
  await expect(pane.getByText("Asked by the agent")).toBeVisible();
  await expect(pane.locator("[data-testid=chat-item]").first()).toBeVisible();
  // Its parent, a click away.
  await pane.getByTestId("helper-parent").click();
  await expect(chatTab).toHaveAttribute("aria-selected", "true");
  await expect(app.chat).toBeVisible();
});

test("a second click focuses the helper's tab rather than opening another", async ({ app }) => {
  const page = app.page;
  const before = await strip(page).count();
  await row(page, "a2").click();
  await expect(helperPane(page).getByTestId("helper")).toHaveAttribute("data-state", "finished");
  // Back ✓ on the tab.
  const tab = strip(page).filter({ hasText: "idempotency in tests" });
  await expect(tab.getByRole("img", { name: /finished|done|back/i })).toBeVisible();
  await helperPane(page).getByTestId("helper-parent").click();
  await expect(app.chat).toBeVisible();
  await row(page, "a2").click();
  await expect(strip(page)).toHaveCount(before + 1);
  await expect(tab).toHaveAttribute("aria-selected", "true");
});

test("⌘-click opens the helper beside its chat in a split", async ({ app }) => {
  const page = app.page;
  const before = await strip(page).count();
  await row(page, "a1").click({ modifiers: ["ControlOrMeta"] });
  await expect(app.panes).toHaveCount(2);
  await expect(strip(page)).toHaveCount(before);
  await expect(helperPane(page)).toBeVisible();
  await expect(app.chat).toBeVisible();
  // Side by side: the helper to the right of the chat.
  const chat = (await page.locator("[data-testid=pane]:visible[data-pane-kind=terminal]").boundingBox())!;
  const helper = (await helperPane(page).boundingBox())!;
  expect(helper.x).toBeGreaterThanOrEqual(chat.x + chat.width - 2);
});

test("⌥-click peeks in the sheet, and Open in tab keeps it", async ({ app }) => {
  const page = app.page;
  const before = await strip(page).count();
  await row(page, "a2").click({ modifiers: ["Alt"] });
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("idempotency in tests");
  await expect(strip(page)).toHaveCount(before);
  await sheet.getByRole("button", { name: "Open in tab" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(strip(page)).toHaveCount(before + 1);
  await expect(helperPane(page).getByRole("heading", { name: "idempotency in tests" })).toBeVisible();
});

test("“Sent out N helpers” opens a helper as the crew does", async ({ app }) => {
  const page = app.page;
  // judge-v2's agent sent out two helpers, known in its chat by name.
  await setCrew(page, [{ id: "s1", name: "Explore: failing tests", doing: "Reading checkout.test.ts", state: "running", ago: 41 }]);
  // Folded into the turn's steps until opened.
  await app.chat.getByRole("button", { name: /started 2 helpers/ }).click();
  const chip = app.chat.locator("[data-helper-chip='failing tests']");
  await expect(chip).toBeVisible();
  const before = await strip(page).count();
  await chip.click();
  await expect(strip(page)).toHaveCount(before + 1);
  await expect(helperPane(page).getByRole("heading", { name: "failing tests" })).toBeVisible();
  await expect(helperPane(page).getByTestId("helper")).toHaveAttribute("data-state", "running");
  // Again from the chat: the same tab, not a second.
  await helperPane(page).getByTestId("helper-parent").click();
  await expect(app.chat).toBeVisible();
  if (!(await chip.isVisible())) await app.chat.getByRole("button", { name: /started 2 helpers/ }).click();
  await chip.click();
  await expect(strip(page)).toHaveCount(before + 1);
});

test("the helper's tab is there again after a reload, read afresh from the box", async ({ app }) => {
  const page = app.page;
  await row(page, "a1").click();
  await expect(helperPane(page).getByTestId("helper")).toHaveAttribute("data-state", "running");
  await page.reload();
  await expect(page.getByTestId("nav-home")).toBeVisible();
  const tab = strip(page).filter({ hasText: "Map the acme retry paths" });
  await expect(tab).toHaveCount(1);
  // The demo's crew lives in the page, made afresh as its chat shows: once
  // it has, give the box these helpers back.
  await strip(page).filter({ hasText: "Tune the judge prompt" }).click();
  await expect(app.chat.locator("[data-crew]")).toBeVisible();
  await setCrew(page, CREW);
  await tab.click();
  await expect(helperPane(page).getByTestId("helper")).toHaveAttribute("data-state", "running", { timeout: 12_000 });
  await expect(helperPane(page).locator("[data-testid=chat-item]").first()).toBeVisible();
});

test("a helper whose record is gone says so, and its tab closes", async ({ app }) => {
  const page = app.page;
  await row(page, "a2").click();
  await expect(helperPane(page).getByTestId("helper")).toHaveAttribute("data-state", "finished");
  const before = await strip(page).count();
  // After a reload the demo's box has no helpers: the record is gone.
  await page.reload();
  await expect(page.getByTestId("nav-home")).toBeVisible();
  const pane = helperPane(page);
  await expect(pane.getByTestId("helper")).toHaveAttribute("data-state", "missing");
  await expect(pane.getByText("This helper's record is gone")).toBeVisible();
  await expect(pane.getByRole("heading", { name: "idempotency in tests" })).toBeVisible();
  await pane.getByRole("button", { name: "Close tab" }).click();
  await expect(strip(page)).toHaveCount(before - 1);
});
