import { ArrowLeftIcon, CheckIcon, CrownIcon, GitCompareArrowsIcon, SquareTerminalIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { ago, errorMessage } from "@/lib/format";
import type { RunCompare } from "@/lib/orchestrate-core";
import { type BoxRun, runs as runsApi, scheduleRuns } from "@/lib/runs";
import { cn } from "@/lib/utils";
import { focusSession } from "@/lib/workspaces";
import { tokens } from "@/views/automations/flows/runs-tab";

// CompareStrip lists attempts runs with candidates to compare, at the top of
// Review: the ones waiting for a pick first.
export function CompareStrip({ runs, onOpen }: { runs: BoxRun[]; onOpen(r: BoxRun): void }) {
  if (!runs.length) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/30 px-6 py-2 text-xs">
      <GitCompareArrowsIcon className="size-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">Attempts to compare:</span>
      {runs.map((r) => (
        <Button key={`${r.box}/${r.id}`} size="xs" variant={r.status === "waiting_gate" ? "default" : "outline"} onClick={() => onOpen(r)}>
          {r.title ?? r.id}
          {r.status === "waiting_gate" && " · pick one"}
        </Button>
      ))}
    </div>
  );
}

// CompareView is Review's Compare mode for an attempts run: a column per
// attempt, with its check, diffstat, commits, the judge's ranking and
// reasons, and the files it changed. Picking one decides the run's gate;
// the run then opens its pull request and archives the rest.
export function CompareView({ box, id, onClose }: { box: string; id: string; onClose(): void }) {
  const [data, setData] = useState<RunCompare>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setData(await runsApi.compare(box, id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [box, id]);

  const pick = async (approve: boolean, index?: number) => {
    setBusy(true);
    try {
      await runsApi.decide(box, id, { approve, pick: index });
      scheduleRuns(box, 0);
      toastManager.add({ type: "success", title: approve ? `Picked attempt ${(index ?? 0) + 1}` : "Rejected every attempt", description: approve ? "The run goes on: its pull request, then the others are archived." : undefined });
      await load();
    } catch (err) {
      toastManager.add({ type: "error", title: "Couldn't decide", description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const gate = data?.gate;
  const canPick = !!gate?.pick;
  const cands = data?.candidates ?? [];
  const winner = gate?.default;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b px-6 py-2.5">
        <Button size="sm" variant="ghost" onClick={onClose}>
          <ArrowLeftIcon />
          Review
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-sm">{data?.run.title ?? id}</p>
          <p className="truncate text-muted-foreground text-xs">
            {box} · {data ? `${data.run.status.replace("_", " ")} · started ${ago(data.run.created)}` : "…"}
            {data?.run.usage && ` · ${tokens(data.run.usage)}`}
          </p>
        </div>
        {canPick && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void pick(false)}>
            <XIcon />
            Reject all
          </Button>
        )}
      </div>
      {error && <p className="px-6 py-3 text-destructive text-sm">{error}</p>}
      {!data && !error && (
        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground text-sm">
          <Spinner className="size-4" /> Reading the attempts…
        </div>
      )}
      {data && (
        <div className="min-h-0 flex-1 overflow-auto p-6">
          {data.judge && (
            <p className="mb-4 rounded-xl border bg-muted/30 px-4 py-2.5 text-sm">
              <span className="font-medium">Judge: </span>
              {data.judge}
            </p>
          )}
          {!cands.length && <p className="text-muted-foreground text-sm">No attempt has finished yet.</p>}
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(1, cands.length)}, minmax(260px, 1fr))` }}>
            {cands.map((c) => {
              const files = c.review?.files ?? [];
              return (
                <section key={c.index} className={cn("flex min-w-0 flex-col rounded-xl border bg-card", c.picked && "border-success/60", winner === c.index && canPick && "border-primary/50")}>
                  <header className="flex items-center gap-2 border-b px-3 py-2">
                    <AgentIcon agent={c.agent} />
                    <span className="font-medium text-sm">Attempt {c.index + 1}</span>
                    <span className="truncate text-muted-foreground text-xs">{c.worktree}</span>
                    {c.judge.rank === 1 && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary">
                        <CrownIcon className="size-3" />
                        judge's pick
                      </span>
                    )}
                    {c.picked && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-success">
                        <CheckIcon className="size-3" />
                        picked
                      </span>
                    )}
                  </header>
                  <dl className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 px-3 py-2 text-xs">
                    <dt className="text-muted-foreground">Check</dt>
                    <dd className={c.verify.passed ? "text-success" : "text-destructive"}>
                      {c.verify.passed ? "passed" : `failed (exit ${c.verify.exit_code})`}
                      {c.verify.rounds ? ` in ${c.verify.rounds} round${c.verify.rounds === 1 ? "" : "s"}` : ""}
                    </dd>
                    <dt className="text-muted-foreground">Changes</dt>
                    <dd className="font-mono tabular-nums">
                      {c.diff.files} files <span className="text-success">+{c.diff.added}</span> <span className="text-destructive">−{c.diff.removed}</span> · {c.diff.commits} commits
                    </dd>
                    {c.judge.rank ? (
                      <>
                        <dt className="text-muted-foreground">Judge</dt>
                        <dd>
                          #{c.judge.rank}
                          {c.judge.reason && <span className="text-muted-foreground"> · {c.judge.reason}</span>}
                        </dd>
                      </>
                    ) : null}
                    {c.tokens && (
                      <>
                        <dt className="text-muted-foreground">Spent</dt>
                        <dd>{tokens(c.tokens)}</dd>
                      </>
                    )}
                    {c.summary && (
                      <>
                        <dt className="text-muted-foreground">Commits</dt>
                        <dd className="text-muted-foreground">{c.summary}</dd>
                      </>
                    )}
                  </dl>
                  {!c.verify.passed && c.verify.tail && <pre className="mx-3 mb-2 max-h-28 overflow-auto rounded-lg bg-muted/60 p-2 font-mono text-[11px] text-muted-foreground">{c.verify.tail}</pre>}
                  <ul className="min-h-0 flex-1 space-y-0.5 border-t px-3 py-2 text-[11px]">
                    {files.slice(0, 14).map((f) => (
                      <li key={f.path} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-mono">{f.path}</span>
                        <span className="font-mono text-success tabular-nums">+{f.added ?? 0}</span>
                        <span className="font-mono text-destructive tabular-nums">−{f.removed ?? 0}</span>
                      </li>
                    ))}
                    {files.length > 14 && <li className="text-muted-foreground">and {files.length - 14} more</li>}
                    {!files.length && <li className="text-muted-foreground">No uncommitted changes.</li>}
                  </ul>
                  <footer className="flex items-center gap-1.5 border-t px-3 py-2">
                    {canPick && (
                      <Button size="xs" disabled={busy} onClick={() => void pick(true, c.index)}>
                        Pick this one
                      </Button>
                    )}
                    {c.session && (
                      <Button size="xs" variant="ghost" onClick={() => void focusSession(box, c.session!)}>
                        <SquareTerminalIcon />
                        Open session
                      </Button>
                    )}
                  </footer>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
