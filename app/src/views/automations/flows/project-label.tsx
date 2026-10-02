import { FolderGitIcon, LayersIcon } from "lucide-react";

import { type Scope, scopeLocation } from "@/lib/flows";
import { useProjects } from "@/lib/project-groups";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { currentSpace } from "@/lib/workspaces";
import { EVERY_BOX, type Place, scopeProject } from "@/views/automations/flows/everywhere";

// BoxChip names a box the way the sidebar does.
export function BoxChip({ box, className }: { box: string; className?: string }) {
  return <span className={cn("inline-flex h-4 shrink-0 items-center rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground leading-none", className)}>{box}</span>;
}

// ProjectLabel names where a flow runs: a project as "cal · calcom/cal" on
// its box, every project on a box, or a project on every box that has it.
export function ProjectLabel({ box, scope, className, chip = true }: { box: string; scope: Scope; className?: string; chip?: boolean }) {
  if (box === EVERY_BOX) return <EveryBoxLabel scope={scope} className={className} chip={chip} />;
  return <OneBoxLabel box={box} scope={scope} className={className} chip={chip} />;
}

function OneBoxLabel({ box, scope, className, chip }: { box: string; scope: Scope; className?: string; chip: boolean }) {
  const loc = scopeLocation(scope);
  const slug = useStore((s) => (loc ? s.boxes[box]?.locations?.find((l) => l.name === loc)?.slug : undefined));
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      {loc ? <FolderGitIcon className="size-3.5 shrink-0 text-muted-foreground" /> : <LayersIcon className="size-3.5 shrink-0 text-muted-foreground" />}
      <span className="truncate">
        {loc ?? "All projects"}
        {slug && <span className="text-muted-foreground"> · {slug}</span>}
      </span>
      {chip && <BoxChip box={box} />}
    </span>
  );
}

// EveryBoxLabel names a project on every box that has it by the name the
// sidebar gives it, its repository muted after ("Any cal · calcom/cal.com"),
// and its boxes.
function EveryBoxLabel({ scope, className, chip }: { scope: Scope; className?: string; chip: boolean }) {
  const { projects } = useProjects();
  const p = projects.find((x) => x.id === scopeProject(scope));
  const boxes = p?.members.filter((m) => m.box.state === "online").map((m) => m.box.name) ?? [];
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <FolderGitIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">
        Any {p?.name ?? "project"}
        {p?.slug && p.slug !== p.name && <span className="text-muted-foreground"> · {p.slug}</span>}
      </span>
      {chip && boxes.map((b) => <BoxChip key={b} box={b} />)}
    </span>
  );
}

const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

// savedWhere says in a line where a flow lives, so it is never a surprise.
// places is where a flow for every box is written.
export function savedWhere(box: string, scope: Scope, committed?: boolean, places?: Place[]): string {
  if (box === EVERY_BOX) {
    const boxes = (places ?? []).map((p) => p.box);
    return boxes.length ? `Saved on ${list(boxes)}, the same on each · not committed. Boxes that get the project later don't have it yet.` : "No box with this project is online.";
  }
  const loc = scopeLocation(scope);
  if (committed) return "Saved in the repo's .berth/config.json";
  return loc ? `Saved on ${box} for ${loc} · not committed` : `Saved on ${box} · runs for every project there`;
}

// defaultScope is where a new flow goes: the project open in the sidebar,
// else the first project on the first box that has one.
export function defaultScope(): { box: string; scope: Scope } | undefined {
  const ref = currentSpace()?.ref;
  if (ref) return { box: ref.box, scope: `repo:${ref.location}` };
  const { status, boxes } = useStore.getState();
  const online = status?.boxes.filter((b) => b.state === "online").map((b) => b.name) ?? [];
  for (const b of online) {
    const loc = boxes[b]?.locations?.[0];
    if (loc) return { box: b, scope: `repo:${loc.name}` };
  }
  return online[0] ? { box: online[0], scope: "box" } : undefined;
}
