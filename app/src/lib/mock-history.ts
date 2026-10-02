import type { HistoryMatch, HistorySession, Transcript, Turn } from "@/lib/history";

// Agent history in ?mock=1: a few made-up sessions per box, a Claude
// transcript with turns and terminal captures, searched the way the box does
// (internal/box/history.go). Every line here is invented.

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

interface MockRecord {
  session: HistorySession;
  turns?: Turn[];
  lines?: string[];
  screen?: string[];
}

function turns(start: number, list: [Turn["role"], string, string?][]): Turn[] {
  return list.map(([role, text, tool], n) => ({ n, role, text, tool, time: ago(start - n * 1.5) }));
}

const billingTurns = turns(50, [
  ["user", "The billing page shows the wrong currency for teams on annual plans. Find out why and fix it, with a test."],
  ["assistant", "I'll start by finding where the billing page formats prices."],
  ["tool", "rg -n \"formatPrice\" apps/web", "Bash"],
  ["result", "apps/web/billing/plan-card.tsx:41:  formatPrice(plan.amount, user.locale)\napps/web/billing/invoice-row.tsx:18:  formatPrice(row.total, row.currency)"],
  ["tool", "apps/web/billing/plan-card.tsx", "Read"],
  ["result", "export function PlanCard({ plan, user }) {\n  const price = formatPrice(plan.amount, user.locale);\n  …"],
  ["assistant", "Found it: the plan card formats the amount with the user's locale but never passes the plan's currency, so annual team plans priced in EUR show as USD."],
  ["tool", "apps/web/billing/plan-card.tsx", "Edit"],
  ["result", "The file apps/web/billing/plan-card.tsx has been updated."],
  ["tool", "pnpm vitest run billing", "Bash"],
  ["result", "✓ billing/plan-card.test.tsx (4 tests)\nTest Files  1 passed (1)\nTests  4 passed (4)"],
  ["assistant", "Fixed: the plan card now passes the plan's currency to formatPrice, and a new test covers an annual EUR team plan. All billing tests pass."],
  ["user", "Also check the invoice emails use the same currency."],
  ["tool", "rg -n \"currency\" packages/emails/invoice", "Bash"],
  ["result", "packages/emails/invoice/total.tsx:9:  {formatPrice(total, currency)}"],
  ["assistant", "The invoice emails already pass the invoice's currency, so they were right. Waiting for you: should I open a pull request?"],
]);

const judgeTurns = turns(40, [
  ["user", "Rewrite the judge prompt so it scores each criterion separately, then rerun the small eval set."],
  ["tool", "evals/judge/prompt.md", "Read"],
  ["result", "You are a strict grader. Give one score from 1 to 10…"],
  ["assistant", "The current prompt asks for one overall score. I'll split it into three criteria: correctness, completeness and style, each 1–5."],
  ["tool", "evals/judge/prompt.md", "Write"],
  ["result", "File written."],
  ["tool", "python -m evals.run --set small", "Bash"],
  ["result", "running 40 cases…\nmean correctness 4.1  completeness 3.8  style 4.4\nAPI_KEY=[hidden: looks like a secret]"],
  ["assistant", "Done. The small set scores 4.1 / 3.8 / 4.4; completeness is the weak spot, mostly on multi-step tasks."],
]);

const internalTurns = turns(60 * 30, [
  ["user", "Upgrade the internal dashboard to the new router and make sure the deep links still work."],
  ["tool", "pnpm up @tanstack/react-router", "Bash"],
  ["result", "Progress: resolved 812, reused 790, downloaded 22, added 22, done"],
  ["assistant", "Upgraded. Two routes used the removed `useMatch` signature; I've moved them to `useMatchRoute`. Deep links to /reports/:id and /team/:slug open the right pages."],
]);

const codexLines = (() => {
  const out = ["$ codex \"Make the QA deck generator skip archived event types\"", "", "▌ Reading packages/qa-deck/src/generate.ts"];
  for (let i = 1; i <= 24; i++) out.push(`  ${String(i).padStart(3)}  ${["import { eventTypes } from \"./data\";", "export async function generate(opts) {", "  const all = await eventTypes(opts.team);", "  return all.map(toSlide);", "}"][i % 5]}`);
  out.push("", "▌ The generator maps every event type, archived ones too. Filtering on `archived` before mapping.", "", "✎ packages/qa-deck/src/generate.ts (+1 -1)");
  out.push("-  return all.map(toSlide);", "+  return all.filter((t) => !t.archived).map(toSlide);", "");
  out.push("$ pnpm -F qa-deck test", "", " ✓ generate.test.ts (6)", " ✓ slides.test.ts (11)", "", " Test Files  2 passed (2)", "      Tests  17 passed (17)", "");
  out.push("▌ Added a test with an archived event type; it is left out of the deck now.");
  return out;
})();

const shellLines = ["$ git status", "On branch main", "nothing to commit, working tree clean", "$ pnpm install", "Lockfile is up to date, resolution step is skipped", "Done in 2.1s", "$ export STRIPE_KEY=[hidden: looks like a secret]", "$ pnpm dev", "▲ Next.js ready on http://localhost:3000"];

const records: Record<string, MockRecord[]> = {
  devl: [
    {
      session: { id: "claude:7d1c0a2e-billing", source: "claude", agent: "claude", location: "cal", worktree: "billing-fix", path: "/home/sean/work/cal-billing-fix", branch: "sean/billing-fix", title: "Fix currency on annual team plans", started: ago(50), updated: ago(4), ended: false, state: "waiting", lines: billingTurns.length, running: "billing-fix-claude", linked: ["term:billing-fix-claude-mock1"] },
      turns: billingTurns,
    },
    {
      session: { id: "term:billing-fix-claude-mock1", source: "terminal", name: "billing-fix-claude", agent: "claude", command: "claude", location: "cal", worktree: "billing-fix", path: "/home/sean/work/cal-billing-fix", branch: "sean/billing-fix", started: ago(52), updated: ago(4), ended: false, state: "waiting", lines: 3, running: "billing-fix-claude", linked: ["claude:7d1c0a2e-billing"] },
      lines: ["╭───────────────────────────╮", "│ ✻ Welcome to Claude Code! │", "╰───────────────────────────╯"],
      screen: ["> Also check the invoice emails use the same currency.", "", "⏺ The invoice emails already pass the invoice's currency, so they were right.", "  Waiting for you: should I open a pull request?", "", "> "],
    },
    {
      session: { id: "term:qa-deck-codex-mock2", source: "terminal", name: "qa-deck-codex", agent: "codex", command: "codex", location: "cal", worktree: "qa-deck", path: "/home/sean/work/cal-qa-deck", branch: "sean/qa-deck", started: ago(18), updated: ago(2), ended: false, state: "running", lines: codexLines.length, running: "qa-deck-codex" },
      lines: codexLines,
      screen: ["▌ Running the full test suite once more…"],
    },
    {
      session: { id: "claude:41aa9f03-internal", source: "claude", agent: "claude", location: "internal", path: "/home/sean/work/internal", branch: "main", title: "Upgrade the dashboard router", started: ago(60 * 30), updated: ago(60 * 30 - 6), ended: true, lines: internalTurns.length },
      turns: internalTurns,
    },
    {
      session: { id: "term:cal-shell-mock3", source: "terminal", name: "cal-shell", location: "cal", path: "/home/sean/work/cal", branch: "main", started: ago(60 * 26), updated: ago(60 * 25), ended: true, state: "stopped", lines: shellLines.length },
      lines: shellLines,
    },
  ],
  gpu: [
    {
      session: { id: "claude:c39e11b0-judge", source: "claude", agent: "claude", location: "evals", worktree: "judge-v2", path: "/home/sean/evals-judge-v2", branch: "judge-v2", title: "Score judge criteria separately", started: ago(40), updated: ago(1), ended: false, state: "running", lines: judgeTurns.length, running: "judge-v2-claude" },
      turns: judgeTurns,
    },
  ],
};

const latest = (s: HistorySession) => s.updated ?? s.started ?? "";

function matchFilter(s: HistorySession, p: URLSearchParams): boolean {
  const id = p.get("session");
  if (id && s.id !== id) return false;
  const agent = p.get("agent");
  if (agent && s.agent !== agent) return false;
  const source = p.get("source");
  if (source && s.source !== source) return false;
  const loc = p.get("location");
  if (loc) {
    const [l, wt] = loc.split("/");
    if (s.location !== l || (wt && s.worktree !== wt)) return false;
  }
  const since = p.get("since");
  if (since) {
    const days = /^(\d+)d$/.exec(since);
    const t = days ? Date.now() - Number(days[1]) * 86_400_000 : Date.parse(since);
    if (!Number.isNaN(t) && Date.parse(latest(s)) < t) return false;
  }
  return true;
}

function search(list: MockRecord[], q: string, regexp: boolean, limit: number): HistoryMatch[] | Error {
  let test: (s: string) => boolean;
  try {
    const re = new RegExp(regexp ? q : q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    test = (s) => re.test(s);
  } catch (err) {
    return err as Error;
  }
  const out: HistoryMatch[] = [];
  for (const r of list) {
    if (r.turns) {
      for (const t of r.turns) {
        const lines = (t.role === "tool" && t.tool ? `${t.tool}: ${t.text}` : t.text).split("\n");
        lines.forEach((l, i) => {
          if (out.length < limit && test(l) && !l.startsWith("[hidden")) out.push({ session: r.session, position: t.n, time: t.time, role: t.role, line: l, before: lines.slice(Math.max(0, i - 2), i), after: lines.slice(i + 1, i + 3) });
        });
      }
    } else {
      const all = [...(r.lines ?? []), ...(r.screen ?? [])];
      const logged = r.lines?.length ?? 0;
      all.forEach((l, i) => {
        if (out.length < limit && test(l) && !l.includes("[hidden")) {
          out.push({ session: r.session, position: i < logged ? i : i - logged, screen: i >= logged || undefined, time: r.session.updated, line: l, before: all.slice(Math.max(0, i - 2), i), after: all.slice(i + 1, i + 3) });
        }
      });
    }
  }
  return out;
}

export function historyCall(box: string, method: string, path: string, delay: <T>(v: T) => Promise<T>): Promise<unknown> | undefined {
  if (method !== "GET" || !(path === "history" || path.startsWith("history?") || path.startsWith("history/"))) return undefined;
  const url = new URL(path, "http://box/");
  const p = url.searchParams;
  const list = (records[box] ?? []).filter((r) => matchFilter(r.session, p)).sort((a, b) => latest(b.session).localeCompare(latest(a.session)));
  if (url.pathname.startsWith("/history/")) {
    const id = decodeURIComponent(url.pathname.slice("/history/".length));
    const r = (records[box] ?? []).find((x) => x.session.id === id);
    if (!r) return Promise.reject(new Error("no recorded session with that id"));
    const from = Number(p.get("from") ?? 0);
    const limit = Number(p.get("limit") ?? 500);
    const t: Transcript = { session: r.session, from, total: r.turns?.length ?? r.lines?.length ?? 0 };
    if (r.turns) t.turns = r.turns.slice(from, from + limit);
    else {
      t.lines = (r.lines ?? []).slice(from, from + limit).map((text, i) => ({ n: from + i, text, time: r.session.updated }));
      t.screen = r.screen;
    }
    return delay(t);
  }
  const q = p.get("q");
  const limit = Number(p.get("limit") || 0) || 50;
  if (!q) return delay(list.slice(0, limit).map((r) => r.session));
  const found = search(list, q, p.get("regexp") === "1", Math.min(limit, 200));
  if (found instanceof Error) return Promise.reject(found);
  return delay(found);
}
