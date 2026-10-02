import { ArrowLeftIcon, ChevronRightIcon, FolderOpenIcon, FolderPlusIcon, GitForkIcon, ServerIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { CloneForm } from "@/components/add-project/clone-form";
import { CreateForm } from "@/components/add-project/create-form";
import { FolderBrowser } from "@/components/add-project/folder-browser";
import { Picker } from "@/components/new-worktree/picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Kbd } from "@/components/ui/kbd";
import { toastManager } from "@/components/ui/toast";
import type { Location } from "@/lib/api";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { selectWorktree } from "@/lib/workspaces";

type View = "home" | "browse" | "clone" | "create";

const titles: Record<View, string> = { home: "Add a project", browse: "Browse folders", clone: "Clone from URL", create: "Create new project" };

const descriptions: Record<View, (box: string) => string> = {
  home: (box) => `A git repository on ${box}. Worktrees and agents work inside it.`,
  browse: (box) => `Pick a repository or folder on ${box}.`,
  clone: (box) => `${box} clones it with its own git credentials.`,
  create: (box) => `An empty repository on ${box}, ready for worktrees.`,
};

// AddProjectDialog adds a repository on a box as a project: one already
// there, a clone, or a new empty one. The project then opens.
export function AddProjectDialog() {
  const draft = useStore((s) => s.locationDraft);
  return (
    <Dialog open={!!draft} onOpenChange={(open) => !open && useStore.getState().closeAddLocation()}>
      <DialogPopup className="sm:max-w-[34rem]" showCloseButton={false}>
        {draft && <Body key={draft.box ?? ""} startBox={draft.box} />}
      </DialogPopup>
    </Dialog>
  );
}

function Body({ startBox }: { startBox?: string }) {
  const status = useStore((s) => s.status);
  const boxes = useMemo(() => status?.boxes ?? [], [status]);
  const firstOnline = boxes.find((b) => b.state === "online")?.name ?? "";
  const [box, setBox] = useState(startBox && boxes.some((b) => b.name === startBox) ? startBox : firstOnline);
  const [view, setView] = useState<View>("home");
  const online = boxes.find((b) => b.name === box)?.state === "online";

  useEffect(() => {
    if (!box && firstOnline) setBox(firstOnline);
  }, [box, firstOnline]);

  const added = async (loc: Location) => {
    const st = useStore.getState();
    const known = st.boxes[box]?.locations?.some((l) => l.name === loc.name && l.path === loc.path);
    await st.refreshBox(box, ["locations"]);
    const main = loc.worktrees?.find((w) => w.main) ?? { name: loc.name, path: loc.path, main: true };
    st.closeAddLocation();
    selectWorktree({ box, location: loc.name, worktree: main.name, path: main.path, main: true });
    if (!known) toastManager.add({ title: `Added ${loc.name}`, description: `${loc.path} on ${box}`, type: "success" });
  };

  const close = () => useStore.getState().closeAddLocation();

  return (
    <>
      <DialogHeader className="flex-row items-start gap-3 px-5 pt-5 pb-3">
        {view !== "home" && (
          <Button size="icon-sm" variant="ghost" aria-label="Back" className="-ms-1.5 -mt-0.5" onClick={() => setView("home")}>
            <ArrowLeftIcon />
          </Button>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <DialogTitle className="text-base">{titles[view]}</DialogTitle>
          <DialogDescription className="truncate text-[13px]">{box ? descriptions[view](box) : "Pair a box first."}</DialogDescription>
        </div>
        <div className="max-w-48 shrink-0">
          <Picker
            variant="chip"
            aria-label="Host"
            value={box}
            onChange={setBox}
            placeholder="Choose a box"
            searchPlaceholder="Search boxes…"
            items={boxes.map((b) => ({
              value: b.name,
              label: b.name,
              disabled: b.state !== "online",
              icon: <ServerIcon className="size-3.5 shrink-0 text-muted-foreground" />,
              detail: b.state === "online" ? undefined : b.state,
              trailing: (
                <span className="flex items-center gap-1.5">
                  <span className={cn("size-1.5 rounded-full", b.state === "online" ? "bg-success" : "bg-muted-foreground/40")} />
                  {b.state === "online" && b.latency_ms !== undefined ? `${b.latency_ms}ms` : ""}
                </span>
              ),
            }))}
          />
        </div>
      </DialogHeader>

      {!online ? (
        <>
          <DialogPanel className="px-5 pb-5">
            <Frame className="rounded-xl">
              <FramePanel className="rounded-[10px] p-6 text-center text-muted-foreground text-sm shadow-none before:hidden">
                {box ? `${box} is offline.` : "No box is online."} Projects are added on a box that is.
              </FramePanel>
            </Frame>
          </DialogPanel>
          <DialogFooter className="px-5 py-3">
            <Button variant="ghost" onClick={close}>
              Close
            </Button>
          </DialogFooter>
        </>
      ) : view === "home" ? (
        <Home box={box} onPick={setView} onClose={close} />
      ) : view === "browse" ? (
        <FolderBrowser box={box} onAdded={added} />
      ) : view === "clone" ? (
        <CloneForm box={box} onAdded={added} onCancel={close} />
      ) : (
        <CreateForm box={box} onAdded={added} onCancel={close} />
      )}
    </>
  );
}

function Home({ box, onPick, onClose }: { box: string; onPick(v: View): void; onClose(): void }) {
  const browse = useRef<HTMLButtonElement>(null);
  // The dialog focuses its first control, the host chip; Browse is the
  // usual next step.
  useEffect(() => {
    const t = setTimeout(() => browse.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  // Enter browses, as the card's hint says.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        onPick("browse");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPick]);

  return (
    <>
      <DialogPanel className="px-5 pb-5">
        <Frame className="rounded-xl p-0.5">
          <FramePanel className="rounded-[10px] p-0 shadow-none before:hidden dark:bg-input/32">
            <button ref={browse} type="button" onClick={() => onPick("browse")} className="flex w-full items-center gap-3 rounded-[10px] p-3 text-left outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/40">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/72">
                <FolderOpenIcon className="size-4.5" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium text-sm">Browse folders</span>
                <span className="truncate text-[13px] text-muted-foreground">An existing git repository or folder on {box}</span>
              </span>
              <Kbd className="ml-auto">↵</Kbd>
            </button>
          </FramePanel>
          <p className="px-3 pt-2.5 pb-1.5 text-muted-foreground text-xs">Other ways to add</p>
          <FramePanel className="rounded-[10px] p-0 shadow-none before:hidden dark:bg-input/32">
            <Way icon={<GitForkIcon className="size-4" />} title="Clone from URL" detail="Clone a GitHub, GitLab or any git remote" onClick={() => onPick("clone")} />
            <div className="mx-3 border-t" />
            <Way icon={<FolderPlusIcon className="size-4" />} title="Create new project" detail="Start from an empty folder" onClick={() => onPick("create")} />
          </FramePanel>
        </Frame>
      </DialogPanel>
      <DialogFooter className="items-center px-5 py-3 sm:justify-between">
        <span className="text-[13px] text-muted-foreground">Projects live on a box, not this laptop.</span>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </DialogFooter>
    </>
  );
}

function Way({ icon, title, detail, onClick }: { icon: React.ReactNode; title: string; detail: string; onClick(): void }) {
  return (
    <button type="button" data-way onClick={onClick} className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring/40">
      <span className="inline-flex size-9 shrink-0 items-center justify-center text-muted-foreground">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-sm">{title}</span>
        <span className="truncate text-[13px] text-muted-foreground">{detail}</span>
      </span>
      <ChevronRightIcon className="ml-auto size-4 text-muted-foreground" />
    </button>
  );
}
