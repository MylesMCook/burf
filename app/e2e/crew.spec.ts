import type { Locator, Page } from "@playwright/test";

import { expect, mockOnly, test } from "./fixtures";

// An agent's crew (components/conversation/crew-card): the helpers it sent
// out, docked in its own conversation above the reply box (not in the
// window's corner, where it covered the reply box in a narrow pane). The
// demo's crew is set through window.__berthCrew (lib/mock-conversation).

const BOX = "gpu";
const AGENT = "judge-v2-claude";

type Hired = { id: string; name: string; doing: string; state: "running" | "finished"; ago: number; back?: number };
const setCrew = (page: Page, members: Hired[]) =>
  page.evaluate(([b, s, m]) => (window as unknown as { __berthCrew: { set(b: string, s: string, m: unknown): void } }).__berthCrew.set(b as string, s as string, m), [BOX, AGENT, members] as const);

const FIVE: Hired[] = [
  { id: "a1", name: "Build the events backend", doing: "Running the tests", state: "running", ago: 40 },
  { id: "a2", name: "UI approach: side sheet", doing: "Writing the sheet", state: "running", ago: 30 },
  { id: "a3", name: "UI approach: full page", doing: "Done", state: "finished", ago: 50, back: 20 },
  { id: "a4", name: "UI approach: ticket", doing: "Done", state: "finished", ago: 45, back: 10 },
  { id: "a5", name: "Explore: the schema", doing: "Done", state: "finished", ago: 60, back: 30 },
];

const box = async (l: Locator) => {
  const b = await l.boundingBox();
  if (!b) throw new Error("not on screen");
  return b;
};
const apart = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

test.beforeEach(async ({ app }) => {
  mockOnly("drives the demo's crew");
  await app.open({ params: { view: "conversation" } });
  await app.openWorktree("gpu/judge-v2");
});

test("the crew docks in its conversation above the reply box, not in the window's corner", async ({ app }) => {
  await setCrew(app.page, FIVE);
  const crew = app.chat.locator("[data-crew]");
  await expect(crew).toBeVisible();
  await expect(crew.locator("[data-crew-status]")).toHaveText("2 working");
  await expect(crew.locator("[data-crew-list] li")).toHaveCount(5);
  // Above the reply box, inside the pane, and the corner holds no crew.
  expect((await box(crew)).y + (await box(crew)).height).toBeLessThanOrEqual((await box(app.composer)).y + 1);
  await expect(app.page.getByRole("region", { name: "Loops" })).toHaveCount(0);
});

test("folded it is one line, and open again on a click", async ({ app }) => {
  await setCrew(app.page, FIVE);
  const crew = app.chat.locator("[data-crew]");
  const toggle = crew.locator("[data-crew-toggle]");
  await toggle.click();
  await expect(crew).not.toHaveAttribute("data-open", "");
  // One line once the fold has finished closing.
  await expect.poll(async () => (await box(crew)).height).toBeLessThan(48);
  await toggle.click();
  await expect(crew).toHaveAttribute("data-open", "");
});

test("once every helper is back it folds itself", async ({ app }) => {
  await setCrew(app.page, FIVE);
  const crew = app.chat.locator("[data-crew]");
  await expect(crew).toHaveAttribute("data-open", "");
  await setCrew(
    app.page,
    FIVE.map((m) => ({ ...m, state: "finished" as const, doing: "Done", back: m.back ?? 1 })),
  );
  await expect(crew.locator("[data-crew-status]")).toHaveText("All back");
  await expect(crew).not.toHaveAttribute("data-open", "", { timeout: 8000 });
});

for (const width of [900, 760]) {
  test(`at ${width}px nothing covers the reply box or Stop`, async ({ app }) => {
    await app.page.setViewportSize({ width, height: 800 });
    await setCrew(app.page, FIVE);
    const crew = app.chat.locator("[data-crew]");
    await expect(crew).toBeVisible();
    const c = await box(crew);
    expect(apart(c, await box(app.composer))).toBe(true);
    const stop = app.page.locator("[data-testid=pane]:visible").getByRole("button", { name: /^Stop/ });
    if (await stop.count()) expect(apart(c, await box(stop.first()))).toBe(true);
    // It stays inside the pane's width.
    const pane = await box(app.page.locator("[data-testid=pane]:visible").first());
    expect(c.x + c.width).toBeLessThanOrEqual(pane.x + pane.width + 1);
  });
}
