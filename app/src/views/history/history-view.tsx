import { HistoryIcon, RefreshCwIcon, RegexIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { agentLabel } from "@/lib/derive";
import { ago, errorMessage } from "@/lib/format";
import { around, groupMatches, type HistoryFilter, type HistoryMatch, type HistorySession, historyTitle, listHistory, type MatchGroup, searchHistory } from "@/lib/history";
import { load, save } from "@/lib/storage";
import { useStore } from "@/lib/store";
import { Replay } from "@/views/history/replay";
import { clock, kindLabel, type Liveness, liveness, Marked, SessionChips, SourceIcon, StatePill } from "@/views/history/parts";
import { ViewHeader } from "@/views/view-header";

// HistoryView lists what agents did on every box, kept after their sessions
// end, and searches it. Opening one replays it.

interface Filters {
  box: string;
  project: string;
  agent: string;
  state: "" | Liveness;
  since: string;
}

const FILTERS_KEY = "berth.history.filters";
const blank: Filters = { box: "", project: "", agent: "", state: "", since: "" };

type Row = HistorySession & { box: string };

export function HistoryView() {
  const view = useStore((s) => s.view);
  const open = view.kind === "history" ? view.open : undefined;
  const q0 = view.kind === "history" ? (view.q ?? "") : "";
  if (open) return <Replay key={`${open.box}:${open.id}`} box={open.box} id={open.id} at={open.at} q={q0} />;
  return <HistoryList initialQuery={q0} />;
}

function HistoryList({ initialQuery }: { initialQuery: string }) {
  const status = useStore((s) => s.status);
  const [q, setQ] = useState(initialQuery);
  const [regexp, setRegexp] = useState(false);
  const [filters, setFilters] = useState<Filters>(() => ({ ...blank, ...load<Partial<Filters>>(FILTERS_KEY, {}) }));
  const [sessions, setSessions] = useState<Row[]>();
  const [groups, setGroups] = useState<MatchGroup[]>();
  const [failed, setFailed] = useState<{ box: string; error: string }[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const run = useRef(0);

  const set = (f: Partial<Filters>) =>
    setFilters((old) => {
      const next = { ...old, ...f };
      save(FILTERS_KEY, next);
      return next;
    });

  const online = useMemo(() => (status?.boxes ?? []).filter((b) => b.state === "online").map((b) => b.name), [status]);
  const boxes = filters.box ? [filters.box] : undefined;
  const filter: HistoryFilter = { agent: filters.agent || undefined, location: filters.project || undefined, since: filters.since || undefined };
  const query = q.trim();

  // Sessions without a query; matches with one, a moment after typing stops.
  useEffect(() => {
    const id = ++run.current;
    setBusy(true);
    setError(undefined);
    const t = setTimeout(
      async () => {
        try {
          if (!query) {
            const r = await listHistory({ ...filter, limit: 300 }, boxes);
            if (id !== run.current) return;
            setSessions(r.items);
            setGroups(undefined);
            setFailed(r.failed);
          } else {
            const r = await searchHistory(query, { ...filter, regexp, limit: 200 }, boxes);
            if (id !== run.current) return;
            setGroups(groupMatches(r.items));
            setFailed(r.failed);
          }
        } catch (err) {
          if (id === run.current) setError(errorMessage(err));
        } finally {
          if (id === run.current) setBusy(false);
        }
      },
      query ? 250 : 0,
    );
    return () => clearTimeout(t);
    // filter and boxes are derived from filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, regexp, filters.box, filters.project, filters.agent, filters.since, online.join(","), tick]);

  const byState = <T extends { session: HistorySession } | HistorySession>(x: T) => {
    if (!filters.state) return true;
    const s = "session" in x ? (x as { session: HistorySession }).session : (x as HistorySession);
    return liveness(s) === filters.state;
  };
  const shownSessions = sessions?.filter(byState);
  const shownGroups = groups?.filter(byState);

  // Choices come from what is recorded, so every one finds something.
  const projects = useMemo(() => [...new Set((sessions ?? []).map((s) => s.location).filter(Boolean) as string[])].sort(), [sessions]);
  const agents = useMemo(() => [...new Set((sessions ?? []).map((s) => s.agent).filter(Boolean) as string[])].sort(), [sessions]);

  const openAt = (box: string, id: string, at?: number) => useStore.getState().setView({ kind: "history", q: query || undefined, open: { box, id, at } });

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="History"
        description="What your agents did on every box, kept after their sessions end."
        actions={
          <Button size="sm" variant="ghost" onClick={() => setTick((n) => n + 1)} disabled={busy} title="Refresh">
            <RefreshCwIcon className={busy ? "animate-spin" : undefined} />
          </Button>
        }
      />
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-6 py-2.5">
        <InputGroup className="min-w-56 flex-1 basis-72">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput autoFocus placeholder={regexp ? "Search with a regular expression…" : "Search what agents said and ran…"} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search history" />
          <InputGroupAddon align="inline-end">
            <Toggle size="sm" pressed={regexp} onPressedChange={setRegexp} title="Regular expression" aria-label="Regular expression">
              <RegexIcon />
            </Toggle>
          </InputGroupAddon>
        </InputGroup>
        <SimpleSelect size="sm" className="w-auto min-w-28" value={filters.box} onChange={(v) => set({ box: v })} options={[{ value: "", label: "All boxes" }, ...online.map((b) => ({ value: b, label: b }))]} />
        <SimpleSelect
          size="sm"
          className="w-auto min-w-32"
          value={filters.project}
          onChange={(v) => set({ project: v })}
          options={[{ value: "", label: "All projects" }, ...[...new Set([...projects, ...(filters.project ? [filters.project] : [])])].map((p) => ({ value: p, label: p }))]}
        />
        <SimpleSelect
          size="sm"
          className="w-auto min-w-28"
          value={filters.agent}
          onChange={(v) => set({ agent: v })}
          options={[{ value: "", label: "All agents" }, ...[...new Set([...agents, ...(filters.agent ? [filters.agent] : [])])].map((a) => ({ value: a, label: agentLabel(a) }))]}
        />
        <SimpleSelect
          size="sm"
          className="w-auto min-w-28"
          value={filters.state}
          onChange={(v) => set({ state: v as Filters["state"] })}
          options={[
            { value: "", label: "Any state" },
            { value: "live", label: "Running" },
            { value: "waiting", label: "Waiting" },
            { value: "finished", label: "Finished" },
            { value: "ended", label: "Ended" },
          ]}
        />
        <SimpleSelect
          size="sm"
          className="w-auto min-w-28"
          value={filters.since}
          onChange={(v) => set({ since: v })}
          options={[
            { value: "", label: "Any time" },
            { value: "24h", label: "Last 24 hours" },
            { value: "7d", label: "Last 7 days" },
            { value: "30d", label: "Last 30 days" },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 pt-4 pb-24">
          {error && <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-destructive-foreground text-sm">{error}</p>}
          {failed.length > 0 && (
            <p className="mb-3 text-muted-foreground text-xs">
              {failed.map((f) => (f.error.includes("does not keep history") || f.error.includes("404") ? `${f.box} needs an upgrade to keep history` : `${f.box}: ${f.error}`)).join(" · ")}
            </p>
          )}
          {query ? <Results groups={shownGroups} q={query} regexp={regexp} onOpen={openAt} /> : <Sessions sessions={shownSessions} onOpen={openAt} />}
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="grid gap-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-14 rounded-xl" />
      ))}
    </div>
  );
}

function Sessions({ sessions, onOpen }: { sessions?: Row[]; onOpen(box: string, id: string): void }) {
  if (!sessions) return <Loading />;
  if (!sessions.length)
    return (
      <Empty className="rounded-2xl border border-dashed py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon />
          </EmptyMedia>
          <EmptyTitle>Nothing recorded yet</EmptyTitle>
          <EmptyDescription>Boxes keep what every terminal and agent shows, and Claude Code's own transcripts. Start an agent and its history appears here, even after it ends.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <ul className="divide-y overflow-hidden rounded-xl border">
      {sessions.map((s) => (
        <li key={`${s.box}:${s.id}`}>
          <button type="button" onClick={() => onOpen(s.box, s.id)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border bg-muted/40">
              <SourceIcon s={s} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="truncate font-medium text-sm">{historyTitle(s)}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{kindLabel(s)}</span>
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <SessionChips box={s.box} s={s} />
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <StatePill s={s} />
              <span className="text-[11px] text-muted-foreground tabular-nums" title={clock(s.updated ?? s.started, true)}>
                {ago(s.updated ?? s.started)} · {s.lines} {s.source === "claude" ? (s.lines === 1 ? "turn" : "turns") : "lines"}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const roleText: Record<string, string> = { user: "Prompt", assistant: "Reply", tool: "Tool", result: "Output" };

function Results({ groups, q, regexp, onOpen }: { groups?: MatchGroup[]; q: string; regexp: boolean; onOpen(box: string, id: string, at?: number): void }) {
  if (!groups) return <Loading />;
  if (!groups.length)
    return (
      <Empty className="rounded-2xl border border-dashed py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchIcon />
          </EmptyMedia>
          <EmptyTitle>No matches</EmptyTitle>
          <EmptyDescription>Nothing any agent said or ran matches “{q}”. Try fewer words, or clear a filter.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  const total = groups.reduce((n, g) => n + g.matches.length, 0);
  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-xs">
        {total} {total === 1 ? "match" : "matches"} in {groups.length} {groups.length === 1 ? "session" : "sessions"}
      </p>
      {groups.map((g) => (
        <section key={`${g.box}:${g.session.id}`} className="overflow-hidden rounded-xl border">
          <button type="button" onClick={() => onOpen(g.box, g.session.id)} className="flex w-full items-center gap-2.5 border-b bg-muted/30 px-4 py-2 text-left hover:bg-accent/40">
            <SourceIcon s={g.session} />
            <span className="min-w-0 truncate font-medium text-sm">{historyTitle(g.session)}</span>
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <SessionChips box={g.box} s={g.session} />
            </span>
            <span className="ml-auto shrink-0">
              <StatePill s={g.session} />
            </span>
          </button>
          <ul className="divide-y">
            {g.matches.map((m, i) => (
              <li key={i}>
                <MatchRow m={m} q={q} regexp={regexp} onOpen={() => onOpen(g.box, g.session.id, m.screen ? -1 - m.position : m.position)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MatchRow({ m, q, regexp, onOpen }: { m: HistoryMatch; q: string; regexp: boolean; onOpen(): void }) {
  return (
    <button type="button" onClick={onOpen} className="grid w-full grid-cols-[4.5rem_1fr] gap-3 px-4 py-2 text-left hover:bg-accent/30">
      <span className="pt-px text-[11px] text-muted-foreground tabular-nums">
        {m.role ? roleText[m.role] ?? m.role : m.screen ? "Screen" : `Line ${m.position + 1}`}
        {m.time && <span className="block">{clock(m.time)}</span>}
      </span>
      <span className="min-w-0 font-mono text-xs leading-relaxed">
        {m.before.map((l, i) => (
          <span key={`b${i}`} className="block truncate text-muted-foreground/70">
            {l || " "}
          </span>
        ))}
        <Marked className="block truncate" text={around(m.line, q, regexp, 60)} q={q} regexp={regexp} />
        {m.after.map((l, i) => (
          <span key={`a${i}`} className="block truncate text-muted-foreground/70">
            {l || " "}
          </span>
        ))}
      </span>
    </button>
  );
}
