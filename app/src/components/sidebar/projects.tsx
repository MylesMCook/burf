import {
  ChevronRightIcon,
  FolderGitIcon,
  GitBranchIcon,
  HomeIcon,
  PlusIcon,
  RefreshCwIcon,
  ServerIcon,
  ServerOffIcon,
  SquareTerminalIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { boxActions, ContextRow, DotsMenu, projectActions, worktreeActions } from "@/components/sidebar/actions";
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

export type GroupBy = "repo" | "box";
export type Show = "active" | "all";

interface SidebarPrefs {
  groupBy: GroupBy;
  show: Show;
  collapsed: Record<string, boolean>;
  expanded: Record<string, boolean>;
}

const KEY = "berth.sidebar";
const initial: SidebarPrefs = { groupBy: "repo", show: "active", collapsed: {}, expanded: {}, ...load<Partial<SidebarPrefs>>(KEY, {}) };

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
      {prefs.groupBy === "repo" ? (
        <>
          <SidebarMenu className="gap-px">{group(repos, boxes.length > 1)}</SidebarMenu>
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
        className="group/row flex h-7 outline-none focus-visible:ring-2 focus-visible:ring-ring items-center gap-1.5 rounded-md pr-1 pl-2 font-medium text-[11px] text-muted-foreground uppercase tracking-wide hover:bg-sidebar-accent/40"
      >
        {online ? <ServerIcon className="size-3" /> : <ServerOffIcon className="size-3" />}
        <span className="truncate normal-case tracking-normal">{box.name}</span>
        {online ? (
          <span className="ml-auto flex items-center gap-1.5 font-normal normal-case tracking-normal tabular-nums group-hover/row:hidden">
            {empty && <span>no projects</span>}
            {box.latency_ms !== undefined && <span>{box.latency_ms} ms</span>}
            <span className="size-1.5 rounded-full bg-success" />
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-1.5 font-normal normal-case tracking-normal group-hover/row:hidden">
            {box.state === "untrusted" ? "not trusted" : box.state}
            <span className="size-1.5 rounded-full bg-muted-foreground/50" />
          </span>
        )}
        <span className="ml-auto hidden group-hover/row:flex">
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
        </span>
      </div>
    </ContextRow>
  );
}

// BoxChip names the box a repository is on; it only draws attention when the
// box is not online.
function BoxChip({ box }: { box: BoxStatus }) {
  const online = box.state === "online";
  return (
    <span
      className={cn(
        "inline-flex h-4 shrink-0 items-center gap-1 rounded px-1 font-mono font-normal text-[10px] leading-none",
        online ? "bg-sidebar-accent/70 text-muted-foreground" : "bg-sidebar-accent/40 text-muted-foreground/70",
      )}
      title={online ? box.name : `${box.name} is ${box.state}`}
    >
      {!online && <span className="size-1.5 rounded-full bg-muted-foreground/50" />}
      {box.name}
    </span>
  );
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
  const active = rows.filter((r) => r.sessions.length > 0 || r.selected);
  const shown = expanded ? rows : active;
  const hidden = rows.length - shown.length;
  const open = (wt: Worktree) => selectWorktree(refOf(box.name, loc, wt));
  const toggle = () => update({ collapsed: { ...prefs.collapsed, [repo.key]: !collapsed } });

  return (
    <SidebarMenuItem>
      <ContextRow items={() => projectActions(box.name, loc)} className="group/row relative">
        <SidebarMenuButton
          size="sm"
          isActive={mainSel && !all}
          disabled={!online || !main}
          onClick={() => main && open(main)}
          title={`${loc.name} on ${box.name}\n${loc.path}`}
          className={cn("h-7.5 gap-1.5 font-medium text-[13px] text-foreground", !online && "text-muted-foreground")}
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
          <FolderGitIcon className="size-3.5 text-muted-foreground" />
          <span className="min-w-0 truncate">{loc.name}</span>
          {chip && <BoxChip box={box} />}
          <span className="ml-auto" />
          {!all && main && <Glyphs sessions={mainSessions} data={data} />}
        </SidebarMenuButton>
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
}: {
  box: string;
  loc: Location;
  wt: Worktree;
  sessions: Session[];
  data?: BoxData;
  selected: boolean;
  onOpen(): void;
}) {
  return (
    <SidebarMenuSubItem>
      <ContextRow items={() => worktreeActions(box, loc, wt)} className="group/row relative">
        <SidebarMenuSubButton
          render={<button type="button" />}
          isActive={selected}
          onClick={onOpen}
          title={`${wt.main ? "main checkout" : wt.name}${wt.branch && wt.branch !== wt.name ? `\n${wt.branch}` : ""}\n${wt.path}`}
          className="h-7 w-full text-[13px] [&>svg]:text-muted-foreground"
        >
          {wt.main ? <HomeIcon className="size-3.5" /> : <GitBranchIcon className="size-3.5" />}
          <span className="min-w-0 truncate">{wt.main ? (wt.branch ?? "main") : wt.name}</span>
          {wt.setting_up && <span className="shrink-0 text-[10px] text-warning-foreground">setting up</span>}
          <span className="ml-auto" />
          <Glyphs sessions={sessions} data={data} />
        </SidebarMenuSubButton>
        <RowActions box={box} loc={loc} wt={wt} />
      </ContextRow>
    </SidebarMenuSubItem>
  );
}

// Glyphs are a row's status: the most urgent agent's state, and how many
// sessions run there when more than one does. Hovering the row makes room
// for its actions, but the state stays.
function Glyphs({ sessions, data }: { sessions: Session[]; data?: BoxData }) {
  const { state, count } = summary(sessions, data);
  const agent = sessions.find((s) => agentOf(s) && sessionState(s, data?.stats) === state);
  if (!state) return null;
  const shells = sessions.filter((s) => !agentOf(s)).length;
  return (
    <span className="flex shrink-0 items-center gap-1 transition-[margin] group-hover/row:mr-13 group-focus-within/row:mr-13 group-has-[[data-popup-open]]/row:mr-13">
      {state !== "idle" && agent && <AgentIcon agent={agentOf(agent)} className="size-3 opacity-80 group-hover/row:hidden" />}
      {state !== "idle" ? (
        <StateGlyph state={state} className="size-3" />
      ) : (
        <span className="size-1 rounded-full bg-muted-foreground/50" title={`${shells} shell${shells === 1 ? "" : "s"} open`} />
      )}
      {count > 1 && <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>}
    </span>
  );
}

// RowActions are a row's buttons: start something here, and its ⋯ menu. They
// fade in on hover or keyboard focus, beside the row's status.
function RowActions({ box, loc, wt, project, onNewWorktree }: { box: string; loc: Location; wt: Worktree; project?: boolean; onNewWorktree?: () => void }) {
  const select = () => selectWorktree(refOf(box, loc, wt));

  return (
    <div className="absolute top-0.5 right-1 flex h-6.5 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100 has-[[data-popup-open]]:opacity-100">
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
    </div>
  );
}

function RowButton({ label, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground data-popup-open:bg-sidebar-accent [&_svg]:size-3.5"
    />
  );
}
