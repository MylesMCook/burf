import { useEffect, useMemo, useState } from "react";

import { PickOne } from "@/components/pick-one";
import { Tip } from "@/components/tip";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { ExecResult } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { committedDiffCommand, describeCode, type DiffLine, diffCommand, type FileChange, parseDiff, splitRows } from "@/lib/git/parse";
import { load, save } from "@/lib/storage";
import { cn } from "@/lib/utils";

// The app's diff viewer: a file list and a unified or split diff, read with
// git on the box. The built-in Git changes plugin draws the same thing with
// the plugin kit; both parse with lib/git/parse.

export type Run = (command: string) => Promise<ExecResult>;

const toneClass = { add: "text-success", new: "text-success", del: "text-destructive", mod: "text-warning", ren: "text-info" } as const;

export function FileRow({ file, active, onSelect }: { file: FileChange; active: boolean; onSelect(): void }) {
  const { label, tone } = describeCode(file.code);
  const slash = file.path.lastIndexOf("/");
  const name = file.path.slice(slash + 1);
  const dir = slash > 0 ? file.path.slice(0, slash) : "";
  return (
    <li>
      <Tip side="right" label={`${label}: ${file.from ? `${file.from} → ` : ""}${file.path}`}>
        <button
          type="button"
          onClick={onSelect}
          className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-accent/60", active && "bg-accent text-foreground")}
        >
          <span className={cn("w-3 shrink-0 text-center font-mono font-semibold", toneClass[tone])}>{file.code === "??" ? "U" : file.code.trim()[0]}</span>
          <span className="min-w-0 flex-1 truncate">
            {name}
            {dir && <span className="ml-1.5 text-muted-foreground">{dir}</span>}
          </span>
          {file.binary ? (
            <span className="text-muted-foreground">bin</span>
          ) : (
            <span className="shrink-0 font-mono text-[11px] tabular-nums">
              <span className="text-success">+{file.added ?? 0}</span> <span className="text-destructive">−{file.removed ?? 0}</span>
            </span>
          )}
        </button>
      </Tip>
    </li>
  );
}

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; value: T };

const MODE_KEY = "berth.diff.mode";

// DiffView shows one file's diff: against HEAD, or, with base, what the
// branch's commits changed since it left base.
export function DiffView({ file, run, base }: { file: FileChange; run: Run; base?: string }) {
  const [diff, setDiff] = useState<Load<{ lines: DiffLine[]; truncated?: boolean }>>({ state: "loading" });
  const [mode, setMode] = useState<"unified" | "split">(() => load(MODE_KEY, "unified"));

  useEffect(() => {
    let live = true;
    setDiff({ state: "loading" });
    run(base ? committedDiffCommand(file, base) : diffCommand(file))
      .then((r) => live && setDiff({ state: "ready", value: { lines: parseDiff(r.output), truncated: r.truncated } }))
      .catch((err) => live && setDiff({ state: "error", message: errorMessage(err) }));
    return () => {
      live = false;
    };
  }, [file, run, base]);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3 text-xs">
        <span className="min-w-0 truncate font-mono">{file.from ? `${file.from} → ${file.path}` : file.path}</span>
        <Badge variant="outline" size="sm">
          {describeCode(file.code).label}
        </Badge>
        <PickOne<"unified" | "split">
          label="Diff layout"
          className="ml-auto"
          value={mode}
          onChange={(m) => {
            setMode(m);
            save(MODE_KEY, m);
          }}
          options={[
            { value: "unified", label: "Unified" },
            { value: "split", label: "Split" },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto font-mono text-[12px] leading-5 [font-variant-ligatures:none]">
        {diff.state === "loading" && (
          <Centered>
            <Spinner className="size-4" />
          </Centered>
        )}
        {diff.state === "error" && <Centered>{diff.message}</Centered>}
        {diff.state === "ready" && diff.value.lines.length === 0 && <Centered>Nothing to show for this file.</Centered>}
        {diff.state === "ready" && diff.value.truncated && <p className="border-b bg-warning/8 px-3 py-1 font-sans text-warning text-xs">Only the end of this diff is shown: it is longer than 64 KB.</p>}
        {diff.state === "ready" && (mode === "unified" ? <Unified lines={diff.value.lines} /> : <Split lines={diff.value.lines} />)}
      </div>
    </section>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-32 items-center justify-center gap-2 p-6 font-sans text-muted-foreground text-sm">{children}</div>;
}

const lineBg = { add: "bg-success/10", del: "bg-destructive/10", ctx: "", hunk: "bg-info/8 text-info", meta: "text-muted-foreground italic" } as const;

function Num({ n }: { n?: number }) {
  return <span className="w-11 shrink-0 select-none pr-2 text-right text-muted-foreground/60">{n ?? ""}</span>;
}

function Unified({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="min-w-fit">
      {lines.map((l, i) => (
        <div key={i} className={cn("flex whitespace-pre", lineBg[l.kind])}>
          {l.kind === "hunk" ? (
            <span className="px-3">{l.text}</span>
          ) : (
            <>
              <Num n={l.oldNo} />
              <Num n={l.newNo} />
              <span className="w-4 shrink-0 select-none text-muted-foreground">{l.kind === "add" ? "+" : l.kind === "del" ? "−" : ""}</span>
              <span className="pr-4">{l.text || " "}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Split({ lines }: { lines: DiffLine[] }) {
  const rows = useMemo(() => splitRows(lines), [lines]);
  return (
    <div className="min-w-fit">
      {rows.map((r, i) =>
        r.hunk ? (
          <div key={i} className={cn("whitespace-pre px-3", lineBg.hunk)}>
            {r.hunk}
          </div>
        ) : (
          <div key={i} className="grid grid-cols-2">
            <Half line={r.left} side="old" />
            <Half line={r.right} side="new" />
          </div>
        ),
      )}
    </div>
  );
}

function Half({ line, side }: { line?: DiffLine; side: "old" | "new" }) {
  if (!line) return <div className="border-r bg-muted/40" />;
  return (
    <div className={cn("flex min-w-0 whitespace-pre border-r", line.kind !== "ctx" && lineBg[line.kind])}>
      <Num n={side === "old" ? line.oldNo : line.newNo} />
      <span className="overflow-hidden pr-3">{line.text || " "}</span>
    </div>
  );
}
