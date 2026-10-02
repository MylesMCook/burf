import { PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import type { Scope, ScopedFlow } from "@/lib/flows";
import { useProjects } from "@/lib/project-groups";
import { load, save } from "@/lib/storage";
import { NONE, useStore } from "@/lib/store";
import { ViewHeader } from "@/views/view-header";
import { EVERY_BOX, placesOf, projectScope, projectsEverywhere, samePlace } from "@/views/automations/flows/everywhere";
import { type EditTarget, FlowEditor } from "@/views/automations/flows/flow-editor";
import { FlowList } from "@/views/automations/flows/flow-list";
import { blankFlow, type Starter } from "@/views/automations/flows/model";
import { defaultScope } from "@/views/automations/flows/project-label";
import { RunsTab } from "@/views/automations/flows/runs-tab";
import { useFlows } from "@/views/automations/flows/use-flows";
import { useRuns } from "@/views/automations/flows/use-runs";
import { ShellHooks } from "@/views/automations/shell-hooks";

type Tab = "flows" | "runs" | "hooks";

// AutomationsView is what runs on its own: flows (a trigger and steps, per
// box or per repository), their runs, and, for anything a flow can't do,
// raw shell hooks.
export function AutomationsView() {
  const view = useStore((s) => s.view);
  const boxesData = useStore((s) => s.boxes);
  const { boxes, byBox, save: saveFlow, remove, setEnabled } = useFlows();
  const { runs, lastRun: lastRunOn } = useRuns(boxes);
  const { projects } = useProjects();
  const [tab, setTab] = useState<Tab>(() => load("berth.automations.tab", "flows"));
  const [editing, setEditing] = useState<EditTarget>();

  // Every place a new flow can live: a project on every box that has it,
  // then each box, and each repo on it.
  const scopes = useMemo(
    () => [
      ...projectsEverywhere(projects).map((p) => ({ box: EVERY_BOX, scope: projectScope(p.id) })),
      ...boxes.flatMap((box) => [{ box, scope: "box" as Scope }, ...(boxesData[box]?.locations ?? NONE).map((l) => ({ box, scope: `repo:${l.name}` }))]),
    ],
    [boxes, boxesData, projects],
  );

  // A flow for every box last ran wherever it ran last.
  const lastRun = (box: string, scope: string, id: string) =>
    placesOf(box, scope, projects)
      .map((p) => lastRunOn(p.box, p.scope, id))
      .filter((r) => !!r)
      .sort((a, b) => b.started.localeCompare(a.started))[0];

  const open = (box: string, f: ScopedFlow) => setEditing({ box, scope: f.scope, flow: f.flow, savedId: f.flow.id, readOnly: !f.editable });
  const create = (box: string, scope: Scope, starter?: Starter) => setEditing({ box, scope, flow: structuredClone(starter?.flow ?? blankFlow()) });
  // A new flow starts on the project open in the sidebar; "Runs for" in the
  // editor changes it.
  const createHere = (starter?: Starter) => {
    const at = defaultScope();
    if (at) create(at.box, at.scope, starter);
  };

  // Another page (Project settings) can ask for a flow, or a new one.
  const request = view.kind === "automations" ? view.open : undefined;
  useEffect(() => {
    if (!request) return;
    if (!request.id) {
      create(request.box, request.scope);
      useStore.getState().setView({ kind: "automations" });
      return;
    }
    const f = byBox[request.box]?.flows?.find((x) => x.scope === request.scope && x.flow.id === request.id);
    if (f) {
      open(request.box, f);
      useStore.getState().setView({ kind: "automations" });
    }
  }, [request, byBox]);

  const pickTab = (t: Tab) => {
    setTab(t);
    save("berth.automations.tab", t);
  };

  if (editing) {
    return (
      <FlowEditor
        key={`${editing.box}|${editing.scope}|${editing.savedId ?? "new"}|${editing.readOnly ? "ro" : "rw"}`}
        target={editing}
        scopes={scopes}
        onClose={() => setEditing(undefined)}
        onSave={async (box, scope, flow, previousId) => {
          // Saved where it goes (on every box with the project, one copy
          // each), then taken out of anywhere it no longer goes.
          const was = editing.savedId ? placesOf(editing.box, editing.scope, projects) : [];
          const to = placesOf(box, scope, projects);
          if (!to.length) throw new Error("No box with this project is online.");
          for (const p of to) await saveFlow(p.box, p.scope, flow, was.some((w) => samePlace(w, p)) ? previousId : undefined);
          for (const w of was) if (!to.some((p) => samePlace(p, w))) await remove(w.box, w.scope, editing.savedId!);
        }}
        onDelete={
          editing.savedId
            ? async () => {
                for (const w of placesOf(editing.box, editing.scope, projects)) await remove(w.box, w.scope, editing.savedId!);
              }
            : undefined
        }
        onOverride={editing.readOnly ? () => setEditing({ ...editing, readOnly: false, savedId: undefined }) : undefined}
      />
    );
  }

  const nameOf = (box: string, scope: string, id: string) => byBox[box]?.flows?.find((f) => f.scope === scope && f.flow.id === id)?.flow.name ?? id;

  return (
    <div className="flex h-full flex-col">
      <ViewHeader
        title="Automations"
        description="Steps that run on a box when something happens there."
        actions={
          tab !== "hooks" && (
            <Button size="sm" disabled={!scopes.length} onClick={() => createHere()}>
              <PlusIcon />
              New flow
            </Button>
          )
        }
      />
      <Tabs value={tab} onValueChange={(v) => pickTab(v as Tab)} className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b px-6">
          <TabsList variant="underline" className="-mb-px">
            <TabsTab value="flows">Flows</TabsTab>
            <TabsTab value="runs">
              Runs
              {runs.some((r) => r.status === "running") && <span className="ml-1.5 size-1.5 animate-pulse rounded-full bg-primary" />}
            </TabsTab>
            <TabsTab value="hooks">Advanced: shell hooks</TabsTab>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "flows" && (
            <div className="h-full overflow-y-auto px-6 pt-5 pb-12">
              <FlowList boxes={boxes} byBox={byBox} projects={projects} lastRun={lastRun} onEdit={open} onToggle={(box, f, on) => void setEnabled(box, f, on)} onNew={create} onStarter={(st) => createHere(st)} />
            </div>
          )}
          {tab === "runs" && (
            <div className="h-full overflow-y-auto px-6 pt-5 pb-12">
              <RunsTab runs={runs} boxes={boxes} names={nameOf} />
            </div>
          )}
          {tab === "hooks" && (
            <div className="h-full pt-4">
              <ShellHooks />
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
