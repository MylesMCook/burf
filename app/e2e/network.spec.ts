import { BOX, fakeAgent, type FakeAgent, SESSION } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

// A slow or dropping link between the laptop and a box, on a stand-in agent
// (e2e/fake-agent.ts) that delays, drops and goes away on cue: a box that
// drops off says it is reconnecting and when it tries next, a message sent
// again after a dropped answer is typed once, and the event stream comes
// back after the agent drops it, without a storm of reads.

let agent: FakeAgent;

test.beforeEach(async () => {
  mockOnly("runs on a stand-in agent");
  agent = await fakeAgent();
});

test.afterEach(async () => {
  await agent?.close();
});

async function openChat(app: import("./fixtures").App) {
  await app.open({ agent, params: { view: "conversation" } });
  await app.openWorktree(`${BOX}/fix`);
  await expect(app.chat.getByText("The retry loop never backs off; fixed it.")).toBeVisible();
}

test("a box that drops off says it is reconnecting, counts down to the next try, and Try now asks the agent", async ({ app }) => {
  await openChat(app);
  agent.away = { state: "offline", retryAt: new Date(Date.now() + 9000).toISOString(), attempts: 3, since: new Date(Date.now() - 75_000).toISOString() };
  agent.event({ type: "box.disconnected", data: { box: BOX } });
  const pane = app.page.locator("[data-testid=pane]:visible");
  await expect(pane.getByText(`Reconnecting to ${BOX}…`).first()).toBeVisible();
  const line = pane.getByTestId("retry-line").first();
  await expect(line).toContainText(/Next try in [6-9]s · away 1m 1[5-9]s/);
  // It counts down, by itself.
  await expect(line).toContainText(/Next try in [1-5]s/, { timeout: 6000 });
  // The chat's own (its terminal's, under it, says the same).
  await app.page.getByRole("button", { name: "Try now" }).filter({ visible: true }).last().click();
  await expect.poll(() => agent.calls.filter((c) => c === `POST /v1/refresh?box=${BOX}`).length).toBe(1);
  // Back: the chat as it was.
  agent.away = undefined;
  agent.event({ type: "box.connected", data: { box: BOX } });
  await expect(app.chat.getByText("The retry loop never backs off; fixed it.")).toBeVisible();
  // (The stand-in has no terminals, so the one under the chat keeps trying.)
  await expect(app.chat.getByText(`Reconnecting to ${BOX}…`)).toHaveCount(0);
});

test("a message sent again after the link dropped its answer carries the same key, so the box types it once", async ({ app }) => {
  agent.session = { agent_state: "finished" };
  // Claude at its prompt, so the chat takes the reply (not its own screen).
  const rule = "─".repeat(60);
  agent.screen = () => `${rule}\n❯ \n${rule}\n`;
  await openChat(app);
  // The box has it, but no answer gets back. Chromium itself sends a POST
  // again when its connection closes before an answer (as on a stale
  // keep-alive), so the link drops until the app gives up.
  let dropping = true;
  agent.send = () => (dropping ? "drop" : { body: { sent: true, duplicate: true, turn: `${SESSION}#2`, seq: 9, at: new Date().toISOString() } });
  const box = app.composer.getByRole("textbox", { name: "Reply" });
  await box.fill("Run the checkout suite again");
  await box.press("Enter");
  // The answer never came: the words come back to the box to send again.
  await expect(box).toHaveValue("Run the checkout suite again");
  dropping = false;
  const tried = agent.sends.length;
  await box.press("Enter");
  await expect.poll(() => agent.sends.length).toBe(tried + 1);
  // Every copy, the browser's own retry and the person's, is one message.
  const first = agent.sends[0];
  expect(first.idem_key).toBeTruthy();
  for (const s of agent.sends) expect(s.idem_key).toBe(first.idem_key);
  // Different words are a different message.
  await expect(box).toHaveValue("");
  await box.fill("And the cart tests");
  await box.press("Enter");
  await expect.poll(() => agent.sends.length).toBe(tried + 2);
  expect(agent.sends.at(-1)!.idem_key).not.toBe(first.idem_key);
});

test("the event stream comes back after the agent drops it, and reads once rather than in a storm", async ({ app }) => {
  await openChat(app);
  const streams = () => agent.calls.filter((c) => c === "GET /v1/events").length;
  const statuses = () => agent.calls.filter((c) => c === "GET /v1/status").length;
  expect(streams()).toBe(1);
  const before = statuses();
  // Dropped three times in quick succession, as a flapping link does.
  for (let i = 0; i < 3; i++) {
    agent.dropStreams();
    await expect.poll(streams, { timeout: 8000 }).toBe(2 + i);
  }
  // Each reconnect refetches, but overlapping refreshes run as one more,
  // never one each.
  await app.page.waitForTimeout(1500);
  expect(statuses() - before).toBeLessThanOrEqual(4);
  // And events flow again.
  agent.session = { title: "Fixed the flaky checkout test" };
  agent.event({ type: "session.renamed", data: { name: SESSION } });
  await expect(app.page.getByText("Fixed the flaky checkout test").first()).toBeVisible();
});
