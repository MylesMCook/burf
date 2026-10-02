import { ChevronRightIcon, ClockIcon, FlaskConicalIcon, GitPullRequestIcon } from "lucide-react";
import { useState } from "react";

import { Scene } from "@/components/art/scenes";
import { BoxFilter, shownBoxes } from "@/components/box-filter";
import { FilterChip } from "@/components/filter-chip";
import { SimpleSelect } from "@/components/simple-select";
import { Tip } from "@/components/tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ago } from "@/lib/format";
import { load, save } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useProjects, type Project } from "@/lib/project-groups";
import { CATALOG } from "@/views/automations/catalog";
import { EVERY_BOX, projectScope, sharedProjectOf } from "@/views/automations/flows/everywhere";
import { STEP_KINDS } from "@/views/automations/flows/model";
import { BoxChip, ProjectLabel } from "@/views/automations/flows/project-label";
import { RunStatus, runTook } from "@/views/automations/flows/run-status";
import type { BoxRun } from "@/views/automations/flows/use-runs";

// RunsTab is every flow run on every box, newest first: what started it,
// and each step's outcome and output. Filters work as everywhere: boxes all
// on to start, a flow picked from a list, "Failed" narrowing.
export function RunsTab({ runs, boxes, names }: { runs: BoxRun[]; boxes: string[]; names: (box: string, scope: string, id: string) => string }) {
  const [hidden, setHidden] = useState<string[]>(() => load("berth.runs.hiddenBoxes", []));
  const [flow, setFlow] = useState("");
  const [failed, setFailed] = useState(false);
  const { projects } = useProjects();
  const hide = (next: string[]) => {
    setHidden(next);
    save("berth.runs.hiddenBoxes", next);
  };

  if (runs.length === 0)
    return (
      <Empty className="mt-12">
        <EmptyHeader>
          <EmptyMedia>
            <Scene name="chart" />
          </EmptyMedia>
          <EmptyTitle>No runs yet</EmptyTitle>
          <EmptyDescription>When a flow's trigger fires, or you test one, its run shows up here with every step's output.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  const on = shownBoxes(boxes, hidden);
  // names gives the id back for a flow it doesn't know.
  const known = (box: string, scope: string, id: string) => {
    const n = names(box, scope, id);
    return n === id ? undefined : n;
  };
  // A run of a flow kept on every box with a project says so, so its runs
  // read as that one flow's, whichever box ran them.
  const named = runs.map((r) => ({ run: r, name: names(r.box, r.scope, r.flow), shared: sharedProjectOf(projects, r.box, r.scope, r.flow, known) }));
  const flows = [...new Set(named.map((n) => n.name))].sort((a, b) => a.localeCompare(b));
  const shown = named.filter(({ run, name }) => on.includes(run.box) && (!flow || name === flow) && (!failed || run.status === "failed"));
  const filtered = on.length < boxes.length || !!flow || failed;
  const clear = () => {
    hide([]);
    setFlow("");
    setFailed(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-48">
          <SimpleSelect size="sm" className="min-w-0" value={flow} onChange={setFlow} options={[{ value: "", label: "All flows" }, ...flows.map((f) => ({ value: f, label: f }))]} />
        </div>
        <Tip label="Only runs that failed">
          <FilterChip pressed={failed} onPressedChange={setFailed}>
            Failed
          </FilterChip>
        </Tip>
        {filtered && (
          <Button size="xs" variant="ghost" onClick={clear}>
            Clear filters
          </Button>
        )}
        <BoxFilter className="ml-auto" boxes={boxes} hidden={hidden} onChange={hide} />
      </div>
      {shown.length === 0 ? (
        <Empty className="rounded-xl border py-12">
          <EmptyHeader>
            <EmptyTitle>No runs match</EmptyTitle>
            <EmptyDescription>None of the {runs.length} runs kept passes every filter.</EmptyDescription>
          </EmptyHeader>
          <Button size="sm" variant="outline" onClick={clear}>
            Clear filters
          </Button>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-[20px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_90px_60px] gap-3 border-b px-4 py-2 text-[11px] text-muted-foreground">
            <span />
            <span>Flow</span>
            <span>Where</span>
            <span>Started by</span>
            <span>When</span>
            <span className="text-right">Took</span>
          </div>
          <ol className="divide-y divide-border/70">
            {shown.map(({ run, name, shared }) => (
              <RunRow key={`${run.box}:${run.id}`} run={run} name={name} shared={shared} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// eventLabel names what started a run in words ("Agent finished"); the
// event's id stays in the tooltip.
const eventLabel = (type: string) => CATALOG.find((e) => e.on === type)?.label;

function RunRow({ run, name, shared }: { run: BoxRun; name: string; shared?: Project }) {
  const [open, setOpen] = useState(false);
  const d = run.event.data ?? {};
  const where = (d.name as string) || (d.location as string) || (d.path as string)?.split("/").pop();
  return (
    <li>
      <button type="button" onClick={() => setOpen(!open)} className="grid w-full grid-cols-[20px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_90px_60px] min-h-row items-center gap-3 px-4 py-1 text-left text-sm hover:bg-accent/40">
        <RunStatus status={run.status} />
        <span className="flex min-w-0 items-center gap-1.5">
          <ChevronRightIcon className={cn("size-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
          <span className="truncate font-medium">{name}</span>
          {run.test && (
            <Badge variant="outline" size="sm" className="shrink-0 text-muted-foreground">
              Test
            </Badge>
          )}
        </span>
        {shared ? (
          <Tip label={`One flow kept the same on every box with ${shared.name}. This run was on ${run.box}.`} align="start">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
              <ProjectLabel box={EVERY_BOX} scope={projectScope(shared.id)} chip={false} className="min-w-0" />
              <BoxChip box={run.box} />
            </span>
          </Tip>
        ) : (
          <ProjectLabel box={run.box} scope={run.scope} className="text-muted-foreground text-xs" />
        )}
        <span className="truncate text-xs">
          {run.test ? (
            // Started from the editor, not by an agent or the schedule.
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <FlaskConicalIcon className="size-3" />
              Test run
            </span>
          ) : run.event.type === "schedule.fired" ? (
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
            <Tip label={run.event.type}>
              <span className="text-muted-foreground">{eventLabel(run.event.type) ?? run.event.type}</span>
            </Tip>
          )}
          {where && <span className="text-muted-foreground"> · {where}</span>}
        </span>
        <Tip label={new Date(run.started).toLocaleString()}>
          <span className="text-muted-foreground text-xs">{ago(run.started)}</span>
        </Tip>
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
                  <pre className="max-h-48 overflow-auto border-t px-3 py-2 font-mono text-[11px] text-muted-foreground leading-snug">{[s.error, s.output].filter(Boolean).join("\n")}</pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}
