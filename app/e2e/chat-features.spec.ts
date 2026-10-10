import { BOX, DIR, fakeAgent } from "./fake-agent";
import { expect, mockOnly, test, type App } from "./fixtures";
import type { ChatPresentation, PresentationAnswer } from "../src/lib/chat-presentations";

test.beforeEach(() => mockOnly("isolated assistant-ui features"));

async function conversation(app: App, text: string) {
  const agent = await fakeAgent();
  const chat = { id: "features", agent: "codex", mode: "chat", cwd: "C:\\Projects\\shop", state: "idle", started_at: "2026-10-10T12:00:00Z", thread_id: "thread", items: [{ id: "answer", kind: "assistant", text }], approvals: [] };
  await app.context.route(`${agent.url}/v1/local**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/local") return route.fulfill({ json: { supported: true, name: "work-hp", home: chat.cwd, agents: [], sessions: [chat] } });
    if (path.endsWith("/conversations") || path.endsWith("/models")) return route.fulfill({ json: [] });
    return route.fulfill({ json: chat });
  });
  await app.open({ agent });
  await app.page.getByTestId("nav-local").click();
  await app.page.getByRole("button", { name: /Codex.*idle/ }).click();
  return { agent, pane: app.page.getByTestId("local-chat") };
}

test("math is typeset while currency and code retain their text", async ({ app }) => {
  const { agent, pane } = await conversation(app, "\\(x^2\\)\n\n\\[\\frac ab\\]\n\n$5 and $10.\n\n```ts\nconst price = '$5';\n```");
  try {
    await expect(pane.locator(".katex")).toHaveCount(2);
    await expect(pane.locator(".katex-display")).toBeVisible();
    await expect(pane.getByText("$5 and $10.", { exact: true })).toBeVisible();
    await expect(pane.locator("pre")).toHaveText("const price = '$5';");
    await expect(pane.locator(".aui-code-header-root").getByRole("button", { name: "Copy", exact: true })).toBeVisible();
    expect(await app.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await agent.close(); }
});

test("unsupported speech synthesis has no read-aloud action", async ({ app }) => {
  await app.context.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined });
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: undefined });
  });
  const { agent, pane } = await conversation(app, "A saved answer.");
  try {
    await expect(pane.getByRole("article", { name: "Codex" })).toContainText("A saved answer.");
    await expect(pane.getByRole("button", { name: "Read aloud" })).toHaveCount(0);
  } finally { await agent.close(); }
});

test("read-aloud can stop and reports speech failures without losing the answer", async ({ app }) => {
  await app.context.addInitScript(() => {
    class Utterance extends EventTarget { constructor(public text: string) { super(); } }
    let current: Utterance | undefined;
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: Utterance });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      speak(utterance: Utterance) { current = utterance; document.body.dataset.spoken = utterance.text; },
      cancel() { document.body.dataset.speechCancelled = "true"; current?.dispatchEvent(new Event("end")); },
    } });
    window.addEventListener("e2e.speechError", () => current?.dispatchEvent(new Event("error")));
  });
  const { agent, pane } = await conversation(app, "A saved answer.");
  try {
    await pane.getByRole("button", { name: "Read aloud", exact: true }).click();
    await expect(app.page.locator("body")).toHaveAttribute("data-spoken", "A saved answer.");
    await pane.getByRole("button", { name: "Stop reading", exact: true }).click();
    await expect(app.page.locator("body")).toHaveAttribute("data-speech-cancelled", "true");
    await pane.getByRole("button", { name: "Read aloud", exact: true }).click();
    await app.page.evaluate(() => window.dispatchEvent(new Event("e2e.speechError")));
    await expect(pane.getByText("Read-aloud failed. Check audio output and try again.")).toBeVisible();
    await expect(pane.getByRole("article", { name: "Codex" })).toContainText("A saved answer.");
  } finally { await agent.close(); }
});

async function toolConversation(app: App, presentations: ChatPresentation[]) {
  const agent = await fakeAgent();
  const calls: PresentationAnswer[] = [];
  const control: { loseAnswer: boolean; answerHeld?: Promise<void> } = { loseAnswer: false };
  const chat = { id: "features", agent: "codex", mode: "chat", location: "shop/fix", cwd: DIR, state: "waiting", started_at: "2026-10-10T12:00:00Z", thread_id: "thread", turn_id: "turn", items: [
    { id: "reasoning", kind: "assistant", reasoning: true, text: "Checking the public plan" },
    ...presentations.map((presentation) => ({ id: presentation.id, kind: "tool", text: "burf_present", presentation })),
  ], approvals: [] };
  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/info")) return route.fulfill({ json: { name: BOX, version: "test", capabilities: ["chat.codex", "transcript"], agents: [{ id: "codex", name: "Codex", command: "codex" }] } });
    if (path.endsWith("/chats")) return route.fulfill({ json: { chats: [chat] } });
    if (path.endsWith("/answer")) {
      const answer: PresentationAnswer = route.request().postDataJSON();
      calls.push(answer);
      await control.answerHeld;
      const form = presentations.find((presentation) => presentation.type === "form");
      if (form?.type === "form") {
        form.state = answer.action === "accept" ? "accepted" : "declined";
        for (const field of form.fields) field.value = answer.values?.[field.name] ?? field.value;
      }
      if (control.loseAnswer) return route.abort("connectionreset");
      return route.fulfill({ json: {} });
    }
    if (path.includes("/chats/")) return route.fulfill({ json: chat });
    return route.continue();
  });
  await app.open({ agent });
  const more = app.page.getByRole("button", { name: "1 more worktree", exact: true });
  if (await more.isVisible()) await more.click();
  await app.openWorktree(`${BOX}/fix`);
  return { agent, calls, control, pane: app.page.getByTestId("remote-chat") };
}

const question = (): Extract<ChatPresentation, { type: "form" }> => ({ type: "form", id: "form1", server: "Burf", message: "Which target?", state: "request", fields: [
  { name: "target", label: "Target", kind: "text", value: "", required: true },
  { name: "mode", label: "Mode", kind: "choice", value: "Safe", options: ["Safe", "Fast"] },
  { name: "notify", label: "Notify", kind: "toggle", value: "false" },
] });

for (const width of [1440, 720]) test(`typed tool data and a one-use form render at ${width}px`, async ({ app }, info) => {
  await app.page.setViewportSize({ width, height: 900 });
  const f = await toolConversation(app, [
    { type: "chart", id: "chart1", label: "Build time", value: "2 sec", points: [8, 5, 2], variant: "line" },
    { type: "table", id: "table1", caption: "Build comparison", columns: [{ key: "name", label: "Name", priority: "primary" }, { key: "time", label: "Time", format: { kind: "number" } }], rows: [{ name: "Slow", time: 12 }, { name: "Fast", time: 2 }] },
    question(),
  ]);
  let release = () => {};
  try {
    await f.pane.getByRole("button", { name: "Reasoning", exact: true }).click();
    await expect(f.pane.getByText("Checking the public plan", { exact: true })).toBeVisible();
    await f.pane.getByRole("button", { name: "Reasoning", exact: true }).click();
    await expect(f.pane.getByRole("region", { name: "Build time" })).toContainText("2 sec");
    const table = f.pane.locator('[data-chat-presentation="table"]');
    await expect(table).toContainText("Slow");
    if (width === 1440) {
      await table.getByRole("button", { name: "Sort by Time", exact: true }).click();
      await expect(table.getByRole("row").nth(1)).toContainText("Fast");
    } else {
      const sort = table.getByRole("combobox", { name: "Sort table", exact: true });
      await sort.press("Enter");
      await app.page.keyboard.press("End");
      await app.page.keyboard.press("ArrowUp");
      await app.page.keyboard.press("Enter");
      await expect(sort).toHaveText("Time, ascending");
      await expect(table.getByRole("listitem").first()).toContainText("Fast");
    }
    const form = f.pane.getByRole("region", { name: "Agent question" });
    await expect(form.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
    await form.getByRole("textbox", { name: "Target", exact: true }).fill("Mini");
    await form.getByRole("switch", { name: "Notify" }).click();
    if (width === 1440) f.control.answerHeld = new Promise<void>((resolve) => { release = resolve; });
    await form.getByRole("button", { name: "Send", exact: true }).click();
    if (width === 1440) {
      await expect(form.getByRole("status")).toHaveText("Sending answer");
      await expect(form.getByRole("textbox", { name: "Target", exact: true })).toBeDisabled();
      expect(f.calls).toHaveLength(1);
      release();
    }
    await expect(form).toContainText("Sent to Burf");
    await expect(form.getByRole("status")).toHaveText("Answered");
    await expect(form.getByText("Sent to Burf", { exact: true })).toBeFocused();
    expect(f.calls).toEqual([{ action: "accept", values: { target: "Mini", mode: "Safe", notify: "true" } }]);
    await expect(form.getByRole("button", { name: "Send", exact: true })).toHaveCount(0);
    expect(await app.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await app.page.screenshot({ path: info.outputPath(`tool-presentations-${width}.png`), animations: "disabled" });
  } finally { release(); await f.agent.close(); }
});

test("lost form responses recover the settled answer without replay", async ({ app }) => {
  const f = await toolConversation(app, [question()]);
  f.control.loseAnswer = true;
  try {
    const form = f.pane.getByRole("region", { name: "Agent question" });
    await form.getByRole("button", { name: "Decline", exact: true }).click();
    await expect(form).toContainText("Declined");
    await expect(form.getByRole("status")).toHaveText("Declined");
    await expect(f.pane.getByText(/The request may have arrived/)).toBeVisible();
    await app.page.reload();
    await expect(app.page.getByRole("region", { name: "Agent question" })).toContainText("Declined");
    expect(f.calls).toEqual([{ action: "decline" }]);
  } finally { await f.agent.close(); }
});
