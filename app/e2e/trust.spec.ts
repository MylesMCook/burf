import { BOX, DIR, fakeAgent, type FakeAgent, SESSION } from "./fake-agent";
import { expect, mockOnly, test } from "./fixtures";

// An agent started with a prompt in a folder it hasn't seen asks first
// whether to trust it. The chat shows that question in the agent's own
// screen, to answer there with keys (never a Yes that would type a word
// into it), and the prompt it was started with as sent and not yet read
// (the box holds anything sent meanwhile).

let agent: FakeAgent;

test.beforeEach(async () => {
  mockOnly("runs on a stand-in agent");
  agent = await fakeAgent();
});

test.afterEach(async () => {
  await agent?.close();
});

// Claude Code's trust question, as its screen draws it.
const QUESTION = [
  "",
  " Accessing workspace:",
  "",
  ` ${DIR}`,
  "",
  " Quick safety check: Is this a project you created or one you trust?",
  " (Like your own code, a well-known open source project, or work from",
  " your team). If not, take a moment to review what's in this folder first.",
  "",
  " Claude Code'll be able to read, edit, and execute files here.",
  "",
  " ❯ No, exit",
  "   Yes, I trust this folder",
  "",
  " Enter to confirm · Esc to cancel",
];

const PROMPT = "Fix the flaky checkout test: the retry loop never backs off, so it hammers the payments sandbox.";

for (const theme of ["berth-dark", "berth-light"]) {
  test(`the trust question shows in place, its first prompt as sent (${theme})`, async ({ app, context }) => {
    agent.session = { agent_state: "waiting", preset: "claude", command: `claude --model sonnet '${PROMPT.replaceAll("'", "'\\''")}'`, turn: `${SESSION}#1` };
    agent.transcript = () => ({ body: { source: "none", items: [], next: 0, crew: [], reason: "No claude conversation yet" } });
    agent.screen = () => QUESTION.join("\n");
    // Its terminal, as the box would relay it.
    await context.routeWebSocket(/\/attach(?:\?|$)/, (ws) => {
      ws.send(`\x1b[2J\x1b[H${QUESTION.join("\r\n")}`);
    });
    await app.open({ agent, theme, params: { view: "conversation" } });
    await app.openWorktree(`${BOX}/fix`);

    const prompt = app.chat.locator("[data-testid=chat-item][data-kind=user]");
    await expect(prompt).toHaveCount(1);
    await expect(prompt).toContainText(PROMPT);
    await expect(prompt).toContainText("Sent · Claude reads it at its next step");
    const screen = app.page.getByRole("region", { name: "Claude Code's own screen" });
    await expect(screen).toBeVisible();
    // Keys answer it, in its screen: the chat offers no Yes or No, which
    // would type a word into it.
    await expect(app.chat.getByText("Needs your answer")).toHaveCount(0);
    await expect(app.chat.getByRole("button", { name: "Yes", exact: true })).toHaveCount(0);
    await expect(screen.getByText("Attaching…")).toHaveCount(0);
    if (process.env.BERTH_SHOTS) await app.page.screenshot({ path: `${process.env.BERTH_SHOTS}/trust-${theme}.png` });

    // Read once trusted: its record has the prompt, which takes its place.
    agent.session = { agent_state: "running", preset: "claude", command: `claude --model sonnet '${PROMPT}'`, turn: `${SESSION}#1` };
    agent.transcript = () => ({ body: { source: "claude", items: [{ kind: "user", id: "u1", text: PROMPT, off: 10 }], next: 1, crew: [], gen: "1.0", start: 10, file: "abc" } });
    agent.event({ type: "agent.started", data: { session: SESSION, path: DIR, signal: "prompt" } });
    await expect(app.chat.getByText("Sent · Claude reads it at its next step")).toHaveCount(0, { timeout: 10_000 });
    await expect(prompt).toHaveCount(1);
  });
}
