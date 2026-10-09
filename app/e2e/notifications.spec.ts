import { DIR, fakeAgent, type FakeAgent, SESSION } from "./fake-agent";
import { expect, mockOnly, test, type App } from "./fixtures";

let agent: FakeAgent;
let notes: { title: string; session?: string; count: number; resolved?: boolean }[];

test.beforeEach(async () => {
  mockOnly("isolated notification events");
  agent = await fakeAgent();
  notes = [];
});
test.afterEach(async () => { await agent?.close(); });

async function open(app: App) {
  await app.context.route(`${agent.url}/v1/app/notifications`, async (route) => {
    if (route.request().method() === "PUT") notes = route.request().postDataJSON().notes;
    await route.fulfill({ json: { version: 1, notes } });
  });
  await app.context.addInitScript(() => {
    localStorage.setItem("berth.notifications", JSON.stringify({ sound: true }));
    // Exercise background delivery without sending real OS notifications/audio.
    document.hasFocus = () => false;
    Object.defineProperty(window, "Notification", { value: class {
      static permission = "granted";
      constructor() { document.documentElement.dataset.systemAlerts = "sent"; }
    } });
    Object.defineProperty(window, "AudioContext", { value: class {
      constructor() { document.documentElement.dataset.soundAlerts = "sent"; }
    } });
    new MutationObserver(() => {
      if (document.querySelector('[data-slot="toast-title"]')) document.documentElement.dataset.toastAlerts = "sent";
    }).observe(document, { childList: true, subtree: true });
  });
  await app.open({ agent });
  await expect(app.worktree("devl/fix")).toBeVisible();
  await expect.poll(() => agent.calls.includes("GET /v1/events")).toBe(true);
}

for (const type of ["agent.waiting", "agent.finished"]) {
  for (const path of ["/w/external", DIR]) {
    test(`${type} outside Berth stays quiet at ${path}`, async ({ app }) => {
      await open(app);
      for (let i = 0; i < 3; i++) agent.event({ type, data: { path, agent: "codex" } });
      await expect.poll(() => notes[0]?.count).toBe(3);
      expect(notes[0].session).toBeUndefined();
      expect(notes[0].title).toMatch(/^Codex /);
      await expect(app.page.locator('[data-slot="toast-title"]')).toHaveCount(0);
      await expect(app.page.locator("html")).not.toHaveAttribute("data-toast-alerts");
      await expect(app.page.locator("html")).not.toHaveAttribute("data-system-alerts");
      await expect(app.page.locator("html")).not.toHaveAttribute("data-sound-alerts");
      await app.page.getByRole("button", { name: /^Notifications/ }).click();
      await expect(app.page.getByRole("dialog").getByText(notes[0].title, { exact: true })).toBeVisible();
    });
  }
  for (const session of [SESSION, "not-cached-yet"]) {
    test(`${type} for Berth session ${session} still alerts`, async ({ app }) => {
      agent.session = { agent_state: "waiting" };
      await open(app);
      // A newly started session appears in the next refresh, not the cache
      // from before its event arrived.
      agent.session = { name: session, agent_state: "waiting" };
      agent.event({ type, data: { path: DIR, session } });
      await expect.poll(() => notes[0]?.session).toBe(session);
      await expect(app.page.locator('[data-slot="toast-title"]')).toHaveText(notes[0].title);
      await expect(app.page.locator('[data-slot="toast-action"]')).toHaveText("Open session");
      await expect(app.page.locator("html")).toHaveAttribute("data-system-alerts", "sent");
      await expect(app.page.locator("html")).toHaveAttribute("data-sound-alerts", "sent");
    });
  }
}

test("external activity does not clear a Berth agent's request in the same folder", async ({ app }) => {
  agent.session = { agent_state: "waiting" };
  await open(app);
  agent.event({ type: "agent.waiting", data: { path: DIR, session: SESSION } });
  await expect.poll(() => notes.some((n) => n.session === SESSION)).toBe(true);
  agent.event({ type: "agent.finished", data: { path: DIR, agent: "codex" } });
  await expect.poll(() => notes.some((n) => n.title === "Codex is done")).toBe(true);
  expect(notes.find((n) => n.session === SESSION)?.resolved).not.toBe(true);
  agent.event({ type: "agent.started", data: { path: DIR, session: SESSION } });
  await expect.poll(() => notes.find((n) => n.session === SESSION)?.resolved).toBe(true);
});
