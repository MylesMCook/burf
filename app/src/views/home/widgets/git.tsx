import * as stylex from "@stylexjs/stylex";
import { useMemo } from "react";

import { Tip } from "@/components/tip";
import { exec } from "@/lib/orchestrate";
import { useProjects } from "@/lib/projects";
import { useStore } from "@/lib/store";
import { useAppWidgetData } from "@/lib/widget-data";

import { useHomeWidget } from "./env";
import { compactNumber, DiffStat, WidgetEmpty, WidgetSkeleton } from "./parts";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "100%",
    "flexDirection": "column",
    "gap": "8px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingBottom": "4px",
  },
  s1: {
    "display": "flex",
    "alignItems": "baseline",
    "gap": "8px",
  },
  s2: {
    "fontWeight": 600,
    "fontSize": "24px",
    "lineHeight": "32px",
    "fontVariantNumeric": "tabular-nums",
    "letterSpacing": "-0.025em",
  },
  s3: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "marginLeft": "auto",
  },
  s5: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s6: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s7: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s8: {
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s9: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s10: {
    "display": "flex",
    "maxHeight": "176px",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "gap": "4px",
  },
  s11: {
    "display": "flex",
    "minHeight": "40px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "flex-end",
    "gap": "2px",
  },
  s12: {
    "display": "flex",
    "height": "100%",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "flex-end",
    "borderRadius": "3px",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s13: {
    "display": "block",
    "width": "100%",
    "borderTopLeftRadius": "4px",
    "borderTopRightRadius": "4px",
    "borderBottomLeftRadius": "1px",
    "borderBottomRightRadius": "1px",
  },
  s14: {
    "backgroundColor": "var(--muted)",
  },
  s15: {
    "display": "flex",
    "gap": "2px",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s16: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "textAlign": "center",
  },
  s17: {
    "display": "flex",
    "height": "100%",
    "flexDirection": "column",
    "gap": "8px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingBottom": "4px",
  },
  s18: {
    "marginLeft": "calc(8px * -1)",
    "marginRight": "calc(8px * -1)",
  },
  s19: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "flex-end",
    "gap": "2px",
  },
  s20: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "borderTopLeftRadius": "4px",
    "borderTopRightRadius": "4px",
    "backgroundColor": "var(--muted)",
  },
  n0: {
    "display": "block",
    "width": "100%",
    "borderTopLeftRadius": "4px",
    "borderTopRightRadius": "4px",
    "borderBottomLeftRadius": "1px",
    "borderBottomRightRadius": "1px",
  },
  n1: {
    "backgroundColor": "var(--info)",
  },
  n2: {
    "backgroundColor": "color-mix(in oklab, var(--info) 55%, transparent)",
  },
  n3: {
    "backgroundColor": "var(--muted)",
  },

  s21: {
    fontFamily: "var(--font-heading)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Git activity: commits and lines changed a day over the last two weeks,
// across every project, by you and your agents alike. One `git log` per
// project's main checkout (all its branches, so worktrees count too), kept
// for 15 minutes and read only while the widget is on screen.

const DAYS = 14;
// At most this many projects are read; the rest wait for a bigger Home.
const MAX_PROJECTS = 8;
const MARK = "# berth-home:git";

export interface Day {
  // Local date, YYYY-MM-DD.
  day: string;
  commits: number;
  add: number;
  del: number;
}

export interface GitActivity {
  days: Day[];
  byProject: { name: string; commits: number }[];
  failed: string[];
}

export const gitLogCommand = () => `git log --all --no-merges --since=${DAYS}.days.ago --format=@%ct --shortstat 2>/dev/null; true ${MARK}`;

const localDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// lastDays lists the local dates of the last n days, oldest first.
export function lastDays(n = DAYS, now = Date.now()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(localDay(now - i * 86_400_000));
  return out;
}

// parseGitLog adds `git log --format=@%ct --shortstat` up by local day.
export function parseGitLog(output: string, into: Map<string, Day>): number {
  let day: Day | undefined;
  let commits = 0;
  for (const line of output.split("\n")) {
    const at = /^@(\d+)$/.exec(line.trim());
    if (at) {
      day = into.get(localDay(Number(at[1]) * 1000));
      if (day) {
        day.commits++;
        commits++;
      }
      continue;
    }
    if (!day) continue;
    const add = /(\d+) insertion/.exec(line);
    const del = /(\d+) deletion/.exec(line);
    if (add) day.add += Number(add[1]);
    if (del) day.del += Number(del[1]);
  }
  return commits;
}

export function GitWidget() {
  const { span } = useHomeWidget();
  const { projects } = useProjects();
  // Each project read once, on its default box when that is online.
  const targets = useMemo(
    () =>
      projects
        .map((p) => {
          const m = p.members.find((x) => x.box.name === p.defaultBox && x.box.state === "online") ?? p.members.find((x) => x.box.state === "online");
          return m && m.loc.repo !== false ? { name: p.name, box: m.box.name, location: m.loc.name } : undefined;
        })
        .filter((t): t is { name: string; box: string; location: string } => !!t)
        .slice(0, MAX_PROJECTS),
    [projects],
  );
  const key = `git:${targets.map((t) => `${t.box}/${t.location}`).join(",")}`;
  const { data, loading, error } = useAppWidgetData<GitActivity>(
    key,
    async () => {
      const days = new Map(lastDays().map((d) => [d, { day: d, commits: 0, add: 0, del: 0 }]));
      const byProject: GitActivity["byProject"] = [];
      const failed: string[] = [];
      await Promise.all(
        targets.map(async (t) => {
          try {
            const r = await exec(t.box, t.location, gitLogCommand(), "30s");
            byProject.push({ name: t.name, commits: parseGitLog(r.output, days) });
          } catch {
            failed.push(t.name);
          }
        }),
      );
      return { days: [...days.values()], byProject: byProject.sort((a, b) => b.commits - a.commits), failed };
    },
    { every: 15 * 60_000 },
  );

  if (!targets.length && !loading) return <WidgetEmpty scene="chart" title="No projects to chart" hint="Add a repository on a box and its commits show here." action="Add a project" onAction={() => useStore.getState().openAddProject()} />;
  if (!data) return error ? <WidgetEmpty scene="storm" title="Couldn't read git" hint={error} compact hold /> : <ChartSkeleton />;
  const total = data.days.reduce((n, d) => n + d.commits, 0);
  const add = data.days.reduce((n, d) => n + d.add, 0);
  const del = data.days.reduce((n, d) => n + d.del, 0);
  const tall = span.r > 1;
  return (
    <div className={sx(paint.s0)}>
      <div className={sx(paint.s1)}>
        <span className={[sx(paint.s2), sx(paint.s21)].filter(Boolean).join(" ")}>{total}</span>
        <span className={sx(paint.s3)}>commits · {DAYS} days</span>
        <DiffStat add={add} del={del} className={sx(paint.s4)} />
      </div>
      <Bars days={data.days} />
      {tall && data.byProject.length > 0 && (
        <ul className={sx(paint.s5)}>
          {data.byProject.slice(0, 4).map((p) => (
            <li key={p.name} className={sx(paint.s6)}>
              <span className={sx(paint.s7)}>{p.name}</span>
              <span className={sx(paint.s8)}>{p.commits}</span>
            </li>
          ))}
        </ul>
      )}
      {data.failed.length > 0 && <p className={sx(paint.s9)}>Couldn't read {data.failed.join(", ")}</p>}
    </div>
  );
}

const weekday = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" });
const longDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

// Bars: one per day, commits as height, today last. Each says its numbers
// on hover and to a screen reader.
function Bars({ days }: { days: Day[] }) {
  const max = Math.max(1, ...days.map((d) => d.commits));
  return (
    <div className={sx(paint.s10)}>
      <div className={sx(paint.s11)} role="list" aria-label="Commits a day">
        {days.map((d, i) => (
          <Tip key={d.day} label={`${longDay(d.day)} · ${d.commits} ${d.commits === 1 ? "commit" : "commits"}${d.commits ? ` · +${compactNumber(d.add)} −${compactNumber(d.del)}` : ""}`}>
            <span role="listitem" aria-label={`${longDay(d.day)}: ${d.commits} commits, ${d.add} lines added, ${d.del} removed`} className={sx(paint.s12)}>
              <span
                className={[sx(paint.n0), d.commits ? i === days.length - 1 ? sx(paint.n1) : sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")}
                style={{ height: d.commits ? `${Math.max(6, (d.commits / max) * 100)}%` : 2 }}
              />
            </span>
          </Tip>
        ))}
      </div>
      <div className={sx(paint.s15)} aria-hidden>
        {days.map((d) => (
          <span key={d.day} className={sx(paint.s16)}>
            {weekday(d.day)}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className={sx(paint.s17)} role="status" aria-busy="true" aria-label="Loading">
      <WidgetSkeleton rows={1} className={sx(paint.s18)} />
      <div className={sx(paint.s19)}>
        {Array.from({ length: DAYS }, (_, i) => (
          <span key={i} className={[sx(paint.s20), "burf-pulse"].filter(Boolean).join(" ")} style={{ height: `${20 + ((i * 37) % 60)}%` }} />
        ))}
      </div>
    </div>
  );
}
