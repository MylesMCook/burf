import { GitBranchIcon, SearchIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { load, save } from "@/lib/storage";
import { ViewHeader } from "@/views/view-header";
import { BulkBar } from "@/views/worktrees/bulk-bar";
import { DeleteDialog } from "@/views/worktrees/delete-dialog";
import { HistorySheet } from "@/views/worktrees/history-sheet";
import { type BulkAction, useBulk } from "@/views/worktrees/use-bulk";
import { type Row, useWorktrees } from "@/views/worktrees/use-worktrees";
import { type Group, WorktreeTable } from "@/views/worktrees/worktree-table";

type Flag = "behind" | "changes" | "paused";
type Sort = "recent" | "behind" | "changes" | "name";

const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Recently committed" },
  { value: "behind", label: "Most behind" },
  { value: "changes", label: "Most changes" },
  { value: "name", label: "Name" },
];

const toggleCls = "h-7 px-2.5 text-xs text-muted-foreground data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-xs dark:data-pressed:bg-input";

// WorktreesView is every worktree on every box in one table, to see where
// each stands against its base and act on many at once: sync, pause, stop,
// delete. A row opens its commit history.
export function WorktreesView() {
  const { rows, boxes, errors, loaded, patch } = useWorktrees();
  const onRowDone = useCallback((r: Row, p: Partial<Row>) => patch(r.box, r.location, r.name, p), [patch]);
  const { progress, summary, run, cancel, clear } = useBulk(onRowDone);

  const [query, setQuery] = useState("");
  const [shownBoxes, setShownBoxes] = useState<string[]>([]);
  const [project, setProject] = useState("");
  const [flags, setFlags] = useState<Flag[]>([]);
  const [sort, setSort] = useState<Sort>(() => load("berth.worktrees.sort", "recent"));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string>();
  const [openKey, setOpenKey] = useState<string>();
  const [deleting, setDeleting] = useState<Row[]>();

  const projects = useMemo(() => [...new Set(rows.map((r) => r.location))].sort(), [rows]);
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const keep = rows.filter(
      (r) =>
        (!shownBoxes.length || shownBoxes.includes(r.box)) &&
        (!project || r.location === project) &&
        (!flags.includes("behind") || r.behind > 0) &&
        (!flags.includes("changes") || r.changed + r.untracked > 0) &&
        (!flags.includes("paused") || r.paused) &&
        (!q || [r.name, r.branch, r.location, r.box, r.last_commit?.subject].some((s) => s?.toLowerCase().includes(q))),
    );
    const by: Record<Sort, (a: Row, b: Row) => number> = {
      recent: (a, b) => (b.last_commit?.time ?? "").localeCompare(a.last_commit?.time ?? ""),
      behind: (a, b) => b.behind - a.behind,
      changes: (a, b) => b.changed + b.untracked - (a.changed + a.untracked),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    // The main checkout heads its project; the rest follow the sort.
    return keep.sort((a, b) => Number(!!b.main) - Number(!!a.main) || by[sort](a, b));
  }, [rows, shownBoxes, project, flags, q, sort]);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const r of visible) {
      const key = `${r.box}/${r.location}`;
      if (!map.has(key)) map.set(key, { key, box: r.box, location: r.location, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return [...map.values()].sort((a, b) => a.location.localeCompare(b.location) || a.box.localeCompare(b.box));
  }, [visible]);
  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  // Selection follows what exists: deleted worktrees drop out.
  useEffect(() => {
    setSelected((s) => {
      const keys = new Set(rows.map((r) => r.key));
      const next = new Set([...s].filter((k) => keys.has(k)));
      return next.size === s.size ? s : next;
    });
  }, [rows]);

  const toggle = (r: Row, shift: boolean) => {
    setSelected((s) => {
      const next = new Set(s);
      if (shift && anchor) {
        const [i, j] = [flat.findIndex((x) => x.key === anchor), flat.findIndex((x) => x.key === r.key)];
        if (i >= 0 && j >= 0) {
          const on = !s.has(r.key);
          for (const x of flat.slice(Math.min(i, j), Math.max(i, j) + 1)) on ? next.add(x.key) : next.delete(x.key);
          return next;
        }
      }
      next.has(r.key) ? next.delete(r.key) : next.add(r.key);
      return next;
    });
    setAnchor(r.key);
  };
  const toggleGroup = (g: Group, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      for (const r of g.rows) on ? next.add(r.key) : next.delete(r.key);
      return next;
    });

  // Esc clears the selection; ⌘A selects every visible worktree.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.closest("input, textarea, [role=dialog]") || e.target.isContentEditable);
      if (typing) return;
      if (e.key === "Escape" && selected.size && !openKey) setSelected(new Set());
      if (e.key === "a" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSelected(new Set(flat.map((r) => r.key)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flat, selected.size, openKey]);

  const selectedRows = rows.filter((r) => selected.has(r.key));
  const busy = !!summary && !summary.done;
  const act = (a: BulkAction, list: Row[]) => {
    if (!busy) void run(a, list);
  };
  const open = rows.find((r) => r.key === openKey);
  const filtered = !!(q || shownBoxes.length || project || flags.length);
  const behind = rows.filter((r) => r.behind > 0).length;
  const paused = rows.filter((r) => r.paused).length;

  return (
    <div className="relative flex h-full flex-col">
      <ViewHeader
        title="Worktrees"
        description={loaded ? [`${rows.length} on ${boxes.length} box${boxes.length === 1 ? "" : "es"}`, behind && `${behind} behind their base`, paused && `${paused} paused`].filter(Boolean).join(" · ") : undefined}
        actions={
          <div className="relative w-56">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="[&_input]:pl-8" aria-label="Search worktrees" />
          </div>
        }
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-6 py-2">
        {boxes.length > 1 && (
          <ToggleGroup multiple size="sm" variant="outline" value={shownBoxes} onValueChange={(v) => setShownBoxes(v as string[])} aria-label="Boxes">
            {boxes.map((b) => (
              <ToggleGroupItem key={b} value={b} className={toggleCls}>
                {b}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        <div className="w-44">
          <SimpleSelect value={project} onChange={setProject} options={[{ value: "", label: "All projects" }, ...projects.map((p) => ({ value: p, label: p }))]} />
        </div>
        <ToggleGroup multiple size="sm" variant="outline" value={flags} onValueChange={(v) => setFlags(v as Flag[])} aria-label="Show only">
          <ToggleGroupItem value="behind" className={toggleCls}>
            Behind base
          </ToggleGroupItem>
          <ToggleGroupItem value="changes" className={toggleCls}>
            Has changes
          </ToggleGroupItem>
          <ToggleGroupItem value="paused" className={toggleCls}>
            Paused
          </ToggleGroupItem>
        </ToggleGroup>
        {filtered && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              setQuery("");
              setShownBoxes([]);
              setProject("");
              setFlags([]);
            }}
          >
            Clear filters
          </Button>
        )}
        <span className="ml-auto flex items-center gap-2 text-muted-foreground text-xs">
          <span className="hidden lg:inline">
            <Kbd>⇧</Kbd> click selects a range · <Kbd>⌘A</Kbd> all
          </span>
          <div className="w-44">
            <SimpleSelect
              value={sort}
              onChange={(v) => {
                setSort(v as Sort);
                save("berth.worktrees.sort", v);
              }}
              options={SORTS}
            />
          </div>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto pb-24">
        {Object.entries(errors).map(([box, err]) => (
          <p key={box} className="border-b px-6 py-2 text-muted-foreground text-xs">
            <span className="font-medium text-foreground">{box}</span>: couldn't list its worktrees ({err}).
            {/404|not found/i.test(err) && " Its berthd predates this view; upgrade it from Settings → Boxes."}
          </p>
        ))}
        {!loaded ? (
          <div className="space-y-2 px-6 pt-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : flat.length === 0 ? (
          <Empty className="mt-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <GitBranchIcon />
              </EmptyMedia>
              <EmptyTitle>{filtered ? "No worktrees match" : "No worktrees yet"}</EmptyTitle>
              <EmptyDescription>{filtered ? "Try fewer filters." : "Worktrees you make on any box show up here."}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <WorktreeTable groups={groups} selected={selected} progress={progress} onToggle={toggle} onToggleGroup={toggleGroup} onOpen={(r) => setOpenKey(r.key)} openKey={openKey} />
        )}
      </div>

      <BulkBar
        selected={selectedRows}
        summary={summary && summary.action.kind !== "delete" ? summary : undefined}
        progress={progress}
        onSync={(mode) => act({ kind: "sync", mode }, selectedRows)}
        onPause={() => act({ kind: "pause" }, selectedRows)}
        onResume={() => act({ kind: "resume" }, selectedRows)}
        onStop={() => act({ kind: "stop" }, selectedRows)}
        onDelete={() => setDeleting(selectedRows)}
        onClear={() => setSelected(new Set())}
        onCancel={cancel}
        onDismiss={clear}
      />

      <HistorySheet
        row={open}
        progress={open ? progress[open.key] : undefined}
        busy={busy}
        onClose={() => setOpenKey(undefined)}
        onAction={(a) => open && act(a, [open])}
        onDelete={() => open && setDeleting([open])}
      />

      <DeleteDialog
        rows={deleting}
        progress={progress}
        running={busy && summary?.action.kind === "delete"}
        onRun={(a) => deleting && act(a, deleting)}
        onClose={() => {
          if (summary?.action.kind === "delete") {
            clear();
            setSelected(new Set());
            setOpenKey(undefined);
          }
          setDeleting(undefined);
        }}
      />
    </div>
  );
}
