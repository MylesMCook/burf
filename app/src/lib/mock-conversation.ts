import type { CrewMember, TranscriptItem } from "@/lib/transcript";
import { keyOf, useConversations } from "@/lib/conversation-store";

// The demo's stand-in for berthd's transcript stream: a short scripted turn
// played into the conversation store, so the view can be tried with ?mock=1.

let n = 0;
const id = () => `m${++n}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Text arrives a few words at a time, as a streamed reply does.
async function stream(key: string, text: string) {
  const s = useConversations.getState();
  const item = { kind: "text" as const, id: id(), text: "" };
  s.push(key, item);
  const words = text.split(" ");
  for (let i = 0; i < words.length; i += 3) {
    await wait(70);
    useConversations.getState().update(key, item.id, { text: words.slice(0, i + 3).join(" ") });
  }
}

async function think(key: string, ms: number) {
  const t = { kind: "thinking" as const, id: id(), since: Date.now() };
  useConversations.getState().push(key, t);
  await wait(ms);
  useConversations.getState().remove(key, t.id);
}

async function tools(key: string, verb: string, calls: { verb: string; target: string; file?: boolean }[]) {
  const t = { kind: "tools" as const, id: id(), verb, items: [] as typeof calls, done: false };
  useConversations.getState().push(key, t);
  for (const c of calls) {
    await wait(420);
    t.items = [...t.items, c];
    useConversations.getState().update(key, t.id, { items: t.items });
  }
  useConversations.getState().update(key, t.id, { done: true });
}

function crew(key: string, members: CrewMember[]) {
  useConversations.getState().setCrew(key, members);
}

// playTurn plays a believable turn for a prompt: read, search, two helpers,
// an edit, a question for the person, then a short answer.
export async function playTurn(box: string, session: string, prompt: string) {
  const key = keyOf(box, session);
  const s = useConversations.getState();
  s.push(key, { kind: "user", id: id(), text: prompt });
  await think(key, 900);
  await stream(key, "I’ll trace how a payment webhook reaches the order, then make retries safe to repeat.");
  await tools(key, "Read", [
    { verb: "Read", target: "webhook.ts", file: true },
    { verb: "Read", target: "createOrder.ts", file: true },
    { verb: "Read", target: "payments.test.ts", file: true },
  ]);
  const start = Date.now();
  useConversations.getState().push(key, { kind: "crew", id: id(), names: ["Explore: retry paths", "Explore: idempotency in tests"] });
  crew(key, [
    { id: "c1", name: "Explore: retry paths", kind: "subagent", agent: "claude", state: "running", doing: "Reading retry.ts", since: start },
    { id: "c2", name: "Explore: idempotency in tests", kind: "subagent", agent: "claude", state: "running", doing: "Searching for idempotency", since: start },
  ]);
  await think(key, 2200);
  const back1 = Date.now();
  crew(key, [
    { id: "c1", name: "Explore: retry paths", kind: "subagent", agent: "claude", state: "finished", doing: "Found 3 retry paths", since: start, until: back1 },
    { id: "c2", name: "Explore: idempotency in tests", kind: "subagent", agent: "claude", state: "running", doing: "Reading payments.test.ts", since: start },
  ]);
  await tools(key, "Search", [
    { verb: "Search", target: "idempotencyKey" },
    { verb: "Search", target: "retryWebhook" },
  ]);
  crew(key, [
    { id: "c1", name: "Explore: retry paths", kind: "subagent", agent: "claude", state: "finished", doing: "Found 3 retry paths", since: start, until: back1 },
    { id: "c2", name: "Explore: idempotency in tests", kind: "subagent", agent: "claude", state: "finished", doing: "No test covers a repeat", since: start, until: Date.now() },
  ]);
  useConversations.getState().push(key, { kind: "edit", id: id(), file: "apps/web/lib/payments/webhook.ts", added: 14, removed: 3 });
  await wait(500);
  useConversations.getState().push(key, { kind: "ask", id: id(), tool: "Bash", detail: "pnpm test payments", why: "Run the payment tests", structured: true, choices: PERMISSION });
}

// Claude Code's permission menu, matched to the three answers.
const PERMISSION = [
  { key: "1", label: "Allow", title: "Yes" },
  { key: "2", label: "Always allow", title: "Yes, and don't ask again for pnpm test commands in /home/me/work/shop" },
  { key: "3", label: "Deny", title: "No, and tell Claude what to do differently (esc)" },
];

// After the person answers the question: run the tests and finish.
export async function finishTurn(box: string, session: string) {
  const key = keyOf(box, session);
  await tools(key, "Run", [{ verb: "Run", target: "pnpm test payments" }]);
  await stream(
    key,
    "Done. A repeated webhook now finds the order by its **idempotency key** and returns it instead of charging twice.\n\n| | Before | After |\n|---|---|---|\n| Duplicate charge on retry | yes | **no** |\n| Retries | unlimited | 5 over 10 minutes |\n\n**What changed:**\n- `createOrder` looks the key up before charging.\n- Retries back off and stop after five.\n- A test sends the same event twice (`pnpm test payments` passes).",
  );
}

// seedTranscript gives an agent that is already working something to show
// when it is opened.
export function seedTranscript(box: string, session: string, state: string, worktree: string): TranscriptItem[] {
  const items: TranscriptItem[] = [
    { kind: "user", id: id(), text: `Pick up ${worktree}: read the issue and get it to green.` },
    { kind: "text", id: id(), text: `I’ll start from the failing test in ${worktree} and work outwards.` },
    { kind: "tools", id: id(), verb: "Read", done: true, items: [{ verb: "Read", target: "README.md", file: true }, { verb: "Read", target: "package.json", file: true }] },
  ];
  if (state === "waiting") {
    items.push({ kind: "edit", id: id(), file: "src/checkout.test.ts", added: 2, removed: 1 });
    items.push({ kind: "ask", id: id(), tool: "Bash", detail: "pnpm db:migrate --name add-idempotency-key", why: "Create the migration for the new idempotency_key column", structured: true, choices: PERMISSION });
  }
  if (state === "running") {
    items.push({ kind: "crew", id: id(), names: ["Explore: failing tests", "Explore: fixtures"] });
    items.push({ kind: "thinking", id: id(), since: Date.now() - 12_000 });
    const t = Date.now();
    useConversations.getState().setCrew(keyOf(box, session), [
      { id: "s1", name: "Explore: failing tests", kind: "subagent", agent: "claude", state: "running", doing: "Reading checkout.test.ts", since: t - 41_000 },
      { id: "s2", name: "Explore: fixtures", kind: "subagent", agent: "claude", state: "finished", doing: "Found 2 stale fixtures", since: t - 64_000, until: t - 18_000 },
    ]);
  }
  if (state === "finished") items.push({ kind: "text", id: id(), text: "All green. The branch is ready for review." });
  const key = keyOf(box, session);
  useConversations.setState((s) => (s.items[key] ? s : { items: { ...s.items, [key]: items } }));
  return items;
}
