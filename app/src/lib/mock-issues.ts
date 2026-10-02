import type { ExecResult } from "@/lib/api";

// mockIssues answers the gh calls the Issues plugin makes (an issue list and
// an issue thread through `gh api graphql`, and `gh issue comment`), so it
// can be explored with ?mock=1. Every issue here is invented. Comments
// "posted" here only ever land in this file's memory.

interface Fixture {
  number: number;
  title: string;
  author: string;
  days: number;
  updated: number;
  labels: string[];
  assignees: string[];
  body: string;
  comments: { author: string; hours: number; body: string }[];
  prs?: { number: number; state: "OPEN" | "MERGED" | "CLOSED"; draft?: boolean; title: string }[];
}

const COLORS: Record<string, string> = {
  bug: "d73a4a",
  "good first issue": "7057ff",
  booking: "0e8a16",
  "app-store": "1d76db",
  performance: "fbca04",
  docs: "0075ca",
  "needs repro": "e4e669",
  billing: "c5def5",
  a11y: "bfd4f2",
  "help wanted": "008672",
  infra: "5319e7",
};

const VIEWER = "me";

const ISSUES: Record<string, Fixture[]> = {
  "calcom/cal.com": [
    {
      number: 18204,
      title: "Login loops after password reset",
      author: "ana-ng",
      days: 3,
      updated: 0.4,
      labels: ["bug", "needs repro"],
      assignees: [],
      body: [
        "### What happens",
        "",
        "After resetting a password from the email link, signing in sends you straight back to `/auth/login` with no error. It happens on every try until the session cookie is cleared by hand.",
        "",
        "### Steps",
        "",
        "1. Ask for a reset link on `/auth/forgot-password`",
        "2. Set a new password",
        "3. Sign in with it",
        "",
        "### Expected",
        "",
        "Signed in and on `/bookings/upcoming`.",
        "",
        "<!-- Please include your browser and version -->",
        "Seen on Firefox and Safari, not on Chrome. Possibly the stale `next-auth.session-token` from before the reset.",
      ].join("\n"),
      comments: [
        { author: "tomas-r", hours: 50, body: "Can reproduce on a fresh local install. The old session isn't invalidated when the password changes, and the new sign-in races it." },
        { author: VIEWER, hours: 30, body: "Looks like `invalidateSessions` only runs for the password change in Settings, not for the reset flow. Should be a one-liner in the reset handler plus a test." },
      ],
    },
    {
      number: 18197,
      title: "Round-robin skips hosts whose calendars are on a secondary account",
      author: "mira-k",
      days: 6,
      updated: 1.2,
      labels: ["bug", "booking"],
      assignees: [VIEWER],
      body: "When a host connects two Google accounts and the destination calendar is on the second one, round-robin never picks them.\n\n```ts\n// packages/features/bookings/lib/getLuckyUser.ts\nconst available = hosts.filter((h) => h.credentials.length > 0);\n```\n\nThe filter looks at the first credential only.",
      comments: [{ author: "ana-ng", hours: 70, body: "Confirmed with a team of three. Removing the second account makes it work again." }],
      prs: [{ number: 18211, state: "OPEN", draft: true, title: "fix: consider every credential when picking a round-robin host" }],
    },
    {
      number: 18190,
      title: "Booking page takes 4s to become interactive on slow 3G",
      author: "devon-p",
      days: 9,
      updated: 2,
      labels: ["performance", "booking"],
      assignees: [],
      body: "Lighthouse on the public booking page, throttled to slow 3G:\n\n| Metric | Now | Target |\n| --- | --- | --- |\n| TTI | 4.1s | < 2.5s |\n| JS | 612 KB | < 350 KB |\n\nMost of it is the timezone list and the embed bundle loading eagerly.\n\n- [x] Measure\n- [ ] Lazy-load the timezone select\n- [ ] Split the embed bundle",
      comments: [],
    },
    {
      number: 18185,
      title: "Document the webhook payload for BOOKING_RESCHEDULED",
      author: "lee-w",
      days: 12,
      updated: 4,
      labels: ["docs", "good first issue"],
      assignees: [],
      body: "The docs list the payload for `BOOKING_CREATED` and `BOOKING_CANCELLED`, but not for `BOOKING_RESCHEDULED`, which carries `rescheduleUid` and the old start time.",
      comments: [{ author: "sam-q", hours: 200, body: "I'd like to take this one if nobody has started." }],
    },
    {
      number: 18172,
      title: "Stripe app: refunds for seated events refund every seat",
      author: "priya-v",
      days: 15,
      updated: 5,
      labels: ["bug", "billing", "app-store"],
      assignees: ["tomas-r"],
      body: "Cancelling one attendee of a seated event refunds the payments of **all** attendees. Only the cancelling attendee's payment should be refunded.",
      comments: [
        { author: "tomas-r", hours: 300, body: "Found it: the refund looks up payments by `bookingId`, and seats share one booking." },
        { author: "priya-v", hours: 280, body: "Thanks, that matches what we saw on the dashboard." },
      ],
      prs: [{ number: 18180, state: "MERGED", title: "fix(stripe): refund only the cancelling seat" }],
    },
    {
      number: 18166,
      title: "Availability toggles can't be reached with the keyboard",
      author: "nadia-o",
      days: 19,
      updated: 8,
      labels: ["a11y", "help wanted"],
      assignees: [],
      body: "Tabbing through the weekly availability skips the day switches. They are `div`s with click handlers.",
      comments: [],
    },
    {
      number: 18151,
      title: "Add an ICS feed per event type",
      author: "felix-b",
      days: 24,
      updated: 11,
      labels: ["app-store"],
      assignees: [VIEWER],
      body: "A read-only ICS URL per event type so people can subscribe to just one kind of booking in their calendar app.",
      comments: [
        { author: VIEWER, hours: 400, body: "Plan: a signed URL per event type, served from the API with a 5 minute cache." },
        { author: "felix-b", hours: 380, body: "Signed URLs sound right. Would the token rotate when the event type is made secret?" },
        { author: VIEWER, hours: 360, body: "Yes, it'd be derived from the event type's secret, so making it secret again rotates it." },
      ],
    },
    {
      number: 18140,
      title: "Flaky: e2e/booking-limits.spec.ts times out on CI",
      author: "ci-bot",
      days: 30,
      updated: 14,
      labels: ["infra"],
      assignees: [],
      body: "Fails roughly one run in eight on `main` with `Timeout 30000ms exceeded` waiting for the third slot.",
      comments: [],
    },
  ],
  "me/notes": [
    {
      number: 412,
      title: "Rotate the staging database credentials monthly",
      author: "ops-team",
      days: 8,
      updated: 3,
      labels: ["infra"],
      assignees: [],
      body: "Automate the monthly rotation and update the secrets store in the same job.",
      comments: [],
    },
    {
      number: 409,
      title: "Seed script leaves orphaned memberships",
      author: "mira-k",
      days: 20,
      updated: 9,
      labels: ["bug"],
      assignees: [VIEWER],
      body: "Running `yarn db-seed` twice leaves memberships pointing at deleted teams.",
      comments: [{ author: "devon-p", hours: 120, body: "Same here; `yarn db-reset` first works around it." }],
    },
  ],
};

const iso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const label = (name: string) => ({ name, color: COLORS[name] ?? "ededed" });

function issueOf(f: Fixture) {
  return {
    number: f.number,
    title: f.title,
    author: f.author,
    createdAt: iso(f.days),
    updatedAt: iso(f.updated),
    labels: f.labels.map(label),
    assignees: f.assignees,
    comments: f.comments.length,
    prs: (f.prs ?? []).map((p) => ({ number: p.number, state: p.state, draft: !!p.draft })),
  };
}

// The title the resolver names a worktree after, for an issue here.
export function mockIssueTitle(n: number): string | undefined {
  for (const list of Object.values(ISSUES)) {
    const f = list.find((x) => x.number === n);
    if (f) return f.title;
  }
  return undefined;
}

const arg = (command: string, name: string) => new RegExp(`-[fF] ${name}='?([^' ]+)'?`).exec(command)?.[1];

export function mockIssues(command: string): ExecResult | undefined {
  if (command.startsWith("gh api graphql") && command.includes("issues(first:100")) {
    const repo = `${arg(command, "owner")}/${arg(command, "name")}`;
    const list = ISSUES[repo];
    if (!list) return { exit_code: 0, output: JSON.stringify({ viewer: VIEWER, repo, enabled: false, total: 0, issues: [] }) };
    return { exit_code: 0, output: JSON.stringify({ viewer: VIEWER, repo, enabled: true, total: list.length, issues: list.map(issueOf) }) };
  }
  if (command.startsWith("gh api graphql") && command.includes("issue(number:$number)")) {
    const repo = `${arg(command, "owner")}/${arg(command, "name")}`;
    const n = Number(arg(command, "number"));
    const f = ISSUES[repo]?.find((x) => x.number === n);
    if (!f) return { exit_code: 1, output: `gh: Could not resolve to an issue or pull request with the number of ${n}.\n` };
    return {
      exit_code: 0,
      output: JSON.stringify({
        ...issueOf(f),
        url: `https://github.com/${repo}/issues/${n}`,
        state: "OPEN",
        body: f.body,
        totalComments: f.comments.length,
        comments: f.comments.map((c, i) => ({ author: c.author, body: c.body, createdAt: new Date(Date.now() - c.hours * 3_600_000).toISOString(), url: `https://github.com/${repo}/issues/${n}#issuecomment-${n}${i}` })),
        prs: (f.prs ?? []).map((p) => ({ ...p, draft: !!p.draft, url: `https://github.com/${repo}/pull/${p.number}` })),
      }),
    };
  }
  const comment = /printf %s '([A-Za-z0-9+/=]*)' \| base64 -d \| gh issue comment (\d+) --repo '([^']+)'/.exec(command);
  if (comment) {
    const f = ISSUES[comment[3]]?.find((x) => x.number === Number(comment[2]));
    if (!f) return { exit_code: 1, output: "GraphQL: Could not resolve to an issue.\n" };
    const bytes = Uint8Array.from(atob(comment[1]), (c) => c.charCodeAt(0));
    f.comments.push({ author: VIEWER, hours: 0, body: new TextDecoder().decode(bytes) });
    f.updated = 0;
    return { exit_code: 0, output: `https://github.com/${comment[3]}/issues/${f.number}#issuecomment-1\n` };
  }
  return undefined;
}
