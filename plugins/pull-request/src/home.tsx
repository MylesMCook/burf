import * as stylex from "@stylexjs/stylex";
import { type BerthPluginContext, type HomeWidgetProps, type Project, useBerth, useProjects, useWidgetData } from "@berth/plugin";
import { Button, Icon, Tip, WidgetEmpty, WidgetRow, WidgetSkeleton } from "@berth/plugin/ui";
import { useMemo } from "react";

import { quote, since } from "./gh";

const paint = stylex.create({
  s0: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s1: {
    "display": "inline-flex",
    "flexShrink": 0,
    "color": "var(--success)",
  },
  s2: {
    "width": "14px",
    "height": "14px",
  },
  s3: {
    "display": "inline-flex",
    "flexShrink": 0,
    "color": "var(--destructive)",
  },
  s4: {
    "width": "14px",
    "height": "14px",
  },
  s5: {
    "display": "inline-flex",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s6: {
    "width": "14px",
    "height": "14px",
  },
  s7: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s8: {
    "color": "var(--muted-foreground)",
  },
  s9: {
    "color": "var(--success)",
  },
  s10: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s11: {
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s12: {
    "width": "64px",
    "flexShrink": 0,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "textAlign": "right",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s13: {
    "display": "flex",
    "flexDirection": "column",
  },
  s14: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontSize": "11px",
    "color": "var(--warning-foreground)",
  },
  s15: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingBottom": "2px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s16: {
    "paddingTop": "6px",
  },
  s17: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
  },
  s18: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "2px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s19: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "10px",
    "borderRadius": "var(--radius-sm)",
    "textAlign": "left",
    "fontSize": "14px",
    "lineHeight": "20px",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s20: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--destructive)",
  },
  s21: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s22: {
    "fontWeight": 500,
  },
  s23: {
    "color": "var(--muted-foreground)",
  },
  s24: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s25: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "24px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s26: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  s27: {
    "height": "20px",
    "borderRadius": "5px",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontSize": "11px",
  },
  s28: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  q29: {
    "display": {
      "@container (max-width: 300px)": {
        "default": "none",
      },
    },
  },
  q30: {
    "display": {
      "@container (max-width: 360px)": {
        "default": "none",
      },
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Home widgets: your pull requests and the ones waiting on your review, in
// one GraphQL search with gh; and CI that failed on the branches of your
// worktrees, one `gh run list` per project. Both run on a box (its gh, its
// login), and only while the widget is on screen.

// ---------- what gh answers ----------

export interface HomePR {
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  updatedAt: string;
  additions: number;
  deletions: number;
  reviewDecision?: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  repository: { nameWithOwner: string };
  author?: { login: string } | null;
  commits?: { nodes: { commit: { statusCheckRollup?: { state: string } | null } }[] };
}

export interface HomePRs {
  viewer: string;
  review: HomePR[];
  mine: HomePR[];
  reviewCount: number;
  mineCount: number;
}

const FIELDS = "number title url isDraft updatedAt additions deletions reviewDecision repository { nameWithOwner } author { login } commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }";
const PRS_QUERY = `query {
  viewer { login }
  review: search(query: "is:pr is:open archived:false review-requested:@me sort:updated-desc", type: ISSUE, first: 15) { issueCount nodes { ... on PullRequest { ${FIELDS} } } }
  mine: search(query: "is:pr is:open archived:false author:@me sort:updated-desc", type: ISSUE, first: 15) { issueCount nodes { ... on PullRequest { ${FIELDS} } } }
}`;

export const prsCommand = () => `gh api graphql -f query=${quote(PRS_QUERY)} --jq '{viewer: .data.viewer.login, review: .data.review.nodes, mine: .data.mine.nodes, reviewCount: .data.review.issueCount, mineCount: .data.mine.issueCount}' # berth-home:prs`;

export interface Run {
  databaseId: number;
  workflowName: string;
  displayTitle: string;
  headBranch: string;
  status: string;
  conclusion: string;
  createdAt: string;
  url: string;
}

export const runsCommand = () => `gh run list --limit 60 --json databaseId,workflowName,displayTitle,headBranch,status,conclusion,createdAt,url # berth-home:ci`;

// A gh failure, in words for a widget.
export class GhProblem extends Error {
  constructor(
    message: string,
    readonly kind: "no-gh" | "no-auth" | "other",
  ) {
    super(message);
  }
}

function readGh<T>(r: { exit_code: number; output: string }): T {
  const text = r.output.toLowerCase();
  if (r.exit_code === 127 || text.includes("command not found")) throw new GhProblem("gh isn't installed on the box", "no-gh");
  if (r.exit_code !== 0 && (text.includes("gh auth login") || text.includes("authentication"))) throw new GhProblem("gh isn't logged in on the box", "no-auth");
  if (r.exit_code !== 0) throw new GhProblem(r.output.trim().split("\n").pop() || `gh exited with ${r.exit_code}`, "other");
  return JSON.parse(r.output) as T;
}

// Where gh runs: a project's main checkout on an online box, its default
// box first.
function homeOf(p: Project): { box: string; location: string } | undefined {
  const m = p.members.find((x) => x.online && x.box === p.defaultBox) ?? p.members.find((x) => x.online);
  return m ? { box: m.box, location: m.location.name } : undefined;
}

// latestFailures keeps each branch and workflow's latest run, and of those
// the ones that failed, on the given branches.
export function latestFailures(runs: Run[], branches: Set<string>): Run[] {
  const latest = new Map<string, Run>();
  for (const r of runs) {
    if (!branches.has(r.headBranch) || r.status !== "completed") continue;
    const k = `${r.headBranch}\u0000${r.workflowName}`;
    const had = latest.get(k);
    if (!had || had.createdAt < r.createdAt) latest.set(k, r);
  }
  return [...latest.values()].filter((r) => ["failure", "timed_out", "startup_failure"].includes(r.conclusion)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------- Pull requests ----------

const usePRData = (berth: BerthPluginContext) => {
  const projects = useProjects();
  const at = projects.filter((p) => p.slug).map(homeOf).find(Boolean) ?? projects.map(homeOf).find(Boolean);
  return useWidgetData<HomePRs>(
    `prs:${at ? `${at.box}/${at.location}` : "none"}`,
    async () => {
      if (!at) throw new GhProblem("No project on an online box to run gh in", "other");
      return readGh<HomePRs>(await berth.orchestrate.exec(at.box, at.location, prsCommand(), "45s"));
    },
    { every: 3 * 60_000 },
  );
};

// The heading's count: pull requests waiting on your review.
export function usePRCount() {
  const berth = useBerth();
  const { data } = usePRData(berth);
  return data ? { n: data.reviewCount, urgent: data.reviewCount > 0 } : undefined;
}

const DECISION: Record<string, string> = { APPROVED: "Approved", CHANGES_REQUESTED: "Changes", REVIEW_REQUIRED: "In review" };

function Checks({ state }: { state?: string | null }) {
  if (!state) return <span className={sx(paint.s0)} />;
  if (state === "SUCCESS")
    return (
      <Tip label="Checks pass">
        <span className={sx(paint.s1)} role="img" aria-label="Checks pass">
          <Icon name="Check" className={sx(paint.s2)} />
        </span>
      </Tip>
    );
  if (state === "FAILURE" || state === "ERROR")
    return (
      <Tip label="Checks fail">
        <span className={sx(paint.s3)} role="img" aria-label="Checks fail">
          <Icon name="CircleX" className={sx(paint.s4)} />
        </span>
      </Tip>
    );
  return (
    <Tip label="Checks running">
      <span className={sx(paint.s5)} role="img" aria-label="Checks running">
        <Icon name="CircleDashed" className={sx(paint.s6)} />
      </span>
    </Tip>
  );
}

export function PullRequestsWidget({ berth, size }: HomeWidgetProps) {
  const { data, error, loading } = usePRData(berth);
  const projects = useProjects();
  const tall = size === "l" || size === "t";
  if (!projects.some((p) => p.members.some((m) => m.online))) return <WidgetEmpty scene="anchor" title="No projects yet" hint="Add a project on a box with gh logged in, and your pull requests show here." />;
  const room = tall ? 8 : 3;
  if (!data && loading) return <WidgetSkeleton rows={tall ? 5 : 3} />;
  if (!data) return <GhEmpty error={error} />;
  if (!data.review.length && !data.mine.length) return <WidgetEmpty scene="anchor" title="No open pull requests" hint="Yours, and those waiting on your review, show here." />;
  // The review queue first: it waits on you.
  const review = data.review.slice(0, Math.max(1, Math.min(data.review.length, Math.ceil(room / 2))));
  const mine = data.mine.slice(0, Math.max(0, room - review.length - (data.review.length ? 1 : 0) - 1));
  const row = (p: HomePR, queue: boolean) => (
    <WidgetRow key={p.url} onClick={() => berth.openUrl(p.url)} label={`${p.title}, ${p.repository.nameWithOwner} #${p.number}`}>
      <Icon name={p.isDraft ? "GitPullRequestDraft" : "GitPullRequest"} className={[sx(paint.s7), p.isDraft ? sx(paint.s8) : sx(paint.s9)].filter(Boolean).join(" ")} />
      <span className={sx(paint.s10)}>{p.title}</span>
      <span className={[sx(paint.s11), sx(paint.q29)].filter(Boolean).join(" ")}>
        {p.repository.nameWithOwner.split("/")[1]}#{p.number}
      </span>
      <Checks state={p.commits?.nodes[0]?.commit.statusCheckRollup?.state} />
      <span className={[sx(paint.s12), sx(paint.q30)].filter(Boolean).join(" ")}>{queue ? (p.author?.login ?? "") : p.isDraft ? "Draft" : (DECISION[p.reviewDecision ?? ""] ?? since(p.updatedAt))}</span>
    </WidgetRow>
  );
  return (
    <div className={sx(paint.s13)}>
      {review.length > 0 && <p className={sx(paint.s14)}>Waiting on your review · {data.reviewCount}</p>}
      {review.map((p) => row(p, true))}
      {mine.length > 0 && <p className={[sx(paint.s15), review.length && sx(paint.s16)].filter(Boolean).join(" ")}>Yours · {data.mineCount}</p>}
      {mine.map((p) => row(p, false))}
    </div>
  );
}

function GhEmpty({ error }: { error?: string }) {
  return <WidgetEmpty scene="storm" title="Couldn't ask GitHub" hint={error ?? "gh didn't answer"} compact />;
}

// ---------- CI failures ----------

export function CiWidget({ berth, size }: HomeWidgetProps) {
  const projects = useProjects();
  // Each project with its worktrees' branches, read where gh can run.
  const targets = useMemo(
    () =>
      projects
        .filter((p) => p.slug)
        .map((p) => ({ p, at: homeOf(p), branches: [...new Set(p.members.flatMap((m) => (m.location.worktrees ?? []).map((w) => w.branch).filter((b): b is string => !!b)))] }))
        .filter((t) => t.at && t.branches.length)
        .slice(0, 6),
    [projects],
  );
  const key = `ci:${targets.map((t) => `${t.at!.box}/${t.at!.location}:${t.branches.join("+")}`).join(",")}`;
  const { data, error, loading } = useWidgetData<{ repo: string; slug: string; box: string; location: string; run: Run }[]>(
    key,
    async () => {
      const all = await Promise.all(
        targets.map(async (t) => {
          try {
            const runs = readGh<Run[]>(await berth.orchestrate.exec(t.at!.box, t.at!.location, runsCommand(), "45s"));
            return latestFailures(runs, new Set(t.branches)).map((run) => ({ repo: t.p.name, slug: t.p.slug!, box: t.at!.box, location: t.at!.location, run }));
          } catch (err) {
            // One project's gh failing (no Actions, say) never hides the rest.
            if (err instanceof GhProblem && err.kind !== "other") throw err;
            return [];
          }
        }),
      );
      return all.flat().sort((a, b) => b.run.createdAt.localeCompare(a.run.createdAt));
    },
    { every: 3 * 60_000 },
  );
  const tall = size === "l" || size === "t";
  if (!targets.length) return <WidgetEmpty scene="chart" title="No GitHub projects" hint="Failed runs on your worktrees' branches show here." />;
  if (!data && loading) return <WidgetSkeleton rows={tall ? 5 : 2} />;
  if (!data) return <GhEmpty error={error} />;
  if (!data.length) return <WidgetEmpty scene="calm" title="CI is green" hint={`The latest runs on your ${targets.reduce((n, t) => n + t.branches.length, 0)} worktree branches passed.`} />;
  const shown = data.slice(0, tall ? 6 : size === "s" ? 2 : 2);
  return (
    <div className={sx(paint.s17)}>
      {shown.map((f) => (
        <div key={f.run.databaseId} className={[sx(paint.s18), "group/row"].filter(Boolean).join(" ")}>
          <button type="button" onClick={() => berth.openUrl(f.run.url)} className={sx(paint.s19)}>
            <Icon name="CircleX" className={sx(paint.s20)} />
            <span className={sx(paint.s21)}>
              <span className={sx(paint.s22)}>{f.run.workflowName}</span>
              <span className={sx(paint.s23)}>
                {" "}
                · {f.repo} / {f.run.headBranch}
              </span>
            </span>
            <span className={sx(paint.s24)}>{since(f.run.createdAt).replace(" ago", "")}</span>
          </button>
          <span className={sx(paint.s25)}>
            <span className={sx(paint.s26)}>{f.run.displayTitle}</span>
            <Button size="xs" variant="outline" className={sx(paint.s27)} onClick={() => berth.openUrl(f.run.url)} aria-label={`Open the ${f.run.workflowName} run on ${f.run.headBranch}`}>
              Logs
            </Button>
          </span>
        </div>
      ))}
      {data.length > shown.length && <p className={sx(paint.s28)}>+{data.length - shown.length} more failing</p>}
    </div>
  );
}
