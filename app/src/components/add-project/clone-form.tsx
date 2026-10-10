import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DialogFooter, DialogPanel } from "@/components/ui/dialog";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
import type { Location } from "@/lib/api";
import { plainError } from "@/lib/errors";
import { projectsApi, repoName } from "@/lib/projects";
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
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s4: {
    "maxHeight": "160px",
    "overflowY": "auto",
    "whiteSpace": "pre-wrap",
    "padding": "12px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "color": "var(--muted-foreground)",
    "lineHeight": "1.625",
  },
  s5: {
    "color": "var(--destructive)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s6: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "6px",
  },
  s7: {
    "fontWeight": 500,
    "fontSize": "13px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// CloneForm clones a repository onto the box, showing git's progress as it
// goes, and adds it as a project.
export function CloneForm({ box, onAdded, onCancel }: { box: string; onAdded(loc: Location): Promise<void>; onCancel(): void }) {
  const [url, setUrl] = useState("");
  const [parent, setParent] = useState("~/work");
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const abort = useRef<AbortController>(null);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines]);

  const shownName = nameEdited ? name : repoName(url);

  const clone = async () => {
    const client = useStore.getState().client;
    if (!client || !url.trim() || busy) return;
    setBusy(true);
    setError(undefined);
    setLines([]);
    abort.current = new AbortController();
    try {
      const loc = await projectsApi.clone(client, box, { url: url.trim(), parent: parent.trim() || undefined, name: shownName.trim() || undefined }, (line) => setLines((l) => mergeProgress(l, line)), abort.current.signal);
      await onAdded(loc);
    } catch (err) {
      setError(abort.current?.signal.aborted ? "Stopped." : plainError(err));
      setBusy(false);
    }
  };

  return (
    <form
      className={sx(paint.s0)}
      onSubmit={(e) => {
        e.preventDefault();
        void clone();
      }}
    >
      <DialogPanel inset="body" stack={3}>
        <Labelled label="Repository URL">
          <Input autoFocus mono disabled={busy} value={url} spellCheck={false} placeholder="https://github.com/acme/shop" onChange={(e) => setUrl(e.target.value)} />
        </Labelled>
        <div className={sx(paint.s1)}>
          <Labelled label="Into">
            <Input mono disabled={busy} value={parent} spellCheck={false} onChange={(e) => setParent(e.target.value)} />
          </Labelled>
          <Labelled label="Folder">
            <Input
              mono
              disabled={busy}
              value={shownName}
              spellCheck={false}
              placeholder="from the URL"
              onChange={(e) => {
                setName(e.target.value);
                setNameEdited(true);
              }}
            />
          </Labelled>
        </div>
        <p className={sx(paint.s2)}>
          Clones to <span className={sx(paint.s3)}>{`${parent.replace(/\/+$/, "") || "~/work"}/${shownName || "…"}`}</span> on {box}
        </p>
        {(busy || lines.length > 0) && (
          <Frame radius="xl" tray>
            <FramePanel bare>
              <pre ref={logRef} aria-live="polite" className={sx(paint.s4)}>
                {lines.length ? lines.join("\n") : "Starting git clone…"}
              </pre>
            </FramePanel>
          </Frame>
        )}
        {error && <ErrorText className={sx(paint.s5)} text={error} />}
      </DialogPanel>
      <DialogFooter pad="actions">
        {busy ? (
          <Button type="button" variant="ghost" onClick={() => abort.current?.abort()}>
            Stop
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={busy} disabled={!url.trim()}>
          Clone and add
        </Button>
      </DialogFooter>
    </form>
  );
}

export function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={sx(paint.s6)}>
      <span className={sx(paint.s7)}>{label}</span>
      {children}
    </label>
  );
}

// mergeProgress keeps git's "Receiving objects: 42%" lines from piling up:
// a line that updates the same step replaces the last one.
function mergeProgress(lines: string[], line: string): string[] {
  const step = (l: string) => /^([A-Za-z ]+):\s+\d+%/.exec(l)?.[1];
  const s = step(line);
  if (s && lines.length && step(lines[lines.length - 1]) === s) return [...lines.slice(0, -1), line];
  return [...lines, line].slice(-200);
}
