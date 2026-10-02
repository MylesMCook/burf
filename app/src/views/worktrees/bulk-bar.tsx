import { AlertTriangleIcon, CheckIcon, PauseIcon, PlayIcon, SendIcon, SquareIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { agentOf } from "@/lib/derive";
import { openBroadcast } from "@/lib/prompts";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { SyncMode } from "@/lib/worktrees";
import { SyncButton } from "@/views/worktrees/history-sheet";
import { actionLabel, type BulkSummary, type RowProgress } from "@/views/worktrees/use-bulk";
import type { Row } from "@/views/worktrees/use-worktrees";

// BulkBar floats over the table: what you can do with the selection, then
// how it is going, then what happened.
export function BulkBar({
  selected,
  summary,
  progress,
  onSync,
  onPause,
  onResume,
  onStop,
  onDelete,
  onClear,
  onCancel,
  onDismiss,
}: {
  selected: Row[];
  summary?: BulkSummary;
  progress: Record<string, RowProgress>;
  onSync(mode: SyncMode): void;
  onPause(): void;
  onResume(): void;
  onStop(): void;
  onDelete(): void;
  onClear(): void;
  onCancel(): void;
  onDismiss(): void;
}) {
  const [details, setDetails] = useState(false);
  const boxes = useStore((s) => s.boxes);
  const running = summary && !summary.done;
  if (!selected.length && !summary) return null;

  const shell = "pointer-events-auto flex max-w-[calc(100%-2rem)] flex-col gap-2 rounded-xl border bg-popover px-3 py-2 shadow-lg/10";

  if (summary && summary.action.kind !== "delete") {
    const states = summary.rows.map((r) => progress[r.key]);
    const count = (s: RowProgress["state"]) => states.filter((p) => p?.state === s).length;
    const done = count("ok") + count("failed") + count("conflict") + count("skipped");
    const problems = summary.rows.filter((r) => progress[r.key]?.state === "failed" || progress[r.key]?.state === "conflict");
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <div className={shell} role="status" aria-live="polite">
          <div className="flex items-center gap-3 text-sm">
            {running ? <Spinner className="size-4" /> : problems.length ? <AlertTriangleIcon className="size-4 text-warning" /> : <CheckIcon className="size-4 text-success" />}
            <span className="tabular-nums">
              {running
                ? `${actionLabel(summary.action)}: ${done} of ${summary.rows.length}`
                : [
                    `${actionLabel(summary.action)}: ${count("ok")} done`,
                    count("conflict") && `${count("conflict")} with conflicts`,
                    count("failed") && `${count("failed")} failed`,
                    count("skipped") && `${count("skipped")} skipped`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </span>
            {!running && problems.length > 0 && (
              <Button size="xs" variant="ghost" onClick={() => setDetails(!details)}>
                {details ? "Hide details" : "Details"}
              </Button>
            )}
            {running ? (
              <Button size="xs" variant="ghost" onClick={onCancel}>
                Stop after this one
              </Button>
            ) : (
              <Button size="icon-xs" variant="ghost" aria-label="Dismiss" onClick={onDismiss}>
                <XIcon />
              </Button>
            )}
          </div>
          {details && !running && (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto border-t pt-2 text-xs">
              {problems.map((r) => {
                const p = progress[r.key]!;
                return (
                  <li key={r.key}>
                    <span className="font-medium">{r.name}</span>
                    <span className={cn("ml-2", p.state === "conflict" ? "text-warning" : "text-destructive-foreground")}>{p.state === "conflict" ? "conflicts, left as it was" : p.message}</span>
                    {p.conflicts && <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{p.conflicts.join(", ")}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  const anyPaused = selected.some((r) => r.paused);
  const anyRunning = selected.some((r) => !r.paused && !r.main);
  const sessions = selected.reduce((n, r) => n + r.sessions, 0);
  const deletable = selected.filter((r) => !r.main).length;
  // The agents working in the selected worktrees, to prompt them all.
  const agents = selected.flatMap((r) => (boxes[r.box]?.sessions ?? []).filter((x) => x.dir === r.path && !x.exited && agentOf(x)).map((x) => ({ box: r.box, session: x.name })));

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
      <div className={cn(shell, "flex-row flex-wrap items-center")}>
        <span className="pr-1 text-sm tabular-nums">{selected.length} selected</span>
        <span className="h-5 w-px bg-border" />
        <SyncButton size="xs" onSync={onSync} />
        {anyRunning && (
          <Button size="xs" variant="outline" onClick={onPause}>
            <PauseIcon />
            Pause
          </Button>
        )}
        {anyPaused && (
          <Button size="xs" variant="outline" onClick={onResume}>
            <PlayIcon />
            Resume
          </Button>
        )}
        <Button size="xs" variant="outline" disabled={!agents.length} onClick={() => openBroadcast({ targets: agents })} title={agents.length ? `Send one prompt to ${agents.length} agent${agents.length === 1 ? "" : "s"}` : "No agents in these worktrees"}>
          <SendIcon />
          Prompt agents…
        </Button>
        <Button size="xs" variant="outline" disabled={!sessions} onClick={onStop} title={sessions ? undefined : "No sessions running"}>
          <SquareIcon />
          Stop sessions
        </Button>
        <Button size="xs" variant="outline" className="text-destructive-foreground" disabled={!deletable} onClick={onDelete} title={deletable ? undefined : "Main checkouts can't be deleted"}>
          <Trash2Icon />
          Delete…
        </Button>
        <span className="h-5 w-px bg-border" />
        <Button size="xs" variant="ghost" onClick={onClear}>
          Clear
          <Kbd>Esc</Kbd>
        </Button>
      </div>
    </div>
  );
}
