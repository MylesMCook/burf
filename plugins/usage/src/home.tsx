import * as stylex from "@stylexjs/stylex";
import { type HomeWidgetProps, useBoxes, useWidgetData } from "@berth/plugin";
import { Tip, WidgetEmpty, WidgetSkeleton } from "@berth/plugin/ui";

import { type Agent, type Report, runScript, where, type Window } from "./box";
import { AGENT_NAME, compact, days, usd } from "./data";

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
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "marginLeft": "auto",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s5: {
    "display": "flex",
    "alignItems": "flex-end",
    "gap": "2px",
  },
  s6: {
    "height": "64px",
  },
  s7: {
    "height": "32px",
  },
  s8: {
    "display": "flex",
    "height": "100%",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "flex-end",
  },
  s9: {
    "display": "block",
    "width": "100%",
    "borderTopLeftRadius": "4px",
    "borderTopRightRadius": "4px",
    "borderBottomLeftRadius": "1px",
    "borderBottomRightRadius": "1px",
  },
  s10: {
    "backgroundColor": "var(--muted)",
  },
  s11: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "6px",
  },
  s12: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
  },
  s13: {
    "display": "flex",
    "alignItems": "baseline",
    "gap": "8px",
    "fontSize": "11px",
  },
  s14: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s15: {
    "flexShrink": 0,
    "fontVariantNumeric": "tabular-nums",
    "color": "var(--muted-foreground)",
  },
  s16: {
    "display": "block",
    "height": "4px",
    "overflow": "hidden",
    "borderRadius": "999px",
    "backgroundColor": "var(--muted)",
  },
  s17: {
    "display": "block",
    "height": "100%",
    "borderRadius": "999px",
  },
  s18: {
    "backgroundColor": "var(--destructive)",
  },
  s19: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s20: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
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
    "backgroundColor": "color-mix(in oklab, var(--info) 60%, transparent)",
  },
  n3: {
    "backgroundColor": "var(--muted)",
  },
  n4: {
    "display": "block",
    "height": "100%",
    "borderRadius": "999px",
  },
  n5: {
    "backgroundColor": "var(--destructive)",
  },
  n6: {
    "backgroundColor": "var(--warning)",
  },
  n7: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 45%, transparent)",
  },
  q21: {
    "fontFamily": "var(--font-heading)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The Usage widget on Home: tokens your agents used today and each day of
// the week, what Claude Code estimates they cost, and how much of a plan's
// window Codex last saw used. usage.py reads the agents' own records on
// each box, every 5 minutes while the widget is on screen.

export interface UsageSummary {
  today: number;
  // Tokens a day, the last 7 days, oldest first.
  week: { day: string; tokens: number }[];
  // Claude Code's own estimate at API prices, for sessions active this week.
  cost: number;
  byAgent: { agent: Agent; tokens: number }[];
  limits: { label: string; used: number; resets: number }[];
  failed: string[];
}

const windowName = (w: Window) => {
  const h = w.window_minutes / 60;
  return h >= 24 * 6 ? "week" : h >= 20 ? "day" : `${h}h`;
};

// summarizeUsage adds up the boxes' reports for the widget.
export function summarizeUsage(reports: { box: string; report: Report }[], failed: string[] = []): UsageSummary {
  const today = reports.reduce((t, r) => (r.report.today > t ? r.report.today : t), "");
  const week = today ? days(today, 7).map((day) => ({ day, tokens: 0 })) : [];
  const at = new Map(week.map((d) => [d.day, d]));
  const agents = new Map<Agent, number>();
  let cost = 0;
  const limits: UsageSummary["limits"] = [];
  for (const { report } of reports) {
    for (const [day, agent, , , , ...t] of report.daily) {
      const n = t[0] + t[1] + t[2] + t[3];
      const d = at.get(day);
      if (!d) continue;
      d.tokens += n;
      agents.set(agent, (agents.get(agent) ?? 0) + n);
    }
    const from = week[0]?.day ?? "";
    for (const s of report.sessions) if ((s.last ?? "") >= from && s.cost) cost += s.cost;
    // The newest limits each login reported this week.
    const newest = new Map<string, (typeof report.limits)[number]>();
    for (const l of report.limits) {
      if (l.at.slice(0, 10) < from) continue;
      const k = `${l.agent}/${l.account}`;
      if (!newest.has(k) || newest.get(k)!.at < l.at) newest.set(k, l);
    }
    for (const l of newest.values())
      for (const w of [l.limits.primary, l.limits.secondary]) if (w) limits.push({ label: `${AGENT_NAME[l.agent]} · ${windowName(w)}`, used: w.used_percent / 100, resets: w.resets_at * 1000 });
  }
  return {
    today: at.get(today)?.tokens ?? 0,
    week,
    cost,
    byAgent: [...agents.entries()].map(([agent, tokens]) => ({ agent, tokens })).sort((a, b) => b.tokens - a.tokens),
    limits: limits.filter((l) => l.resets > Date.now()).sort((a, b) => b.used - a.used),
    failed,
  };
}

export function UsageWidget({ berth, size }: HomeWidgetProps) {
  const online = useBoxes()
    .filter((b) => b.state === "online")
    .map((b) => b.name);
  const { data, error, loading } = useWidgetData<UsageSummary>(
    `usage:${online.join(",")}`,
    async () => {
      const failed: string[] = [];
      const got = await Promise.all(
        online.map(async (box) => {
          try {
            return { box, report: await runScript<Report>(berth, box, await where(berth, box), ["report", "7"], "2m") };
          } catch {
            failed.push(box);
            return undefined;
          }
        }),
      );
      const reports = got.filter((r): r is { box: string; report: Report } => !!r);
      if (!reports.length && failed.length) throw new Error(`Couldn't read usage on ${failed.join(", ")}`);
      return summarizeUsage(reports, failed);
    },
    { every: 5 * 60_000 },
  );
  const big = size === "l" || size === "t";
  if (!online.length) return <WidgetEmpty scene="offline" title="No box is online" hint="Usage is read from the agents' records on each box." />;
  if (!data && loading) return <WidgetSkeleton rows={3} />;
  if (!data) return <WidgetEmpty scene="storm" title="Couldn't read usage" hint={error} compact />;
  const max = Math.max(1, ...data.week.map((d) => d.tokens));
  const total = data.week.reduce((n, d) => n + d.tokens, 0);
  return (
    <div className={sx(paint.s0)}>
      <div className={sx(paint.s1)}>
        <span className={[sx(paint.s2), sx(paint.q21)].filter(Boolean).join(" ")}>{compact(data.today)}</span>
        <span className={sx(paint.s3)}>tokens today</span>
        {data.cost > 0 && (
          <Tip label="Claude Code's own estimate at API prices, for sessions active this week. A subscription isn't billed this way.">
            <span className={sx(paint.s4)}>≈ {usd(data.cost)} this week</span>
          </Tip>
        )}
      </div>
      <div className={[sx(paint.s5), big ? sx(paint.s6) : sx(paint.s7)].filter(Boolean).join(" ")} role="list" aria-label={`Tokens a day this week, ${compact(total)} in all`}>
        {data.week.map((d, i) => (
          <Tip key={d.day} label={`${new Date(`${d.day}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${compact(d.tokens)} tokens`}>
            <span role="listitem" aria-label={`${d.day}: ${d.tokens} tokens`} className={sx(paint.s8)}>
              <span className={[sx(paint.n0), d.tokens ? i === data.week.length - 1 ? sx(paint.n1) : sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")} style={{ height: d.tokens ? `${Math.max(8, (d.tokens / max) * 100)}%` : 2 }} />
            </span>
          </Tip>
        ))}
      </div>
      {data.limits.length > 0 && (
        <div className={sx(paint.s11)}>
          {data.limits.slice(0, big ? 4 : 1).map((l) => (
            <div key={l.label} className={sx(paint.s12)}>
              <span className={sx(paint.s13)}>
                <span className={sx(paint.s14)}>{l.label}</span>
                <span className={sx(paint.s15)}>{Math.round(l.used * 100)}%</span>
              </span>
              <span className={sx(paint.s16)} role="meter" aria-valuenow={Math.round(l.used * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={l.label}>
                <span className={[sx(paint.n4), l.used >= 0.9 ? sx(paint.n5) : l.used >= 0.7 ? sx(paint.n6) : sx(paint.n7)].filter(Boolean).join(" ")} style={{ width: `${Math.min(100, l.used * 100)}%` }} />
              </span>
            </div>
          ))}
        </div>
      )}
      {size !== "s" && (
        <p className={sx(paint.s19)}>
          This week: {data.byAgent.map((a) => `${AGENT_NAME[a.agent]} ${compact(a.tokens)}`).join(" · ") || "no tokens yet"}
        </p>
      )}
      {data.failed.length > 0 && <p className={sx(paint.s20)}>Couldn't read {data.failed.join(", ")}</p>}
    </div>
  );
}
