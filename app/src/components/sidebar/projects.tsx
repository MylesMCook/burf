import {
  ChevronRightIcon,
  FolderGitIcon,
  GitBranchIcon,
  HomeIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  ServerIcon,
  ServerOffIcon,
  SquareTerminalIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { type Action, boxActions, ContextRow, DotsMenu, newSection, projectActions, projectGroupActions, worktreeActions } from "@/components/sidebar/actions";
import { confirm } from "@/components/sidebar/confirm";
import { type Project, projectActions as groupActions, useProjects } from "@/lib/project-groups";
import { Tip } from "@/components/tip";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar";
import { agentPresets, startSession } from "@/lib/actions";
import { type BoxStatus, type Location, type Session, type Worktree } from "@/lib/api";
import { agentOf, type SessionState, sessionState, worktreeSessions } from "@/lib/derive";
import { load, save } from "@/lib/storage";
import { type BoxData, NONE, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { refOf, selectWorktree, useWorkspaces, wsKey } from "@/lib/workspaces";

// Projects lists repositories, as Orca does: one group per repository on a
// box (the same repository on two boxes is two groups, told apart by the
// box), the repository row opening its main checkout, and its worktrees under
// it with one status each. By default only worktrees with something in them
// show; the rest are a click away.

export type GroupBy = "project" | "box";
export type Show = "active" | "all";

interface SidebarPrefs {
  groupBy: GroupBy;
  show: Show;
  collapsed: Record<string, boolean>;
  expanded: Record<string, boolean>;
}

const KEY = "berth.sidebar";
const saved = load<Partial<SidebarPrefs> & { groupBy?: string }>(KEY, {});
// "repo" was the old name for grouping by project.
const initial: SidebarPrefs = { show: "active", collapsed: {}, expanded: {}, ...saved, groupBy: saved.groupBy === "box" ? "box" : "project" };

// The sidebar's own preferences, kept on this computer.
export function useSidebarPrefs() {
  const [prefs, set] = useState<SidebarPrefs>(initial);
  const update = (patch: Partial<SidebarPrefs>) =>
    set((p) => {
      const next = { ...p, ...patch };
      Object.assign(initial, next);
      save(KEY, next);
      return next;
    });
  return [prefs, update] as const;
}

const urgency: Record<SessionState, number> = { waiting: 0, running: 1, finished: 2, ready: 3, idle: 4, exited: 5 };

// summary is the one status a row shows: its most urgent session's.
function summary(sessions: Session[], data?: BoxData): { state?: SessionState; count: number } {
  const states = sessions.map((s) => sessionState(s, data?.stats)).filter((s) => s !== "exited");
  states.sort((a, b) => urgency[a] - urgency[b]);
  return { state: states[0], count: sessions.length };
}

interface Repo {
  key: string;
  box: BoxStatus;
  loc: Location;
  main?: Worktree;
  worktrees: Worktree[];
}

export function Projects({ prefs, update }: { prefs: SidebarPrefs; update(p: Partial<SidebarPrefs>): void }) {
  const boxes = useStore((s) => s.status?.boxes ?? NONE);
  const data = useStore((s) => s.boxes);

  const repos = useMemo(() => {
    const out: Repo[] = [];
    for (const b of boxes) {
      for (const loc of data[b.name]?.locations ?? []) {
        const wts = loc.worktrees ?? [];
        out.push({ key: `${b.name}/${loc.name}`, box: b, loc, main: wts.find((w) => w.main), worktrees: wts.filter((w) => !w.main).sort((x, y) => x.name.localeCompare(y.name)) });
      }
    }
    return out.sort((a, b) => a.loc.name.localeCompare(b.loc.name) || a.box.name.localeCompare(b.box.name));
  }, [boxes, data]);

  const group = (list: Repo[], chip: boolean) => list.map((r) => <RepoGroup key={r.key} repo={r} chip={chip} prefs={prefs} update={update} />);

  // By repository, boxes only appear when there is something to say: an
  // empty box, or one that is not online.
  const notable = boxes.filter((b) => b.state !== "online" || !data[b.name]?.locations?.length);

  return (
    <>
      {prefs.groupBy === "project" ? (
        <>
          <ProjectSections prefs={prefs} update={update} />
          {notable.length > 0 && (
            <div className="mt-3">
              {notable.map((b) => (
                <BoxHeader key={b.name} box={b} empty={!data[b.name]?.locations?.length} />
              ))}
            </div>
          )}
        </>
      ) : (
        boxes.map((b) => (
          <div key={b.name} className="mb-3">
            <BoxHeader box={b} empty={!data[b.name]?.locations?.length} />
            <SidebarMenu className="gap-px">
              {group(
                repos.filter((r) => r.box.name === b.name),
                false,
              )}
            </SidebarMenu>
          </div>
        ))
      )}
    </>
  );
}

// BoxHeader heads a box: its name, state and latency, with a way to add a
// project to it, or to reconnect when it is not online.
function BoxHeader({ box, empty }: { box: BoxStatus; empty: boolean }) {
  const online = box.state === "online";
  return (
    <ContextRow items={() => boxActions(box)}>
      <div
        tabIndex={0}
        className="group/row relative flex h-7 outline-none focus-visible:ring-2 focus-visible:ring-ring items-center gap-1.5 rounded-md pr-1 pl-2 font-medium text-[11px] text-muted-foreground hover:bg-sidebar-accent"
      >
        {online ? <ServerIcon className="size-3" /> : <ServerOffIcon className="size-3" />}
        <span className="truncate normal-case tracking-normal">{box.name}</span>
        {online ? (
          <span className="ml-auto flex items-center gap-1.5 font-normal normal-case tracking-normal tabular-nums">
            {empty && <span>no projects</span>}
            {box.latency_ms !== undefined && <span>{box.latency_ms} ms</span>}
            <span className="size-1.5 rounded-full bg-success" />
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-1.5 font-normal normal-case tracking-normal">
            {box.state === "untrusted" ? "not trusted" : box.state}
            <span className="size-1.5 rounded-full bg-muted-foreground/50" />
          </span>
        )}
        <RowOverlay className="rounded-r-md">
          {online ? (
            <RowButton label={`Add a project on ${box.name}`} onClick={() => useStore.getState().openAddLocation(box.name)}>
              <PlusIcon />
            </RowButton>
          ) : (
            <RowButton label={`Reconnect to ${box.name}`} onClick={() => void useStore.getState().refreshAll()}>
              <RefreshCwIcon />
            </RowButton>
          )}
          <DotsMenu label={`${box.name} actions`} items={() => boxActions(box)} />
        </RowOverlay>
      </div>
    </ContextRow>
  );
}

// BoxChip names the box a repository is on; it only draws attention when the
// box is not online.
function BoxChip({ box }: { box: BoxStatus }) {
  const online = box.state === "online";
  const chip = (
    <span
      className={cn(
        "inline-flex h-4 shrink-0 items-center gap-1 rounded px-1 font-mono font-normal text-[10px] leading-none",
        online ? "bg-sidebar-accent/70 text-muted-foreground" : "bg-sidebar-accent/40 text-muted-foreground/70",
      )}
    >
      {!online && <span className="size-1.5 rounded-full bg-muted-foreground/50" />}
      {box.name}
    </span>
  );
  // The name says it all while the box is up; otherwise say why it is dim.
  return online ? chip : <Tip label={`${box.name} is ${box.state}`}>{chip}</Tip>;
}

function RepoGroup({ repo, chip, prefs, update }: { repo: Repo; chip: boolean; prefs: SidebarPrefs; update(p: Partial<SidebarPrefs>): void }) {
  const { box, loc, main, worktrees } = repo;
  const data = useStore((s) => s.boxes[box.name]);
  const current = useWorkspaces((s) => s.current);
  const inWorkspace = useStore((s) => s.view.kind === "workspace");
  const online = box.state === "online";
  const collapsed = prefs.collapsed[repo.key] ?? false;
  const all = prefs.show === "all";
  const expanded = all || (prefs.expanded[repo.key] ?? false);

  const mainSessions = main ? worktreeSessions(data?.sessions, main) : [];
  const mainSel = !!main && inWorkspace && current === wsKey(box.name, main.path);
  const rows = worktrees.map((wt) => ({ wt, sessions: worktreeSessions(data?.sessions, wt), selected: inWorkspace && current === wsKey(box.name, wt.path) }));
  const active = rows.filter((r) => r.sessions.some((s) => !s.exited) || r.selected);
  const shown = expanded ? rows : active;
  const hidden = rows.length - shown.length;
  const open = (wt: Worktree) => selectWorktree(refOf(box.name, loc, wt));
  const toggle = () => update({ collapsed: { ...prefs.collapsed, [repo.key]: !collapsed } });

  return (
    <SidebarMenuItem>
      <ContextRow items={() => projectActions(box.name, loc)} className="group/row relative">
        <Tip side="right" delay={700} wrapClassName="flex w-full min-w-0" label={<PlaceTip name={`${loc.name} on ${box.name}`} lines={[loc.path]} />}>
          <SidebarMenuButton
            size="sm"
            isActive={mainSel && !all}
            disabled={!online || !main}
            onClick={() => main && open(main)}
            className={cn("h-[calc(var(--side-row)+0.125rem)] gap-1.5 font-medium text-[13px] text-foreground", !online && "text-muted-foreground")}
          >
            <span
              role="button"
              tabIndex={-1}
              aria-label={collapsed ? `Show ${loc.name}` : `Hide ${loc.name}`}
              className="-ml-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
            >
              <ChevronRightIcon className={cn("size-3 transition-transform", !collapsed && "rotate-90")} />
            </span>
            <LeadIcon sessions={!all && main ? mainSessions : []} data={data} icon={<FolderGitIcon />} />
            <span className="min-w-0 truncate">{loc.name}</span>
            {chip && <BoxChip box={box} />}
            <span className="ml-auto" />
            {!all && main && <Glyphs sessions={mainSessions} data={data} />}
          </SidebarMenuButton>
        </Tip>
        {online && main && (
          <RowActions box={box.name} loc={loc} wt={main} project onNewWorktree={() => useStore.getState().openNewWorktree({ box: box.name, location: loc.name })} />
        )}
      </ContextRow>

      {!collapsed && online && (all || shown.length > 0 || hidden > 0) && (
        <SidebarMenuSub className="mx-0 ml-[17px] gap-px py-0.5 pr-0 pl-1.5">
          {all && main && <WorktreeRow box={box.name} loc={loc} wt={main} sessions={mainSessions} data={data} selected={mainSel} onOpen={() => open(main)} />}
          {shown.map(({ wt, sessions, selected }) => (
            <WorktreeRow key={wt.path} box={box.name} loc={loc} wt={wt} sessions={sessions} data={data} selected={selected} onOpen={() => open(wt)} />
          ))}
          {hidden > 0 && (
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                render={<button type="button" />}
                size="sm"
                className="h-6 w-full text-muted-foreground/80"
                onClick={() => update({ expanded: { ...prefs.expanded, [repo.key]: true } })}
              >
                <span>
                  {hidden} more {hidden === 1 ? "worktree" : "worktrees"}
                </span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          )}
          {!all && expanded && rows.length > active.length && (
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                render={<button type="button" />}
                size="sm"
                className="h-6 w-full text-muted-foreground/80"
                onClick={() => update({ expanded: { ...prefs.expanded, [repo.key]: false } })}
              >
                <span>Show fewer</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          )}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

function WorktreeRow({
  box,
  loc,
  wt,
  sessions,
  data,
  selected,
  onOpen,
  chip,
}: {
  box: string;
  loc: Location;
  wt: Worktree;
  sessions: Session[];
  data?: BoxData;
  selected: boolean;
  onOpen(): void;
  // Shown when the project spans boxes, to tell its copies apart.
  chip?: BoxStatus;
}) {
  return (
    <SidebarMenuSubItem>
      <ContextRow items={() => worktreeActions(box, loc, wt)} className="group/row relative">
        <Tip side="right" delay={700} label={<PlaceTip name={`${wt.main ? "Main checkout" : wt.name}${wt.branch && wt.branch !== wt.name ? ` · ${wt.branch}` : ""}`} lines={[wt.path]} />}>
          <SidebarMenuSubButton
            render={<button type="button" />}
            isActive={selected}
            onClick={onOpen}
            className="h-side-row w-full text-[13px] sm:h-side-row [&>svg]:text-muted-foreground"
          >
            <LeadIcon sessions={sessions} data={data} icon={wt.main ? <HomeIcon /> : <GitBranchIcon />} />
            <span className="min-w-0 truncate">{wt.main ? (wt.branch ?? "main") : wt.name}</span>
            {chip && <BoxChip box={chip} />}
            {wt.setting_up && <span className="shrink-0 text-[10px] text-warning-foreground">setting up</span>}
            <span className="ml-auto" />
            <Glyphs sessions={sessions} data={data} />
          </SidebarMenuSubButton>
        </Tip>
        <RowActions box={box} loc={loc} wt={wt} />
      </ContextRow>
    </SidebarMenuSubItem>
  );
}

// Rows never change size or position on hover: a row's state lives in its
// leading icon, its trailing glyphs stay put, and its actions fade in over
// them on a background of their own (RowOverlay).

// LeadIcon is a row's leading icon: the state of its most urgent agent while
// one is working, waiting or done, and the row's own icon otherwise, in the
// same 14px box.
function LeadIcon({ sessions, data, icon }: { sessions: Session[]; data?: BoxData; icon: React.ReactNode }) {
  const { state } = summary(sessions, data);
  if (state === "running" || state === "waiting" || state === "finished") return <StateGlyph state={state} className="size-3.5" />;
  return <span className="inline-flex size-3.5 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-3.5">{icon}</span>;
}

// Glyphs are what runs in a row: the most urgent agent's icon, or a dot for
// shells alone, and how many sessions when more than one.
function Glyphs({ sessions, data }: { sessions: Session[]; data?: BoxData }) {
  const { state, count } = summary(sessions, data);
  if (!state) return null;
  const agent = sessions.find((s) => agentOf(s) && sessionState(s, data?.stats) === state) ?? sessions.find((s) => agentOf(s) && !s.exited);
  const shells = sessions.filter((s) => !agentOf(s)).length;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {agent ? (
        <AgentIcon agent={agentOf(agent)} className="size-3 opacity-80" />
      ) : (
        <Tip label={`${shells} shell${shells === 1 ? "" : "s"} open`}>
          <span className="inline-flex size-3 items-center justify-center">
            <span className="size-1 rounded-full bg-muted-foreground/50" />
          </span>
        </Tip>
      )}
      {count > 1 && <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>}
    </span>
  );
}

// RowOverlay holds a row's actions over its trailing end. It only fades
// (opacity, 100ms), and paints the row's hover colour, opaque, with a short
// fade on its left edge, so it covers chips, counts and glyphs under it and
// nothing in the row moves.
function RowOverlay({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("pointer-events-none absolute inset-y-0 right-0 flex items-center rounded-r-lg pr-1 pl-4 opacity-0 transition-opacity duration-100 [background:linear-gradient(var(--sidebar-accent),var(--sidebar-accent)),var(--sidebar)] [mask-image:linear-gradient(to_right,transparent,black_16px)] focus-within:pointer-events-auto focus-within:opacity-100 group-hover/row:pointer-events-auto group-hover/row:opacity-100 has-[[data-popup-open]]:pointer-events-auto has-[[data-popup-open]]:opacity-100", className)}>
      {children}
    </div>
  );
}

// RowActions are a row's buttons: start something here, and its ⋯ menu. They
// fade in over the row's trailing end on hover or keyboard focus.
function RowActions({ box, loc, wt, project, onNewWorktree }: { box: string; loc: Location; wt: Worktree; project?: boolean; onNewWorktree?: () => void }) {
  const select = () => selectWorktree(refOf(box, loc, wt));

  return (
    <RowOverlay>
      {onNewWorktree && (
        <RowButton label={`New worktree in ${loc.name}`} onClick={onNewWorktree}>
          <PlusIcon />
        </RowButton>
      )}
      {!onNewWorktree && (
        <Menu>
          <MenuTrigger render={<RowButton label={`Start in ${wt.name}`} />}>
            <PlusIcon />
          </MenuTrigger>
          <MenuPopup align="start" className="min-w-48">
            <MenuGroup>
              <MenuGroupLabel>Start in {wt.main ? loc.name : wt.name}</MenuGroupLabel>
              {agentPresets(box, loc).map((p) => (
                <MenuItem
                  key={p.id}
                  onClick={() => {
                    select();
                    void startSession(p.command, { kind: "tab" }, p.name);
                  }}
                >
                  <span className="flex size-4 items-center justify-center">
                    <AgentIcon agent={p.id} />
                  </span>
                  {p.name}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem
                onClick={() => {
                  select();
                  void startSession("");
                }}
              >
                <SquareTerminalIcon />
                Shell
              </MenuItem>
            </MenuGroup>
          </MenuPopup>
        </Menu>
      )}
      <DotsMenu label={`${wt.main ? loc.name : wt.name} actions`} items={() => (project ? projectActions(box, loc) : worktreeActions(box, loc, wt))} />
    </RowOverlay>
  );
}

function RowButton({ label, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label={label}
        {...props}
        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground data-popup-open:bg-sidebar-accent [&_svg]:size-3.5"
      />
    </Tip>
  );
}

// ProjectSections lists projects under their sections (Work, Personal…);
// projects in none come first. Drag a project onto a section to move it.
function ProjectSections({ prefs, update }: { prefs: SidebarPrefs; update(p: Partial<SidebarPrefs>): void }) {
  const { projects, sections } = useProjects();
  const multiBox = useStore((s) => (s.status?.boxes.length ?? 0) > 1);
  const [over, setOver] = useState<string>();
  const loose = projects.filter((p) => !p.section);
  const drop = (section?: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("application/x-berth-project")) return;
      e.preventDefault();
      setOver(section ?? "");
    },
    onDragLeave: () => setOver(undefined),
    onDrop: (e: React.DragEvent) => {
      const id = e.dataTransfer.getData("application/x-berth-project");
      setOver(undefined);
      const p = projects.find((x) => x.id === id);
      if (p && p.section !== section) void groupActions.setSection(p, section);
    },
  });
  const list = (ps: Project[]) => ps.map((p) => <ProjectGroup key={p.id} project={p} chips={multiBox} prefs={prefs} update={update} />);

  return (
    <>
      <div {...drop(undefined)} className={cn("rounded-md", over === "" && "bg-sidebar-accent/40 ring-1 ring-ring/40")}>
        <SidebarMenu className="gap-px">{list(loose)}</SidebarMenu>
      </div>
      {sections.map((name) => {
        const inside = projects.filter((p) => p.section === name);
        const key = `section:${name}`;
        const closed = prefs.collapsed[key] ?? false;
        return (
          <div key={name} {...drop(name)} className={cn("mt-2 rounded-md", over === name && "bg-sidebar-accent/40 ring-1 ring-ring/40")}>
            <ContextRow items={() => sectionActions(name)}>
              <div className="group/row flex h-7 items-center gap-1 rounded-md pr-1 pl-1.5 hover:bg-sidebar-accent/40">
                <button
                  type="button"
                  onClick={() => update({ collapsed: { ...prefs.collapsed, [key]: !closed } })}
                  className="flex min-w-0 flex-1 items-center gap-1 font-medium text-[11px] text-muted-foreground"
                >
                  <ChevronRightIcon className={cn("size-3 transition-transform", !closed && "rotate-90")} />
                  <span className="truncate">{name}</span>
                  <span className="font-normal normal-case tracking-normal">{inside.length || ""}</span>
                </button>
                <span className="opacity-0 group-hover/row:opacity-100 has-[[data-popup-open]]:opacity-100">
                  <DotsMenu label={`${name} section`} items={() => sectionActions(name)} />
                </span>
              </div>
            </ContextRow>
            {!closed &&
              (inside.length ? <SidebarMenu className="gap-px">{list(inside)}</SidebarMenu> : <p className="px-6 py-1 text-muted-foreground/70 text-xs">Drag a project here.</p>)}
          </div>
        );
      })}
    </>
  );
}

function sectionActions(name: string): Action[] {
  return [
    {
      type: "item",
      label: "Rename section…",
      icon: <PencilIcon />,
      run: () =>
        confirm({
          title: `Rename ${name}`,
          description: "Its projects move with it.",
          input: { label: "Name", initial: name },
          confirm: "Rename",
          run: (_c, v) => groupActions.renameSection(name, v),
        }),
    },
    { type: "item", label: "New section…", icon: <PlusIcon />, run: () => newSection() },
    { type: "sep" },
    {
      type: "item",
      label: "Remove section",
      icon: <Trash2Icon />,
      destructive: true,
      run: () => void groupActions.removeSection(name),
      hint: "projects stay",
    },
  ];
}

// ProjectGroup is one project: its row (name, its boxes, how its agents are
// doing), and under it the worktrees from all its boxes.
function ProjectGroup({ project: p, chips, prefs, update }: { project: Project; chips: boolean; prefs: SidebarPrefs; update(p: Partial<SidebarPrefs>): void }) {
  const boxes = useStore((s) => s.boxes);
  const current = useWorkspaces((s) => s.current);
  const inWorkspace = useStore((s) => s.view.kind === "workspace");
  const key = `project:${p.id}`;
  const collapsed = prefs.collapsed[key] ?? false;
  const all = prefs.show === "all";
  const expanded = all || (prefs.expanded[key] ?? false);
  const multi = p.members.length > 1;
  const def = p.members.find((m) => m.box.name === p.defaultBox) ?? p.members[0];
  const defMain = def.loc.worktrees?.find((w) => w.main);

  const rows = p.members.flatMap((m) => {
    if (m.box.state !== "online") return [];
    const data = boxes[m.box.name];
    return (m.loc.worktrees ?? [])
      .filter((w) => (multi ? true : !w.main))
      .sort((a, b) => Number(!!b.main) - Number(!!a.main) || a.name.localeCompare(b.name))
      .map((wt) => ({ m, wt, data, sessions: worktreeSessions(data?.sessions, wt), selected: inWorkspace && current === wsKey(m.box.name, wt.path) }));
  });
  const active = rows.filter((r) => r.sessions.some((s) => !s.exited) || r.selected);
  const shown = expanded ? rows : active;
  const hidden = rows.length - shown.length;
  // With one box, the row itself is the main checkout.
  const mainSel = !multi && !!defMain && inWorkspace && current === wsKey(def.box.name, defMain.path);
  const allSessions = p.members.flatMap((m) => (boxes[m.box.name]?.sessions ?? []).filter((s) => m.loc.worktrees?.some((w) => w.path === s.dir)));
  const glyphSessions = multi ? (collapsed ? allSessions : []) : defMain ? worktreeSessions(boxes[def.box.name]?.sessions, defMain) : [];
  const online = p.members.some((m) => m.box.state === "online");

  return (
    <SidebarMenuItem>
      <ContextRow items={() => projectGroupActions(p)} className="group/row relative">
        <Tip side="right" delay={700} wrapClassName="flex w-full min-w-0" label={<PlaceTip name={`${p.name}${p.slug ? ` (${p.slug})` : ""}`} lines={p.members.map((m) => `${m.box.name}: ${m.loc.path}`)} />}>
          <SidebarMenuButton
            size="sm"
            draggable
            onDragStart={(e: React.DragEvent) => {
              e.dataTransfer.setData("application/x-berth-project", p.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            isActive={mainSel && !all}
            disabled={!online}
            onClick={() => defMain && def.box.state === "online" && selectWorktree(refOf(def.box.name, def.loc, defMain))}
            className={cn("h-[calc(var(--side-row)+0.125rem)] gap-1.5 font-medium text-[13px] text-foreground", !online && "text-muted-foreground")}
          >
            <span
              role="button"
              tabIndex={-1}
              aria-label={collapsed ? `Show ${p.name}` : `Hide ${p.name}`}
              className="-ml-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                update({ collapsed: { ...prefs.collapsed, [key]: !collapsed } });
              }}
            >
              <ChevronRightIcon className={cn("size-3 transition-transform", !collapsed && "rotate-90")} />
            </span>
            <LeadIcon sessions={!all ? glyphSessions : []} data={boxes[def.box.name]} icon={<FolderGitIcon />} />
            <span className="min-w-0 truncate">{p.name}</span>
            {chips && (
              <span className="flex min-w-0 shrink items-center gap-0.5 overflow-hidden">
                {p.members.slice(0, 3).map((m) => (
                  <BoxChip key={m.box.name} box={m.box} />
                ))}
                {p.members.length > 3 && <span className="text-[10px] text-muted-foreground">+{p.members.length - 3}</span>}
              </span>
            )}
            <span className="ml-auto" />
            {!all && <Glyphs sessions={glyphSessions} data={boxes[def.box.name]} />}
          </SidebarMenuButton>
        </Tip>
        {online && (
          <RowOverlay>
            <RowButton
              label={multi ? `New worktree on ${p.defaultBox}` : `New worktree in ${p.name}`}
              onClick={() => useStore.getState().openNewWorktree({ box: def.box.name, location: def.loc.name })}
            >
              <PlusIcon />
            </RowButton>
            <DotsMenu label={`${p.name} actions`} items={() => projectGroupActions(p)} />
          </RowOverlay>
        )}
      </ContextRow>

      {!collapsed && online && (all || shown.length > 0 || hidden > 0) && (
        <SidebarMenuSub className="mx-0 ml-[17px] gap-px py-0.5 pr-0 pl-1.5">
          {!multi && all && defMain && (
            <WorktreeRow
              box={def.box.name}
              loc={def.loc}
              wt={defMain}
              sessions={glyphSessions}
              data={boxes[def.box.name]}
              selected={mainSel}
              onOpen={() => selectWorktree(refOf(def.box.name, def.loc, defMain))}
            />
          )}
          {shown.map(({ m, wt, data, sessions, selected }) => (
            <WorktreeRow
              key={`${m.box.name}:${wt.path}`}
              box={m.box.name}
              loc={m.loc}
              wt={wt}
              sessions={sessions}
              data={data}
              selected={selected}
              chip={multi ? m.box : undefined}
              onOpen={() => selectWorktree(refOf(m.box.name, m.loc, wt))}
            />
          ))}
          {hidden > 0 && (
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                render={<button type="button" />}
                size="sm"
                className="h-6 w-full text-muted-foreground/80"
                onClick={() => update({ expanded: { ...prefs.expanded, [key]: true } })}
              >
                <span>
                  {hidden} more {hidden === 1 ? "worktree" : "worktrees"}
                </span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          )}
          {!all && expanded && rows.length > active.length && (
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                render={<button type="button" />}
                size="sm"
                className="h-6 w-full text-muted-foreground/80"
                onClick={() => update({ expanded: { ...prefs.expanded, [key]: false } })}
              >
                <span>Show fewer</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          )}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

// PlaceTip says where a sidebar row is: its name, then its path on each box.
function PlaceTip({ name, lines }: { name: string; lines: string[] }) {
  return (
    <span className="flex max-w-96 flex-col gap-0.5">
      <span>{name}</span>
      {lines.map((l) => (
        <span key={l} className="break-all font-mono text-[11px] text-muted-foreground">
          {l}
        </span>
      ))}
    </span>
  );
}
