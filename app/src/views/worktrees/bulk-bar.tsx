import * as stylex from "@stylexjs/stylex";
import { AlertTriangleIcon, CheckIcon, CornerDownLeftIcon, GitMergeIcon, PauseIcon, PlayIcon, SendIcon, SquareIcon, Trash2Icon, XIcon, ArchiveIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { agentOf } from "@/lib/derive";
import { openBroadcast } from "@/lib/prompts";
import { useStore } from "@/lib/store";
import type { SyncMode } from "@/lib/worktrees";
import { SyncButton } from "@/views/worktrees/sync-button";
import { type BulkAction, actionLabel, type BulkSummary, type RowProgress, skipReason } from "@/views/worktrees/use-bulk";
import { openWorktree, type Row } from "@/views/worktrees/use-worktrees";
import { liftToasts } from "@/hooks/lift-toasts";
import { color, radius } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "pointerEvents": "none",
    "position": "absolute",
    "left": 0,
    "right": 0,
    "bottom": "16px",
    "display": "flex",
    "justifyContent": "center",
  },
  s1: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s2: {
    "width": "16px",
    "height": "16px",
    "color": "var(--warning)",
  },
  s3: {
    "width": "16px",
    "height": "16px",
    "color": "var(--success)",
  },
  s4: {
    "fontVariantNumeric": "tabular-nums",
  },
  s5: {
    "maxHeight": "224px",
    "overflowY": "auto",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "fontSize": "12px",
    "lineHeight": "16px",
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s6: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s7: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s8: {
    "fontWeight": 500,
  },
  s9: {
    "marginLeft": "8px",
  },
  s10: {
    "color": "var(--warning-foreground)",
  },
  s11: {
    "color": "var(--destructive-foreground)",
  },
  s12: {
    "marginTop": "2px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s13: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
  },
  s14: {
    "pointerEvents": "none",
    "position": "absolute",
    "left": 0,
    "right": 0,
    "bottom": "16px",
    "display": "flex",
    "justifyContent": "center",
  },
  s15: {
    "flexDirection": "row",
    "flexWrap": "wrap",
    "alignItems": "center",
  },
  s16: {
    "paddingRight": "4px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "fontVariantNumeric": "tabular-nums",
  },
  s17: {
    "height": "20px",
    "width": "1px",
    "backgroundColor": "var(--border)",
  },
  s18: {
    "fontVariantNumeric": "tabular-nums",
  },
  s19: {
    "fontVariantNumeric": "tabular-nums",
  },
  s20: {
    "color": "var(--destructive-foreground)",
  },
  s21: {
    "height": "20px",
    "width": "1px",
    "backgroundColor": "var(--border)",
  },
  s22: {
    "display": "inline-flex",
  },

  s23: {
    pointerEvents: "auto",
    display: "flex",
    maxWidth: "calc(100%-2rem)",
    flexDirection: "column",
    gap: 8,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: color.popover,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 8,
    paddingBottom: 8,
    boxShadow: "0 10px 15px -3px color-mix(in oklab, var(--foreground) 10%, transparent), 0 4px 6px -4px color-mix(in oklab, var(--foreground) 10%, transparent)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

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
  onArchive,
  onClear,
  onCancel,
  onDismiss,
  onRetry,
}: {
  selected: Row[];
  summary?: BulkSummary;
  progress: Record<string, RowProgress>;
  onSync(mode: SyncMode, paused: boolean): void;
  onPause(): void;
  onResume(): void;
  onStop(): void;
  onDelete(): void;
  onArchive(): void;
  onClear(): void;
  onCancel(): void;
  onDismiss(): void;
  // Runs another action over some of the last one's rows.
  onRetry(a: BulkAction, rows: Row[]): void;
}) {
  const [details, setDetails] = useState(false);
  const [includePaused, setIncludePaused] = useState(false);
  const boxes = useStore((s) => s.boxes);
  const running = summary && !summary.done;
  if (!selected.length && !summary) return null;

  const shell = (sx(paint.s23) ?? "");

  if (summary && summary.action.kind !== "delete") {
    const states = summary.rows.map((r) => progress[r.key]);
    const count = (s: RowProgress["state"]) => states.filter((p) => p?.state === s).length;
    const done = count("ok") + count("failed") + count("conflict") + count("skipped");
    const problems = summary.rows.filter((r) => progress[r.key]?.state === "failed" || progress[r.key]?.state === "conflict");
    return (
      <div className={sx(paint.s0)}>
        <div ref={liftToasts} className={shell} role="status" aria-live="polite">
          <div className={sx(paint.s1)}>
            {running ? <Spinner  size="lg"/> : problems.length ? <AlertTriangleIcon className={sx(paint.s2)} /> : <CheckIcon className={sx(paint.s3)} />}
            <span className={sx(paint.s4)}>
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
            <ul className={sx(paint.s5)}>
              {problems.map((r) => {
                const p = progress[r.key]!;
                const agents = (boxes[r.box]?.sessions ?? []).filter((x) => x.dir === r.path && !x.exited && agentOf(x));
                const sync = summary.action.kind === "sync" ? summary.action : undefined;
                return (
                  <li key={r.key} className={sx(paint.s6)}>
                    <div className={sx(paint.s7)}>
                      <span className={sx(paint.s8)}>{r.name}</span>
                      <span className={[sx(paint.s9), p.state === "conflict" ? sx(paint.s10) : sx(paint.s11)].filter(Boolean).join(" ")}>{p.state === "conflict" ? "conflicts, left as it was" : p.message}</span>
                      {p.conflicts && <div className={sx(paint.s12)}>{p.conflicts.join(", ")}</div>}
                    </div>
                    {/* What to do about it, without leaving the table. */}
                    <div className={sx(paint.s13)}>
                      {sync && p.state === "conflict" && sync.mode === "rebase" && (
                        <Button size="xs" variant="ghost" onClick={() => onRetry({ ...sync, mode: "merge" }, [r])}>
                          <GitMergeIcon />
                          Try merge
                        </Button>
                      )}
                      {sync && p.state === "conflict" && agents.length > 0 && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            openBroadcast({
                              targets: agents.map((x) => ({ box: r.box, session: x.name })),
                              text: `Sync this worktree with ${r.base ?? "its base"} (git ${sync.mode === "pull" ? "pull --ff-only" : sync.mode} ${r.base ?? ""}) and resolve the conflicts in ${p.conflicts?.join(", ") ?? "the files git reports"}. Keep both sides' intent, run the tests, and commit.`,
                            })
                          }
                        >
                          <SendIcon />
                          Ask agent
                        </Button>
                      )}
                      <Button size="xs" variant="ghost" onClick={() => openWorktree(r)}>
                        <CornerDownLeftIcon />
                        Open
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // What each action would touch: rows it skips (main checkouts, paused
  // ones for a sync) don't count, so the button says what it will do.
  const eligible = (a: BulkAction) => selected.filter((r) => !skipReason(a, r)).length;
  const counted = (n: number) => (n < selected.length ? n : undefined);
  const anyPaused = selected.some((r) => r.paused);
  const anyRunning = selected.some((r) => !r.paused && !r.main);
  const sessions = selected.reduce((n, r) => n + r.sessions, 0);
  const deletable = selected.filter((r) => !r.main).length;
  // The agents working in the selected worktrees, to prompt them all.
  const agents = selected.flatMap((r) => (boxes[r.box]?.sessions ?? []).filter((x) => x.dir === r.path && !x.exited && agentOf(x)).map((x) => ({ box: r.box, session: x.name })));

  const pausedCount = selected.filter((r) => r.paused).length;
  const toSync = eligible({ kind: "sync", mode: "rebase", paused: includePaused });
  const toPause = eligible({ kind: "pause" });
  const toResume = eligible({ kind: "resume" });

  return (
    <div className={sx(paint.s14)}>
      <div ref={liftToasts} className={[shell, sx(paint.s15)].filter(Boolean).join(" ")}>
        <span className={sx(paint.s16)}>{selected.length} selected</span>
        <span className={sx(paint.s17)} />
        <SyncButton
          size="xs"
          count={counted(toSync)}
          onSync={(mode) => onSync(mode, includePaused)}
          paused={{ count: pausedCount, include: includePaused, onChange: setIncludePaused }}
        />
        {anyRunning && (
          <Button size="xs" variant="outline" onClick={onPause}>
            <PauseIcon />
            Pause
            {counted(toPause) !== undefined && <span className={sx(paint.s18)}>{toPause}</span>}
          </Button>
        )}
        {anyPaused && (
          <Button size="xs" variant="outline" onClick={onResume}>
            <PlayIcon />
            Resume
            {counted(toResume) !== undefined && <span className={sx(paint.s19)}>{toResume}</span>}
          </Button>
        )}
        <Hint text={agents.length ? `Send one prompt to ${agents.length} agent${agents.length === 1 ? "" : "s"}` : "No agents in these worktrees"}>
          <Button size="xs" variant="outline" disabled={!agents.length} onClick={() => openBroadcast({ targets: agents })}>
            <SendIcon />
            Prompt agents…
          </Button>
        </Hint>
        <Hint text={sessions ? `Stop ${sessions} session${sessions === 1 ? "" : "s"}` : "No sessions running"}>
          <Button size="xs" variant="outline" disabled={!sessions} onClick={onStop}>
            <SquareIcon />
            Stop sessions
          </Button>
        </Hint>
        <Hint text={deletable ? "Run their archive scripts and remove them; their branches stay" : "Main checkouts can't be archived"}>
          <Button size="xs" variant="outline" disabled={!deletable} onClick={onArchive}>
            <ArchiveIcon />
            {counted(deletable) !== undefined ? `Archive ${deletable}…` : "Archive…"}
          </Button>
        </Hint>
        <Hint text={deletable ? (deletable < selected.length ? `Main checkouts are skipped (${selected.length - deletable})` : undefined) : "Main checkouts can't be deleted"}>
          <span className={sx(paint.s20)}><Button size="xs" variant="outline"  disabled={!deletable} onClick={onDelete}>
            <Trash2Icon />
            {counted(deletable) !== undefined ? `Delete ${deletable}…` : "Delete…"}
          </Button></span>
        </Hint>
        <span className={sx(paint.s21)} />
        <Button size="xs" variant="ghost" onClick={onClear}>
          Clear
          <Kbd>Esc</Kbd>
        </Button>
      </div>
    </div>
  );
}

// Hint explains a button, disabled or not: a disabled button gets no
// pointer events, so the tooltip hangs on a wrapper.
function Hint({ text, children }: { text?: string; children: ReactNode }) {
  return (
    <Tip label={text}>
      <span className={sx(paint.s22)}>{children}</span>
    </Tip>
  );
}
