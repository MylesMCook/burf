import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, CornerDownLeftIcon, PauseIcon, PlayIcon, RefreshCwIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Group, GroupSeparator } from "@/components/ui/group";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { Sheet, SheetDescription, SheetHeader, SheetPanel, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ago, errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { refOf, selectWorktree } from "@/lib/workspaces";
import { type Commit, SYNC_MODES, type SyncMode, worktreesApi } from "@/lib/worktrees";
import { ProjectLabel } from "@/views/automations/flows/project-label";
import { type GraphRow, layout } from "@/views/worktrees/commit-graph";
import { GraphGutter, laneColor, ROW_H } from "@/views/worktrees/graph-gutter";
import type { BulkAction, RowProgress } from "@/views/worktrees/use-bulk";
import type { Row } from "@/views/worktrees/use-worktrees";

const PAGE = 80;

// HistorySheet is one worktree: where it stands, what you can do with it,
// and its commits, newest first, marking those not on its base yet.
export function HistorySheet({ row, progress, busy, onClose, onAction, onDelete }: { row?: Row; progress?: RowProgress; busy: boolean; onClose(): void; onAction(a: BulkAction): void; onDelete(): void }) {
  const client = useStore((s) => s.client);
  const [log, setLog] = useState<{ base: string; commits: Commit[] }>();
  const [error, setError] = useState<string>();
  const [limit, setLimit] = useState(PAGE);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => setLimit(PAGE), [row?.key]);
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
        setError(errorMessage(e));
        setLoadingMore(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // Refetch when a sync or anything else moves the branch.
  }, [client, row?.key, row?.ahead, row?.behind, row?.last_commit?.sha, limit]);

  const graph = useMemo(() => (log ? layout(log.commits) : undefined), [log]);

  const open = () => {
    if (!row) return;
    const loc = useStore.getState().boxes[row.box]?.locations?.find((l) => l.name === row.location);
    const wt = loc?.worktrees?.find((w) => w.path === row.path);
    if (loc && wt) {
      selectWorktree(refOf(row.box, loc, wt));
      useStore.getState().setView({ kind: "workspace" });
    }
  };
  const base = (log?.base ?? row?.base ?? "main").replace(/^origin\//, "");

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetPopup className="w-[min(560px,100vw)] max-w-none">
        {row && (
          <>
            <SheetHeader className="gap-1.5">
              <SheetTitle className="flex items-center gap-2 text-base">
                {row.main ? row.location : row.name}
                {row.paused && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-warning/12 px-1.5 py-px font-normal text-[11px] text-warning">
                    <PauseIcon className="size-2.5" />
                    Paused
                  </span>
                )}
              </SheetTitle>
              <SheetDescription render={<div />} className="space-y-1">
                <ProjectLabel box={row.box} scope={`repo:${row.location}`} className="text-xs" />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {row.branch && <code className="font-mono">{row.branch}</code>}
                  <span className="inline-flex items-center gap-2 font-mono tabular-nums">
                    <span className="inline-flex items-center">
                      <ArrowUpIcon className="size-3" />
                      {row.ahead}
                    </span>
                    <span className={cn("inline-flex items-center", row.behind >= 10 && "text-warning")}>
                      <ArrowDownIcon className="size-3" />
                      {row.behind}
                    </span>
                    <span className="font-sans">vs {row.base ?? "its base"}</span>
                  </span>
                  <span>{row.changed || row.untracked ? `${row.changed} changed, ${row.untracked} untracked` : "Clean"}</span>
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-wrap items-center gap-1.5 border-b px-6 pb-4">
              <SyncButton disabled={busy} onSync={(mode) => onAction({ kind: "sync", mode })} />
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
              {row.sessions > 0 && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction({ kind: "stop" })}>
                  <SquareIcon />
                  Stop sessions
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={open}>
                <CornerDownLeftIcon />
                Open
              </Button>
              {!row.main && (
                <Button size="sm" variant="ghost" className="ml-auto text-destructive-foreground" disabled={busy} onClick={onDelete}>
                  <Trash2Icon />
                  Delete…
                </Button>
              )}
            </div>
            {progress && progress.state !== "queued" && <ProgressLine p={progress} />}

            <SheetPanel className="pt-3">
              <h3 className="mb-2 flex items-center gap-3 font-medium text-muted-foreground text-xs">
                Commits
                <span className="flex items-center gap-1 font-normal">
                  <span className="size-2 rounded-full" style={{ background: laneColor(0) }} />
                  {row.branch ?? row.name}
                </span>
                <span className="flex items-center gap-1 font-normal">
                  <span className="size-2 rounded-full opacity-60" style={{ background: laneColor(1) }} />
                  {base}
                </span>
              </h3>
              {error ? (
                <p className="text-destructive-foreground text-sm">{error}</p>
              ) : !log ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-9" />
                  ))}
                </div>
              ) : log.commits.length === 0 || !graph ? (
                <p className="text-muted-foreground text-sm">No commits.</p>
              ) : (
                <>
                  <ol className="-mx-2">
                    {graph.rows.map((g) => (
                      <CommitRow key={g.commit.sha} row={g} lanes={graph.lanes} base={base} mergeBase={g.commit.sha === graph.mergeBase} branch={row.branch} />
                    ))}
                  </ol>
                  {log.commits.length >= limit && (
                    <div className="mt-3 flex justify-center">
                      <Button size="sm" variant="ghost" loading={loadingMore} onClick={() => setLimit((l) => l + PAGE)}>
                        Load more
                      </Button>
                    </div>
                  )}
                </>
              )}
            </SheetPanel>
          </>
        )}
      </SheetPopup>
    </Sheet>
  );
}

function CommitRow({ row, lanes, base, mergeBase, branch }: { row: GraphRow; lanes: number; base: string; mergeBase: boolean; branch?: string }) {
  const c = row.commit;
  const mine = c.on_base === false;
  const refs = parseRefs(c.refs);
  return (
    <li className={cn("flex items-start rounded-md pr-2", mergeBase && "bg-info/[0.06]")} style={{ height: ROW_H }} title={`${c.sha}\n${c.author} · ${new Date(c.time).toLocaleString()}${row.merge ? `\nmerge of ${c.parents?.length} parents` : ""}`}>
      <GraphGutter row={row} lanes={lanes} highlight={mergeBase} />
      <div className="min-w-0 flex-1 pt-1.5">
        <div className="flex items-baseline gap-2">
          <code className={cn("shrink-0 font-mono text-[11px]", mine ? "text-foreground" : "text-muted-foreground")}>{c.short}</code>
          <span className={cn("min-w-0 flex-1 truncate text-[13px]", row.merge ? "text-muted-foreground" : mine ? "text-foreground" : "text-foreground/80")}>{c.subject}</span>
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{ago(c.time)}</span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="max-w-40 shrink-0 truncate">{c.author}</span>
          {mergeBase && (
            <span className="shrink-0 rounded border border-info/40 px-1 text-[10px] text-info" title={`Where ${branch ?? "this worktree"} last met ${base}`}>
              Branched here
            </span>
          )}
          {refs.map((r) => (
            <span
              key={r.name}
              className={cn(
                "min-w-0 truncate rounded border px-1 font-mono text-[10px]",
                r.kind === "head" ? "border-info/50 bg-info/10 text-info" : r.kind === "tag" ? "border-warning/40 text-warning" : r.kind === "remote" ? "border-border text-muted-foreground" : "border-ring/30 text-foreground/80",
              )}
            >
              {r.kind === "head" && "HEAD → "}
              {r.name}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}

interface Ref {
  name: string;
  kind: "head" | "tag" | "remote" | "branch";
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
    .slice(0, 4);
}

// SyncButton syncs with a rebase, or the mode picked from its menu.
export function SyncButton({ disabled, onSync, size = "sm" }: { disabled?: boolean; onSync(mode: SyncMode): void; size?: "sm" | "xs" }) {
  return (
    <Group>
      <Button size={size} variant="outline" disabled={disabled} onClick={() => onSync("rebase")}>
        <RefreshCwIcon />
        Sync
      </Button>
      <GroupSeparator />
      <Menu>
        <MenuTrigger render={<Button size={size === "sm" ? "icon-sm" : "icon-xs"} variant="outline" disabled={disabled} aria-label="Sync with…" />}>
          <ChevronDownIcon />
        </MenuTrigger>
        <MenuPopup align="end" className="min-w-64">
          <MenuGroup>
            <MenuGroupLabel>Sync with the base by</MenuGroupLabel>
            {SYNC_MODES.map((m) => (
              <MenuItem key={m.value} onClick={() => onSync(m.value)}>
                <span className="flex flex-col">
                  <span>{m.label}</span>
                  <span className="text-muted-foreground text-xs">{m.hint}</span>
                </span>
              </MenuItem>
            ))}
          </MenuGroup>
        </MenuPopup>
      </Menu>
    </Group>
  );
}

function ProgressLine({ p }: { p: RowProgress }) {
  const tone = p.state === "ok" ? "text-success" : p.state === "conflict" ? "text-warning" : p.state === "failed" ? "text-destructive-foreground" : "text-muted-foreground";
  return (
    <div className={cn("border-b bg-muted/30 px-6 py-2 text-xs", tone)}>
      {p.state === "running" ? "Working…" : p.message}
      {p.conflicts?.length ? (
        <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-muted-foreground">
          {p.conflicts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
