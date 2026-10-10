import * as stylex from "@stylexjs/stylex";
import { AlertTriangleIcon, ArrowDownIcon, ArrowUpIcon, CheckIcon, EllipsisIcon, HouseIcon, PauseIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { Tip } from "@/components/tip";
import { Checkbox } from "@/components/ui/checkbox";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { agentOf, sessionName, sessionState } from "@/lib/derive";
import { ago } from "@/lib/format";
import { previewUrl } from "@/lib/preview";
import { NONE, useStore } from "@/lib/store";
import { removalLabel, useRemoval } from "@/lib/removing";
import { ProjectLabel } from "@/views/automations/flows/project-label";
import type { RowProgress } from "@/views/worktrees/use-bulk";
import type { Row } from "@/views/worktrees/use-worktrees";
import { sessionWord } from "@/lib/state-model";

const paint = stylex.create({
  s0: {
    "position": "sticky",
    "top": "0px",
    "zIndex": 20,
    "display": "grid",
    "height": "32px",
    "alignItems": "center",
    "gap": "12px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s1: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s2: {
    "display": "flex",
    "alignItems": "center",
  },
  s3: {
    "width": "fit-content",
  },
  s4: {
    "width": "fit-content",
  },
  s5: {
    "width": "fit-content",
  },
  s6: {
    "width": "fit-content",
  },
  s7: {
    "position": "sticky",
    "top": "32px",
    "zIndex": 10,
    "display": "grid",
    "height": "32px",
    "alignItems": "center",
    "gap": "12px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in srgb,var(--color-muted) 60%,var(--color-background))",
    "paddingLeft": "16px",
    "paddingRight": "16px",
  },
  s8: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "fontWeight": 500,
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s9: {
    "fontWeight": 400,
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s10: {
    "display": "grid",
    "height": "var(--row-h)",
    "cursor": "pointer",
    "alignItems": "center",
    "gap": "12px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "borderColor": "color-mix(in oklab, var(--border) 60%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "outline": "none",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 40%, transparent)",
      ":focus-visible": "color-mix(in oklab, var(--accent) 40%, transparent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px color-mix(in oklab, var(--ring) 48%, transparent)",
    },
  },
  s11: {
    "backgroundColor": {
      "default": "color-mix(in oklab, var(--primary) 6%, transparent)",
      ":hover": "color-mix(in oklab, var(--primary) 9%, transparent)",
    },
  },
  s12: {
    "backgroundColor": "color-mix(in oklab, var(--accent) 60%, transparent)",
  },
  s13: {
    "color": "var(--muted-foreground)",
  },
  s14: {
    "cursor": "default",
    "color": "var(--muted-foreground)",
    "backgroundColor": {
      ":hover": "transparent",
    },
    ":not(#\\#) > *:not(:nth-child(-n+2))": {
      "opacity": 0.5,
    },
  },
  s15: {
    "display": "flex",
    "height": "100%",
    "alignItems": "center",
  },
  s16: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
  },
  s17: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s18: {
    "maxWidth": "100%",
    "flexShrink": 0,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s19: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s20: {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "2px",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--warning) 12%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontSize": "10px",
    "color": "var(--warning-foreground)",
  },
  s21: {
    "width": "10px",
    "height": "10px",
  },
  s22: {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "999px",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s23: {
    "display": "flex",
    "width": "fit-content",
    "alignItems": "center",
    "gap": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s24: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "2px",
  },
  s25: {
    "color": "var(--foreground)",
  },
  s26: {
    "color": "var(--muted-foreground)",
  },
  s27: {
    "width": "12px",
    "height": "12px",
  },
  s28: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "2px",
  },
  s29: {
    "color": "var(--warning-foreground)",
  },
  s30: {
    "width": "12px",
    "height": "12px",
  },
  s31: {
    "display": "flex",
    "width": "fit-content",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s32: {
    "color": "var(--muted-foreground)",
  },
  s33: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s34: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "var(--warning)",
  },
  s35: {
    "color": "var(--success-foreground)",
  },
  s36: {
    "minWidth": "0px",
  },
  s37: {
    "fontFamily": "var(--font-mono)",
  },
  s38: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "baseline",
    "gap": "8px",
  },
  s39: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s40: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s41: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s42: {
    "color": "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s43: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
  },
  s44: {
    "display": "flex",
    "width": "fit-content",
    "alignItems": "center",
    "gap": "6px",
  },
  s45: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "2px",
  },
  s46: {
    "width": "12px",
    "height": "12px",
  },
  s47: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s48: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s49: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s50: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
  },
  s51: {
    "backgroundColor": "var(--success)",
  },
  s52: {
    "textAlign": "right",
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s53: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "flex-end",
    "gap": "2px",
  },
  s54: {
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s55: {
    "width": "14px",
    "height": "14px",
  },
  s56: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
  },
  s57: {
    "fontFamily": "var(--font-mono)",
  },
  s58: {
    "color": "var(--muted-foreground)",
  },
  s59: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
  },
  s60: {
    "width": "14px",
    "height": "14px",
    "color": "var(--success-foreground)",
  },
  s61: {
    "width": "14px",
    "height": "14px",
    "color": "var(--warning)",
  },
  s62: {
    "width": "14px",
    "height": "14px",
    "color": "var(--destructive-foreground)",
  },
  s63: {
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s64: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
  },
  n0: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "2px",
  },
  n1: {
    "color": "var(--warning-foreground)",
  },
  n2: {
    "color": "var(--foreground)",
  },
  n3: {
    "color": "var(--muted-foreground)",
  },

  s65: {
    containerType: "inline-size",
  },
  s66: {
    justifySelf: "end",
    "@container (max-width: 64rem)": {
      display: "none",
    },
  },
  s67: {
    gridColumn: "2/-1",
  },
  s68: {
    scrollMarginTop: 64,
  },
  s69: {
    "@container (max-width: 64rem)": {
      display: "none",
    },
  },
  s70: {
    gridTemplateColumns: "2rem minmax(180px,1.2fr) 6rem 6rem minmax(240px,2fr) 5.5rem 4rem 2.75rem",
    "@container (max-width: 64rem)": {
      gridTemplateColumns: "2rem minmax(160px,1.2fr) 5.5rem 5.5rem minmax(200px,2fr) 4.5rem 2.75rem",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export interface Group {
  key: string;
  box: string;
  location: string;
  rows: Row[];
}

// One grid for the header and every row, so the columns line up. Below
// 1024px of table the port moves into the worktree's tooltip and agents
// narrow, so the last commit keeps room to be read.
export const COLS =
  (sx(paint.s70) ?? "");


// WorktreeTable lists worktrees by project, one line each. Checkboxes
// select, shift-click selects a range, and a row click opens its latest
// chat. History, rebase and open stay on the sheet, from the row's ⋯.
//
// From the keyboard the rows are one stop: Tab lands on the last row
// focused (the first, to begin with), ↑ and ↓ move between rows across
// projects, Home and End jump, Space selects (⇧Space a range) and Enter
// opens.
export function WorktreeTable({
  groups,
  selected,
  progress,
  onToggle,
  onToggleGroup,
  onToggleAll,
  onOpen,
  onHistory,
  openKey,
}: {
  groups: Group[];
  selected: Set<string>;
  progress: Record<string, RowProgress>;
  onToggle(r: Row, shift: boolean): void;
  onToggleGroup(g: Group, on: boolean): void;
  onToggleAll(on: boolean): void;
  onOpen(r: Row): void;
  onHistory(r: Row): void;
  openKey?: string;
}) {
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const flat = groups.flatMap((g) => g.rows.map((r) => r.key));
  const [cursor, setCursor] = useState<string>();
  // The row that takes Tab: the last one focused, while it is still shown.
  const stop = cursor && flat.includes(cursor) ? cursor : (openKey && flat.includes(openKey) ? openKey : flat[0]);
  const listRef = useRef<HTMLDivElement>(null);
  const move = (from: string, key: string) => {
    const i = flat.indexOf(from);
    const to = key === "ArrowDown" ? i + 1 : key === "ArrowUp" ? i - 1 : key === "Home" ? 0 : flat.length - 1;
    const next = flat[Math.max(0, Math.min(flat.length - 1, to))];
    if (!next || next === from) return;
    setCursor(next);
    listRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(next)}"]`)?.focus();
  };
  return (
    <div ref={listRef} className={sx(paint.s65)}>
      <div className={[sx(paint.s0), COLS].filter(Boolean).join(" ")}>
        <Tip
          label={
            <span className={sx(paint.s1)}>
              Select all <Kbd>⌘A</Kbd> · <Kbd>⇧</Kbd>-click selects a range
            </span>
          }
        >
          <span className={sx(paint.s2)}>
            <Checkbox checked={selected.size > 0 && selected.size === total} indeterminate={selected.size > 0 && selected.size < total} onCheckedChange={(on) => onToggleAll(!!on)} aria-label="Select every worktree shown" />
          </span>
        </Tip>
        <span>Worktree</span>
        <Tip width="sm" label="Commits ahead of its base, and behind it">
          <span className={sx(paint.s3)}>vs base</span>
        </Tip>
        <Tip width="sm" label="Uncommitted: modified and untracked files">
          <span className={sx(paint.s4)}>Changes</span>
        </Tip>
        <span>Last commit</span>
        <Tip width="sm" label="Sessions in it, and dev servers it runs">
          <span className={sx(paint.s5)}>Agents</span>
        </Tip>
        <Tip width="sm" label="Its first port, on its own box">
          <span className={[sx(paint.s6), sx(paint.s66)].filter(Boolean).join(" ")}>Port</span>
        </Tip>
        <span />
      </div>
      {groups.map((g) => {
        const n = g.rows.filter((r) => selected.has(r.key)).length;
        return (
          <section key={g.key} aria-label={`${g.location} on ${g.box}`}>
            <header className={[sx(paint.s7), COLS].filter(Boolean).join(" ")}>
              <Checkbox
                checked={n > 0 && n === g.rows.length}
                indeterminate={n > 0 && n < g.rows.length}
                onCheckedChange={(on) => onToggleGroup(g, !!on)}
                aria-label={`Select every worktree in ${g.location} on ${g.box}`}
              />
              <span className={[sx(paint.s8), sx(paint.s67)].filter(Boolean).join(" ")}>
                <ProjectLabel box={g.box} scope={`repo:${g.location}`} />
                <span className={sx(paint.s9)}>{g.rows.length}</span>
              </span>
            </header>
            <div role="listbox" aria-multiselectable aria-label={`Worktrees in ${g.location} on ${g.box}`}>
              {g.rows.map((r) => (
                <WorktreeRow
                  key={r.key}
                  row={r}
                  selected={selected.has(r.key)}
                  progress={progress[r.key]}
                  open={openKey === r.key}
                  tabStop={stop === r.key}
                  onFocus={() => setCursor(r.key)}
                  onMove={(key) => move(r.key, key)}
                  onToggle={(shift) => onToggle(r, shift)}
                  onOpen={() => onOpen(r)}
                  onHistory={() => onHistory(r)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function WorktreeRow({
  row: r,
  selected,
  progress,
  open,
  tabStop,
  onFocus,
  onMove,
  onToggle,
  onOpen,
  onHistory,
}: {
  row: Row;
  selected: boolean;
  progress?: RowProgress;
  open: boolean;
  tabStop: boolean;
  onFocus(): void;
  onMove(key: string): void;
  onToggle(shift: boolean): void;
  onOpen(): void;
  onHistory(): void;
}) {
  const sessions = useStore((s) => s.boxes[r.box]?.sessions) ?? NONE;
  const stats = useStore((s) => s.boxes[r.box]?.stats);
  const services = useStore((s) => s.boxes[r.box]?.services) ?? NONE;
  const mine = sessions.filter((s) => s.dir === r.path && !s.exited);
  const serving = services.filter((s) => s.path === r.path);
  const c = r.last_commit;
  const name = r.main ? r.location : r.name;
  const base = r.base ?? "its base";
  const s = (n: number) => (n === 1 ? "" : "s");
  // Being archived or removed: dimmed, and nothing opens it (lib/removing.ts).
  const leaving = useRemoval(r.box, r.path);

  return (
    <div
      role="option"
      data-row={r.key}
      tabIndex={tabStop ? 0 : -1}
      aria-selected={selected}
      aria-label={name}
      aria-disabled={leaving ? true : undefined}
      aria-busy={leaving ? true : undefined}
      onClick={leaving ? undefined : onOpen}
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === "Enter") {
          if (!leaving) onOpen();
        } else if (e.key === " ") {
          e.preventDefault();
          onToggle(e.shiftKey);
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
          e.preventDefault();
          onMove(e.key);
        }
      }}
      className={[[sx(paint.s10), [sx(paint.s68), "group"].filter(Boolean).join(" ")].filter(Boolean).join(" "), COLS, selected && sx(paint.s11), open && sx(paint.s12), r.paused && sx(paint.s13), leaving && sx(paint.s14)].filter(Boolean).join(" ")}
    >
      {/* The checkbox selects; it never opens the row. */}
      <span
        onClick={(e) => {
          e.stopPropagation();
          onToggle(e.shiftKey);
        }}
        className={sx(paint.s15)}
      >
        <Checkbox checked={selected} tabIndex={-1} aria-label={`Select ${name}`} passive />
      </span>

      <Tip width="sm" label={<NameTip row={r} />}>
        <div className={sx(paint.s16)}>
          {r.main && <HouseIcon className={sx(paint.s17)} aria-label="Main checkout" />}
          <span className={sx(paint.s18)}>{name}</span>
          {r.branch && r.branch !== name && <span className={sx(paint.s19)}>{r.branch}</span>}
          {r.paused && (
            <span className={sx(paint.s20)}>
              <PauseIcon className={sx(paint.s21)} />
              Paused
            </span>
          )}
          {leaving && (
            <span className={sx(paint.s22)}>
              <Spinner  size="xs"/>
              {removalLabel(leaving)}
            </span>
          )}
        </div>
      </Tip>

      <Tip width="sm" label={r.ahead || r.behind ? `${r.ahead} commit${s(r.ahead)} ahead of ${base}, ${r.behind} behind` : `Even with ${base}`}>
        <div className={sx(paint.s23)}>
          <span className={[sx(paint.s24), r.ahead ? sx(paint.s25) : sx(paint.s26)].filter(Boolean).join(" ")}>
            <ArrowUpIcon className={sx(paint.s27)} />
            {r.ahead}
          </span>
          <span className={[sx(paint.n0), r.behind >= 10 ? sx(paint.n1) : r.behind ? sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")}>
            <ArrowDownIcon className={sx(paint.s30)} />
            {r.behind}
          </span>
        </div>
      </Tip>

      <Tip width="sm" label={r.changed || r.untracked ? [r.changed && `${r.changed} modified`, r.untracked && `${r.untracked} untracked`].filter(Boolean).join(", ") : "No uncommitted changes"}>
        <div className={sx(paint.s31)}>
          {r.changed === 0 && r.untracked === 0 ? (
            <span className={sx(paint.s32)}>Clean</span>
          ) : (
            <>
              {r.changed > 0 && (
                <span className={sx(paint.s33)}>
                  <span className={sx(paint.s34)} />
                  {r.changed}
                </span>
              )}
              {r.untracked > 0 && <span className={sx(paint.s35)}>+{r.untracked}</span>}
            </>
          )}
        </div>
      </Tip>

      <div className={sx(paint.s36)}>
        {c ? (
          <Tip
            label={
              <>
                <span className={sx(paint.s37)}>{c.short}</span> · {c.author} · {new Date(c.time).toLocaleString()}
              </>
            }
          >
            <div className={sx(paint.s38)}>
              <span className={sx(paint.s39)}>{c.subject}</span>
              <span className={sx(paint.s40)}>{ago(c.time)}</span>
            </div>
          </Tip>
        ) : (
          <span className={sx(paint.s41)}>{r.error ?? "No commits"}</span>
        )}
      </div>

      {mine.length === 0 && serving.length === 0 ? (
        <span className={sx(paint.s42)}>—</span>
      ) : (
        <Tip
          label={
            <span className={sx(paint.s43)}>
              {mine.map((x) => {
                const a = agentOf(x);
                return <span key={x.name}>{a ? `${sessionName(x, { sessions: mine })} ${r.paused ? "paused" : sessionWord(sessionState(x, stats), true)}` : sessionName(x, { sessions: mine })}</span>;
              })}
              {serving.map((x) => (
                <span key={x.port}>
                  :{x.port} {x.process ?? "server"} {r.paused ? "stopped" : "running"}
                </span>
              ))}
            </span>
          }
        >
          <div className={sx(paint.s44)}>
            {mine.slice(0, 3).map((x) => (
              <span key={x.name} className={sx(paint.s45)}>
                <AgentIcon agent={agentOf(x)} />
                {!r.paused && <StateGlyph state={sessionState(x, stats)} className={sx(paint.s46)} />}
              </span>
            ))}
            {mine.length > 3 && <span className={sx(paint.s47)}>+{mine.length - 3}</span>}
            {serving.length > 0 && (
              <span className={sx(paint.s48)}>
                <span className={[sx(paint.s49), r.paused ? sx(paint.s50) : sx(paint.s51)].filter(Boolean).join(" ")} />
                {serving.length}
              </span>
            )}
          </div>
        </Tip>
      )}

      <span className={[sx(paint.s52), sx(paint.s69)].filter(Boolean).join(" ")}>{r.port ?? ""}</span>

      <span className={sx(paint.s53)}>
        <ProgressMark p={progress} />
        {!leaving && (
          <Tip label="History">
            <button
              type="button"
              aria-label={`History for ${name}`}
              className={sx(paint.s54)}
              onClick={(e) => {
                e.stopPropagation();
                onHistory();
              }}
            >
              <EllipsisIcon className={sx(paint.s55)} />
            </button>
          </Tip>
        )}
      </span>
    </div>
  );
}

// NameTip says where a worktree is: its branch, and the port and address
// its dev server answers on, which are per box.
function NameTip({ row: r }: { row: Row }) {
  const loc = useStore((s) => s.boxes[r.box]?.locations?.find((l) => l.name === r.location));
  const wt = loc?.worktrees?.find((w) => w.path === r.path);
  return (
    <span className={sx(paint.s56)}>
      <span>
        {r.main ? "Main checkout" : "Worktree"} on {r.box}
        {r.branch && (
          <>
            {" · "}
            <span className={sx(paint.s57)}>{r.branch}</span>
          </>
        )}
      </span>
      {r.port !== undefined && (
        <span className={sx(paint.s58)}>
          Port {r.port} on {r.box}
          {loc && wt ? ` · ${previewUrl(r.box, loc, wt, r.port)}` : ""}
        </span>
      )}
    </span>
  );
}

function ProgressMark({ p }: { p?: RowProgress }) {
  if (!p) return <span />;
  const body =
    p.state === "running" ? (
      <Spinner  size="md"/>
    ) : p.state === "queued" ? (
      <span className={sx(paint.s59)} />
    ) : p.state === "ok" ? (
      <CheckIcon className={sx(paint.s60)} />
    ) : p.state === "conflict" ? (
      <AlertTriangleIcon className={sx(paint.s61)} />
    ) : p.state === "failed" ? (
      <XIcon className={sx(paint.s62)} />
    ) : (
      <span className={sx(paint.s63)}>—</span>
    );
  const label =
    p.state === "queued"
      ? "Waiting its turn"
      : p.state === "running"
        ? "Working…"
        : p.conflicts?.length
          ? `Conflicts in ${p.conflicts.length} file${p.conflicts.length === 1 ? "" : "s"}: ${p.conflicts.join(", ")}`
          : p.state === "skipped"
            ? `Skipped: ${p.message ?? ""}`
            : (p.message ?? p.state);
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={sx(paint.s64)} />}>{body}</TooltipTrigger>
      <TooltipPopup width="sm">{label}</TooltipPopup>
    </Tooltip>
  );
}
