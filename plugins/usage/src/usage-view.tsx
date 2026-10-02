import { useSessions, type BerthPluginContext, type Location } from "@berth/plugin";
import { Badge, Button, Empty, EmptyDescription, EmptyHeader, EmptyTitle, Frame, FrameHeader, FramePanel, FrameTitle, Icon, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@berth/plugin/ui";
import { useMemo, useState } from "react";

import type { Account, Agent, Limits, Report, UsageSession, Window } from "./box";
import { DailyChart, SERIES } from "./chart";
import { AGENT_NAME, ago, compact, days, plan, summarize, total, usd, worktreeOf, type Period } from "./data";

export function UsageView({ berth, box, period, report, accounts, locations }: { berth: BerthPluginContext; box: string; period: Period; report?: Report; accounts?: Account[]; locations: Location[] }) {
  const sum = useMemo(() => (report ? summarize(report, period, locations) : undefined), [report, period, locations]);
  if (!report || !sum) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }
  const agents = (["claude", "codex"] as Agent[]).filter((a) => (sum.byAgent.get(a) ? total(sum.byAgent.get(a)!) > 0 : false) || report.limits.some((l) => l.agent === a));
  if (!agents.length) {
    return (
      <Empty className="rounded-xl border py-16">
        <EmptyHeader>
          <Icon name="ChartColumn" className="mx-auto mb-2 size-5 text-muted-foreground" />
          <EmptyTitle>No agent usage on {box} {period === 1 ? "today" : `in the last ${period} days`}</EmptyTitle>
          <EmptyDescription>Claude Code and Codex record their token use as they work; it shows up here once an agent has run on this box.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  const defaultAccount = (a: Agent) => accounts?.find((x) => x.agent === a && x.id === "default");
  const subscription = plan(defaultAccount("claude"))?.subscription;

  return (
    <div className="space-y-4">
      <div className={cn("grid gap-3", agents.length > 1 && "md:grid-cols-2")}>
        {agents.map((a) => (
          <AgentTile key={a} agent={a} tokens={sum.byAgent.get(a) ?? [0, 0, 0, 0]} sessions={sum.sessions.filter((s) => s.agent === a)} account={defaultAccount(a)} limits={report.limits.filter((l) => l.agent === a)} period={period} />
        ))}
      </div>

      {period > 1 && (
        <Frame>
          <FrameHeader className="py-3">
            <FrameTitle>Tokens per day</FrameTitle>
          </FrameHeader>
          <FramePanel className="p-4">
            <DailyChart days={days(report.today, period)} byDay={sum.byDay} />
          </FramePanel>
        </Frame>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Frame>
          <FrameHeader className="py-3">
            <FrameTitle>By model</FrameTitle>
          </FrameHeader>
          <FramePanel className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Input</TableHead>
                  <TableHead className="text-right">Output</TableHead>
                  <TableHead className="text-right">Cache</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sum.byModel.map((m) => (
                  <TableRow key={m.agent + m.model}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span className={cn("size-2 shrink-0 rounded-[2px]", SERIES[m.agent].dot)} />
                        <span className="truncate font-mono text-xs">{m.model}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{compact(m.tokens[0])}</TableCell>
                    <TableCell className="text-right tabular-nums">{compact(m.tokens[1])}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{compact(m.tokens[2] + m.tokens[3])}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{compact(total(m.tokens))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </FramePanel>
        </Frame>
        <Frame>
          <FrameHeader className="py-3">
            <FrameTitle>By project</FrameTitle>
          </FrameHeader>
          <FramePanel className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worktree</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sum.byWorktree.slice(0, 10).map((w) => (
                  <TableRow key={w.name.label}>
                    <TableCell className="max-w-64 truncate" title={w.name.path ?? w.name.label}>
                      {w.name.location ? w.name.label : <span className="font-mono text-muted-foreground text-xs">{w.name.label}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{w.sessions || ""}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{compact(total(w.tokens))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </FramePanel>
        </Frame>
      </div>

      <Frame>
        <FrameHeader className="flex-row items-center gap-2 py-3">
          <FrameTitle>Sessions</FrameTitle>
          <span className="ml-auto text-muted-foreground text-xs">
            Cost is Claude Code's own estimate at API list prices{subscription ? "; your Claude subscription covers this use" : ""}.
          </span>
        </FrameHeader>
        <FramePanel className="p-0">
          <SessionList berth={berth} box={box} sessions={sum.sessions.slice(0, 25)} locations={locations} />
        </FramePanel>
      </Frame>

      <p className="text-muted-foreground text-xs">
        Read from {report.files} transcript{report.files === 1 ? "" : "s"} on {box} {ago(report.generated)}; days are the box's ({report.tz}).
        {report.partial && ` ${report.pending} more are still being read; refresh in a minute for the rest.`}
        {report.truncated && " Older sessions are left out to keep the answer small."} Input excludes cached input, which is counted under cache.
      </p>
    </div>
  );
}

function AgentTile({ agent, tokens, sessions: list, account, limits, period }: { agent: Agent; tokens: [number, number, number, number]; sessions: UsageSession[]; account?: Account; limits: Limits[]; period: Period }) {
  const p = plan(account);
  const sessions = list.length;
  const costed = list.filter((s) => s.cost != null);
  const cost = costed.reduce((n, s) => n + (s.cost ?? 0), 0);
  return (
    <Frame>
      <FrameHeader className="flex-row items-center gap-2 py-3">
        <span className={cn("size-2.5 rounded-[3px]", SERIES[agent].dot)} />
        <FrameTitle>{AGENT_NAME[agent]}</FrameTitle>
        {p && (
          <Badge variant="outline" size="sm">
            {p.label}
            {p.subscription ? " · subscription" : ""}
          </Badge>
        )}
        <span className="ml-auto text-muted-foreground text-xs">{period === 1 ? "today" : `last ${period} days`}</span>
      </FrameHeader>
      <FramePanel className="space-y-3 p-4">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-2xl tabular-nums tracking-tight">{compact(total(tokens))}</span>
          <span className="text-muted-foreground text-sm">tokens in {sessions} session{sessions === 1 ? "" : "s"}</span>
        </div>
        <dl className="grid grid-cols-4 gap-2 text-xs">
          {(["Input", "Output", "Cache read", "Cache write"] as const).map((l, i) => (
            <div key={l}>
              <dt className="text-muted-foreground">{l}</dt>
              <dd className="tabular-nums">{compact(tokens[i])}</dd>
            </div>
          ))}
        </dl>
        {costed.length > 0 && (
          <p className="border-t pt-3 text-muted-foreground text-xs">
            <span className="font-medium text-foreground tabular-nums">{usd(cost)}</span> is Claude Code's own estimate at API list prices for {costed.length === sessions ? "these sessions" : `${costed.length} of these sessions`}, whole sessions included.
            {p?.subscription ? ` ${p.label} covers this use; it isn't billed per token.` : ""}
          </p>
        )}
        {limits.map((l) => (
          <LimitRows key={l.account} limits={l} />
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
function LimitRows({ limits: l }: { limits: Limits }) {
  const windows = [l.limits.primary, l.limits.secondary].filter(Boolean) as Window[];
  return (
    <div className="space-y-2 border-t pt-3">
      {windows.map((w, i) => {
        const reset = new Date(w.resets_at * 1000);
        const past = reset.getTime() < Date.now();
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-baseline gap-2 text-xs">
              <span className="font-medium">{windowName(w)}</span>
              <span className="text-muted-foreground">{l.account === "default" ? "" : `${l.account} · `}as of {ago(l.at)}</span>
              <span className="ml-auto tabular-nums">{past ? "reset since" : `${Math.round(w.used_percent)}% used`}</span>
            </div>
            {!past && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={Math.round(w.used_percent)} aria-valuemin={0} aria-valuemax={100} aria-label={windowName(w)}>
                <div className={cn("h-full rounded-full", w.used_percent >= 90 ? "bg-destructive" : w.used_percent >= 70 ? "bg-warning" : "bg-primary/70")} style={{ width: `${Math.min(100, w.used_percent)}%` }} />
              </div>
            )}
            <div className="text-[11px] text-muted-foreground">{past ? `It reset ${reset.toLocaleDateString()}; Codex reports the new window on its next turn.` : `Resets ${reset.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}`}</div>
          </div>
        );
      })}
    </div>
  );
}

function SessionList({ berth, box, sessions, locations }: { berth: BerthPluginContext; box: string; sessions: UsageSession[]; locations: Location[] }) {
  const running = useSessions(box) ?? [];
  const [busy, setBusy] = useState<string>();
  if (!sessions.length) return <p className="px-4 py-6 text-center text-muted-foreground text-sm">No sessions in this period.</p>;

  const resume = async (s: UsageSession) => {
    const w = worktreeOf(s.cwd, locations);
    if (!w.location) return;
    setBusy(s.id);
    try {
      const command = s.agent === "claude" ? `claude --resume ${s.id}` : `codex resume ${s.id}`;
      const created = await berth.api.request<{ name: string }>(box, "POST", "sessions", { location: w.main ? w.location : `${w.location}/${w.worktree}`, command });
      berth.openTerminal(box, created.name);
    } catch (err) {
      berth.notify("Couldn't resume that session", String((err as Error).message ?? err));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <ul className="divide-y">
      {sessions.map((s) => {
        const w = worktreeOf(s.cwd, locations);
        const live = running.find((r) => !r.exited && r.agent === s.agent && r.dir === s.cwd);
        return (
          <li key={s.agent + s.id} className="group flex items-center gap-3 px-4 py-2 text-sm">
            <span className={cn("size-2 shrink-0 rounded-[2px]", SERIES[s.agent].dot)} aria-label={AGENT_NAME[s.agent]} />
            <div className="min-w-0 flex-1">
              <div className="truncate">{s.title || <span className="text-muted-foreground">Untitled session</span>}</div>
              <div className="truncate text-muted-foreground text-xs">
                {w.label} · {s.models.join(", ")} · {ago(s.last)}
                {s.account !== "default" && ` · ${s.account}`}
              </div>
            </div>
            <span className="w-16 text-right tabular-nums">{compact(total(s.tokens))}</span>
            <span className="w-16 text-right text-muted-foreground tabular-nums" title="Claude Code's estimate at API list prices">
              {s.cost != null ? usd(s.cost) : ""}
            </span>
            <span className="w-20 text-right">
              {live ? (
                <Button size="xs" variant="outline" onClick={() => berth.openTerminal(box, live.name)}>
                  Open
                </Button>
              ) : w.location ? (
                <Button size="xs" variant="ghost" className="opacity-0 group-hover:opacity-100" loading={busy === s.id} onClick={() => void resume(s)}>
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
