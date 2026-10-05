import { BOX, DIR, fakeAgent, type FakeAgent, SESSION } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

// The chat reading an agent's conversation from its box (lib/transcript-
// feed.ts), on a stand-in agent (e2e/fake-agent.ts) whose answers and
// timing each test sets. "Reading the conversation…" must always end, in a
// few seconds, in the chat, an empty state, or an error with Retry.

let agent: FakeAgent;
let ticker: ReturnType<typeof setInterval> | undefined;

test.beforeEach(async () => {
  mockOnly("runs on a stand-in agent");
  agent = await fakeAgent();
});

test.afterEach(async () => {
  if (ticker) clearInterval(ticker);
  ticker = undefined;
  await agent?.close();
});

const reading = (app: { page: import("@playwright/test").Page }) => app.page.getByText("Reading the conversation…");

async function openChat(app: import("./fixtures").App) {
  await app.open({ agent, params: { view: "conversation" } });
  await app.openWorktree(`${BOX}/fix`);
}

// The way it stuck: an agent at work calls tools every moment, each call is
// an event about its session, and each event started the read over,
// throwing away the answer on its way. A box slower to answer than the
// agent's calls came never got its first answer shown.
test("a busy agent's chat shows while events keep coming", async ({ app }) => {
  agent.transcript = () => ({ delay: 700, body: { source: "claude", items: [{ kind: "user", id: "u1", text: "Fix the flaky checkout test", off: 10 }, { kind: "text", id: "t1", text: "The retry loop never backs off; fixed it.", off: 200 }], next: 2, crew: [], gen: "1.0", start: 10, file: "abc" } });
  await openChat(app);
  ticker = setInterval(() => agent.event({ type: "agent.started", data: { session: SESSION, path: DIR, signal: "tool" } }), 200);
  await expect(app.chat.getByText("The retry loop never backs off; fixed it.")).toBeVisible({ timeout: 5000 });
  await expect(reading(app)).toHaveCount(0);
  // It goes on reading from where it got to, not from the start each time.
  await expect.poll(() => agent.calls.filter((c) => c.includes("/transcript?since=2")).length, { timeout: 5000 }).toBeGreaterThan(0);
});

test("a box that never answers ends in an error with Retry", async ({ app }) => {
  let hang = true;
  agent.transcript = () => (hang ? { delay: 60_000, body: {} } : { body: { source: "claude", items: [{ kind: "text", id: "t1", text: "Back again.", off: 5 }], next: 1, crew: [], gen: "1.0", start: 5, file: "abc" } });
  await openChat(app);
  await expect(app.chat.or(app.page.getByText("Couldn't read the conversation"))).toBeVisible();
  await expect(app.page.getByText("Couldn't read the conversation")).toBeVisible({ timeout: 15_000 });
  hang = false;
  await app.page.getByRole("button", { name: "Retry" }).click();
  await expect(app.chat.getByText("Back again.")).toBeVisible({ timeout: 5000 });
});

test("a refused read (401) ends in an error with Retry", async ({ app }) => {
  let refuse = true;
  agent.transcript = () => (refuse ? { status: 401, body: { error: "not paired" } } : { body: { source: "claude", items: [{ kind: "text", id: "t1", text: "Paired again.", off: 5 }], next: 1, crew: [], gen: "1.0", start: 5, file: "abc" } });
  await openChat(app);
  await expect(app.page.getByText("Couldn't read the conversation")).toBeVisible({ timeout: 5000 });
  refuse = false;
  await app.page.getByRole("button", { name: "Retry" }).click();
  await expect(app.chat.getByText("Paired again.")).toBeVisible({ timeout: 5000 });
});

test("a session the box no longer has (404) doesn't stay reading", async ({ app }) => {
  agent.transcript = () => ({ status: 404, body: { error: "no session fix-claude", code: "not_found" } });
  await openChat(app);
  await expect(app.page.locator("[data-testid=pane]:visible")).toBeVisible();
  await expect(reading(app)).toHaveCount(0, { timeout: 5000 });
});

test("an agent that has written nothing yet doesn't stay reading", async ({ app }) => {
  agent.transcript = () => ({ body: { source: "none", items: [], next: 0, crew: [], reason: "No claude conversation yet" } });
  await openChat(app);
  await expect(app.page.locator("[data-testid=pane]:visible")).toBeVisible();
  await expect(reading(app)).toHaveCount(0, { timeout: 5000 });
});
