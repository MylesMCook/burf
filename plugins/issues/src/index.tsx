import { type Project, type ScreenProps, type Session, definePlugin, useCurrentWorktree, useProjects, useSessions, useStorage } from "@berth/plugin";
import {
  Button,
  Checkbox,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Icon,
  Input,
  Kbd,
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
  PickOne,
  Skeleton,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
  cn,
} from "@berth/plugin/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Avatar, Detail, LabelChip, PrIcon, Problem, type Row, StatePill } from "./detail";
import * as gh from "./gh";
import { StartSheet, type Target } from "./start-sheet";
import { type Run, askRefresh, isGitHubProject, listOf, loadList, refreshCount, runnerOf, runsByIssue, useIssuesStore } from "./store";

// Issues: the open GitHub issues of a project (or of every project), read
// with gh on the project's box, and an agent on any of them in one step: a
// worktree named for the issue, the agent you pick, and the issue as its
// first prompt. Rows show how that agent is doing from then on.

export default definePlugin((berth) => {
  berth.addScreen({ id: "issues", title: "Issues", Component: IssuesScreen });
  berth.addSidebarItem({ id: "issues", title: "Issues", icon: "CircleDot", screen: "issues" });
  berth.addCommand({ id: "issues", title: "Show issues", group: "Issues", run: () => berth.openScreen("issues") });
  berth.addCommand({
    id: "issues-refresh",
    title: "Refresh issues",
    group: "Issues",
    run: () => {
      askRefresh();
      berth.openScreen("issues");
    },
  });
});

type Who = "all" | "mine" | "unassigned";
type Sort = "updated" | "newest" | "discussed";

const ALL = "all";

function IssuesScreen({ berth }: ScreenProps) {
  useIssuesStore();
  const allProjects = useProjects();
  const projects = useMemo(() => allProjects.filter(isGitHubProject), [allProjects]);
  const current = useCurrentWorktree();

  // Which project: the stored choice, or the one in front, or all of them.
  const [stored, setStored] = useStorage<string>("project", "");
  const fromCurrent = current && projects.find((p) => p.members.some((m) => m.box === current.box && m.location.name === current.location))?.id;
  const scope = stored === ALL || projects.some((p) => p.id === stored) ? stored : (fromCurrent ?? (projects.length === 1 ? projects[0].id : ALL));
  const shown = useMemo(() => (scope === ALL ? projects : projects.filter((p) => p.id === scope)), [projects, scope]);
  const scoped = scope !== ALL ? shown[0] : undefined;

  const [who, setWho] = useStorage<Who>("who", "all");
  const [sort, setSort] = useStorage<Sort>("sort", "updated");
  const [labels, setLabels] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);

  // Fetch what's shown, again when asked from the palette.
  const tick = refreshCount();
  const lastTick = useRef(tick);
  const shownKey = shown.map((p) => `${p.id}@${runnerOf(p)?.box ?? ""}`).join(",");
  useEffect(() => {
    const force = lastTick.current !== tick;
    lastTick.current = tick;
    for (const p of shown) void loadList(berth, p, force);
    // shown is keyed by shownKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [berth, shownKey, tick]);
  const refresh = () => {
    for (const p of shown) void loadList(berth, p, true);
  };

  const loads = shown.map((p) => ({ project: p, load: listOf(p.id) }));
  const loading = loads.some((l) => !l.load || l.load.status === "loading");
  const problems = loads.filter((l) => l.load?.status === "problem") as { project: Project; load: { status: "problem"; problem: gh.Problem } }[];
  const viewers = new Set(loads.map((l) => (l.load?.status === "ok" ? l.load.value.viewer : l.load?.status === "loading" ? l.load.prev?.viewer : undefined)).filter(Boolean) as string[]);
  const viewer = [...viewers][0];

  const rows: Row[] = useMemo(
    () =>
      loads.flatMap(({ project, load }) => {
        const list = load?.status === "ok" ? load.value : load?.status === "loading" ? load.prev : undefined;
        const repo = list?.repo || project.slug!;
        return (list?.issues ?? []).map((i) => ({ ...i, key: `${repo.toLowerCase()}#${i.number}`, repo, project }));
      }),
    // loads is rebuilt every render; the store version drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loads.map((l) => (l.load?.status === "ok" ? l.load.at : l.load?.status)).join(","), shownKey],
  );
  const total = loads.reduce((n, l) => n + (l.load?.status === "ok" ? l.load.value.total : 0), 0);

  // Agents on issues: every box the shown projects are on.
  const boxes = useMemo(() => [...new Set(shown.flatMap((p) => p.members.map((m) => m.box)))].sort(), [shown]);
  const [sessions, setSessions] = useState<Record<string, Session[] | undefined>>({});
  const onSessions = useCallback((box: string, s?: Session[]) => setSessions((prev) => (prev[box] === s ? prev : { ...prev, [box]: s })), []);
  const runs = useMemo(() => runsByIssue(shown, sessions), [shown, sessions]);

  const labelCounts = useMemo(() => {
    const m = new Map<string, gh.Label & { n: number }>();
    for (const r of rows) for (const l of r.labels) m.set(l.name, { ...l, n: (m.get(l.name)?.n ?? 0) + 1 });
    return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }, [rows]);
  useEffect(() => setLabels((ls) => ls.filter((l) => labelCounts.some((c) => c.name === l))), [labelCounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    const out = rows.filter(
      (r) =>
        (who === "all" || (who === "mine" ? !!viewer && r.assignees.includes(viewer) : r.assignees.length === 0)) &&
        labels.every((l) => r.labels.some((x) => x.name === l)) &&
        (!q || String(r.number).startsWith(q) || `${r.title} ${r.author ?? ""} ${r.labels.map((l) => l.name).join(" ")} ${r.assignees.join(" ")}`.toLowerCase().includes(q)),
    );
    const by: Record<Sort, (a: Row, b: Row) => number> = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      discussed: (a, b) => b.comments - a.comments || b.updatedAt.localeCompare(a.updatedAt),
    };
    return out.sort(by[sort]);
  }, [rows, who, viewer, labels, query, sort]);

  // Selection: the issue in the right-hand pane, and the ones ticked for a batch.
  const [selectedKey, setSelectedKey] = useState<string>();
  const selected = filtered.find((r) => r.key === selectedKey) ?? filtered[0];
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const checkedRows = filtered.filter((r) => checked.has(r.key));
  const toggle = (key: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (!n.delete(key)) n.add(key);
      return n;
    });

  const [targets, setTargets] = useState<Target[]>([]);
  const targetOf = (r: Row): Target => ({ project: r.project, repo: r.repo, number: r.number, title: r.title, runs: runs.get(r.key) ?? [] });
  const startOn = (rs: Row[]) => rs.length && setTargets(rs.map(targetOf));

  // Keys: J/K move, X ticks, S starts, O opens on GitHub, / searches.
  const keys = useRef({ filtered, selected, checkedRows, targets });
  keys.current = { filtered, selected, checkedRows, targets };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || keys.current.targets.length) return;
      if (t && (t.closest("input, textarea, [contenteditable=true], [role=dialog], [role=menu]") || t.isContentEditable)) {
        if (e.key === "Escape" && t === search.current) search.current?.blur();
        return;
      }
      const { filtered: list, selected: sel, checkedRows: ticked } = keys.current;
      const i = sel ? list.indexOf(sel) : -1;
      const move = (d: number) => {
        const next = list[Math.min(list.length - 1, Math.max(0, i + d))];
        if (!next) return;
        setSelectedKey(next.key);
        document.getElementById(`issue-${next.key}`)?.scrollIntoView({ block: "nearest" });
      };
      if (e.key === "j" || e.key === "ArrowDown") move(1);
      else if (e.key === "k" || e.key === "ArrowUp") move(-1);
      else if (e.key === "x" && sel) toggle(sel.key);
      else if (e.key === "s") startOn(ticked.length ? ticked : sel ? [sel] : []);
      else if (e.key === "o" && sel) berth.openUrl(gh.issueUrl(sel.repo, sel.number));
      else if (e.key === "/") search.current?.focus();
      else if (e.key === "Escape") setChecked(new Set());
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // startOn and toggle only use setters and the refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [berth]);

  const busyRuns = useMemo(() => [...runs.values()].filter((rs) => rs[0]?.session && rs[0].session.agent_state !== "finished").length, [runs]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {boxes.map((b) => (
        <SessionFeed key={b} box={b} onSessions={onSessions} />
      ))}
      <header data-tauri-drag-region className="flex min-h-12 shrink-0 items-center gap-3 border-b bg-sidebar/40 px-6 py-2">
        <div data-tauri-drag-region className="flex min-w-0 flex-1 items-baseline gap-3">
          <h1 className="shrink-0 font-medium text-sm">Issues</h1>
          <p className="hidden min-w-0 truncate text-muted-foreground text-xs md:block">
            {busyRuns > 0 ? `${busyRuns} agent${busyRuns === 1 ? " is" : "s are"} on issues right now.` : "Open GitHub issues, and an agent on any of them in one step."}
          </p>
        </div>
        <ProjectPicker projects={projects} scope={scope} onChange={(id) => (setStored(id), setChecked(new Set()))} />
        <Tooltip>
          <TooltipTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Refresh" onClick={refresh} disabled={!shown.length} />}>
            <Icon name="RefreshCw" className={cn("size-3.5", loading && shown.length > 0 && "animate-spin")} />
          </TooltipTrigger>
          <TooltipPopup>Refresh</TooltipPopup>
        </Tooltip>
      </header>

      {projects.length === 0 ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <Icon name="CircleDot" className="mb-2 size-6 text-muted-foreground" />
            <EmptyTitle>No GitHub projects yet</EmptyTitle>
            <EmptyDescription>Add a repository whose origin is on GitHub to a box, and its open issues show up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
            <div className="relative">
              <Icon name="Search" className="pointer-events-none absolute top-1/2 left-2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={search}
                size="sm"
                className="w-52 [&_input]:pl-7"
                placeholder="Search issues"
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              />
              {!query && <Kbd className="pointer-events-none absolute top-1/2 right-1.5 h-4.5 -translate-y-1/2 text-[10px]">/</Kbd>}
            </div>
            <PickOne
              label="Assignee"
              value={who}
              onChange={(v: string) => setWho(v as Who)}
              options={[
                { value: "all", label: "All" },
                { value: "mine", label: "Mine" },
                { value: "unassigned", label: "Unassigned" },
              ]}
            />
            <SortMenu sort={sort} onChange={setSort} />
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
              {labelCounts.slice(0, 10).map((l) => (
                <LabelChip key={l.name} label={l} active={labels.includes(l.name)} onClick={() => setLabels((ls) => (ls.includes(l.name) ? ls.filter((x) => x !== l.name) : [...ls, l.name]))} />
              ))}
            </div>
          </div>

          {problems.length > 0 && scope === ALL && rows.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 border-b bg-muted/30 px-4 py-1.5 text-muted-foreground text-xs">
              {problems.map(({ project, load }) => (
                <span key={project.id} className="inline-flex items-center gap-1.5">
                  <Icon name="Info" className="size-3" />
                  <b className="font-medium text-foreground">{project.name}</b> {problemShort(load.problem)}
                </span>
              ))}
            </div>
          )}

          <div className="flex min-h-0 flex-1">
            <aside className="flex w-[25rem] shrink-0 flex-col border-r max-xl:w-[21rem]">
              <ul className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Open issues">
                {rows.length === 0 && loading ? (
                  Array.from({ length: 7 }, (_, i) => <RowSkeleton key={i} />)
                ) : rows.length === 0 && problems.length > 0 ? (
                  <div className="flex flex-col gap-2 p-1">
                    {problems.map(({ project, load }) => (
                      <div key={project.id} className="flex flex-col gap-1">
                        {scope === ALL && <span className="px-1 font-medium text-[11px] text-muted-foreground">{project.name}</span>}
                        <Problem problem={load.problem} box={runnerOf(project)?.box} />
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="px-3 py-8 text-center text-muted-foreground text-xs">
                    {rows.length === 0 ? "No open issues. Nice." : "No issues match."}
                    {rows.length > 0 && (
                      <button
                        type="button"
                        className="ml-1 font-medium text-foreground hover:underline"
                        onClick={() => {
                          setQuery("");
                          setLabels([]);
                          setWho("all");
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </p>
                ) : (
                  filtered.map((r) => (
                    <IssueRow
                      key={r.key}
                      row={r}
                      showRepo={scope === ALL && shown.length > 1}
                      viewer={viewer}
                      run={runs.get(r.key)?.[0]}
                      active={r.key === selected?.key}
                      checked={checked.has(r.key)}
                      selecting={checked.size > 0}
                      onSelect={() => setSelectedKey(r.key)}
                      onCheck={() => toggle(r.key)}
                      onOpenRun={(run) => berth.openWorktree({ box: run.box, location: run.location, worktree: run.worktree, path: run.path })}
                    />
                  ))
                )}
              </ul>
              {checkedRows.length > 0 ? (
                <footer className="flex shrink-0 items-center gap-2 border-t bg-muted/40 px-3 py-2 text-xs">
                  <span className="font-medium">{checkedRows.length} selected</span>
                  <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setChecked(new Set())}>
                    Clear
                  </button>
                  <Button size="xs" className="ml-auto" onClick={() => startOn(checkedRows)}>
                    <Icon name="Bot" className="size-3.5" />
                    Start {checkedRows.length} agent{checkedRows.length === 1 ? "" : "s"}
                  </Button>
                </footer>
              ) : (
                <footer className="flex shrink-0 items-center gap-2.5 overflow-hidden whitespace-nowrap border-t px-3 py-2 text-[11px] text-muted-foreground">
                  {(
                    [
                      ["J K", "move"],
                      ["X", "select"],
                      ["S", "start agent"],
                      ["O", "GitHub"],
                    ] as const
                  ).map(([k, label]) => (
                    <span key={label} className="inline-flex items-center gap-1">
                      {k.split(" ").map((x) => (
                        <Kbd key={x} className="h-4 min-w-4 px-1 text-[10px]">
                          {x}
                        </Kbd>
                      ))}
                      {label}
                    </span>
                  ))}
                  <span className="ml-auto tabular-nums">
                    {filtered.length === rows.length ? `${rows.length}` : `${filtered.length} of ${rows.length}`}
                    {total > rows.length ? ` · ${total} open` : ""}
                  </span>
                </footer>
              )}
            </aside>
            <section className="min-w-0 flex-1 overflow-y-auto">
              {selected ? (
                <Detail key={selected.key} berth={berth} row={selected} runs={runs.get(selected.key) ?? []} viewer={viewer} onStart={() => startOn([selected])} />
              ) : (
                <div className="grid h-full place-items-center text-muted-foreground text-xs">{loading ? "" : "Pick an issue to read it."}</div>
              )}
            </section>
          </div>
        </>
      )}
      <StartSheet berth={berth} targets={targets} onClose={() => setTargets([])} onStarted={() => setChecked(new Set())} />
    </div>
  );
}

// SessionFeed hands a box's live sessions up, so rows can follow agents on
// every box the shown projects are on.
function SessionFeed({ box, onSessions }: { box: string; onSessions(box: string, s?: Session[]): void }) {
  const s = useSessions(box);
  useEffect(() => onSessions(box, s), [box, s, onSessions]);
  return null;
}

function IssueRow({
  row,
  showRepo,
  viewer,
  run,
  active,
  checked,
  selecting,
  onSelect,
  onCheck,
  onOpenRun,
}: {
  row: Row;
  showRepo: boolean;
  viewer?: string;
  run?: Run;
  active: boolean;
  checked: boolean;
  selecting: boolean;
  onSelect(): void;
  onCheck(): void;
  onOpenRun(run: Run): void;
}) {
  const openPR = row.prs.find((p) => p.state === "OPEN") ?? row.prs.find((p) => p.state === "MERGED") ?? row.prs[0];
  const waiting = run?.session?.agent_state === "waiting";
  return (
    <li id={`issue-${row.key}`}>
      {/* biome-ignore lint/a11y/useSemanticElements: the row holds a checkbox, so it can't be a button. */}
      <div
        role="button"
        tabIndex={-1}
        onClick={onSelect}
        onKeyDown={undefined}
        aria-current={active || undefined}
        className={cn(
          "group flex w-full cursor-default gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-accent/50",
          active && "bg-accent hover:bg-accent",
          waiting && "shadow-[inset_2px_0_0_var(--color-warning)]",
        )}
      >
        <span className="relative mt-[3px] grid size-4 shrink-0 place-items-center">
          <Icon name="CircleDot" className={cn("size-3.5 text-success", (selecting || checked) && "hidden", "group-hover:hidden")} />
          {/* biome-ignore lint/a11y/noStaticElementInteractions: stops the row's click. */}
          <span className={cn("hidden", (selecting || checked) && "flex", "group-hover:flex")} onClick={(e) => e.stopPropagation()} onKeyDown={undefined}>
            <Checkbox checked={checked} onCheckedChange={onCheck} aria-label={`Select #${row.number}`} />
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 font-medium text-[13px] leading-snug">{row.title}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="shrink-0 font-mono tabular-nums">{showRepo ? `${row.repo.split("/")[1]}#${row.number}` : `#${row.number}`}</span>
            <span className="truncate">
              · {gh.since(row.updatedAt)} · {row.author ?? "ghost"}
            </span>
          </span>
          {(row.labels.length > 0 || run) && (
            <span className="flex min-w-0 items-center gap-1 overflow-hidden">
              {run && (
                // biome-ignore lint/a11y/useKeyWithClickEvents: the issue's own keys reach it.
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-background px-1.5 py-px hover:bg-accent"
                  title={`${run.worktree} on ${run.box}: open it`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenRun(run);
                  }}
                >
                  <StatePill run={run} compact />
                  <span className="max-w-28 truncate text-[11px] text-muted-foreground">{run.session ? run.box : run.worktree}</span>
                </span>
              )}
              {row.labels.slice(0, 3).map((l) => (
                <LabelChip key={l.name} label={l} />
              ))}
              {row.labels.length > 3 && <span className="shrink-0 text-[10px] text-muted-foreground">+{row.labels.length - 3}</span>}
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5 pt-px text-[11px] text-muted-foreground">
          <span className="flex -space-x-1">
            {row.assignees.slice(0, 2).map((a) => (
              <Avatar key={a} login={a} className={cn("size-4 text-[8px] ring-2 ring-background", a === viewer && "ring-primary/60")} />
            ))}
          </span>
          <span className="flex items-center gap-2">
            {openPR && (
              <span className="inline-flex items-center gap-0.5" title={`#${openPR.number} ${openPR.state.toLowerCase()}`}>
                <PrIcon pr={openPR} />
              </span>
            )}
            {row.comments > 0 && (
              <span className="inline-flex items-center gap-0.5 tabular-nums">
                <Icon name="MessageSquare" className="size-3" />
                {row.comments}
              </span>
            )}
          </span>
        </span>
      </div>
    </li>
  );
}

function RowSkeleton() {
  return (
    <li className="flex gap-2.5 px-2.5 py-2.5">
      <Skeleton className="mt-0.5 size-3.5 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </li>
  );
}

function ProjectPicker({ projects, scope, onChange }: { projects: Project[]; scope: string; onChange(id: string): void }) {
  const current = projects.find((p) => p.id === scope);
  if (projects.length === 0) return null;
  return (
    <Menu>
      <MenuTrigger render={<Button size="sm" variant="outline" className="max-w-56" />}>
        <Icon name={current ? "FolderGit2" : "Layers"} className="size-3.5" />
        <span className="truncate">{current ? current.name : "All projects"}</span>
        <Icon name="ChevronsUpDown" className="size-3 opacity-60" />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-56">
        <MenuItem onClick={() => onChange(ALL)}>
          <Icon name="Layers" className="size-3.5" />
          All projects
          {scope === ALL && <Icon name="Check" className="ml-auto size-3.5" />}
        </MenuItem>
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>Projects on GitHub</MenuGroupLabel>
          {projects.map((p) => (
            <MenuItem key={p.id} onClick={() => onChange(p.id)}>
              <Icon name="FolderGit2" className="size-3.5" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{p.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">{p.slug}</span>
              </span>
              {scope === p.id && <Icon name="Check" className="ml-auto size-3.5" />}
            </MenuItem>
          ))}
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}

const SORTS: Record<Sort, string> = { updated: "Recently updated", newest: "Newest", discussed: "Most discussed" };

function SortMenu({ sort, onChange }: { sort: Sort; onChange(s: Sort): void }) {
  return (
    <Menu>
      <MenuTrigger render={<Button size="sm" variant="ghost" className="text-muted-foreground" />}>
        <Icon name="ArrowDownWideNarrow" className="size-3.5" />
        {SORTS[sort]}
      </MenuTrigger>
      <MenuPopup align="start">
        {(Object.keys(SORTS) as Sort[]).map((s) => (
          <MenuItem key={s} onClick={() => onChange(s)}>
            {SORTS[s]}
            {s === sort && <Icon name="Check" className="ml-auto size-3.5" />}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}

function problemShort(p: gh.Problem) {
  switch (p.kind) {
    case "disabled":
      return "has issues turned off";
    case "no-gh":
      return "needs gh on its box";
    case "no-auth":
      return "needs gh auth login on its box";
    case "offline":
      return "has no box online";
    case "not-github":
      return "isn't on GitHub";
    default:
      return "couldn't be read";
  }
}
