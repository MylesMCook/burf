import { ChevronRightIcon, ClockIcon, GitPullRequestIcon, HistoryIcon } from "lucide-react";
import { useState } from "react";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ago } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STEP_KINDS } from "@/views/automations/flows/model";
import { ProjectLabel } from "@/views/automations/flows/project-label";
import { RunStatus, runTook } from "@/views/automations/flows/run-status";
import type { BoxRun } from "@/views/automations/flows/use-runs";

// RunsTab is every flow run on every box, newest first: what started it,
// and each step's outcome and output.
export function RunsTab({ runs, names }: { runs: BoxRun[]; names: (box: string, scope: string, id: string) => string }) {
  if (runs.length === 0)
    return (
      <Empty className="mt-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon />
          </EmptyMedia>
          <EmptyTitle>No runs yet</EmptyTitle>
          <EmptyDescription>When a flow's trigger fires, or you test one, its run shows up here with every step's output.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-[20px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_90px_60px] gap-3 border-b px-4 py-2 text-[11px] text-muted-foreground uppercase tracking-wide">
        <span />
        <span>Flow</span>
        <span>Where</span>
        <span>Started by</span>
        <span>When</span>
        <span className="text-right">Took</span>
      </div>
      <ol className="divide-y divide-border/70">
        {runs.map((r) => (
          <RunRow key={`${r.box}:${r.id}`} run={r} name={names(r.box, r.scope, r.flow)} />
        ))}
      </ol>
    </div>
  );
}

function RunRow({ run, name }: { run: BoxRun; name: string }) {
  const [open, setOpen] = useState(false);
  const d = run.event.data ?? {};
  const where = (d.name as string) || (d.location as string) || (d.path as string)?.split("/").pop();
  return (
    <li>
      <button type="button" onClick={() => setOpen(!open)} className="grid w-full grid-cols-[20px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_90px_60px] items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent/40">
        <RunStatus status={run.status} />
        <span className="flex min-w-0 items-center gap-1.5">
          <ChevronRightIcon className={cn("size-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
          <span className="truncate font-medium">{name}</span>
        </span>
        <ProjectLabel box={run.box} scope={run.scope} className="text-muted-foreground text-xs" />
        <span className="truncate text-xs">
          {run.event.type === "schedule.fired" ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <ClockIcon className="size-3" />
              Scheduled
            </span>
          ) : run.event.type.startsWith("github.") ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <GitPullRequestIcon className="size-3" />
              PR #{String(d.pr ?? "")}
              {d.author ? ` · ${String(d.author)}` : d.check ? ` · ${String(d.check)}` : ""}
            </span>
          ) : (
            <code className="font-mono text-[11px] text-muted-foreground">{run.event.type}</code>
          )}
          {where && <span className="text-muted-foreground"> · {where}</span>}
        </span>
        <span className="text-muted-foreground text-xs" title={new Date(run.started).toLocaleString()}>
          {ago(run.started)}
        </span>
        <span className="text-right font-mono text-[11px] text-muted-foreground tabular-nums">{runTook(run)}</span>
      </button>
      {open && (
        <div className="space-y-1.5 bg-muted/20 px-4 pt-1 pb-3 pl-12">
          {run.error && <p className="text-destructive-foreground text-xs">{run.error}</p>}
          {run.steps.map((s, i) => {
            const m = STEP_KINDS[s.kind];
            return (
              <div key={i} className={cn("rounded-lg border bg-card", s.status === "skipped" && "opacity-60")}>
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs">
                  <m.Icon className={cn("size-3.5", m.tone)} />
                  <span className="font-medium">{s.id || m.label}</span>
                  <span className={cn("ml-auto", s.status === "failed" ? "text-destructive-foreground" : s.status === "succeeded" ? "text-success" : "text-muted-foreground")}>{s.status}</span>
                  {s.kind === "run" && s.status !== "skipped" && <span className="text-muted-foreground">exit {s.exit_code}</span>}
                  {s.duration && <span className="font-mono text-[11px] text-muted-foreground">{s.duration}</span>}
                </div>
                {(s.output || s.error) && (
                  <pre className="max-h-48 overflow-auto border-t px-3 py-2 font-mono text-[11px] text-muted-foreground leading-snug [font-variant-ligatures:none]">{[s.error, s.output].filter(Boolean).join("\n")}</pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}
