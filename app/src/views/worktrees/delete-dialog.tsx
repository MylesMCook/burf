import * as stylex from "@stylexjs/stylex";
import { AlertTriangleIcon, CheckIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { AlertDialog, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import type { BulkAction, RowProgress } from "@/views/worktrees/use-bulk";
import type { Row } from "@/views/worktrees/use-worktrees";

const paint = stylex.create({
  s0: {
    "marginLeft": "24px",
    "marginRight": "24px",
    "maxHeight": "256px",
    "overflowY": "auto",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s1: {
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s2: {
    "display": "flex",
    "width": "16px",
    "justifyContent": "center",
  },
  s3: {
    "width": "14px",
    "height": "14px",
    "color": "var(--success)",
  },
  s4: {
    "width": "14px",
    "height": "14px",
    "color": "var(--destructive-foreground)",
  },
  s5: {
    "width": "14px",
    "height": "14px",
    "color": "var(--warning)",
  },
  s6: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s7: {
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s8: {
    "display": "block",
    "whiteSpace": "normal",
    "overflowWrap": "break-word",
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s9: {
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s10: {
    "flexShrink": 0,
    "fontSize": "11px",
    "color": "var(--warning-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s11: {
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s12: {
    "marginLeft": "24px",
    "marginRight": "24px",
    "marginTop": "12px",
    "marginBottom": "8px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "10px",
    },
  },
  s13: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "10px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s14: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "10px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s15: {
    "display": "block",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s16: {
    "color": "var(--warning-foreground)",
  },

  s17: {
    ":not(#\\#) > :not(:last-child)": {
      borderBottomColor: "color-mix(in oklab, var(--border) 60%, transparent)",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// DeleteDialog removes several worktrees after one confirmation that names
// every one, then stays open with each one's outcome.
// With archive, it archives them instead: each one's archive script runs,
// then it goes, and its branch stays.
export function DeleteDialog({ rows, progress, running, onRun, onClose, archive }: { rows?: Row[]; progress: Record<string, RowProgress>; running: boolean; onRun(a: BulkAction): void; onClose(): void; archive?: boolean }) {
  const [branch, setBranch] = useState(false);
  const [force, setForce] = useState(false);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (rows) {
      setBranch(false);
      setForce(false);
      setStarted(false);
    }
  }, [rows]);

  const targets = (rows ?? []).filter((r) => !r.main);
  const skipped = (rows ?? []).length - targets.length;
  const dirty = targets.filter((r) => r.changed || r.untracked).length;
  const done = started && !running;
  const failed = targets.filter((r) => progress[r.key]?.state === "failed").length;

  return (
    <AlertDialog open={!!rows} onOpenChange={(o) => !o && !running && onClose()}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {done
              ? failed
                ? `${archive ? "Archived" : "Removed"} ${targets.length - failed} of ${targets.length}`
                : `${archive ? "Archived" : "Removed"} ${targets.length} worktree${targets.length === 1 ? "" : "s"}`
              : `${archive ? "Archive" : "Delete"} ${targets.length} worktree${targets.length === 1 ? "" : "s"}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {done
              ? failed
                ? "The rest were left as they were."
                : archive
                  ? "Their branches are kept; their folders, services and sessions are gone."
                  : "Their folders, services and sessions are gone."
              : archive
                ? "Each one's sessions and services stop, the repo's archive script runs, then its folder goes. Branches stay, so nothing committed is lost; one with uncommitted work is left as it is."
                : "Each folder is deleted after the repo's teardown runs, and its services and sessions stop."}
            {skipped > 0 && !done && ` Main checkouts are skipped (${skipped}).`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className={[sx(paint.s0), sx(paint.s17)].filter(Boolean).join(" ")}>
          {targets.map((r) => {
            const p = progress[r.key];
            return (
              <li key={r.key} className={sx(paint.s1)}>
                <span className={sx(paint.s2)}>
                  {p?.state === "running" ? (
                    <Spinner  size="md"/>
                  ) : p?.state === "ok" ? (
                    <CheckIcon className={sx(paint.s3)} />
                  ) : p?.state === "failed" ? (
                    <XIcon className={sx(paint.s4)} />
                  ) : r.changed || r.untracked ? (
                    <AlertTriangleIcon className={sx(paint.s5)} aria-label="Has uncommitted changes" />
                  ) : null}
                </span>
                <span className={sx(paint.s6)}>
                  <span className={sx(paint.s7)}>{r.name}</span>
                  {p?.state === "failed" ? (
                    <span className={sx(paint.s8)}>
                      {p.message}
                    </span>
                  ) : (
                    <span className={sx(paint.s9)}>{r.branch}</span>
                  )}
                </span>
                {(r.changed > 0 || r.untracked > 0) && !p && (
                  <span className={sx(paint.s10)}>{[r.changed && `${r.changed} changed`, r.untracked && `${r.untracked} untracked`].filter(Boolean).join(", ")}</span>
                )}
                <span className={sx(paint.s11)}>{r.box}</span>
              </li>
            );
          })}
        </ul>

        {!started && !archive && (
          <div className={sx(paint.s12)}>
            <label className={sx(paint.s13)}>
              <Checkbox offset checked={branch} onCheckedChange={(v) => setBranch(!!v)} />
              Also delete their branches
            </label>
            <label className={sx(paint.s14)}>
              <Checkbox offset checked={force} onCheckedChange={(v) => setForce(!!v)} />
              <span>
                Even with uncommitted changes
                <span className={[sx(paint.s15), dirty && !force && sx(paint.s16)].filter(Boolean).join(" ")}>
                  {dirty ? `${dirty} ${dirty === 1 ? "has" : "have"} work git would lose; without this, ${dirty === 1 ? "it is" : "they are"} kept.` : "Without this, git refuses when there is work it would lose."}
                </span>
              </span>
            </label>
          </div>
        )}

        <AlertDialogFooter>
          {done ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" disabled={running} onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant={archive ? "default" : "destructive"}
                loading={running}
                disabled={!targets.length}
                onClick={() => {
                  setStarted(true);
                  onRun(archive ? { kind: "archive" } : { kind: "delete", force, branch });
                }}
              >
                {archive ? "Archive" : "Delete"} {targets.length}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
