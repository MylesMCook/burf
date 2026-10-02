import { ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, CornerDownRightIcon, SearchIcon, SquareArrowOutUpRightIcon, WrenchIcon } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { agentLabel } from "@/lib/derive";
import { errorMessage } from "@/lib/format";
import { handoffFrom, handoffFromLines, historyApi, type HistorySession, historyTitle, type Transcript, type TranscriptLine, type Turn } from "@/lib/history";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { focusSession } from "@/lib/workspaces";
import { Chip, clock, kindLabel, Marked, SessionChips, SourceIcon, StatePill } from "@/views/history/parts";
import { ViewHeader } from "@/views/view-header";

// Replay shows one recorded session: a Claude transcript as a timeline of
// turns, or a terminal's scrollback. at is the turn or line to start on; a
// negative at is a line of the last screen (-1 is its first).

const PAGE = 2000;

export function Replay({ box, id, at, q }: { box: string; id: string; at?: number; q?: string }) {
  const client = useStore((s) => s.client);
  const [t, setT] = useState<Transcript>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!client) return;
    let stop = false;
    (async () => {
      try {
        const first = await historyApi.read(client, box, id, 0, id.startsWith("claude:") ? 5000 : 1);
        if (first.session.source === "claude") {
          // Long transcripts come in pages; keep reading to the end.
          const turns = [...(first.turns ?? [])];
          while (turns.length < first.total && turns.length < 20000) {
            const more = await historyApi.read(client, box, id, turns.length, 5000);
            if (!more.turns?.length) break;
            turns.push(...more.turns);
          }
          if (!stop) setT({ ...first, turns });
          return;
        }
        const from = at !== undefined && at >= 0 ? Math.max(0, at - PAGE / 2) : Math.max(0, first.total - PAGE);
        const page = await historyApi.read(client, box, id, from, PAGE);
        if (!stop) setT(page);
      } catch (err) {
        if (!stop) setError(errorMessage(err));
      }
    })();
    return () => {
      stop = true;
    };
  }, [client, box, id, at]);

  const back = () => useStore.getState().setView({ kind: "history", q: q || undefined });

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title={
          <span className="flex min-w-0 items-center gap-2">
            <Button size="icon-sm" variant="ghost" onClick={back} aria-label="Back to history" title="Back to history">
              <ArrowLeftIcon />
            </Button>
            {t ? <SourceIcon s={t.session} /> : null}
            <span className="max-w-[28rem] truncate">{t ? historyTitle(t.session) : "History"}</span>
          </span>
        }
        description={t ? kindLabel(t.session) : undefined}
        actions={t ? <Actions box={box} s={t.session} /> : undefined}
      />
      {error && <p className="m-6 rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-destructive-foreground text-sm">{error}</p>}
      {!t && !error && (
        <div className="grid gap-3 p-6">
          <Skeleton className="h-8 w-80 rounded-lg" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      )}
      {t?.session.source === "claude" && <Timeline box={box} t={t} at={at} q={q} />}
      {t?.session.source === "terminal" && <Scrollback box={box} initial={t} at={at} q={q} />}
    </div>
  );
}

// Actions are the session's way back to the work: open it while it runs,
// or switch to its other record.
function Actions({ box, s }: { box: string; s: HistorySession }) {
  const other = s.linked?.[0];
  return (
    <>
      {other && (
        <Button size="sm" variant="ghost" onClick={() => useStore.getState().setView({ kind: "history", open: { box, id: other } })}>
          {other.startsWith("claude:") ? "Claude transcript" : "Terminal capture"}
        </Button>
      )}
      {s.running && (
        <Button size="sm" variant="outline" onClick={() => void focusSession(box, s.running!)}>
          <SquareArrowOutUpRightIcon />
          Open session
        </Button>
      )}
    </>
  );
}

function handOff(box: string, s: HistorySession, prompt: string) {
  const location = s.location ? (s.worktree ? `${s.location}/${s.worktree}` : s.location) : undefined;
  useStore.getState().setOrchestrate({ kind: "handoff", box, session: s.running ?? s.name ?? historyTitle(s), prompt, location });
}

const canHandOff = (s: HistorySession) => !!s.running || !!s.location;

function Meta({ box, s, children }: { box: string; s: HistorySession; children?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b px-6 py-2">
      <SessionChips box={box} s={s} />
      {s.agent && <Chip>{agentLabel(s.agent)}</Chip>}
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {clock(s.started, true)}
        {s.updated && s.updated !== s.started ? ` – ${clock(s.updated, true)}` : ""}
      </span>
      <StatePill s={s} />
      <span className="ml-auto flex items-center gap-2">{children}</span>
    </div>
  );
}

// Find is a search box with previous/next and where you are.
function Find({ value, onChange, count, index, onStep, placeholder }: { value: string; onChange(v: string): void; count: number; index: number; onStep(d: 1 | -1): void; placeholder: string }) {
  return (
    <div className="flex items-center gap-1">
      <InputGroup className="w-56">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          size="sm"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onStep(e.shiftKey ? -1 : 1);
            }
          }}
          aria-label={placeholder}
        />
        {value && (
          <InputGroupAddon align="inline-end">
            <span className="text-[11px] text-muted-foreground tabular-nums">{count ? `${index + 1}/${count}` : "0"}</span>
          </InputGroupAddon>
        )}
      </InputGroup>
      <Button size="icon-sm" variant="ghost" disabled={!count} onClick={() => onStep(-1)} aria-label="Previous match">
        <ChevronUpIcon />
      </Button>
      <Button size="icon-sm" variant="ghost" disabled={!count} onClick={() => onStep(1)} aria-label="Next match">
        <ChevronDownIcon />
      </Button>
    </div>
  );
}

// --- Claude transcripts ------------------------------------------------------

interface Step {
  turn: Turn;
  // A tool call's output, shown under it when opened.
  result?: Turn;
}

function stepsOf(turns: Turn[]): Step[] {
  const out: Step[] = [];
  for (const t of turns) {
    const prev = out[out.length - 1];
    if (t.role === "result" && prev?.turn.role === "tool" && !prev.result) prev.result = t;
    else out.push({ turn: t });
  }
  return out;
}

const stepText = (s: Step) => [s.turn.tool, s.turn.text, s.result?.text].filter(Boolean).join("\n");

function Timeline({ box, t, at, q: q0 }: { box: string; t: Transcript; at?: number; q?: string }) {
  const turns = t.turns ?? [];
  const steps = useMemo(() => stepsOf(turns), [turns]);
  const indexOfTurn = (n: number) => Math.max(0, steps.findIndex((s) => s.turn.n === n || s.result?.n === n));
  const [sel, setSel] = useState(() => (at !== undefined && at >= 0 ? indexOfTurn(at) : Math.max(0, steps.length - 1)));
  const [q, setQ] = useState(q0 ?? "");
  const [hit, setHit] = useState(0);
  const [openTools, setOpenTools] = useState<Set<number>>(() => new Set());
  const rows = useRef(new Map<number, HTMLElement>());

  const query = q.trim().toLowerCase();
  const hits = useMemo(() => (query ? steps.flatMap((s, i) => (stepText(s).toLowerCase().includes(query) ? [i] : [])) : []), [steps, query]);

  const show = (i: number, smooth = true) => {
    setSel(i);
    rows.current.get(i)?.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
  };
  // Start where the link pointed, or at the end.
  useEffect(() => {
    requestAnimationFrame(() => show(sel, false));
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = (d: 1 | -1) => {
    if (!hits.length) return;
    // From the selected step, the next match that way.
    const next = d === 1 ? (hits.find((i) => i > sel) ?? hits[0]) : ([...hits].reverse().find((i) => i < sel) ?? hits[hits.length - 1]);
    setHit(hits.indexOf(next));
    const s = steps[next];
    if (s.result && s.result.text.toLowerCase().includes(query)) setOpenTools((o) => new Set(o).add(next));
    show(next);
  };

  const prompts = steps.filter((s) => s.turn.role === "user").length;

  return (
    <>
      <Meta box={box} s={t.session}>
        <span className="text-[11px] text-muted-foreground">
          {prompts} {prompts === 1 ? "prompt" : "prompts"} · {turns.length} turns
        </span>
      </Meta>
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b px-6 py-2">
        <div className="flex min-w-48 flex-1 items-center gap-3">
          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{clock(steps[sel]?.turn.time) || `${sel + 1}`}</span>
          <Slider aria-label="Scrub through the session" min={0} max={Math.max(0, steps.length - 1)} value={sel} onValueChange={(v) => show(Array.isArray(v) ? v[0] : (v as number), false)} />
          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
            {sel + 1}/{steps.length}
          </span>
        </div>
        <Find value={q} onChange={(v) => (setQ(v), setHit(0))} count={hits.length} index={hit} onStep={step} placeholder="Find in transcript" />
        <Button size="sm" disabled={!canHandOff(t.session) || !steps.length} title={canHandOff(t.session) ? "Start another agent from the selected turn" : "Berth cannot tell which worktree this ran in"} onClick={() => handOff(box, t.session, handoffFrom(t.session, turns, steps[sel]?.result?.n ?? steps[sel]?.turn.n ?? 0))}>
          <CornerDownRightIcon />
          Hand off from here…
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ol className="mx-auto grid max-w-4xl gap-1 px-6 pt-4 pb-24">
          {steps.map((s, i) => (
            <li
              key={s.turn.n}
              ref={(el) => {
                if (el) rows.current.set(i, el);
                else rows.current.delete(i);
              }}
              onClick={() => setSel(i)}
              className={cn("grid cursor-default grid-cols-[4.5rem_1fr] gap-3 rounded-lg px-2 py-1.5 [content-visibility:auto] [contain-intrinsic-size:auto_3rem]", i === sel ? "bg-accent/50 ring-1 ring-ring/30" : "hover:bg-accent/20")}
            >
              <span className="pt-1 text-[11px] text-muted-foreground tabular-nums">{clock(s.turn.time)}</span>
              <StepBody s={s} q={query ? q.trim() : undefined} open={openTools.has(i)} onToggle={() => setOpenTools((o) => (o.has(i) ? (o.delete(i), new Set(o)) : new Set(o).add(i)))} />
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function StepBody({ s, q, open, onToggle }: { s: Step; q?: string; open: boolean; onToggle(): void }) {
  const t = s.turn;
  if (t.role === "user")
    return (
      <div className="rounded-lg border bg-muted/40 px-3 py-2">
        <div className="mb-0.5 font-medium text-[11px] text-muted-foreground">Prompt</div>
        <Marked className="whitespace-pre-wrap break-words text-sm" text={t.text} q={q} />
      </div>
    );
  if (t.role === "assistant") return <Marked className="block whitespace-pre-wrap break-words py-0.5 text-sm leading-relaxed" text={t.text} q={q} />;
  if (t.role === "tool")
    return (
      <div className="min-w-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="flex w-full min-w-0 items-center gap-1.5 rounded-md py-0.5 text-left text-muted-foreground text-xs hover:text-foreground"
          aria-expanded={open}
        >
          {s.result ? open ? <ChevronDownIcon className="size-3 shrink-0" /> : <ChevronRightIcon className="size-3 shrink-0" /> : <span className="size-3 shrink-0" />}
          <WrenchIcon className="size-3 shrink-0" />
          <span className="shrink-0 font-medium text-foreground">{t.tool}</span>
          <Marked className="truncate font-mono" text={t.text} q={q} />
        </button>
        {open && s.result && (
          <pre className="mt-1 ml-[1.125rem] max-h-72 overflow-auto rounded-md border bg-muted/30 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed">
            <Marked text={s.result.text} q={q} />
          </pre>
        )}
      </div>
    );
  return (
    <pre className="overflow-auto rounded-md border bg-muted/30 px-2.5 py-1.5 font-mono text-[11px]">
      <Marked text={t.text} q={q} />
    </pre>
  );
}

// --- terminal captures -------------------------------------------------------

function Scrollback({ box, initial, at, q: q0 }: { box: string; initial: Transcript; at?: number; q?: string }) {
  const client = useStore((s) => s.client);
  const s = initial.session;
  const [page, setPage] = useState(initial);
  const [sel, setSel] = useState<number | undefined>(at);
  const [q, setQ] = useState(q0 ?? "");
  const [hits, setHits] = useState<number[]>([]);
  const [hit, setHit] = useState(0);
  const [loading, setLoading] = useState(false);
  const rows = useRef(new Map<number, HTMLElement>());
  const scroller = useRef<HTMLDivElement>(null);
  const lines = page.lines ?? [];
  const screen = page.screen ?? [];
  const first = lines[0]?.n ?? page.from;
  const end = first + lines.length;

  const scrollTo = (n: number, smooth = true) => requestAnimationFrame(() => rows.current.get(n)?.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" }));

  useEffect(() => {
    if (at !== undefined) scrollTo(at, false);
    else scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Matches come from the box, so they reach lines not loaded yet.
  const query = q.trim();
  useEffect(() => {
    if (!client || !query) {
      setHits([]);
      return;
    }
    let stop = false;
    const t = setTimeout(async () => {
      try {
        const m = await historyApi.search(client, box, query, { session: s.id, limit: 200 });
        if (!stop) setHits(m.map((x) => (x.screen ? -1 - x.position : x.position)));
      } catch {
        if (!stop) setHits([]);
      }
    }, 200);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [client, box, s.id, query]);

  const loadAt = async (from: number) => {
    if (!client) return;
    setLoading(true);
    try {
      setPage(await historyApi.read(client, box, s.id, Math.max(0, from), PAGE));
    } finally {
      setLoading(false);
    }
  };

  const jump = async (n: number) => {
    setSel(n);
    if (n >= 0 && (n < first || n >= end)) await loadAt(n - PAGE / 2);
    scrollTo(n);
  };

  const step = (d: 1 | -1) => {
    if (!hits.length) return;
    const i = (hit + d + hits.length) % hits.length;
    setHit(i);
    void jump(hits[i]);
  };

  // Hand off with what the terminal showed up to the selected line.
  const context = (): string[] => {
    if (sel !== undefined && sel < 0) return [...lines.slice(-20).map((l) => l.text), ...screen.slice(0, -1 - sel + 1)].slice(-40);
    if (sel !== undefined) return lines.filter((l) => l.n <= sel).slice(-40).map((l) => l.text);
    return [...lines.map((l) => l.text), ...screen].slice(-40);
  };

  let lastTime = "";
  return (
    <>
      <Meta box={box} s={s}>
        <span className="text-[11px] text-muted-foreground tabular-nums">{page.total} lines kept</span>
      </Meta>
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b px-6 py-2">
        <Find value={q} onChange={(v) => (setQ(v), setHit(0))} count={hits.length} index={hit} onStep={step} placeholder="Find in scrollback" />
        <span className="flex-1" />
        <Button size="sm" disabled={!canHandOff(s)} title={canHandOff(s) ? "Start another agent with what this terminal showed up to the selected line" : "Berth cannot tell which worktree this ran in"} onClick={() => handOff(box, s, handoffFromLines(s, context()))}>
          <CornerDownRightIcon />
          Hand off from here…
        </Button>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto bg-muted/15">
        <div className="px-4 py-3 font-mono text-xs leading-[1.55]">
          {first > 0 && (
            <Button size="xs" variant="outline" className="mb-2" disabled={loading} onClick={() => void loadAt(first - PAGE)}>
              Load earlier ({first} more)
            </Button>
          )}
          {lines.length === 0 && screen.length === 0 && <p className="py-8 text-center font-sans text-muted-foreground text-sm">Nothing scrolled by yet.</p>}
          {lines.map((l) => {
            const time = l.time ? clock(l.time, true) : "";
            const mark = time && time !== lastTime;
            lastTime = time || lastTime;
            return (
              <Fragment key={l.n}>
                {mark && <TimeMark time={l.time!} />}
                <Line l={l} sel={sel === l.n} q={query} onClick={() => setSel(l.n)} rowRef={(el) => (el ? rows.current.set(l.n, el) : rows.current.delete(l.n))} />
              </Fragment>
            );
          })}
          {end < page.total && (
            <Button size="xs" variant="outline" className="my-2" disabled={loading} onClick={() => void loadAt(end)}>
              Load later ({page.total - end} more)
            </Button>
          )}
          {screen.length > 0 && end >= page.total && (
            <>
              <div className="my-2 flex items-center gap-2 font-sans text-[11px] text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {s.running ? "On screen now" : "Last screen"}
                <span className="h-px flex-1 bg-border" />
              </div>
              {screen.map((text, i) => {
                const n = -1 - i;
                return <Line key={n} l={{ n, text }} sel={sel === n} q={query} onClick={() => setSel(n)} rowRef={(el) => (el ? rows.current.set(n, el) : rows.current.delete(n))} />;
              })}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function TimeMark({ time }: { time: string }) {
  return <div className="mt-2 mb-0.5 font-sans text-[10px] text-muted-foreground/80 tabular-nums">{clock(time, true)}</div>;
}

function Line({ l, sel, q, onClick, rowRef }: { l: TranscriptLine; sel: boolean; q: string; onClick(): void; rowRef(el: HTMLElement | null): void }) {
  return (
    <div ref={rowRef} onClick={onClick} className={cn("grid grid-cols-[3.5rem_1fr] gap-3 rounded-sm [content-visibility:auto] [contain-intrinsic-size:auto_1.2rem]", sel ? "bg-accent ring-1 ring-ring/30" : "hover:bg-accent/30")}>
      <span className="select-none text-right text-muted-foreground/60 tabular-nums">{l.n >= 0 ? l.n + 1 : ""}</span>
      <Marked className="whitespace-pre-wrap break-all" text={l.text || " "} q={q || undefined} />
    </div>
  );
}
