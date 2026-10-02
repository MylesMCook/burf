import { ArrowLeftIcon, ChevronRightIcon, FolderGit2Icon, FolderOpenIcon, FolderPlusIcon, GitForkIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { CloneForm } from "@/components/add-project/clone-form";
import { CreateForm } from "@/components/add-project/create-form";
import { FolderBrowser } from "@/components/add-project/folder-browser";
import { Button } from "@/components/ui/button";
import type { Location } from "@/lib/api";
import { NONE, useStore } from "@/lib/store";

type Way = "browse" | "clone" | "create";

const wayTitles: Record<Way, string> = { browse: "Browse folders", clone: "Clone from URL", create: "Create a new project" };

// RepoStep adds the first project on the new box, the same three ways the
// Add a project dialog offers: a repository already there, a clone, or a
// new empty one. A box that already has projects can go straight on.
// Skipping is the page's "Skip setup", beside the progress.
export function RepoStep({ box, onDone }: { box: string; onDone(location: string): void }) {
  const existing = useStore((s) => s.boxes[box]?.locations ?? NONE);
  const [way, setWay] = useState<Way>();

  const added = async (loc: Location) => {
    await useStore.getState().refreshBox(box, ["locations"]);
    onDone(loc.name);
  };

  return (
    <div>
      <h1 className="font-semibold text-xl tracking-tight">Add a project on {box}</h1>
      <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
        A git repository on the box. Each piece of work gets its own worktree beside it, so agents never trip over each other.
      </p>

      {way ? (
        <div className="mt-6">
          <Button size="xs" variant="ghost" className="-ml-2 mb-2 text-muted-foreground" onClick={() => setWay(undefined)}>
            <ArrowLeftIcon /> {wayTitles[way]}
          </Button>
          {/* The Add a project forms, in a frame shaped like their dialog. */}
          <div data-slot="dialog-popup" className="overflow-hidden rounded-2xl border bg-popover pt-1">
            {way === "browse" && <FolderBrowser box={box} onAdded={added} />}
            {way === "clone" && <CloneForm box={box} onAdded={added} onCancel={() => setWay(undefined)} />}
            {way === "create" && <CreateForm box={box} onAdded={added} onCancel={() => setWay(undefined)} />}
          </div>
        </div>
      ) : (
        <>
          {existing.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-muted-foreground text-xs">Already on {box}</div>
              <ul className="divide-y divide-border/70 rounded-xl border">
                {existing.map((l) => (
                  <li key={l.name} className="flex items-center gap-3 px-3.5 py-2.5">
                    <FolderGit2Icon className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">{l.name}</div>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">{l.path}</div>
                    </div>
                    <Button size="xs" variant="outline" onClick={() => onDone(l.name)}>
                      Use this
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-6 space-y-2">
            {existing.length > 0 && <div className="text-muted-foreground text-xs">Or add another</div>}
            <WayButton icon={<FolderOpenIcon />} title="Browse folders" detail={`A repository already cloned on ${box}`} onClick={() => setWay("browse")} />
            <WayButton icon={<GitForkIcon />} title="Clone from URL" detail="GitHub, GitLab or any git remote, cloned by the box" onClick={() => setWay("clone")} />
            <WayButton icon={<FolderPlusIcon />} title="Create a new project" detail="An empty repository, ready for worktrees" onClick={() => setWay("create")} />
          </div>
        </>
      )}
    </div>
  );
}

function WayButton({ icon, title, detail, onClick }: { icon: ReactNode; title: string; detail: string; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-xl border bg-card/40 px-4 py-3 text-left outline-none transition-colors hover:border-foreground/20 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{title}</span>
        <span className="mt-0.5 block truncate text-muted-foreground text-xs">{detail}</span>
      </span>
      <ChevronRightIcon className="size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
