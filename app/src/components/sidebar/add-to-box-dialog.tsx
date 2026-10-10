import { CheckIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { create } from "zustand";

import { type Option, SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";
import type { Location } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { Project } from "@/lib/project-groups";
import { scheduleRefresh, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { boxLoad } from "@/components/sidebar/box-load";
import { ErrorText } from "@/components/error-note";

// Add to box clones a project's repository onto a box that does not have it
// yet, with git's progress as it goes. The new copy joins the project by its remote.

const useAddToBox = create<{ project?: Project }>()(() => ({}));

export function openAddToBox(project: Project) {
  useAddToBox.setState({ project });
}

export function AddToBoxDialog() {
  const project = useAddToBox((s) => s.project);
  return (
    <Dialog open={!!project} onOpenChange={(o) => !o && useAddToBox.setState({ project: undefined })}>
      <DialogPopup>{project && <Body key={project.id} project={project} />}</DialogPopup>
    </Dialog>
  );
}

function Body({ project }: { project: Project }) {
  const status = useStore((s) => s.status);
  const has = new Set(project.members.map((m) => m.box.name));
  const candidates = (status?.boxes ?? []).filter((b) => b.state === "online" && !has.has(b.name));
  const [box, setBox] = useState(candidates[0]?.name ?? "");
  const [parent, setParent] = useState("~/work");
  const [lines, setLines] = useState<string[]>([]);
  const [phase, setPhase] = useState<"form" | "cloning" | "done" | "failed">("form");
  const [error, setError] = useState<string>();
  const log = useRef<HTMLPreElement>(null);
  const abort = useRef<AbortController>(null);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [lines]);
  useEffect(() => () => abort.current?.abort(), []);

  const options: Option[] = candidates.map((b) => ({ value: b.name, label: `${b.name}${boxLoad(b.name) ? ` · ${boxLoad(b.name)}` : ""}` }));

  const run = async () => {
    const client = useStore.getState().client;
    if (!client || !project.remote || !box) return;
    setPhase("cloning");
    setError(undefined);
    setLines([]);
    abort.current = new AbortController();
    // git redraws its progress lines; keep the latest of each kind.
    const add = (l: string) =>
      setLines((ls) => {
        const kind = l.split(":")[0];
        const last = ls[ls.length - 1];
        return last && last.split(":")[0] === kind && /\d+%/.test(l) ? [...ls.slice(0, -1), l] : [...ls, l];
      });
    let loc: Location | undefined;
    let failure: string | undefined;
    try {
      await client.stream(
        "POST",
        `/v1/boxes/${encodeURIComponent(box)}/api/locations/clone`,
        { url: project.remote, parent: parent.trim() || "~/work" },
        (v) => {
          const m = v as { line?: string; done?: boolean; error?: string; location?: Location };
          if (m.line) add(m.line);
          if (m.done) {
            failure = m.error;
            loc = m.location;
          }
        },
        abort.current.signal,
      );
    } catch (err) {
      failure = errorMessage(err);
    }
    if (failure || !loc) {
      setError(failure ?? "The box stopped answering before the clone finished.");
      setPhase("failed");
      return;
    }
    scheduleRefresh(box, ["locations"]);
    setPhase("done");
    toastManager.add({ title: `${project.name} is on ${box}`, description: loc.path, type: "success" });
  };

  const busy = phase === "cloning";
  return (
    <>
      <DialogHeader>
        <DialogTitle>Add {project.name} to a box</DialogTitle>
        <DialogDescription>Clones its repository there; it joins this project with the boxes that already have it.</DialogDescription>
      </DialogHeader>
      <DialogPanel stack={4}>
        {phase === "form" ? (
          candidates.length === 0 ? (
            <p className="text-muted-foreground text-sm">Every online box already has {project.name}.</p>
          ) : (
            <>
              <Field>
                <FieldLabel>Box</FieldLabel>
                <SimpleSelect options={options} value={box} onChange={setBox} />
              </Field>
              <Field>
                <FieldLabel>Into folder</FieldLabel>
                <Input value={parent} mono onChange={(e) => setParent(e.target.value)} />
                <FieldDescription className="truncate">
                  Clones <span className="font-mono">{project.remote}</span>
                </FieldDescription>
              </Field>
            </>
          )
        ) : (
          <>
            <pre ref={log} className="max-h-56 min-h-24 overflow-auto rounded-md bg-muted/60 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {lines.join("\n") || "Starting…"}
            </pre>
            {phase === "done" && (
              <p className="flex items-center gap-1.5 text-sm">
                <CheckIcon className="size-4 text-success" /> {project.name} is on {box}.
              </p>
            )}
            {error && <ErrorText className="text-destructive-foreground text-sm" text={error} />}
          </>
        )}
      </DialogPanel>
      <DialogFooter>
        {phase === "done" ? (
          <DialogClose render={<Button />}>Done</DialogClose>
        ) : (
          <>
            <DialogClose render={<Button variant="ghost" />} onClick={() => abort.current?.abort()}>
              {busy ? "Stop" : "Cancel"}
            </DialogClose>
            <span className={cn(phase === "failed" && "min-w-24")}><Button  loading={busy} disabled={!box || !project.remote || candidates.length === 0} onClick={() => void run()}>
              {phase === "failed" ? "Try again" : `Clone to ${box || "box"}`}
            </Button></span>
          </>
        )}
      </DialogFooter>
    </>
  );
}
