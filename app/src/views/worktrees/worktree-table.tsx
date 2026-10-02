import { AlertTriangleIcon, ArrowDownIcon, ArrowUpIcon, CheckIcon, PauseIcon, XIcon } from "lucide-react";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { agentOf, sessionState } from "@/lib/derive";
import { ago } from "@/lib/format";
import { NONE, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ProjectLabel } from "@/views/automations/flows/project-label";
import type { RowProgress } from "@/views/worktrees/use-bulk";
import type { Row } from "@/views/worktrees/use-worktrees";

export interface Group {
  key: string;
  box: string;
  location: string;
  rows: Row[];
}

// One grid for the header and every row, so the columns line up.
export const COLS = "grid-cols-[2rem_minmax(0,1.5fr)_5.5rem_6.5rem_minmax(0,2fr)_7rem_3.5rem_1.75rem]";

// WorktreeTable lists worktrees by project. Checkboxes select, shift-click
// selects a range, and a row click opens its history.
export function WorktreeTable({
  groups,
  selected,
  progress,
  onToggle,
  onToggleGroup,
  onOpen,
  openKey,
}: {
  groups: Group[];
  selected: Set<string>;
  progress: Record<string, RowProgress>;
  onToggle(r: Row, shift: boolean): void;
  onToggleGroup(g: Group, on: boolean): void;
  onOpen(r: Row): void;
  openKey?: string;
}) {
  return (
    <div className="@container min-w-[880px]">
      <div className={cn("sticky top-0 z-10 grid items-center gap-3 border-b bg-background/95 px-4 py-1.5 text-[11px] text-muted-foreground backdrop-blur", COLS)}>
        <span />
        <span>Worktree</span>
        <span title="Commits ahead of and behind its base">vs base</span>
        <span>Changes</span>
        <span>Last commit</span>
        <span>Agents</span>
        <span className="text-right">Port</span>
        <span />
      </div>
      {groups.map((g) => {
        const selectable = g.rows;
        const n = selectable.filter((r) => selected.has(r.key)).length;
        return (
          <section key={g.key} aria-label={`${g.location} on ${g.box}`}>
            <header className={cn("grid items-center gap-3 border-b bg-muted/30 px-4 py-1.5", COLS)}>
              <Checkbox
                checked={n > 0 && n === selectable.length}
                indeterminate={n > 0 && n < selectable.length}
                onCheckedChange={(on) => onToggleGroup(g, !!on)}
                aria-label={`Select every worktree in ${g.location} on ${g.box}`}
              />
              <span className="col-span-7 flex items-center gap-2 font-medium text-xs">
                <ProjectLabel box={g.box} scope={`repo:${g.location}`} />
                <span className="text-muted-foreground tabular-nums">{g.rows.length}</span>
              </span>
            </header>
            <div role="list">
              {g.rows.map((r) => (
                <WorktreeRow key={r.key} row={r} selected={selected.has(r.key)} progress={progress[r.key]} open={openKey === r.key} onToggle={(shift) => onToggle(r, shift)} onOpen={() => onOpen(r)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function WorktreeRow({ row: r, selected, progress, open, onToggle, onOpen }: { row: Row; selected: boolean; progress?: RowProgress; open: boolean; onToggle(shift: boolean): void; onOpen(): void }) {
  const sessions = useStore((s) => s.boxes[r.box]?.sessions) ?? NONE;
  const stats = useStore((s) => s.boxes[r.box]?.stats);
  const services = useStore((s) => s.boxes[r.box]?.services) ?? NONE;
  const mine = sessions.filter((s) => s.dir === r.path && !s.exited);
  const serving = services.filter((s) => s.path === r.path);
  const c = r.last_commit;

  return (
    <div
      role="listitem"
      tabIndex={0}
      aria-selected={selected}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter") onOpen();
        if (e.key === " ") {
          e.preventDefault();
          onToggle(e.shiftKey);
        }
      }}
      className={cn(
        "group grid cursor-pointer items-center gap-3 border-b border-border/60 px-4 py-2 text-sm outline-none hover:bg-accent/40 focus-visible:bg-accent/40",
        COLS,
        selected && "bg-primary/[0.06] hover:bg-primary/[0.09]",
        open && "bg-accent/60",
        r.paused && "text-muted-foreground",
      )}
    >
      {/* The checkbox selects; it never opens the row. */}
      <span
        onClick={(e) => {
          e.stopPropagation();
          onToggle(e.shiftKey);
        }}
        className="flex h-full items-center"
      >
        <Checkbox checked={selected} tabIndex={-1} aria-label={`Select ${r.name}`} className="pointer-events-none" />
      </span>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{r.main ? r.location : r.name}</span>
          {r.main && <span className="shrink-0 rounded border px-1 text-[10px] text-muted-foreground">main checkout</span>}
          {r.paused && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-warning/12 px-1.5 py-px text-[10px] text-warning">
              <PauseIcon className="size-2.5" />
              Paused
            </span>
          )}
        </div>
        {r.branch && <div className="truncate font-mono text-[11px] text-muted-foreground">{r.branch}</div>}
      </div>

      <div className="flex items-center gap-2 font-mono text-xs tabular-nums" title={r.base ? `vs ${r.base}` : undefined}>
        <span className={cn("inline-flex items-center gap-0.5", r.ahead ? "text-foreground" : "text-muted-foreground/50")}>
          <ArrowUpIcon className="size-3" />
          {r.ahead}
        </span>
        <span className={cn("inline-flex items-center gap-0.5", r.behind >= 10 ? "text-warning" : r.behind ? "text-foreground" : "text-muted-foreground/50")}>
          <ArrowDownIcon className="size-3" />
          {r.behind}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs tabular-nums">
        {r.changed === 0 && r.untracked === 0 ? (
          <span className="text-muted-foreground/50">Clean</span>
        ) : (
          <>
            {r.changed > 0 && (
              <span className="inline-flex items-center gap-1" title={`${r.changed} changed`}>
                <span className="size-1.5 rounded-full bg-warning" />
                {r.changed}
              </span>
            )}
            {r.untracked > 0 && (
              <span className="text-success" title={`${r.untracked} untracked`}>
                +{r.untracked}
              </span>
            )}
          </>
        )}
      </div>

      <div className="min-w-0">
        {c ? (
          <Tooltip>
            <TooltipTrigger render={<div className="flex min-w-0 items-baseline gap-2" />}>
              <span className="truncate">{c.subject}</span>
              <span className="shrink-0 text-muted-foreground text-xs">{ago(c.time)}</span>
            </TooltipTrigger>
            <TooltipPopup>
              {c.short} · {c.author} · {new Date(c.time).toLocaleString()}
            </TooltipPopup>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground text-xs">{r.error ?? "No commits"}</span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {mine.slice(0, 3).map((s) => (
          <span key={s.name} className="inline-flex items-center gap-0.5" title={`${s.name}${r.paused ? " (paused)" : ""}`}>
            <AgentIcon agent={agentOf(s)} />
            {!r.paused && <StateGlyph state={sessionState(s, stats)} className="size-3" />}
          </span>
        ))}
        {mine.length > 3 && <span className="text-muted-foreground text-xs">+{mine.length - 3}</span>}
        {serving.length > 0 && (
          <span className="inline-flex items-center gap-1 text-muted-foreground text-xs" title={serving.map((s) => `:${s.port} ${s.process ?? ""}`).join("\n")}>
            <span className={cn("size-1.5 rounded-full", r.paused ? "bg-muted-foreground/40" : "bg-success")} />
            {serving.length}
          </span>
        )}
        {mine.length === 0 && serving.length === 0 && <span className="text-muted-foreground/50 text-xs">—</span>}
      </div>

      <span className="text-right font-mono text-muted-foreground text-xs tabular-nums">{r.port ?? ""}</span>

      <ProgressMark p={progress} />
    </div>
  );
}

function ProgressMark({ p }: { p?: RowProgress }) {
  if (!p) return <span />;
  const body =
    p.state === "running" ? (
      <Spinner className="size-3.5" />
    ) : p.state === "queued" ? (
      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
    ) : p.state === "ok" ? (
      <CheckIcon className="size-3.5 text-success" />
    ) : p.state === "conflict" ? (
      <AlertTriangleIcon className="size-3.5 text-warning" />
    ) : p.state === "failed" ? (
      <XIcon className="size-3.5 text-destructive-foreground" />
    ) : (
      <span className="text-[10px] text-muted-foreground">—</span>
    );
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex items-center justify-center" />}>{body}</TooltipTrigger>
      <TooltipPopup className="max-w-sm">{p.conflicts?.length ? `Conflicts in ${p.conflicts.join(", ")}` : (p.message ?? p.state)}</TooltipPopup>
    </Tooltip>
  );
}
