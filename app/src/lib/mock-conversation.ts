import type { Artifact, ToolDetail, CrewMember, TranscriptItem } from "@/lib/transcript";
import { keyOf, useConversations } from "@/lib/conversation-store";
import { mockNotice } from "@/lib/chat-controls";

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

async function tools(key: string, verb: string, calls: { verb: string; target: string; file?: boolean; id?: string }[]) {
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
    { verb: "Read", target: "webhook.ts", file: true, id: "mock-read-1" },
    { verb: "Read", target: "createOrder.ts", file: true, id: "mock-read-2" },
    { verb: "Read", target: "payments.test.ts", file: true, id: "mock-read-3" },
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
    { verb: "Search", target: "idempotencyKey", id: "mock-search-1" },
    { verb: "Search", target: "retryWebhook", id: "mock-search-2" },
  ]);
  crew(key, [
    { id: "c1", name: "Explore: retry paths", kind: "subagent", agent: "claude", state: "finished", doing: "Found 3 retry paths", since: start, until: back1 },
    { id: "c2", name: "Explore: idempotency in tests", kind: "subagent", agent: "claude", state: "finished", doing: "No test covers a repeat", since: start, until: Date.now() },
  ]);
  useConversations.getState().push(key, { kind: "edit", id: id(), file: "apps/web/lib/payments/webhook.ts", added: 14, removed: 3, tool: "mock-edit-1" });
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
  await tools(key, "Run", [{ verb: "Run", target: "pnpm test payments", id: "mock-run-1" }]);
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
  // Two finished sessions published pages on claude.ai: one, and eight.
  const pages = MOCK_ARTIFACTS[session];
  if (pages) {
    const t = Date.now();
    const list: Artifact[] = [];
    for (const [i, p] of pages.entries()) {
      const at = t - p.ago * 60_000;
      const tool = `mock-artifact-${session}-${i}`;
      const url = `https://claude.ai/artifact/${p.slug}`;
      const before = list.findIndex((a) => a.url === url);
      const updated = before >= 0;
      if (updated) list.splice(before, 1);
      list.push({ url, title: p.title, description: p.description ?? (updated ? pages.find((x) => x.slug === p.slug)?.description : undefined), file: "index.html", at, tool, updated });
      if (p.said) items.push({ kind: "text", id: id(), text: p.said });
      items.push({ kind: "tools", id: id(), verb: "Run", done: true, items: [{ verb: "Run", target: p.run ?? "pnpm bench search", id: `mock-run-${i}` }] });
      items.push({ kind: "artifact", id: id(), tool, text: p.title, url, description: list[list.length - 1].description, file: "index.html", done: true, updated });
    }
    const key = keyOf(box, session);
    useConversations.setState((s) => (s.artifacts[key] ? s : { artifacts: { ...s.artifacts, [key]: list } }));
  }
  if (state === "finished") items.push({ kind: "text", id: id(), text: pages ? `All green. ${pages.length === 1 ? "The page above has the coverage" : "The pages above have the numbers and screenshots"}; the branch is ready for review.` : "All green. The branch is ready for review." });
  // One finished session shows a notice card (chat-controls).
  const notice = mockNotice(session);
  if (notice) items.push(notice);
  const key = keyOf(box, session);
  useConversations.setState((s) => (s.items[key] ? s : { items: { ...s.items, [key]: items } }));
  return items;
}

// The demo's published pages, oldest first: a slug published twice is
// updated. ago is in minutes.
const MOCK_ARTIFACTS: Record<string, { slug: string; title: string; description?: string; ago: number; said?: string; run?: string }[]> = {
  "order-export-claude-3": [{ slug: "ExampleExportTests", title: "Export job test coverage", description: "Which export paths the new tests cover, with the two still missing", ago: 82, said: "I’ll put the coverage in a page you can share.", run: "pnpm test export --coverage" }],
  "search-perf-claude": [
    { slug: "ExampleSearchBaseline", title: "Search latency baseline", description: "p50 and p95 for the ten slowest queries before any change", ago: 92, said: "First, a baseline to compare against." },
    { slug: "ExampleQueryPlans", title: "Query plans, before", description: "EXPLAIN ANALYZE for each slow query, with the sequential scans marked", ago: 86, run: "pnpm db:explain search" },
    { slug: "ExampleIndexOptions", title: "Index options compared", description: "Trigram, full-text and a covering index, side by side", ago: 71, said: "Three ways to index it; here they are side by side." },
    { slug: "ExampleSearchBaseline", title: "Search latency: before and after", ago: 54, said: "With the trigram index the baseline page now has both runs." },
    { slug: "ExampleCacheHits", title: "Result cache hit rate", description: "Hit rate by query shape over a replayed hour of traffic", ago: 47, run: "pnpm replay traffic --hour" },
    { slug: "ExampleTypeahead", title: "Typeahead debounce trial", description: "How often typeahead queries fire at 80, 150 and 250 ms", ago: 40 },
    { slug: "ExampleSearchScreens", title: "Search page screenshots", description: "Desktop and phone, light and dark, before and after", ago: 33, run: "pnpm e2e search --screenshots" },
    { slug: "ExampleRollout", title: "Rollout checklist", description: "Migration order, the flag, and what to watch on the dashboard", ago: 29 },
    { slug: "ExampleSlowLog", title: "Slow query log, last 24 hours", description: "Every search query over 200 ms since the index went in", ago: 24, said: "Last, the slow log since the change.", run: "pnpm db:slowlog --since 24h" },
  ],
};

// What the demo's tool calls show when opened, as a box would send them.
const DETAILS: Record<string, ToolDetail> = {
  "mock-read-1": { id: "mock-read-1", name: "Read", file: "apps/web/lib/payments/webhook.ts", output: "     1\timport { createOrder } from \"../checkout/createOrder\";\n     2\timport { verify } from \"./signature\";\n     3\t\n     4\texport async function handleWebhook(req: Request) {\n     5\t  const event = await verify(req);\n     6\t  return createOrder(event.data);\n     7\t}" },
  "mock-read-2": { id: "mock-read-2", name: "Read", file: "apps/web/lib/checkout/createOrder.ts", output: "     1\texport async function createOrder(data: OrderInput) {\n     2\t  const charge = await payments.charge(data.amount);\n     3\t  return db.order.create({ data: { ...data, chargeId: charge.id } });\n     4\t}" },
  "mock-read-3": { id: "mock-read-3", name: "Read", file: "apps/web/lib/payments/payments.test.ts", output: "     1\tdescribe(\"webhook\", () => {\n     2\t  test(\"creates an order\", async () => { … });\n     3\t});" },
  "mock-search-1": { id: "mock-search-1", name: "Grep", pattern: "idempotencyKey", output: "apps/web/lib/payments/stripe.ts:41:  idempotencyKey: event.id,\napps/web/lib/payments/types.ts:12:  idempotencyKey?: string;" },
  "mock-search-2": { id: "mock-search-2", name: "Grep", pattern: "retryWebhook", output: "No matches found" },
  "mock-run-1": { id: "mock-run-1", name: "Bash", command: "pnpm test payments", output: " ✓ webhook › creates an order (12 ms)\n ✓ webhook › returns the same order for a repeated event (9 ms)\n ✓ webhook › stops after five retries (4 ms)\n\n Test Files  1 passed (1)\n      Tests  3 passed (3)\n   Duration  1.21s" },
  "mock-edit-1": {
    id: "mock-edit-1",
    name: "Edit",
    file: "apps/web/lib/payments/webhook.ts",
    old: "export async function handleWebhook(req: Request) {\n  const event = await verify(req);\n  return createOrder(event.data);\n}",
    new: "export async function handleWebhook(req: Request) {\n  const event = await verify(req);\n  // A repeated event finds the order it already made.\n  const existing = await db.order.findUnique({ where: { idempotencyKey: event.id } });\n  if (existing) return existing;\n  return createOrder({ ...event.data, idempotencyKey: event.id });\n}",
    output: "The file apps/web/lib/payments/webhook.ts has been updated.",
  },
};

export const mockToolDetail = async (id: string): Promise<ToolDetail> => {
  await wait(250);
  const d = DETAILS[id];
  if (!d) throw new Error("That step isn't in the demo.");
  return d;
};
