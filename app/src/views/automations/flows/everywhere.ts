import { type Flow, type Scope, type ScopedFlow, scopeLocation } from "@/lib/flows";
import type { Project } from "@/lib/project-groups";
import type { BoxFlows } from "@/views/automations/flows/use-flows";

// A flow can run for a project on every box that has it ("Any cal").
// Boxes keep their own flows, so Berth writes one copy into each box's own
// config for the project, and shows the copies as one flow while they match.

export const EVERY_BOX = "*";
export const projectScope = (id: string): Scope => `project:${id}`;
export const scopeProject = (scope: Scope) => (scope.startsWith("project:") ? scope.slice("project:".length) : undefined);

export interface Place {
  box: string;
  scope: Scope;
}

export const samePlace = (a: Place, b: Place) => a.box === b.box && a.scope === b.scope;

// placesOf is where a flow kept at (box, scope) lives: that one place, or,
// for every box, the project on each online box that has it.
export function placesOf(box: string, scope: Scope, projects: Project[]): Place[] {
  if (box !== EVERY_BOX) return [{ box, scope }];
  const p = projects.find((x) => x.id === scopeProject(scope));
  return (p?.members ?? []).filter((m) => m.box.state === "online").map((m) => ({ box: m.box.name, scope: `repo:${m.loc.name}` }));
}

// projectsEverywhere are the projects a flow can run for on every box: those
// on two or more online boxes.
export const projectsEverywhere = (projects: Project[]) => projects.filter((p) => placesOf(EVERY_BOX, projectScope(p.id), projects).length > 1);

export interface Copy extends ScopedFlow {
  box: string;
}

export interface SharedGroup {
  project: Project;
  places: Place[];
  flows: { flow: Flow; copies: Copy[] }[];
}

// sharedFlows finds, for each such project, the flows saved the same on
// every box with it. A copy edited on one box no longer matches, and shows
// under that box again.
export function sharedFlows(projects: Project[], byBox: Record<string, BoxFlows>): SharedGroup[] {
  const out: SharedGroup[] = [];
  for (const project of projectsEverywhere(projects)) {
    const places = placesOf(EVERY_BOX, projectScope(project.id), projects);
    if (places.some((pl) => !byBox[pl.box]?.flows)) continue;
    const lists = places.map((pl) => (byBox[pl.box].flows ?? []).filter((f) => f.scope === pl.scope && f.source === "local" && f.editable).map((f) => ({ ...f, box: pl.box })));
    const flows: SharedGroup["flows"] = [];
    for (const f of lists[0]) {
      const copies = lists.map((l) => l.find((x) => x.flow.id === f.flow.id));
      const same = copies.every((c) => c && JSON.stringify(c.flow) === JSON.stringify(f.flow));
      if (same) flows.push({ flow: f.flow, copies: copies as Copy[] });
    }
    out.push({ project, places, flows });
  }
  return out;
}

// isShared says whether a box's flow is shown as part of a shared one.
export function isShared(groups: SharedGroup[], box: string, f: ScopedFlow): boolean {
  return groups.some((g) => g.flows.some((s) => s.copies.some((c) => c.box === box && c.scope === f.scope && c.flow.id === f.flow.id)));
}

// sharedProjectOf finds the project a run's flow runs for on every box: the
// flow at (box, scope) is one copy of a flow kept the same, by name, at
// every place the project has. name looks a flow up where it lives, or
// gives undefined when it isn't there. Runs only know their own box, so
// this is how Runs tells a shared flow's runs from a box's own.
export function sharedProjectOf(projects: Project[], box: string, scope: Scope, id: string, name: (box: string, scope: Scope, id: string) => string | undefined): Project | undefined {
  const loc = scopeLocation(scope);
  if (!loc) return undefined;
  const p = projects.find((x) => x.members.some((m) => m.box.name === box && m.loc.name === loc));
  if (!p) return undefined;
  const places = placesOf(EVERY_BOX, projectScope(p.id), projects);
  if (places.length < 2 || !places.some((pl) => samePlace(pl, { box, scope }))) return undefined;
  const here = name(box, scope, id);
  return here !== undefined && places.every((pl) => name(pl.box, pl.scope, id) === here) ? p : undefined;
}
