import * as stylex from "@stylexjs/stylex";
import { ChevronRightIcon, FilePlusIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { agentName, FileGlyph } from "@/components/files/file-bits";
import { Tip } from "@/components/tip";
import { Spinner } from "@/components/ui/spinner";
import { type Filter, loadDir, pickFilter, reveal, setCreating, toggleChangedDir, toggleDir, type TreeRow, useFilter, useTree, useTreeRows, useWorkingSessions } from "@/lib/file-tree";
import { filesApi, type How, type TouchedFile, useFiles } from "@/lib/files";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";
import { folderOf, newFilePath, parentOf, type Touch } from "@/lib/tree-model";
import type { WorktreeRef } from "@/lib/workspaces";

const paint = stylex.create({
  s0: {
    "width": "12px",
    "flexShrink": 0,
    "textAlign": "center",
    "fontFamily": "var(--font-sans)",
    "fontWeight": 600,
    "fontSize": "11px",
    "lineHeight": "1",
  },
  s1: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "10.5px",
    "fontVariantNumeric": "tabular-nums",
  },
  s2: {
    "color": "var(--success-foreground)",
  },
  s3: {
    "color": "var(--destructive-foreground)",
  },
  s4: {
    "position": "relative",
    "display": "flex",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
  },
  s5: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, #d97757 25%, transparent)",
    "animationDuration": "1.8s",
  },
  s6: {
    "width": "12px",
    "height": "12px",
  },
  s7: {
    "position": "relative",
    "display": "flex",
    "height": "26px",
    "cursor": "default",
    "userSelect": "none",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "5px",
    "paddingRight": "8px",
    "fontSize": "13px",
  },
  s8: {
    "backgroundColor": "var(--accent)",
    "color": "var(--accent-foreground)",
  },
  s9: {
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
    },
  },
  s10: {
    "backgroundColor": "color-mix(in oklab, var(--accent) 60%, transparent)",
  },
  s11: {
    "pointerEvents": "none",
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "width": "1px",
    "backgroundColor": "color-mix(in oklab, var(--border) 70%, transparent)",
  },
  s12: {
    "display": "flex",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "color": "var(--muted-foreground)",
  },
  s13: {
    "width": "14px",
    "height": "14px",
    "transitionProperty": "transform",
    "transitionDuration": "100ms",
  },
  s14: {
    "transform": "rotate(90deg)",
  },
  s15: {
    "width": "14px",
    "height": "14px",
  },
  s16: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s17: {
    "color": "color-mix(in oklab, var(--foreground) 90%, transparent)",
  },
  s18: {
    "color": "var(--muted-foreground)",
  },
  s19: {
    "marginLeft": "2px",
    "width": "6px",
    "height": "6px",
    "flexShrink": 0,
    "borderRadius": "999px",
    "backgroundColor": "var(--info)",
  },
  s20: {
    "opacity": 0.45,
  },
  s21: {
    "marginLeft": "auto",
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "paddingLeft": "4px",
  },
  s22: {
    "display": "inline-flex",
    "height": "22px",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "5px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontWeight": 500,
    "fontSize": "11.5px",
    "outline": "none",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s23: {
    "backgroundColor": {
      "default": "light-dark(var(--background), var(--accent))",
    },
    "color": "var(--foreground)",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s24: {
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
  },
  s25: {
    "marginLeft": "auto",
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "1px",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--muted)",
    "padding": "2px",
  },
  s26: {
    "fontVariantNumeric": "tabular-nums",
  },
  s27: {
    "color": "var(--muted-foreground)",
  },
  s28: {
    "color": "color-mix(in oklab, var(--muted-foreground) 70%, transparent)",
  },
  s29: {
    "marginLeft": "6px",
    "marginRight": "6px",
    "marginTop": "6px",
    "marginBottom": "4px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s30: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s31: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s32: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "backgroundColor": "transparent",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "outline": "none",
    "color": {
      "::placeholder": "color-mix(in oklab, var(--muted-foreground) 70%, transparent)",
    },
  },
  s33: {
    "marginTop": "4px",
    "color": "var(--destructive-foreground)",
    "fontSize": "11px",
    "lineHeight": "1.375",
  },
  s34: {
    "marginTop": "4px",
    "display": "flex",
    "minWidth": "0px",
    "gap": "4px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s35: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s36: {
    "flexShrink": 0,
  },
  s37: {
    "display": "flex",
    "minHeight": "0px",
    "flexDirection": "column",
  },
  s38: {
    "display": "flex",
    "height": "32px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingRight": "6px",
    "paddingLeft": "12px",
  },
  s39: {
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s40: {
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "outline": "none",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s41: {
    "width": "14px",
    "height": "14px",
  },
  s42: {
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "outline": "none",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s43: {
    "width": "14px",
    "height": "14px",
  },
  s44: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
    "overscrollBehavior": "contain",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "4px",
    "paddingBottom": "8px",
    "outline": "none",
    "scrollbarWidth": "thin",
  },
  s45: {
    "display": "flex",
    "justifyContent": "center",
    "paddingTop": "24px",
    "paddingBottom": "24px",
  },
  s46: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s47: {
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "center",
    "gap": "4px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "32px",
    "paddingBottom": "32px",
    "textAlign": "center",
  },
  s48: {
    "color": "var(--foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s49: {
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s50: {
    "flexShrink": 0,
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "lineHeight": "1.375",
  },
  s51: {
    "display": "flex",
    "height": "28px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s52: {
    "width": "12px",
    "height": "12px",
  },
  s53: {
    "marginLeft": "auto",
    "fontFamily": "var(--font-mono)",
    "fontVariantNumeric": "tabular-nums",
  },
  s54: {
    "color": "var(--success-foreground)",
  },
  s55: {
    "color": "var(--destructive-foreground)",
  },
  n0: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  n1: {
    "color": "color-mix(in oklab, var(--foreground) 90%, transparent)",
  },
  n2: {
    "color": "var(--foreground)",
  },
  n3: {
    "color": "color-mix(in oklab, var(--foreground) 85%, transparent)",
  },
  n4: {
    "color": "var(--muted-foreground)",
  },
  n5: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  n6: {
    "color": "var(--muted-foreground)",
    "textDecoration": "line-through",
  },

  s56: {
    textDecorationColor: "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
  },
  s57: {
    color: "var(--info-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The Files panel's tree (components/files/tree-dock.tsx places it): the
// worktree's files a folder at a time (All), or only what its agents
// touched this turn (Changed), with +/− and A/M/D. A blue dot marks a
// folder with changes inside (amber means "needs you" in Burf, so not
// that); the file an agent is writing now gets a quiet live mark, and its
// folders' dots pulse. New file is the only thing it does to files: no
// rename, delete, move or drag.

const INDENT = 12;

// Badge is a file's letter: A, the turn made it; M, it changed it; D, it
// deleted it.
function Badge({ t }: { t: Touch }) {
  const [letter, cls, word] = t.deleted ? ["D", sx(paint.s55), "Deleted"] : t.created ? ["A", sx(paint.s54), "Added"] : ["M", sx(paint.s57), "Modified"];
  return (
    <span aria-label={`${word} by ${agentName(t.agent)} this turn`} data-testid="tree-badge" className={[sx(paint.s0), cls].filter(Boolean).join(" ")}>
      {letter}
    </span>
  );
}

function Counts({ t }: { t: Touch }) {
  return (
    <span className={sx(paint.s1)}>
      {t.added > 0 && <span className={sx(paint.s2)}>+{t.added}</span>}
      {t.removed > 0 && <span className={sx(paint.s3)}>−{t.removed}</span>}
    </span>
  );
}

// Live is the quiet mark on a file the agent is writing now.
function Live({ agent }: { agent?: string }) {
  return (
    <Tip label={`${agentName(agent)} is writing this now`} side="left">
      <span data-testid="tree-live" className={sx(paint.s4)}>
        <span aria-hidden className={[sx(paint.s5), "burf-ping"].filter(Boolean).join(" ")} />
        <AgentIcon agent={agent} className={sx(paint.s6)} />
      </span>
    </Tip>
  );
}

function RowView({ row, index, active, current, filter, onPick }: { row: TreeRow; index: number; active: boolean; current: boolean; filter: Filter; onPick(row: TreeRow, how: How): void }) {
  const t = row.touched;
  const dir = row.kind === "dir";
  return (
    <div
      id={`tree-row-${index}`}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={dir && !row.empty ? !!row.open : undefined}
      aria-selected={active}
      aria-current={current ? "page" : undefined}
      data-index={index}
      data-path={row.path}
      data-kind={row.kind}
      data-live={row.live || undefined}
      onClick={(e) => onPick(row, e.metaKey || e.ctrlKey ? "external" : e.altKey ? "split" : "tab")}
      className={[[sx(paint.s7), "group/row"].filter(Boolean).join(" "), active ? sx(paint.s8) : sx(paint.s9), current && !active && sx(paint.s10)].filter(Boolean).join(" ")}
      style={{ paddingLeft: 6 + row.depth * INDENT }}
    >
      {/* Indent guides, one per level above. */}
      {Array.from({ length: row.depth }, (_, i) => (
        <span key={i} aria-hidden className={sx(paint.s11)} style={{ left: 6 + i * INDENT + 6 }} />
      ))}
      {dir ? (
        <span className={sx(paint.s12)}>
          {row.loading ? <Spinner  size="sm"/> : row.empty ? null : <ChevronRightIcon className={[sx(paint.s13), row.open && sx(paint.s14)].filter(Boolean).join(" ")} />}
        </span>
      ) : (
        <FileGlyph path={row.path} className={sx(paint.s15)} />
      )}
      <span className={[sx(paint.n0), dir ? sx(paint.n1) : t && !t.deleted ? sx(paint.n2) : sx(paint.n3), row.empty && sx(paint.n4), current && sx(paint.n5), t?.deleted && [sx(paint.n6), sx(paint.s56)].filter(Boolean).join(" ")].filter(Boolean).join(" ")}>
        {dir && row.name.includes("/") ? (
          <>
            {row.name
              .split("/")
              .slice(0, -1)
              .map((p, i) => (
                <span key={i} className={sx(paint.s18)}>
                  {p}/
                </span>
              ))}
            {row.name.split("/").pop()}
          </>
        ) : (
          row.name
        )}
      </span>
      {dir && !!row.inside && (
        <Tip label={`${row.inside} ${row.inside === 1 ? "file" : "files"} changed inside`} side="left" delay={500}>
          <span data-testid="tree-dot" data-live={row.liveInside || undefined} className={[sx(paint.s19), row.open && filter === "all" && sx(paint.s20), row.liveInside && "burf-pulse"].filter(Boolean).join(" ")} />
        </Tip>
      )}
      <span className={sx(paint.s21)}>
        {row.live && <Live agent={t?.agent} />}
        {t && filter === "changed" && !t.deleted && <Counts t={t} />}
        {t && <Badge t={t} />}
      </span>
    </div>
  );
}

// FilterSwitch is All | Changed, with how many files the agents changed.
function FilterSwitch({ filter, onChange, count }: { filter: Filter; onChange(f: Filter): void; count: number }) {
  const item = (f: Filter, label: React.ReactNode) => (
    <button
      type="button"
      role="radio"
      aria-checked={filter === f}
      data-testid={`tree-filter-${f}`}
      onClick={() => onChange(f)}
      className={[sx(paint.s22), filter === f ? sx(paint.s23) : sx(paint.s24)].filter(Boolean).join(" ")}
    >
      {label}
    </button>
  );
  return (
    <span role="radiogroup" aria-label="Show" className={sx(paint.s25)}>
      {item("all", "All")}
      {item(
        "changed",
        <>
          Changed
          {count > 0 && <span className={[sx(paint.s26), filter === "changed" ? sx(paint.s27) : sx(paint.s28)].filter(Boolean).join(" ")}>{count}</span>}
        </>,
      )}
    </span>
  );
}

// NewFile is New file: a name typed in place, in the folder you are on (a
// path from the top starts with /), made empty with If-None-Match: * so it
// never replaces a file, then opened in a File tab.
function NewFile({ ws, wref, dir, onDone }: { ws: string; wref: WorktreeRef; dir: string; onDone(path?: string): void }) {
  const client = useStore((s) => s.client);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const make = async () => {
    const path = newFilePath(dir, name);
    if (!path) {
      if (name.trim()) setError("Name a file in this worktree, like util.ts or lib/util.ts.");
      return;
    }
    if (!client || busy) return;
    setBusy(true);
    try {
      await filesApi.write(client, wref, path, "", undefined);
      reveal(ws, path);
      void loadDir(ws, wref, parentOf(path), true);
      onDone(path);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <div className={sx(paint.s29)} data-testid="tree-new-file">
      <div className={sx(paint.s30)}>
        <FilePlusIcon className={sx(paint.s31)} />
        <input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && !e.nativeEvent.isComposing) void make();
            if (e.key === "Escape") onDone();
          }}
          onBlur={() => !name.trim() && !busy && onDone()}
          placeholder="new-file.ts"
          aria-label="New file's name"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className={sx(paint.s32)}
        />
        {busy && <Spinner  size="sm"/>}
      </div>
      {error ? (
        <p role="alert" className={sx(paint.s33)}>
          {error}
        </p>
      ) : (
        <p className={sx(paint.s34)}>
          {/* The folder's end shows when it is long: "…/lib/payments/". */}
          <span className={sx(paint.s35)} dir="rtl">
            <bdi>in {dir ? `${dir}/` : "the top folder"}</bdi>
          </span>
          <span className={sx(paint.s36)}>· ↵ · esc</span>
        </p>
      )}
    </div>
  );
}

// treeKey moves through rows: ↑↓, → opens a folder or goes into it, ← closes
// it or goes up, ↵ opens a file (⌥↵ beside, ⌘↵ in your editor).
function treeKey(e: React.KeyboardEvent, rows: TreeRow[], at: number, setAt: (i: number) => void, pick: (row: TreeRow, how: How) => void, toggle: (row: TreeRow, open?: boolean) => void): boolean {
  const row = rows[at];
  if (e.key === "ArrowDown") setAt(Math.min(rows.length - 1, at + 1));
  else if (e.key === "ArrowUp") setAt(Math.max(0, at - 1));
  else if (e.key === "Home") setAt(0);
  else if (e.key === "End") setAt(rows.length - 1);
  else if (e.key === "ArrowRight" && row?.kind === "dir" && !row.empty) {
    if (!row.open) toggle(row, true);
    else if (rows[at + 1]?.depth === row.depth + 1) setAt(at + 1);
  } else if (e.key === "ArrowLeft" && row) {
    if (row.kind === "dir" && row.open) toggle(row, false);
    else {
      for (let i = at - 1; i >= 0; i--)
        if (rows[i].depth < row.depth) {
          setAt(i);
          break;
        }
    }
  } else if (e.key === "Enter" && row) {
    if (e.nativeEvent.isComposing) return true;
    pick(row, e.metaKey || e.ctrlKey ? "external" : e.altKey ? "split" : "tab");
  } else return false;
  e.preventDefault();
  return true;
}

// TreePanel is the tree with its header: Files, All | Changed, New file,
// and hide.
export function TreePanel({ ws, wref, current, onOpen, onClose, className }: { ws: string; wref: WorktreeRef; current?: string; onOpen(path: string, how: How): void; onClose(): void; className?: string }) {
  const working = useWorkingSessions(wref);
  const filter = useFilter(ws, working.size > 0);
  const creating = useTree((s) => (s.creating?.ws === ws ? s.creating : undefined));
  const touched = useFiles((s) => s.touched[ws]?.files);
  const { rows, truncated, loading, error } = useTreeRows(ws, wref, filter, working);
  const [at, setAt] = useState(-1);
  const list = useRef<HTMLDivElement>(null);
  // The open file's folders open with it.
  useEffect(() => {
    if (current) reveal(ws, current);
  }, [ws, current]);
  // Another worktree, view or file in front: the list's place is the file
  // in front again.
  useEffect(() => setAt(-1), [ws, filter, current]);
  const curIndex = useMemo(() => (current ? rows.findIndex((r) => r.path === current) : -1), [rows, current]);
  const focusAt = at >= 0 ? Math.min(at, rows.length - 1) : curIndex;
  // Scroll to the open file when it changes (once its row is there), and
  // with the keyboard; never when a folder opens above or below it.
  const shown = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (at >= 0) list.current?.querySelector(`[data-index="${at}"]`)?.scrollIntoView({ block: "nearest" });
  }, [at]);
  useEffect(() => {
    if (!current || shown.current === current || curIndex < 0) return;
    shown.current = current;
    list.current?.querySelector(`[data-index="${curIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current, curIndex]);
  const count = touched?.length ?? 0;

  const toggle = (row: TreeRow, open?: boolean) => {
    if (row.empty) return;
    if (filter === "changed") toggleChangedDir(ws, row.path, open);
    else toggleDir(ws, row.path, open);
  };
  const pick = (row: TreeRow, how: How) => {
    setAt(rows.indexOf(row));
    if (row.kind === "dir") return toggle(row);
    onOpen(row.path, how);
  };

  return (
    <div className={[sx(paint.s37), className].filter(Boolean).join(" ")} data-testid="file-tree" data-filter={filter}>
      {/* The File tab's header line: 32px, so the two read as one row. */}
      <div className={sx(paint.s38)}>
        <span className={sx(paint.s39)}>Files</span>
        <FilterSwitch filter={filter} onChange={(f) => pickFilter(ws, f)} count={count} />
        <Tip label="New file" side="bottom">
          <button type="button" aria-label="New file" data-testid="tree-new-file-button" onClick={() => setCreating({ ws, dir: folderOf(rows[focusAt]) })} className={sx(paint.s40)}>
            <FilePlusIcon className={sx(paint.s41)} />
          </button>
        </Tip>
        <Tip label="Hide files (⌘⇧E)" side="bottom">
          <button type="button" aria-label="Hide files" onClick={onClose} className={sx(paint.s42)}>
            <XIcon className={sx(paint.s43)} />
          </button>
        </Tip>
      </div>
      {creating && (
        <NewFile
          key={creating.dir}
          ws={ws}
          wref={wref}
          dir={creating.dir}
          onDone={(p) => {
            setCreating(undefined);
            if (p) onOpen(p, "tab");
          }}
        />
      )}
      <div
        ref={list}
        role="tree"
        aria-label="Files"
        tabIndex={0}
        aria-activedescendant={focusAt >= 0 ? `tree-row-${focusAt}` : undefined}
        onKeyDown={(e) => treeKey(e, rows, Math.max(0, focusAt), setAt, pick, toggle)}
        className={sx(paint.s44)}
      >
        {filter === "all" && loading && !rows.length ? (
          <div className={sx(paint.s45)}>
            <Spinner  size="lg" muted/>
          </div>
        ) : filter === "all" && error ? (
          <p className={sx(paint.s46)}>{error}</p>
        ) : filter === "changed" && !rows.length ? (
          <div className={sx(paint.s47)} data-testid="tree-nothing-changed">
            <p className={sx(paint.s48)}>Nothing changed this turn</p>
            <p className={sx(paint.s49)}>Files the agent edits show here as it goes.</p>
          </div>
        ) : (
          rows.map((r, i) => <RowView key={r.path} row={r} index={i} active={i === at} current={r.path === current} filter={filter} onPick={pick} />)
        )}
      </div>
      {filter === "changed" && count > 0 && <ChangedFooter files={touched ?? []} />}
      {filter === "all" && truncated && (
        <p className={sx(paint.s50)} data-testid="tree-truncated">
          A folder here has more than 5,000 entries; it lists the first 5,000.
        </p>
      )}
    </div>
  );
}

// ChangedFooter sums what the agents changed this turn.
function ChangedFooter({ files }: { files: TouchedFile[] }) {
  const added = files.reduce((n, f) => n + f.added, 0);
  const removed = files.reduce((n, f) => n + f.removed, 0);
  const agents = [...new Set(files.map((f) => f.agent))];
  return (
    <div className={sx(paint.s51)} data-testid="tree-changed-footer">
      {agents.length === 1 && <AgentIcon agent={agents[0]} className={sx(paint.s52)} />}
      <span>
        {files.length} {files.length === 1 ? "file" : "files"} this turn
      </span>
      <span className={sx(paint.s53)}>
        <span className={sx(paint.s54)}>+{added}</span> <span className={sx(paint.s55)}>−{removed}</span>
      </span>
    </div>
  );
}
