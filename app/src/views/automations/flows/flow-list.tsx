import { LockIcon, PlusIcon, Settings2Icon, WorkflowIcon } from "lucide-react";

import { Scene } from "@/components/art/scenes";
import { openProjectSettings } from "@/components/skills/project-settings-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { FlowRun, Scope, ScopedFlow } from "@/lib/flows";
import { scopeLocation } from "@/lib/flows";
import { ago } from "@/lib/format";
import type { Project } from "@/lib/project-groups";
import { cn } from "@/lib/utils";
import { EVERY_BOX, isShared, projectScope, type SharedGroup, sharedFlows } from "@/views/automations/flows/everywhere";
import { STARTERS, STEP_KINDS, type Starter, summary } from "@/views/automations/flows/model";
import { ProjectLabel } from "@/views/automations/flows/project-label";
import { RunStatus } from "@/views/automations/flows/run-status";
import type { BoxFlows } from "@/views/automations/flows/use-flows";
import { Tip } from "@/components/tip";

interface Group {
  box: string;
  scope: Scope;
  flows: ScopedFlow[];
}

// groupsOf orders a box's flows by where they live: the box's own first,
// then each repository's.
function groupsOf(bf: BoxFlows, shared: SharedGroup[]): Group[] {
  const byScope = new Map<Scope, ScopedFlow[]>([["box", []]]);
  for (const f of bf.flows ?? []) if (!isShared(shared, bf.box, f)) byScope.set(f.scope, [...(byScope.get(f.scope) ?? []), f]);
  return [...byScope.entries()].sort(([a], [b]) => (a === "box" ? -1 : b === "box" ? 1 : a.localeCompare(b))).map(([scope, flows]) => ({ box: bf.box, scope, flows }));
}

export function FlowList({
  boxes,
  byBox,
  projects,
  lastRun,
  onEdit,
  onToggle,
  onNew,
  onStarter,
}: {
  boxes: string[];
  byBox: Record<string, BoxFlows>;
  projects: Project[];
  lastRun(box: string, scope: string, id: string): FlowRun | undefined;
  onEdit(box: string, f: ScopedFlow): void;
  onToggle(box: string, f: ScopedFlow, on: boolean): void;
  onNew(box: string, scope: Scope): void;
  onStarter(s: Starter): void;
}) {
  const loaded = boxes.filter((b) => byBox[b]?.flows);
  const total = loaded.reduce((n, b) => n + (byBox[b].flows?.length ?? 0), 0);
  const firstBox = boxes[0];
  // Flows saved the same on every box with their project show once, first.
  const shared = sharedFlows(projects, byBox).filter((g) => g.flows.length);

  return (
    <div className="space-y-8">
      {/* No flows on any box yet: a course plotted, not yet sailed. */}
      {!total && boxes.length > 0 && loaded.length === boxes.length && (
        <div className="flex items-center gap-5 px-1">
          <Scene name="chart" width={112} />
          <div className="min-w-0">
            <p className="font-medium text-sm">No flows yet</p>
            <p className="mt-0.5 max-w-md text-muted-foreground text-xs">A flow runs steps on a box when something happens, or on a schedule. Start with one of these and change it to fit.</p>
          </div>
        </div>
      )}
      <section>
        <h2 className="mb-2.5 font-medium text-[13px] text-muted-foreground">{total ? "Start from a template" : "Start with one of these"}</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2">
          {STARTERS.map((s) => {
            const kinds = [...new Set(s.flow.steps.map((x) => x.kind))];
            return (
              <button
                key={s.id}
                type="button"
                disabled={!firstBox}
                onClick={() => onStarter(s)}
                className="group flex min-h-28 flex-col gap-2 rounded-xl border bg-card px-3.5 py-3 text-left transition-colors hover:border-ring/40 disabled:opacity-50"
              >
                <span className="flex items-center gap-1">
                  {kinds.map((k) => {
                    const m = STEP_KINDS[k];
                    return (
                      <span key={k} className={cn("inline-flex size-6 items-center justify-center rounded-md bg-muted", m.tone)}>
                        <m.Icon className="size-3.5" />
                      </span>
                    );
                  })}
                </span>
                <span>
                  <span className="block font-medium text-sm leading-snug">{s.title}</span>
                  <span className="mt-0.5 block text-muted-foreground text-xs">{s.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {shared.map((g) => (
        <SharedSection key={g.project.id} group={g} lastRun={lastRun} onEdit={onEdit} onToggle={onToggle} onNew={onNew} />
      ))}

      {boxes.map((box) => {
        const bf = byBox[box];
        if (!bf) return <Skeleton key={box} className="h-24 rounded-xl" />;
        if (bf.error)
          return (
            <section key={box} className="rounded-xl border px-4 py-3 text-muted-foreground text-sm">
              <span className="font-medium text-foreground">{box}</span>: couldn't read its flows ({bf.error}).
              {/404|not found/i.test(bf.error) && " Its berthd predates flows; upgrade it from Settings → Boxes."}
            </section>
          );
        return groupsOf(bf, shared).map((g) => <ScopeGroup key={`${box}|${g.scope}`} group={g} lastRun={lastRun} onEdit={onEdit} onToggle={onToggle} onNew={onNew} />);
      })}
    </div>
  );
}

function ScopeGroup({
  group,
  lastRun,
  onEdit,
  onToggle,
  onNew,
}: {
  group: Group;
  lastRun(box: string, scope: string, id: string): FlowRun | undefined;
  onEdit(box: string, f: ScopedFlow): void;
  onToggle(box: string, f: ScopedFlow, on: boolean): void;
  onNew(box: string, scope: Scope): void;
}) {
  const { box, scope, flows } = group;
  const loc = scopeLocation(scope);
  // A committed flow overridden on this box shows once, as the override.
  const shown = flows.filter((f) => !(f.source === "repo" && flows.some((o) => o.source === "local" && o.flow.id === f.flow.id)));

  return (
    <section>
      <header className="mb-2.5 flex items-center gap-2">
        <h2 className="min-w-0 font-medium text-[13px]">
          <ProjectLabel box={box} scope={scope} />
        </h2>
        <span className="text-muted-foreground text-xs tabular-nums">{shown.length}</span>
        <span className="ml-auto flex items-center gap-1">
          {loc && (
            <Button size="xs" variant="ghost" onClick={() => openProjectSettings(box, loc)}>
              <Settings2Icon />
              Project settings
            </Button>
          )}
          <Button size="xs" variant="ghost" onClick={() => onNew(box, scope)}>
            <PlusIcon />
            New flow
          </Button>
        </span>
      </header>
      {shown.length === 0 ? (
        <button
          type="button"
          onClick={() => onNew(box, scope)}
          className="flex w-full items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-left text-muted-foreground text-sm hover:border-ring/40 hover:text-foreground"
        >
          <WorkflowIcon className="size-4" />
          No flows {loc ? `for ${loc}` : `for every project on ${box}`} yet. Make one, or start from a template above.
        </button>
      ) : (
        <div className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-card">
          {shown.map((f) => (
            <FlowRow key={`${f.source}:${f.flow.id}`} f={f} run={lastRun(box, scope, f.flow.id)} onEdit={() => onEdit(box, f)} onToggle={(on) => onToggle(box, f, on)} overridden={f.source === "local" && flows.some((o) => o.source === "repo" && o.flow.id === f.flow.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

// SharedSection is a project's flows on every box that has it, each one
// flow standing for its copies; switching it switches every copy.
function SharedSection({
  group,
  lastRun,
  onEdit,
  onToggle,
  onNew,
}: {
  group: SharedGroup;
  lastRun(box: string, scope: string, id: string): FlowRun | undefined;
  onEdit(box: string, f: ScopedFlow): void;
  onToggle(box: string, f: ScopedFlow, on: boolean): void;
  onNew(box: string, scope: Scope): void;
}) {
  const scope = projectScope(group.project.id);
  return (
    <section>
      <header className="mb-2.5 flex items-center gap-2">
        <h2 className="min-w-0 font-medium text-[13px]">
          <ProjectLabel box={EVERY_BOX} scope={scope} />
        </h2>
        <span className="text-muted-foreground text-xs tabular-nums">{group.flows.length}</span>
        <span className="ml-auto">
          <Button size="xs" variant="ghost" onClick={() => onNew(EVERY_BOX, scope)}>
            <PlusIcon />
            New flow
          </Button>
        </span>
      </header>
      <div className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-card">
        {group.flows.map(({ flow, copies }) => (
          <FlowRow
            key={flow.id}
            f={{ ...copies[0], scope }}
            // Each box runs its own copy: the latest run of any of them.
            run={copies
              .map((c) => lastRun(c.box, c.scope, flow.id))
              .filter((r): r is FlowRun => !!r)
              .sort((a, b) => b.started.localeCompare(a.started))[0]}
            onEdit={() => onEdit(EVERY_BOX, { ...copies[0], scope })}
            onToggle={(on) => copies.forEach((c) => onToggle(c.box, c, on))}
            overridden={false}
          />
        ))}
      </div>
    </section>
  );
}

function FlowRow({ f, run, onEdit, onToggle, overridden }: { f: ScopedFlow; run?: FlowRun; onEdit(): void; onToggle(on: boolean): void; overridden: boolean }) {
  const { flow } = f;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => e.key === "Enter" && onEdit()}
      className={cn("group flex cursor-pointer items-center gap-4 px-4 py-row-pad outline-none hover:bg-accent/40 focus-visible:bg-accent/40", !flow.enabled && "opacity-60")}
    >
      <span className="flex shrink-0 items-center -space-x-1">
        {[...new Set(flow.steps.map((s) => s.kind))].slice(0, 3).map((k) => {
          const m = STEP_KINDS[k];
          return (
            <span key={k} className={cn("inline-flex size-6 items-center justify-center rounded-md border-2 border-card bg-muted", m.tone)}>
              <m.Icon className="size-3.5" />
            </span>
          );
        })}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-sm">{flow.name}</span>
          {f.source === "repo" && (
            <Tip label="Committed in the repository's .berth/config.json">
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-px text-[11px] text-muted-foreground">
                <LockIcon className="size-2.5" />
                In repo
              </span>
            </Tip>
          )}
          {overridden && <span className="shrink-0 rounded-md border border-ring/30 px-1.5 py-px text-[11px] text-muted-foreground">Overridden here</span>}
        </div>
        <p className="mt-0.5 truncate text-muted-foreground text-xs">{summary(flow)}</p>
      </div>
      <div className="flex w-36 shrink-0 items-center justify-end gap-1.5 text-muted-foreground text-xs">
        {run ? (
          <>
            <RunStatus status={run.status} />
            <Tip label={new Date(run.started).toLocaleString()}>
              <span>{ago(run.started)}</span>
            </Tip>
          </>
        ) : (
          <span className="opacity-60">Never run</span>
        )}
      </div>
      {/* The switch acts on the flow, not the row that opens it. */}
      <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="flex shrink-0">
        <Switch checked={flow.enabled} onCheckedChange={onToggle} aria-label={flow.enabled ? `Turn off ${flow.name}` : `Turn on ${flow.name}`} />
      </span>
    </div>
  );
}
