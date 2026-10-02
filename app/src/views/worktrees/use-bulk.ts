import { useCallback, useRef, useState } from "react";

import { boxApi } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { scheduleRefresh, useStore } from "@/lib/store";
import { type SyncMode, worktreesApi } from "@/lib/worktrees";
import type { Row } from "@/views/worktrees/use-worktrees";

export type BulkAction = { kind: "sync"; mode: SyncMode } | { kind: "pause" } | { kind: "resume" } | { kind: "stop" } | { kind: "delete"; force: boolean; branch: boolean };

export interface RowProgress {
  state: "queued" | "running" | "ok" | "conflict" | "failed" | "skipped";
  message?: string;
  conflicts?: string[];
}

export interface BulkSummary {
  action: BulkAction;
  rows: Row[];
  // Set once every row has its result.
  done: boolean;
}

export const actionLabel = (a: BulkAction) =>
  a.kind === "sync" ? (a.mode === "rebase" ? "Rebase" : a.mode === "merge" ? "Merge" : "Fast-forward") : a.kind === "pause" ? "Pause" : a.kind === "resume" ? "Resume" : a.kind === "stop" ? "Stop sessions" : "Delete";

// skipReason says why an action doesn't apply to a row, or nothing.
export function skipReason(a: BulkAction, r: Row): string | undefined {
  if (r.main && (a.kind === "pause" || a.kind === "resume" || a.kind === "delete")) return "the main checkout";
  if (a.kind === "pause" && r.paused) return "already paused";
  if (a.kind === "resume" && !r.paused) return "not paused";
  if (a.kind === "stop" && r.sessions === 0) return "no sessions";
  return undefined;
}

// useBulk runs one action over many worktrees, one at a time, so a slow or
// failing one never leaves others half done, and keeps each row's outcome.
export function useBulk(onRowDone: (r: Row, patch: Partial<Row>) => void) {
  const [progress, setProgress] = useState<Record<string, RowProgress>>({});
  const [summary, setSummary] = useState<BulkSummary>();
  const cancelled = useRef(false);

  const set = (key: string, p: RowProgress) => setProgress((s) => ({ ...s, [key]: p }));

  const run = useCallback(
    async (action: BulkAction, rows: Row[]) => {
      const client = useStore.getState().client;
      if (!client) return;
      cancelled.current = false;
      setProgress(Object.fromEntries(rows.map((r) => [r.key, { state: "queued" } as RowProgress])));
      setSummary({ action, rows, done: false });
      for (const r of rows) {
        if (cancelled.current) {
          set(r.key, { state: "skipped", message: "cancelled" });
          continue;
        }
        const why = skipReason(action, r);
        if (why) {
          set(r.key, { state: "skipped", message: why });
          continue;
        }
        set(r.key, { state: "running" });
        try {
          switch (action.kind) {
            case "sync": {
              const res = await worktreesApi.sync(client, r.box, r.location, r.name, action.mode);
              if (res.ok) {
                set(r.key, { state: "ok", message: res.output.split("\n").filter(Boolean).pop() });
                onRowDone(r, { ahead: res.ahead, behind: res.behind });
              } else if (res.conflicts?.length) {
                set(r.key, { state: "conflict", message: "Conflicts; left as it was", conflicts: res.conflicts });
              } else {
                set(r.key, { state: "failed", message: res.output.split("\n").filter(Boolean).pop() ?? "Sync failed" });
              }
              break;
            }
            case "pause":
            case "resume": {
              const st = await worktreesApi.pause(client, r.box, r.location, r.name, action.kind === "pause");
              set(r.key, { state: "ok", message: action.kind === "pause" ? "Paused" : "Resumed" });
              onRowDone(r, { paused: st.paused, sessions: st.sessions });
              break;
            }
            case "stop": {
              const sessions = (useStore.getState().boxes[r.box]?.sessions ?? []).filter((s) => s.dir === r.path && !s.exited);
              for (const s of sessions) await boxApi.stopSession(client, r.box, s.name);
              set(r.key, { state: "ok", message: `Stopped ${sessions.length}` });
              onRowDone(r, { sessions: 0 });
              scheduleRefresh(r.box, ["sessions"]);
              break;
            }
            case "delete": {
              try {
                await worktreesApi.remove(client, r.box, r.location, r.name, { force: action.force, branch: action.branch });
              } catch (err) {
                const m = errorMessage(err);
                if (/modified|untracked|uncommitted|contains/i.test(m) && !action.force) throw new Error("Has uncommitted changes; tick “even with uncommitted changes”");
                throw err;
              }
              set(r.key, { state: "ok", message: "Removed" });
              scheduleRefresh(r.box, ["locations", "sessions", "services"]);
              break;
            }
          }
        } catch (err) {
          set(r.key, { state: "failed", message: errorMessage(err) });
        }
      }
      setSummary({ action, rows, done: true });
    },
    [onRowDone],
  );

  const cancel = () => {
    cancelled.current = true;
  };
  const clear = () => {
    setProgress({});
    setSummary(undefined);
  };

  return { progress, summary, run, cancel, clear };
}
