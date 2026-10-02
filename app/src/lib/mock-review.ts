import type { BerthEvent, ExecResult, Session } from "@/lib/api";
import type { ReviewItem } from "@/views/review/review-store";

// Review in mock mode: the finished and waiting agents in mock.ts's
// fixtures, each with work in its worktree. Approving, sending back and
// discarding change that work, so the inbox can be seen emptying.

type Emit = (e: Omit<BerthEvent, "time">) => void;

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const work: Record<string, Omit<ReviewItem, "session" | "agent" | "agent_state" | "state_since">> = {
  "devl|/home/me/work/cal-billing-fix": {
    location: "cal",
    worktree: "billing-fix",
    path: "/home/me/work/cal-billing-fix",
    branch: "me/billing-fix",
    head: "4f1c9e2",
    base: "origin/main",
    upstream: "origin/me/billing-fix",
    ahead: 2,
    behind: 0,
    files: [
      { path: "apps/web/lib/billing/retry.ts", code: " M", added: 14, removed: 3 },
      { path: "packages/features/ee/payments/webhook.ts", code: "M ", added: 22, removed: 9 },
      { path: "apps/web/lib/billing/retry.test.ts", code: "??", added: 48, removed: 0 },
    ],
    added: 84,
    removed: 12,
    commits: [
      { sha: "4f1c9e2b7a1d0c3e5f6a7b8c9d0e1f2a3b4c5d6e", subject: "fix(billing): cap retries at 3 with backoff", author: "Claude", when: ago(31) },
      { sha: "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b", subject: "refactor(billing): move charge errors into ChargeError", author: "Claude", when: ago(44) },
    ],
    base_ahead: 2,
    committed: [
      { path: "apps/web/lib/billing/charge.ts", from: "apps/web/lib/billing/charge-old.ts", code: "R ", added: 2, removed: 2 },
      { path: "packages/lib/backoff.ts", code: "A ", added: 41, removed: 0 },
    ],
  },
  "devl|/home/me/work/cal-booker-perf": {
    location: "cal",
    worktree: "booker-perf",
    path: "/home/me/work/cal-booker-perf",
    branch: "me/booker-perf",
    head: "c0ffee1",
    base: "origin/main",
    ahead: 0,
    behind: 0,
    files: [
      { path: "packages/features/bookings/Booker/Booker.tsx", code: " M", added: 31, removed: 18 },
      { path: "packages/features/bookings/Booker/utils/memo.ts", code: "??", added: 26, removed: 0 },
    ],
    added: 57,
    removed: 18,
    commits: [{ sha: "c0ffee1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b", subject: "perf(booker): memoise the slot grid", author: "Claude", when: ago(25) }],
    base_ahead: 1,
    committed: [{ path: "packages/features/bookings/Booker/components/SlotGrid.tsx", code: "M ", added: 12, removed: 30 }],
  },
};

export const reviewScreens: Record<string, string> = {
  "booker-perf-claude": `❯ Make the booker render faster on long months

● I profiled the Booker on a 31-day month and the slot grid re-rendered
  on every hover. I memoised the slot grid and moved the date maths out of
  render.

  - SlotGrid.tsx: wrapped in memo, keys by date instead of index
  - utils/memo.ts: a small cache for the timezone conversions
  - Booker.tsx: passes stable callbacks

  Render time for the month view went from ~180ms to ~45ms. Type check and
  the booker tests pass.

✻ Brewed for 4m 12s · done 11:42 AM

────────────────────────────────────────────────
❯
────────────────────────────────────────────────
  ⏵⏵ auto mode on (shift+tab to cycle)`,
  "billing-fix-claude": `● Retries are capped at 3 with exponential backoff, and 429s now count as
  retryable. I added tests for the cap and the backoff timing.

  Should I also cap the total retry time? A slow Stripe outage would hold
  the booking lock for the whole backoff.

❯ 1. Yes, cap it at 30s
  2. No, leave it
`,
};

function itemFor(box: string, s: Session): ReviewItem | undefined {
  const w = work[`${box}|${s.dir}`];
  if (!w || s.exited || !s.agent || (s.agent_state !== "finished" && s.agent_state !== "waiting")) return undefined;
  if (w.files.length === 0 && w.ahead === 0 && w.base_ahead === 0) return undefined;
  return { ...structuredClone(w), session: s.name, agent: s.agent, agent_state: s.agent_state, state_since: s.state_since };
}

export function reviewCall(box: string, method: string, path: string, sessions: Session[] | undefined): Promise<unknown> | undefined {
  const screen = /^sessions\/([^/]+)\/screen/.exec(path);
  if (method === "GET" && screen && reviewScreens[decodeURIComponent(screen[1])]) {
    return new Promise((r) => setTimeout(() => r({ screen: reviewScreens[decodeURIComponent(screen[1])] }), 120));
  }
  if (method !== "GET" || (path !== "review" && !path.startsWith("review?"))) return undefined;
  const items = (sessions ?? []).map((s) => itemFor(box, s)).filter((i): i is ReviewItem => !!i);
  items.sort((a, b) => (b.state_since ?? "").localeCompare(a.state_since ?? ""));
  return new Promise((r) => setTimeout(() => r(items), 180));
}

// reviewExec carries out the review actions' git commands on the fixtures.
export function reviewExec(box: string, location: string, command: string, emit: Emit): ExecResult | undefined {
  const w = Object.entries(work).find(([k, v]) => k.startsWith(`${box}|`) && (location === v.location || location === `${v.location}/${v.worktree}`))?.[1];
  if (!w) return undefined;
  const changed = () => setTimeout(() => emit({ type: "exec.finished", box, data: { location, path: w.path, command: command.slice(0, 40), exit_code: 0 } }), 30);
  if (command.startsWith("git restore --staged . && git checkout -- . && git clean -fd")) {
    w.files = [];
    w.added = w.removed = 0;
    changed();
    return { exit_code: 0, output: "" };
  }
  if (command.startsWith("git add -A && printf %s")) {
    const subject = (() => {
      try {
        const b64 = /printf %s '([^']*)' \| base64 -d \| git commit/.exec(command)?.[1] ?? "";
        return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))).split("\n")[0];
      } catch {
        return "Commit";
      }
    })();
    w.committed = [...w.committed, ...w.files.map((f) => ({ ...f, code: f.code === "??" ? "A " : "M " }))];
    w.commits = [{ sha: Math.random().toString(16).slice(2).padEnd(40, "0"), subject, author: "you", when: new Date().toISOString() }, ...w.commits];
    w.base_ahead += 1;
    w.ahead += 1;
    w.head = w.commits[0].sha.slice(0, 7);
    w.files = [];
    w.added = w.removed = 0;
  }
  if (command.includes("git push")) {
    w.ahead = 0;
    w.upstream = `origin/${w.branch}`;
  }
  if (command.startsWith("git add -A") || command.includes("git push")) {
    changed();
    const out = [command.includes("git push") ? `To github.com:calcom/cal.com.git\n   4f1c9e2..${w.head}  HEAD -> ${w.branch}` : "", command.includes("gh pr create") ? "https://github.com/calcom/cal.com/pull/9077" : ""].filter(Boolean).join("\n");
    return { exit_code: 0, output: out };
  }
  return undefined;
}
