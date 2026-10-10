import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import { Labelled } from "@/components/add-project/clone-form";
import { Button } from "@/components/ui/button";
import { DialogFooter, DialogPanel } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Location } from "@/lib/api";
import { plainError } from "@/lib/errors";
import { locationName, projectsApi } from "@/lib/projects";
import { useStore } from "@/lib/store";
import { ErrorText } from "@/components/error-note";

const paint = stylex.create({
  s0: {
    "display": "contents",
  },
  s1: {
    "display": "grid",
    "gridTemplateColumns": "1fr 11rem",
    "gap": "8px",
  },
  s2: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "13px",
    "color": "var(--muted-foreground)",
  },
  s3: {
    "fontFamily": "var(--font-mono)",
  },
  s4: {
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s5: {
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s6: {
    "color": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },
  s7: {
    "fontSize": "14px",
    "lineHeight": "20px",
    "color": "var(--warning-foreground)",
  },
  s8: {
    "color": "var(--destructive)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// CreateForm starts a project from nothing: a folder with a fresh git
// repository and an empty first commit, so worktrees work right away.
export function CreateForm({ box, onAdded, onCancel }: { box: string; onAdded(loc: Location): Promise<void>; onCancel(): void }) {
  const [name, setName] = useState("");
  const [parent, setParent] = useState("~/work");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const clean = locationName(name);
  const taken = useStore((s) => s.boxes[box]?.locations?.some((l) => l.name === clean));
  const dir = parent.replace(/\/+$/, "") || "~/work";

  const create = async () => {
    const client = useStore.getState().client;
    if (!client || !clean || busy || taken) return;
    setBusy(true);
    setError(undefined);
    try {
      await onAdded(await projectsApi.create(client, box, clean, parent.trim() || undefined));
    } catch (err) {
      setError(plainError(err));
      setBusy(false);
    }
  };

  return (
    <form
      className={sx(paint.s0)}
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <DialogPanel inset="body" stack={3}>
        <div className={sx(paint.s1)}>
          <Labelled label="Name">
            <Input autoFocus value={name} spellCheck={false} placeholder="my-app" onChange={(e) => setName(e.target.value)} />
          </Labelled>
          <Labelled label="In">
            <Input mono value={parent} spellCheck={false} onChange={(e) => setParent(e.target.value)} />
          </Labelled>
        </div>
        <p className={sx(paint.s2)}>
          Creates{" "}
          <span className={sx(paint.s3)}>
            <span className={sx(paint.s4)}>{dir}/</span>
            {clean ? <span className={sx(paint.s5)}>{clean}</span> : <span className={sx(paint.s6)}>my-app</span>}
          </span>{" "}
          with git and an empty first commit.
        </p>
        {taken && <p className={sx(paint.s7)}>{box} already has a project called {clean}.</p>}
        {error && <ErrorText className={sx(paint.s8)} text={error} />}
      </DialogPanel>
      <DialogFooter pad="actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={!clean || taken}>
          Create project
        </Button>
      </DialogFooter>
    </form>
  );
}
