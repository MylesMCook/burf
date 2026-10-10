import * as stylex from "@stylexjs/stylex";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, CopyIcon, CornerDownLeftIcon, EllipsisIcon, PauseIcon, PlayIcon, SquareIcon, Trash2Icon, ArchiveIcon } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useState } from "react";

import { PickOne } from "@/components/pick-one";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetDescription, SheetHeader, SheetPanel, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveTheme } from "@/hooks/use-theme";
import { useGraphRowHeight } from "@/lib/density";
import { boxApi } from "@/lib/api";
import { ago } from "@/lib/format";
import { plainError } from "@/lib/errors";
import { type CommitDetail, commitDetailCommand, parseCommitDetail } from "@/lib/git/parse";
import { useStore } from "@/lib/store";
import { type Commit, worktreesApi } from "@/lib/worktrees";
import { ProjectLabel } from "@/views/automations/flows/project-label";
import { branchOnly, type GraphRow, layout } from "@/views/worktrees/commit-graph";
import { GraphGutter, gutterWidth, laneColor, laneVars } from "@/views/worktrees/graph-gutter";
import { SyncButton } from "@/views/worktrees/sync-button";
import type { BulkAction, RowProgress } from "@/views/worktrees/use-bulk";
import { openWorktree, type Row } from "@/views/worktrees/use-worktrees";

const paint = stylex.create({
  s0: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "2px",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--warning) 12%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontWeight": 400,
    "fontSize": "11px",
    "color": "var(--warning-foreground)",
  },
  s1: {
    "width": "10px",
    "height": "10px",
  },
  s2: {
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s3: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "12px",
    "rowGap": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "fontFamily": "var(--font-mono)",
  },
  s5: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "8px",
    "fontFamily": "var(--font-mono)",
    "fontVariantNumeric": "tabular-nums",
  },
  s6: {
    "display": "inline-flex",
    "alignItems": "center",
  },
  s7: {
    "width": "12px",
    "height": "12px",
  },
  s8: {
    "display": "inline-flex",
    "alignItems": "center",
  },
  s9: {
    "color": "var(--warning-foreground)",
  },
  s10: {
    "width": "12px",
    "height": "12px",
  },
  s11: {
    "fontFamily": "var(--font-sans)",
  },
  s12: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingBottom": "16px",
  },
  s13: {
    "marginLeft": "auto",
  },
  s14: {
    "display": "flex",
    "height": "40px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "12px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s15: {
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
  },
  s16: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
  },
  s17: {
    "width": "8px",
    "height": "8px",
    "flexShrink": 0,
    "borderRadius": "999px",
  },
  s18: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
  },
  s19: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s20: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
  },
  s21: {
    "width": "8px",
    "height": "8px",
    "flexShrink": 0,
    "borderRadius": "999px",
    "borderWidth": "1.5px",
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s22: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
  },
  s23: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s24: {
    "paddingTop": "8px",
    "color": "var(--destructive-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s25: {
    "paddingTop": "4px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "4px",
    },
  },
  s26: {
    "height": "24px",
  },
  s27: {
    "paddingTop": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s28: {
    "marginLeft": "calc(12px * -1)",
    "marginRight": "calc(12px * -1)",
  },
  s29: {
    "display": "flex",
    "height": "28px",
    "width": "100%",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "textAlign": "left",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "12px",
    "lineHeight": "16px",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
    },
  },
  s30: {
    "width": "14px",
    "height": "14px",
  },
  s31: {
    "display": "flex",
    "height": "36px",
    "alignItems": "center",
  },
  s32: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s33: {
    "position": "relative",
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-md)",
    "paddingRight": "12px",
    "textAlign": "left",
    "outline": "none",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
      ":focus-visible": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s34: {
    "backgroundColor": "color-mix(in oklab, var(--info) 7%, transparent)",
  },
  s35: {
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "left": "0px",
    "width": "2px",
  },
  s36: {
    "top": "4px",
    "borderTopLeftRadius": "999px",
    "borderTopRightRadius": "999px",
  },
  s37: {
    "bottom": "4px",
    "borderBottomLeftRadius": "999px",
    "borderBottomRightRadius": "999px",
  },
  s38: {
    "width": "7ch",
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
  },
  s39: {
    "color": "var(--foreground)",
  },
  s40: {
    "color": "var(--muted-foreground)",
  },
  s41: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "13px",
  },
  s42: {
    "color": "var(--muted-foreground)",
  },
  s43: {
    "flexShrink": 0,
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--info) 40%, transparent)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontSize": "10px",
    "color": "var(--info)",
    "lineHeight": "16px",
  },
  s44: {
    "display": "none",
    "width": "112px",
    "flexShrink": 0,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s45: {
    "width": "48px",
    "flexShrink": 0,
    "textAlign": "right",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s46: {
    "color": "var(--muted-foreground)",
  },
  s47: {
    "color": "var(--muted-foreground)",
  },
  s48: {
    "minWidth": "0px",
    "fontSize": "14px",
    "lineHeight": "20px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "10px",
    },
  },
  s49: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "4px",
    },
  },
  s50: {
    "overflowWrap": "break-word",
    "fontWeight": 500,
    "lineHeight": "1.375",
  },
  s51: {
    "height": "14px",
  },
  s52: {
    "maxHeight": "160px",
    "overflowY": "auto",
    "whiteSpace": "pre-wrap",
    "overflowWrap": "break-word",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s53: {
    "display": "grid",
    "gridTemplateColumns": "5.5rem minmax(0,1fr)",
    "columnGap": "12px",
    "rowGap": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s54: {
    "color": "var(--muted-foreground)",
  },
  s55: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s56: {
    "color": "var(--muted-foreground)",
  },
  s57: {
    "marginTop": "2px",
    "height": "12px",
    "width": "128px",
  },
  s58: {
    "color": "var(--muted-foreground)",
  },
  s59: {
    "fontVariantNumeric": "tabular-nums",
  },
  s60: {
    "marginLeft": "8px",
    "color": "var(--success-foreground)",
  },
  s61: {
    "marginLeft": "6px",
    "color": "var(--destructive-foreground)",
  },
  s62: {
    "marginLeft": "8px",
    "color": "var(--muted-foreground)",
  },
  s63: {
    "color": "var(--muted-foreground)",
  },
  s64: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
  },
  s65: {
    "width": "8px",
    "height": "8px",
    "flexShrink": 0,
    "borderRadius": "999px",
  },
  s66: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s67: {
    "color": "var(--muted-foreground)",
  },
  s68: {
    "fontFamily": "var(--font-mono)",
  },
  s69: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingTop": "10px",
  },
  s70: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s71: {
    "maxWidth": "144px",
    "flexShrink": 0,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
    "lineHeight": "16px",
  },
  s72: {
    "borderColor": "color-mix(in oklab, var(--info) 50%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--info) 10%, transparent)",
    "color": "var(--info)",
  },
  s73: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 30%, transparent)",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s74: {
    "marginTop": "4px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "2px",
    },
  },
  n0: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "13px",
  },
  n1: {
    "color": "var(--muted-foreground)",
  },
  n2: {
    "color": "color-mix(in oklab, var(--foreground) 85%, transparent)",
  },
  n3: {
    "maxWidth": "144px",
    "flexShrink": 0,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
    "lineHeight": "16px",
  },
  n4: {
    "borderColor": "color-mix(in oklab, var(--info) 50%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--info) 10%, transparent)",
    "color": "var(--info)",
  },
  n5: {
    "borderColor": "var(--border)",
    "backgroundColor": "var(--muted)",
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  n6: {
    "borderColor": "var(--border)",
    "color": "var(--muted-foreground)",
  },
  n7: {
    "borderColor": "color-mix(in oklab, var(--ring) 40%, transparent)",
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },

  s75: {
    backgroundColor: { "[data-popup-open]": "color-mix(in oklab, var(--accent) 70%, transparent)" },
  },
  s76: {
    translate: "0px 1px",
  },
  s77: {
    "@container (min-width: 1024px)": {
      display: "block",
    },
  },
  s78: {
    width: "66.6667%",
  },
  s79: {
    bottom: 0,
  },
  s80: {
    color: "var(--success-foreground)",
  },
  s81: {
    color: "var(--warning-foreground)",
  },
  s82: {
    color: "var(--destructive-foreground)",
  },
  s83: {
    color: "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const PAGE = 80;

// Past this many commits behind, the history starts on the branch's own
// commits; the base's newer ones are a toggle away.
const COLLAPSE_BEHIND = 5;

type Scope = "all" | "branch";

// A commit never changes, so what was read about one is kept for the session.
const details = new Map<string, CommitDetail>();

// HistorySheet is one worktree: where it stands, what you can do with it,
// and its commits, newest first, marking those not on its base yet and
// those on the base it lacks.
export function HistorySheet({ row, progress, busy, onClose, onAction, onDelete, onArchive }: { row?: Row; progress?: RowProgress; busy: boolean; onClose(): void; onAction(a: BulkAction): void; onDelete(): void; onArchive(): void }) {
  const client = useStore((s) => s.client);
  const dark = useActiveTheme().appearance === "dark";
  const [log, setLog] = useState<{ base: string; commits: Commit[] }>();
  const [error, setError] = useState<string>();
  const [limit, setLimit] = useState(PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scope, setScope] = useState<Scope>("all");

  useEffect(() => {
    setLimit(PAGE);
    setScope(row && row.behind > COLLAPSE_BEHIND ? "branch" : "all");
    // Only when another worktree opens, not when this one's counts move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.key]);
  useEffect(() => {
    if (limit === PAGE) {
      setLog(undefined);
      setError(undefined);
    }
    if (!row || !client) return;
    let cancelled = false;
    setLoadingMore(limit > PAGE);
    worktreesApi.log(client, row.box, row.location, row.name, limit, true).then(
      (l) => {
        if (cancelled) return;
        setLog({ base: l.base, commits: l.commits ?? [] });
        setLoadingMore(false);
      },
      (e) => {
        if (cancelled) return;
        setError(plainError(e));
        setLoadingMore(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // Refetch when a sync or anything else moves the branch.
  }, [client, row?.key, row?.ahead, row?.behind, row?.last_commit?.sha, limit]);

  const graph = useMemo(() => (log ? layout(scope === "branch" ? branchOnly(log.commits) : log.commits) : undefined), [log, scope]);
  const vars = useMemo(() => laneVars(dark), [dark]);
  const rowH = useGraphRowHeight();

  const baseRef = log?.base ?? row?.base ?? "origin/main";
  const base = baseRef.replace(/^origin\//, "");
  const branch = row?.branch ?? row?.name ?? "";
  // A main checkout is its own base: one line, one legend entry.
  const sameAsBase = branch === base;
  const showScope = !!row && row.behind > 0 && !sameAsBase;

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetPopup width="history">
        {row && (
          <>
            <SheetHeader pad="tight">
              <SheetTitle row size="base">
                {row.main ? row.location : row.name}
                {row.paused && (
                  <span className={sx(paint.s0)}>
                    <PauseIcon className={sx(paint.s1)} />
                    Paused
                  </span>
                )}
              </SheetTitle>
              <SheetDescription render={<div />} stack>
                <ProjectLabel box={row.box} scope={`repo:${row.location}`} className={sx(paint.s2)} />
                <div className={sx(paint.s3)}>
                  {row.branch && <code className={sx(paint.s4)}>{row.branch}</code>}
                  <span className={sx(paint.s5)}>
                    <span className={sx(paint.s6)}>
                      <ArrowUpIcon className={sx(paint.s7)} />
                      {row.ahead}
                    </span>
                    <span className={[sx(paint.s8), row.behind >= 10 && sx(paint.s9)].filter(Boolean).join(" ")}>
                      <ArrowDownIcon className={sx(paint.s10)} />
                      {row.behind}
                    </span>
                    <span className={sx(paint.s11)}>vs {row.base ?? "its base"}</span>
                  </span>
                  <span>{row.changed || row.untracked ? `${row.changed} changed, ${row.untracked} untracked` : "Clean"}</span>
                </div>
              </SheetDescription>
            </SheetHeader>

            {/* One line: the everyday actions, and the rest under ⋯. */}
            <div className={sx(paint.s12)}>
              <SyncButton base={baseRef} disabled={busy} onSync={(mode) => onAction({ kind: "sync", mode, paused: true })} />
              {!row.main &&
                (row.paused ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction({ kind: "resume" })}>
                    <PlayIcon />
                    Resume
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction({ kind: "pause" })}>
                    <PauseIcon />
                    Pause
                  </Button>
                ))}
              <Button size="sm" variant="ghost" onClick={() => openWorktree(row)}>
                <CornerDownLeftIcon />
                Open
              </Button>
              <Menu>
                <MenuTrigger render={<span className={sx(paint.s13)}><Button size="icon-sm" variant="ghost"  aria-label="More actions" /></span>}>
                  <EllipsisIcon />
                </MenuTrigger>
                <MenuPopup align="end">
                  <MenuItem disabled={busy || row.sessions === 0} onClick={() => onAction({ kind: "stop" })}>
                    <SquareIcon />
                    {row.sessions ? `Stop ${row.sessions} session${row.sessions === 1 ? "" : "s"}` : "No sessions running"}
                  </MenuItem>
                  {!row.main && (
                    <>
                      <MenuSeparator />
                      <MenuItem disabled={busy} onClick={onArchive}>
                        <ArchiveIcon />
                        Archive…
                      </MenuItem>
                      <MenuItem variant="destructive" disabled={busy} onClick={onDelete}>
                        <Trash2Icon />
                        Delete…
                      </MenuItem>
                    </>
                  )}
                </MenuPopup>
              </Menu>
            </div>
            {progress && progress.state !== "queued" && <ProgressLine p={progress} />}

            <div className={sx(paint.s14)}>
              <span className={sx(paint.s15)}>Commits</span>
              <span className={sx(paint.s16)}>
                <span className={sx(paint.s17)} style={{ background: laneColor(sameAsBase ? 1 : 0) }} />
                <code className={sx(paint.s18)}>{branch}</code>
                {!sameAsBase && <span className={sx(paint.s19)}>{row.ahead} ahead</span>}
              </span>
              {!sameAsBase && (
                <span className={sx(paint.s20)}>
                  <span className={sx(paint.s21)} style={{ borderColor: laneColor(1) }} />
                  <code className={sx(paint.s22)}>{baseRef}</code>
                  {row.behind > 0 && <span className={sx(paint.s23)}>{row.behind} not in this branch</span>}
                </span>
              )}
              {showScope && (
                <PickOne<Scope>
                  label="Commits to show"
                  align="end"
                  value={scope}
                  onChange={setScope}
                  options={[
                    { value: "branch", label: "This branch" },
                    { value: "all", label: `With ${base}` },
                  ]}
                />
              )}
            </div>

            <SheetPanel container padTop>
              {error ? (
                <p className={sx(paint.s24)}>{error}</p>
              ) : !log ? (
                <div className={sx(paint.s25)}>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div className={sx(paint.s26)}><Skeleton key={i}  /></div>
                  ))}
                </div>
              ) : log.commits.length === 0 || !graph ? (
                <p className={sx(paint.s27)}>No commits.</p>
              ) : (
                <ol className={sx(paint.s28)} style={vars}>
                  {scope === "branch" && row.behind > 0 && (
                    <li>
                      <button type="button" className={sx(paint.s29)} onClick={() => setScope("all")}>
                        <ArrowDownIcon className={sx(paint.s30)} />
                        {baseRef} has {row.behind} newer commit{row.behind === 1 ? "" : "s"} this branch doesn't. Show them
                      </button>
                    </li>
                  )}
                  {graph.rows.map((g, i) => (
                    <CommitRow
                      key={g.commit.sha}
                      row={g}
                      lanes={graph.lanes}
                      height={rowH}
                      // The branch's own commits share one bar down their run.
                      run={g.side === "ahead" ? { first: graph.rows[i - 1]?.side !== "ahead", last: graph.rows[i + 1]?.side !== "ahead" } : undefined}
                      base={baseRef}
                      branch={branch}
                      mergeBase={g.commit.sha === graph.mergeBase}
                      where={row}
                      vars={vars}
                    />
                  ))}
                  <li className={sx(paint.s31)} style={{ paddingLeft: gutterWidth(graph.lanes) }}>
                    {log.commits.length >= limit ? (
                      <Button size="xs" variant="ghost" loading={loadingMore} onClick={() => setLimit((l) => l + PAGE)}>
                        Load {PAGE} more
                      </Button>
                    ) : (
                      <span className={sx(paint.s32)}>Start of history</span>
                    )}
                  </li>
                </ol>
              )}
            </SheetPanel>
          </>
        )}
      </SheetPopup>
    </Sheet>
  );
}

// CommitRow is one line, like `git log --graph --oneline`: graph, hash,
// subject, refs, author, age. A click opens what the line leaves out.
function CommitRow({
  row,
  lanes,
  height,
  run,
  base,
  branch,
  mergeBase,
  where,
  vars,
}: {
  row: GraphRow;
  lanes: number;
  height: number;
  run?: { first: boolean; last: boolean };
  base: string;
  branch: string;
  mergeBase: boolean;
  where: Row;
  vars: CSSProperties;
}) {
  const c = row.commit;
  const refs = parseRefs(c.refs);
  const [open, setOpen] = useState(false);
  return (
    <li>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={[[sx(paint.s33), sx(paint.s75)].filter(Boolean).join(" "), mergeBase && sx(paint.s34)].filter(Boolean).join(" ")}
              style={{ height }}
            />
          }
        >
          {/* The branch's own commits carry a bar in its colour, one line down
              the run of them: it meets the next row's, rounded only at the ends. */}
          {run && <span className={[sx(paint.s35), run.first && sx(paint.s36), run.last && sx(paint.s37)].filter(Boolean).join(" ")} style={{ background: laneColor(0) }} />}
          <GraphGutter row={row} lanes={lanes} height={height} highlight={mergeBase} />
          <code className={[[sx(paint.s38), sx(paint.s76)].filter(Boolean).join(" "), row.side === "ahead" ? sx(paint.s39) : sx(paint.s40)].filter(Boolean).join(" ")}>{c.short}</code>
          <Subject commit={c} merge={row.merge} className={[sx(paint.n0), row.side === "behind" ? sx(paint.n1) : row.side === "shared" && sx(paint.n2)].filter(Boolean).join(" ")} />
          {mergeBase && <span className={sx(paint.s43)}>Branched here</span>}
          {refs.map((r) => (
            <RefChip key={`${r.kind}:${r.name}`} r={r} />
          ))}
          <span className={[sx(paint.s44), sx(paint.s77)].filter(Boolean).join(" ")}>{c.author}</span>
          <span className={sx(paint.s45)}>{ago(c.time)}</span>
        </PopoverTrigger>
        <PopoverPopup side="bottom" align="start" sideOffset={2} style={vars} width="fit">
          {open && <CommitDetails row={row} base={base} branch={branch} mergeBase={mergeBase} where={where} />}
        </PopoverPopup>
      </Popover>
    </li>
  );
}

// Subject shows a merge's own words (the branch it brought in) at full
// strength and git's boilerplate around them muted.
function Subject({ commit: c, merge, className }: { commit: Commit; merge: boolean; className?: string }) {
  const m = merge ? /^(Merge (?:pull request #\d+ from|remote-tracking branch|branch) )(.+?)( into .+)?$/.exec(c.subject) : null;
  if (!m) return <span className={className}>{c.subject}</span>;
  return (
    <span className={className}>
      <span className={sx(paint.s46)}>{m[1]}</span>
      {m[2]}
      {m[3] && <span className={sx(paint.s47)}>{m[3]}</span>}
    </span>
  );
}

// CommitDetails is what a log line leaves out: the whole message, how much
// it changed, where it stands, and its full hash to copy.
function CommitDetails({ row, base, branch, mergeBase, where }: { row: GraphRow; base: string; branch: string; mergeBase: boolean; where: Row }) {
  const c = row.commit;
  const client = useStore((s) => s.client);
  const key = `${where.box}/${where.location}:${c.sha}`;
  const [detail, setDetail] = useState<CommitDetail | "failed" | undefined>(() => details.get(key));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!client || details.has(key)) return;
    let cancelled = false;
    boxApi.exec(client, where.box, where.main ? where.location : `${where.location}/${where.name}`, commitDetailCommand(c.sha), "20s").then(
      (r) => {
        const d = r.exit_code === 0 ? parseCommitDetail(r.output) : undefined;
        if (d) details.set(key, d);
        if (!cancelled) setDetail(d ?? "failed");
      },
      () => !cancelled && setDetail("failed"),
    );
    return () => {
      cancelled = true;
    };
  }, [client, key, where.box, where.location, where.name, where.main, c.sha]);

  const copy = () =>
    navigator.clipboard.writeText(c.sha).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );

  const standing = mergeBase
    ? `Where ${branch} last met ${base}`
    : row.side === "ahead"
      ? `Only on ${branch}, not on ${base} yet`
      : row.side === "behind"
        ? `On ${base}; ${branch} doesn't have it yet`
        : `On ${branch} and ${base}`;

  return (
    <div className={sx(paint.s48)}>
      <div className={sx(paint.s49)}>
        <p className={sx(paint.s50)}>{c.subject}</p>
        {detail === undefined ? (
          <div className={[sx(paint.s51), sx(paint.s78)].filter(Boolean).join(" ")}><Skeleton  /></div>
        ) : (
          detail !== "failed" && detail.body && <p className={sx(paint.s52)}>{detail.body}</p>
        )}
      </div>
      <dl className={sx(paint.s53)}>
        <dt className={sx(paint.s54)}>Author</dt>
        <dd className={sx(paint.s55)}>
          {c.author} · {new Date(c.time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </dd>
        <dt className={sx(paint.s56)}>Changed</dt>
        <dd>
          {detail === undefined ? (
            <div className={sx(paint.s57)}><Skeleton  /></div>
          ) : detail === "failed" || detail.files === undefined ? (
            <span className={sx(paint.s58)}>{detail === "failed" ? "Couldn't read" : "Nothing"}</span>
          ) : (
            <span className={sx(paint.s59)}>
              {detail.files} file{detail.files === 1 ? "" : "s"}
              <span className={sx(paint.s60)}>+{detail.added}</span>
              <span className={sx(paint.s61)}>−{detail.removed}</span>
              {row.merge && <span className={sx(paint.s62)}>vs its first parent</span>}
            </span>
          )}
        </dd>
        <dt className={sx(paint.s63)}>Where</dt>
        <dd className={sx(paint.s64)}>
          <span className={sx(paint.s65)} style={row.side === "behind" ? { border: `1.5px solid ${laneColor(row.color)}` } : { background: laneColor(row.color) }} />
          <span className={sx(paint.s66)}>{standing}</span>
        </dd>
        {row.merge && (
          <>
            <dt className={sx(paint.s67)}>Parents</dt>
            <dd className={sx(paint.s68)}>{c.parents?.map((p) => p.slice(0, 7)).join(" + ")}</dd>
          </>
        )}
      </dl>
      <div className={sx(paint.s69)}>
        <code className={sx(paint.s70)}>{c.sha}</code>
        <Button size="xs" variant="outline" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy SHA"}
        </Button>
      </div>
    </div>
  );
}

interface Ref {
  name: string;
  kind: "head" | "tag" | "remote" | "branch";
}

function RefChip({ r }: { r: Ref }) {
  return (
    <span
      className={[sx(paint.n3), r.kind === "head" ? sx(paint.n4) : r.kind === "tag" ? sx(paint.n5) : r.kind === "remote" ? sx(paint.n6) : sx(paint.n7)].filter(Boolean).join(" ")}
    >
      {r.kind === "head" && "HEAD → "}
      {r.kind === "tag" && "tag "}
      {r.name}
    </span>
  );
}

// parseRefs reads git's decoration, like "HEAD -> fix, origin/main, tag: v1".
function parseRefs(refs?: string): Ref[] {
  return (refs ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r && r !== "HEAD" && !r.endsWith("/HEAD"))
    .map((r): Ref => {
      if (r.startsWith("HEAD -> ")) return { name: r.slice(8), kind: "head" };
      if (r.startsWith("tag: ")) return { name: r.slice(5), kind: "tag" };
      if (/^(origin|upstream)\//.test(r)) return { name: r, kind: "remote" };
      return { name: r, kind: "branch" };
    })
    .slice(0, 3);
}

function ProgressLine({ p }: { p: RowProgress }) {
  const tone = p.state === "ok" ? sx(paint.s80) : p.state === "conflict" ? sx(paint.s81) : p.state === "failed" ? sx(paint.s82) : sx(paint.s83);
  return (
    <div className={[sx(paint.s73), tone].filter(Boolean).join(" ")}>
      {p.state === "running" ? "Working…" : p.message}
      {p.conflicts?.length ? (
        <ul className={sx(paint.s74)}>
          {p.conflicts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
