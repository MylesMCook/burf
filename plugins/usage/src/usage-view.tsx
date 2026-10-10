import * as stylex from "@stylexjs/stylex";
import type { BerthPluginContext, Location, Session } from "@berth/plugin";
import { Badge, Button, Empty, EmptyDescription, EmptyHeader, EmptyTitle, Frame, FrameHeader, FramePanel, FrameTitle, Icon, PickOne, Skeleton, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tip } from "@berth/plugin/ui";
import { useMemo, useState } from "react";

import type { Account, Agent, Limits, Window } from "./box";
import { DailyChart, OTHER_BOXES, SERIES, agentSeries, boxColor, boxSeries } from "./chart";
import { AGENT_NAME, ago, compact, days, firstDay, plan, summarize, total, usd, worktreeOf, type BoxSession, type Period, type Source } from "./data";

const paint = stylex.create({
  s0: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "12px",
    },
  },
  s1: {
    "height": "112px",
    "width": "100%",
  },
  s2: {
    "height": "176px",
    "width": "100%",
  },
  s3: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "marginBottom": "8px",
    "width": "20px",
    "height": "20px",
    "color": "var(--muted-foreground)",
  },
  s4: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "16px",
    },
  },
  s5: {
    "display": "grid",
    "gap": "12px",
  },
  s6: {
    "gridTemplateColumns": {
      "@media (min-width: 768px)": {
        "default": "repeat(2, minmax(0, 1fr))",
      },
    },
  },
  s7: {
    "display": "grid",
    "gap": "16px",
  },
  s8: {
    "gridTemplateColumns": {
      "@media (min-width: 1024px)": {
        "default": "repeat(2, minmax(0, 1fr))",
      },
    },
  },
  s9: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s10: {
    "width": "8px",
    "height": "8px",
    "flexShrink": 0,
    "borderRadius": "2px",
  },
  s11: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s12: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s13: {
    "marginLeft": "auto",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s14: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s15: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-sm)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s16: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s17: {
    "width": "10px",
    "height": "10px",
    "borderRadius": "3px",
  },
  s18: {
    "marginLeft": "auto",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s19: {
    "display": "flex",
    "alignItems": "baseline",
    "gap": "8px",
  },
  s20: {
    "fontWeight": 600,
    "fontSize": "24px",
    "lineHeight": "32px",
    "fontVariantNumeric": "tabular-nums",
    "letterSpacing": "-0.025em",
  },
  s21: {
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s22: {
    "display": "grid",
    "gridTemplateColumns": "repeat(4, minmax(0, 1fr))",
    "gap": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s23: {
    "color": "var(--muted-foreground)",
  },
  s24: {
    "fontVariantNumeric": "tabular-nums",
  },
  s25: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "6px",
    },
  },
  s26: {
    "display": "flex",
    "height": "6px",
    "gap": "2px",
    "overflow": "hidden",
    "borderRadius": "999px",
  },
  s27: {
    "height": "100%",
    "borderTopLeftRadius": {
      ":first-child": "999px",
    },
    "borderBottomLeftRadius": {
      ":first-child": "999px",
    },
    "borderTopRightRadius": {
      ":last-child": "999px",
    },
    "borderBottomRightRadius": {
      ":last-child": "999px",
    },
  },
  s28: {
    "display": "flex",
    "flexWrap": "wrap",
    "columnGap": "12px",
    "rowGap": "2px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s29: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s30: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s31: {
    "color": "var(--foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s32: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingTop": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s33: {
    "fontWeight": 500,
    "color": "var(--foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s34: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingTop": "12px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "8px",
    },
  },
  s35: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s36: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "4px",
    },
  },
  s37: {
    "display": "flex",
    "alignItems": "baseline",
    "gap": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s38: {
    "fontWeight": 500,
  },
  s39: {
    "color": "var(--muted-foreground)",
  },
  s40: {
    "marginLeft": "auto",
    "fontVariantNumeric": "tabular-nums",
  },
  s41: {
    "height": "6px",
    "overflow": "hidden",
    "borderRadius": "999px",
    "backgroundColor": "var(--muted)",
  },
  s42: {
    "height": "100%",
    "borderRadius": "999px",
  },
  s43: {
    "backgroundColor": "var(--destructive)",
  },
  s44: {
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s45: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s46: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s47: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s48: {
    "width": "8px",
    "height": "8px",
    "flexShrink": 0,
    "borderRadius": "2px",
  },
  s49: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s50: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
  },
  s51: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s52: {
    "color": "var(--muted-foreground)",
  },
  s53: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s54: {
    "width": "64px",
    "textAlign": "right",
    "fontVariantNumeric": "tabular-nums",
  },
  s55: {
    "width": "64px",
    "textAlign": "right",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s56: {
    "width": "64px",
  },
  s57: {
    "width": "80px",
    "textAlign": "right",
  },
  s58: {
    "opacity": {
      "default": 0,
      ":focus-visible": 1,
    },
    ":is(.group:hover &)": {
      "opacity": 1,
    },
  },
  s59: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s60: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
  },
  s61: {
    "borderColor": "color-mix(in oklab, var(--destructive) 40%, transparent)",
  },
  s62: {
    "borderStyle": "dashed",
    "color": "var(--muted-foreground)",
  },
  s63: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s64: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
  },
  s65: {
    "fontWeight": 500,
  },
  s66: {
    "width": "12px",
    "height": "12px",
  },
  s67: {
    "color": "var(--muted-foreground)",
  },
  s68: {
    "maxWidth": "256px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--destructive-foreground)",
  },
  s69: {
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  n0: {
    "height": "100%",
    "borderRadius": "999px",
  },
  n1: {
    "backgroundColor": "var(--destructive)",
  },
  n2: {
    "backgroundColor": "var(--warning)",
  },
  n3: {
    "backgroundColor": "color-mix(in oklab, var(--primary) 70%, transparent)",
  },
  n4: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  n5: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// What the screen knows about one box while reading it.
export interface BoxState {
  box: string;
  online: boolean;
  loading: boolean;
  error?: string;
}

export interface UsageProps {
  berth: BerthPluginContext;
  period: Period;
  // Boxes with a report, and every box the view covers.
  sources: Source[];
  states: BoxState[];
  accounts: Record<string, Account[] | undefined>;
  running: Record<string, Session[] | undefined>;
  // Every paired box, for stable colors.
  allBoxes: string[];
  // True when the view covers more than one box.
  multi: boolean;
}

type Tokens4 = [number, number, number, number];

export function UsageView({ berth, period, sources, states, accounts, running, allBoxes, multi }: UsageProps) {
  const sum = useMemo(() => summarize(sources, period), [sources, period]);
  const [stackBy, setStackBy] = useState<"agent" | "box">("agent");
  const counted = sources.map((s) => s.box);
  const showBox = multi && counted.length > 1;
  const busy = states.some((s) => s.loading);

  if (!sources.length) {
    if (busy) {
      return (
        <div className={sx(paint.s0)}>
          <Skeleton className={sx(paint.s1)} />
          <Skeleton className={sx(paint.s2)} />
        </div>
      );
    }
    return null;
  }
  const agents = (["claude", "codex"] as Agent[]).filter((a) => (sum.byAgent.get(a) ? total(sum.byAgent.get(a)!) > 0 : false) || dedupeLimits(a, sources, accounts, period).length > 0);
  const where = multi ? (counted.length === 1 ? counted[0] : `${counted.length} boxes`) : counted[0];
  if (!agents.length) {
    return (
      <Empty frame="panel" pad="room">
        <EmptyHeader>
          <Icon name="ChartColumn" className={sx(paint.s3)} />
          <EmptyTitle>
            No agent usage on {where} {period === 1 ? "today" : `in the last ${period} days`}
          </EmptyTitle>
          <EmptyDescription>Claude Code and Codex record their token use as they work; it shows up here once an agent has run on a box.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const series = stackBy === "box" && showBox ? boxSeries(counted, allBoxes) : agentSeries();
  const byDay = stackBy === "box" && showBox ? foldBoxes(sum.byDayBox, series) : (sum.byDay as Map<string, Map<string, number>>);
  const subscription = agents.includes("claude") && claudeAccounts(sources, accounts).every((a) => plan(a)?.subscription);
  const files = sources.reduce((n, s) => n + s.report.files, 0);

  return (
    <div className={sx(paint.s4)}>
      <div className={[sx(paint.s5), agents.length > 1 && sx(paint.s6)].filter(Boolean).join(" ")}>
        {agents.map((a) => (
          <AgentTile
            key={a}
            agent={a}
            tokens={sum.byAgent.get(a) ?? [0, 0, 0, 0]}
            sessions={sum.sessions.filter((s) => s.agent === a)}
            perBox={showBox ? sum.byAgentBox.get(a) : undefined}
            allBoxes={allBoxes}
            plans={usedAccounts(a, sources, accounts)}
            limits={dedupeLimits(a, sources, accounts, period)}
            period={period}
          />
        ))}
      </div>

      {period > 1 && (
        <Frame variant="card">
          <FrameHeader row gap={2} pad="tight">
            <FrameTitle>Tokens per day</FrameTitle>
            {showBox && (
              <PickOne
                align="end"
                label="Stack by"
                value={stackBy}
                onChange={(v: string) => setStackBy(v as "agent" | "box")}
                options={[
                  { value: "agent", label: "By agent" },
                  { value: "box", label: "By box" },
                ]}
              />
            )}
          </FrameHeader>
          <FramePanel pad="room">
            <DailyChart days={days(sum.today, period)} byDay={byDay} series={series} />
          </FramePanel>
        </Frame>
      )}

      <div className={[sx(paint.s7), !showBox && sx(paint.s8)].filter(Boolean).join(" ")}>
        <Frame variant="card">
          <FrameHeader pad="tight">
            <FrameTitle>By model</FrameTitle>
          </FrameHeader>
          <FramePanel pad="none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  {showBox && <TableHead>Box</TableHead>}
                  <TableHead end>Input</TableHead>
                  <TableHead end>Output</TableHead>
                  <TableHead end>Cache</TableHead>
                  <TableHead end>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sum.byModel.slice(0, 12).map((m) => (
                  <TableRow key={m.agent + m.model + m.box}>
                    <TableCell truncate>
                      <span className={sx(paint.s9)}>
                        <span className={[sx(paint.s10), SERIES[m.agent].dot].filter(Boolean).join(" ")} />
                        <span className={sx(paint.s11)}>{m.model}</span>
                      </span>
                    </TableCell>
                    {showBox && (
                      <TableCell>
                        <BoxChip box={m.box} allBoxes={allBoxes} />
                      </TableCell>
                    )}
                    <TableCell end nums>{compact(m.tokens[0])}</TableCell>
                    <TableCell end nums>{compact(m.tokens[1])}</TableCell>
                    <TableCell end nums tone="muted">{compact(m.tokens[2] + m.tokens[3])}</TableCell>
                    <TableCell end nums weight="medium">{compact(total(m.tokens))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </FramePanel>
        </Frame>
        <Frame variant="card">
          <FrameHeader pad="tight">
            <FrameTitle>By project</FrameTitle>
          </FrameHeader>
          <FramePanel pad="none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worktree</TableHead>
                  {showBox && <TableHead>Box</TableHead>}
                  <TableHead end>Sessions</TableHead>
                  <TableHead end>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sum.byWorktree.slice(0, 12).map((w) => (
                  <TableRow key={w.box + w.name.label}>
                    <TableCell title={w.name.path ?? w.name.label} truncate>
                      {w.name.location ? w.name.label : <span className={sx(paint.s12)}>{w.name.label}</span>}
                    </TableCell>
                    {showBox && (
                      <TableCell>
                        <BoxChip box={w.box} allBoxes={allBoxes} />
                      </TableCell>
                    )}
                    <TableCell end nums tone="muted">{w.sessions || ""}</TableCell>
                    <TableCell end nums weight="medium">{compact(total(w.tokens))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </FramePanel>
        </Frame>
      </div>

      <Frame variant="card">
        <FrameHeader row gap={2} pad="tight">
          <FrameTitle>Sessions</FrameTitle>
          <span className={sx(paint.s13)}>
            Cost is Claude Code's own estimate at API list prices{subscription ? "; your Claude subscription covers this use" : ""}.
          </span>
        </FrameHeader>
        <FramePanel pad="none">
          <SessionList berth={berth} sessions={sum.sessions.slice(0, 30)} sources={sources} running={running} allBoxes={allBoxes} showBox={showBox} />
        </FramePanel>
      </Frame>

      <p className={sx(paint.s14)}>
        Read from {files} transcript{files === 1 ? "" : "s"}
        {sources.map((s, i) => (
          <span key={s.box}>
            {i === 0 ? " on " : i === sources.length - 1 ? " and " : ", "}
            {s.box} {ago(s.report.generated)}
            {s.report.tz ? ` (${s.report.tz})` : ""}
          </span>
        ))}
        ; days are each box's own.
        {sources.some((s) => s.report.partial) && ` ${sources.reduce((n, s) => n + s.report.pending, 0)} more are still being read; this updates when they are.`}
        {sources.some((s) => s.report.truncated) && " Older sessions are left out to keep the answer small."} Input excludes cached input, which is counted under cache.
      </p>
    </div>
  );
}

// The chart's box series: boxes past the named hues add up as one.
function foldBoxes(byDayBox: Map<string, Map<string, number>>, series: { key: string }[]) {
  const named = new Set(series.map((s) => s.key));
  const out = new Map<string, Map<string, number>>();
  for (const [day, m] of byDayBox) {
    const d = new Map<string, number>();
    for (const [box, n] of m) {
      const k = named.has(box) ? box : OTHER_BOXES;
      d.set(k, (d.get(k) ?? 0) + n);
    }
    out.set(day, d);
  }
  return out;
}

export function BoxChip({ box, allBoxes }: { box: string; allBoxes: string[] }) {
  return (
    <span className={sx(paint.s15)}>
      <span className={[sx(paint.s16), boxColor(box, allBoxes).dot].filter(Boolean).join(" ")} />
      {box}
    </span>
  );
}

// The same login on two boxes counts once: matched by the email the agent
// recorded, or else it is its own account on its own box.
const identity = (a: Account | undefined, box: string, id: string) => (a?.email ? `${a.agent}:${a.email}` : `${box}:${a?.agent}:${id}`);

// usedAccounts: the accounts an agent ran under in these reports, plus each
// box's default, one per login.
function usedAccounts(agent: Agent, sources: Source[], accounts: Record<string, Account[] | undefined>) {
  const out = new Map<string, { account: Account; boxes: string[] }>();
  for (const { box, report } of sources) {
    const ids = new Set(["default", ...report.daily.filter((d) => d[1] === agent).map((d) => d[2])]);
    for (const id of ids) {
      const a = accounts[box]?.find((x) => x.agent === agent && x.id === id);
      if (!a || !a.signed_in) continue;
      const k = identity(a, box, id);
      const seen = out.get(k);
      if (seen) seen.boxes.push(box);
      else out.set(k, { account: a, boxes: [box] });
    }
  }
  return [...out.values()];
}

function claudeAccounts(sources: Source[], accounts: Record<string, Account[] | undefined>) {
  return usedAccounts("claude", sources, accounts).map((u) => u.account);
}

export interface SharedLimits {
  label?: string;
  boxes: string[];
  limits: Limits;
}

// dedupeLimits keeps the newest limits Codex saw per login.
// Limits Codex saw before the period are left out, as its tokens are.
function dedupeLimits(agent: Agent, sources: Source[], accounts: Record<string, Account[] | undefined>, period: Period): SharedLimits[] {
  const out = new Map<string, SharedLimits>();
  for (const { box, report } of sources) {
    const from = firstDay(report.today, period);
    for (const l of report.limits.filter((x) => x.agent === agent && x.at.slice(0, 10) >= from)) {
      const a = accounts[box]?.find((x) => x.agent === agent && x.id === l.account);
      const k = identity(a, box, l.account);
      const label = a?.email ?? (l.account === "default" ? box : `${box} · ${l.account}`);
      const seen = out.get(k);
      if (!seen) out.set(k, { label, boxes: [box], limits: l });
      else {
        seen.boxes.push(box);
        if (l.at > seen.limits.at) seen.limits = l;
      }
    }
  }
  const list = [...out.values()];
  // One login needs no name.
  if (list.length === 1) list[0].label = undefined;
  return list;
}

function AgentTile({
  agent,
  tokens,
  sessions: list,
  perBox,
  allBoxes,
  plans,
  limits,
  period,
}: {
  agent: Agent;
  tokens: Tokens4;
  sessions: BoxSession[];
  perBox?: Map<string, number>;
  allBoxes: string[];
  plans: { account: Account; boxes: string[] }[];
  limits: SharedLimits[];
  period: Period;
}) {
  const sessions = list.length;
  const costed = list.filter((s) => s.cost != null);
  const cost = costed.reduce((n, s) => n + (s.cost ?? 0), 0);
  const labels = plans.map((p) => ({ ...p, plan: plan(p.account) })).filter((p) => p.plan);
  const covered = labels.length > 0 && labels.every((p) => p.plan!.subscription);
  const boxes = perBox ? [...perBox.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]) : [];
  const sumBoxes = boxes.reduce((n, [, v]) => n + v, 0) || 1;
  return (
    <Frame variant="card">
      <FrameHeader row wrap gap={2} pad="tight">
        <span className={[sx(paint.s17), SERIES[agent].dot].filter(Boolean).join(" ")} />
        <FrameTitle>{AGENT_NAME[agent]}</FrameTitle>
        <span className={sx(paint.s18)}>{period === 1 ? "today" : `last ${period} days`}</span>
        {labels.length > 0 && <span className="basis-full" />}
        {labels.map((p) => (
          <Badge key={identity(p.account, p.boxes[0], p.account.id)} variant="outline" size="sm" title={[p.account.email, `on ${p.boxes.join(", ")}`].filter(Boolean).join(" · ")}>
            {p.plan!.label}
            {p.plan!.subscription ? " · subscription" : ""}
            {labels.length > 1 && p.account.email ? ` · ${p.account.email}` : ""}
          </Badge>
        ))}
      </FrameHeader>
      <FramePanel pad="room" space={3}>
        <div className={sx(paint.s19)}>
          <span className={sx(paint.s20)}>{compact(total(tokens))}</span>
          <span className={sx(paint.s21)}>
            tokens in {sessions} session{sessions === 1 ? "" : "s"}
            {boxes.length > 1 ? ` on ${boxes.length} boxes` : ""}
          </span>
        </div>
        <dl className={sx(paint.s22)}>
          {(["Input", "Output", "Cache read", "Cache write"] as const).map((l, i) => (
            <div key={l}>
              <dt className={sx(paint.s23)}>{l}</dt>
              <dd className={sx(paint.s24)}>{compact(tokens[i])}</dd>
            </div>
          ))}
        </dl>
        {boxes.length > 1 && (
          <div className={sx(paint.s25)}>
            <div className={sx(paint.s26)} role="img" aria-label={`By box: ${boxes.map(([b, n]) => `${b} ${compact(n)}`).join(", ")}`}>
              {boxes.map(([b, n]) => (
                <Tip key={b} label={`${b}: ${compact(n)} tokens`}>
                  <span className={[sx(paint.s27), boxColor(b, allBoxes).dot].filter(Boolean).join(" ")} style={{ width: `${(n / sumBoxes) * 100}%` }} />
                </Tip>
              ))}
            </div>
            <div className={sx(paint.s28)}>
              {boxes.map(([b, n]) => (
                <span key={b} className={sx(paint.s29)}>
                  <span className={[sx(paint.s30), boxColor(b, allBoxes).dot].filter(Boolean).join(" ")} />
                  {b} <span className={sx(paint.s31)}>{compact(n)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {costed.length > 0 && (
          <p className={sx(paint.s32)}>
            <span className={sx(paint.s33)}>{usd(cost)}</span> is Claude Code's own estimate at API list prices for {costed.length === sessions ? "these sessions" : `${costed.length} of these sessions`}, whole sessions included.
            {covered ? ` ${labels.length === 1 ? labels[0].plan!.label : "Your subscriptions"} cover${labels.length === 1 ? "s" : ""} this use; it isn't billed per token.` : ""}
          </p>
        )}
        {limits.map((l) => (
          <LimitRows key={l.label ?? "one"} shared={l} />
        ))}
      </FramePanel>
    </Frame>
  );
}

function windowName(w: Window) {
  const h = w.window_minutes / 60;
  return h >= 24 * 6 ? "Weekly limit" : h >= 20 ? "Daily limit" : `${h}-hour limit`;
}

// LimitRows shows the plan windows Codex itself last reported, and says how
// old that report is: it only knows what Codex saw on its last turn.
function LimitRows({ shared }: { shared: SharedLimits }) {
  const l = shared.limits;
  const windows = [l.limits.primary, l.limits.secondary].filter(Boolean) as Window[];
  return (
    <div className={sx(paint.s34)}>
      {shared.label && <div className={sx(paint.s35)}>{shared.label}</div>}
      {windows.map((w, i) => {
        const reset = new Date(w.resets_at * 1000);
        const past = reset.getTime() < Date.now();
        return (
          <div key={i} className={sx(paint.s36)}>
            <div className={sx(paint.s37)}>
              <span className={sx(paint.s38)}>{windowName(w)}</span>
              <span className={sx(paint.s39)}>as of {ago(l.at)}</span>
              <span className={sx(paint.s40)}>{past ? "reset since" : `${Math.round(w.used_percent)}% used`}</span>
            </div>
            {!past && (
              <div className={sx(paint.s41)} role="meter" aria-valuenow={Math.round(w.used_percent)} aria-valuemin={0} aria-valuemax={100} aria-label={windowName(w)}>
                <div className={[sx(paint.n0), w.used_percent >= 90 ? sx(paint.n1) : w.used_percent >= 70 ? sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")} style={{ width: `${Math.min(100, w.used_percent)}%` }} />
              </div>
            )}
            <div className={sx(paint.s44)}>{past ? `It reset ${reset.toLocaleDateString()}; Codex reports the new window on its next turn.` : `Resets ${reset.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}`}</div>
          </div>
        );
      })}
    </div>
  );
}

function SessionList({ berth, sessions, sources, running, allBoxes, showBox }: { berth: BerthPluginContext; sessions: BoxSession[]; sources: Source[]; running: Record<string, Session[] | undefined>; allBoxes: string[]; showBox: boolean }) {
  const [busy, setBusy] = useState<string>();
  if (!sessions.length) return <p className={sx(paint.s45)}>No sessions in this period.</p>;
  const locationsOf = (box: string): Location[] => sources.find((s) => s.box === box)?.locations ?? [];

  const resume = async (s: BoxSession) => {
    const w = worktreeOf(s.cwd, locationsOf(s.box));
    if (!w.location) return;
    setBusy(s.box + s.id);
    try {
      const command = s.agent === "claude" ? `claude --resume ${s.id}` : `codex resume ${s.id}`;
      const created = await berth.api.request<{ name: string }>(s.box, "POST", "sessions", { location: w.main ? w.location : `${w.location}/${w.worktree}`, command });
      berth.openTerminal(s.box, created.name);
    } catch (err) {
      berth.notify("Couldn't resume that session", String((err as Error).message ?? err));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <ul className={sx(paint.s46)}>
      {sessions.map((s) => {
        const w = worktreeOf(s.cwd, locationsOf(s.box));
        const live = (running[s.box] ?? []).find((r) => !r.exited && r.agent === s.agent && r.dir === s.cwd);
        return (
          <li key={s.box + s.agent + s.id} className={[sx(paint.s47), "group"].filter(Boolean).join(" ")}>
            <span className={[sx(paint.s48), SERIES[s.agent].dot].filter(Boolean).join(" ")} aria-label={AGENT_NAME[s.agent]} />
            <div className={sx(paint.s49)}>
              <div className={sx(paint.s50)}>
                <span className={sx(paint.s51)}>{s.title || <span className={sx(paint.s52)}>Untitled session</span>}</span>
                {showBox && <BoxChip box={s.box} allBoxes={allBoxes} />}
              </div>
              <div className={sx(paint.s53)}>
                {w.label} · {s.models.join(", ")} · {ago(s.last)}
                {s.account !== "default" && ` · ${s.account}`}
              </div>
            </div>
            <span className={sx(paint.s54)}>{compact(total(s.tokens))}</span>
            {s.cost != null ? (
              <Tip label="Claude Code's estimate at API list prices">
                <span className={sx(paint.s55)}>{usd(s.cost)}</span>
              </Tip>
            ) : (
              <span className={sx(paint.s56)} />
            )}
            <span className={sx(paint.s57)}>
              {live ? (
                <Button size="xs" variant="outline" onClick={() => berth.openTerminal(s.box, live.name)}>
                  Open
                </Button>
              ) : w.location ? (
                <Button size="xs" variant="ghost" className={sx(paint.s58)} loading={busy === s.box + s.id} onClick={() => void resume(s)}>
                  Resume
                </Button>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// BoxStatus: one chip per box the view covers, so a slow or failing box is
// visible without holding up the rest.
export function BoxStatus({ states, files, allBoxes }: { states: BoxState[]; files: Record<string, number | undefined>; allBoxes: string[] }) {
  return (
    <div className={sx(paint.s59)}>
      {states.map((s) => (
        <Tip key={s.box} label={s.error}>
          <span className={[sx(paint.s60), s.error && sx(paint.s61), !s.online && sx(paint.s62)].filter(Boolean).join(" ")}>
            <span className={[sx(paint.n4), s.online ? boxColor(s.box, allBoxes).dot : sx(paint.n5)].filter(Boolean).join(" ")} />
            <span className={sx(paint.s65)}>{s.box}</span>
            {!s.online ? (
              <span>not counted (offline)</span>
            ) : s.loading ? (
              <>
                <Spinner className={sx(paint.s66)} />
                <span className={sx(paint.s67)}>reading…</span>
              </>
            ) : s.error ? (
              <span className={sx(paint.s68)}>couldn't read: {s.error}</span>
            ) : (
              <span className={sx(paint.s69)}>{files[s.box] ?? 0} transcripts</span>
            )}
          </span>
        </Tip>
      ))}
    </div>
  );
}
