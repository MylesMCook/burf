import * as stylex from "@stylexjs/stylex";
import {
  ChevronRightIcon,
  FolderGitIcon,
  GitBranchIcon,
  HomeIcon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  ServerIcon,
  ServerOffIcon,
  SquareTerminalIcon,
  Trash2Icon,
  WorkflowIcon,
} from "lucide-react";
import { memo, useMemo, useState } from "react";

import { AgentIcon, BoxStateDot, StateGlyph } from "@/components/agent-glyph";
import { type Action, Armed, boxActions, useArmed, ContextRow, DotsMenu, newSection, projectActions, projectGroupActions, worktreeActions } from "@/components/sidebar/actions";
import { confirm } from "@/components/sidebar/confirm";
import { type Project, projectActions as groupActions, useProjects } from "@/lib/project-groups";
import { Tip } from "@/components/tip";
import { Spinner } from "@/components/ui/spinner";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar";
import { startSession } from "@/lib/actions";
import { type BoxStatus, type Location, type Session, type Worktree } from "@/lib/api";
import { agentOf, sidebarChats, type SessionState, sessionName, sessionState, worktreeSessions } from "@/lib/derive";
import { load, save } from "@/lib/storage";
import { type BoxData, NONE, useStore } from "@/lib/store";
import { selectFolder } from "@/lib/open-folder-chat";
import { addGroup, openSession, refOf, selectWorktree, useWorkspaces, wsKey } from "@/lib/workspaces";
import { armDrag } from "@/components/workspace/tab-drag";
import { WtDot } from "@/components/workspace/worktree-tone";
import { BOX_WORDS, boxState, WORKTREE_WORDS } from "@/lib/state-model";
import { useNotifications } from "@/lib/notifications";
import { usePrefs } from "@/lib/prefs";
import { removalLabel, removalOf, useRemoval, useRemovals } from "@/lib/removing";
import { WorktreeNameField } from "@/components/sidebar/rename-worktree";
import { renameKey, startRenamingWorktree, stopRenamingWorktree, useRenamingWorktree, worktreeLabel } from "@/lib/worktree-names";
import { below, MAX_INDENT, nest, prune, size, type TreeNode } from "@/lib/worktree-tree";

const paint = stylex.create({
  s0: {
    "marginTop": "12px",
  },
  s1: {
    "marginBottom": "12px",
  },
  s2: {
    "position": "relative",
    "display": "flex",
    "height": "28px",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "paddingRight": "4px",
    "paddingLeft": "8px",
    "fontWeight": 500,
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "backgroundColor": {
      ":hover": "var(--sidebar-accent)",
    },
  },
  s3: {
    "width": "12px",
    "height": "12px",
  },
  s4: {
    "width": "12px",
    "height": "12px",
  },
  s5: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "textTransform": "none",
    "letterSpacing": "0em",
  },
  s6: {
    "marginLeft": "auto",
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "fontWeight": 400,
    "textTransform": "none",
    "letterSpacing": "0em",
    "fontVariantNumeric": "tabular-nums",
  },
  s7: {
    "marginLeft": "auto",
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "fontWeight": 400,
    "textTransform": "none",
    "letterSpacing": "0em",
  },
  s8: {
    "borderTopRightRadius": "var(--radius-md)",
    "borderBottomRightRadius": "var(--radius-md)",
  },
  s9: {
    "display": "inline-flex",
    "height": "16px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontFamily": "var(--font-mono)",
    "fontWeight": 400,
    "fontSize": "10px",
    "lineHeight": "1",
  },
  s10: {
    "backgroundColor": "color-mix(in oklab, var(--sidebar-accent) 70%, transparent)",
    "color": "var(--muted-foreground)",
  },
  s11: {
    "backgroundColor": "color-mix(in oklab, var(--sidebar-accent) 40%, transparent)",
    "color": "var(--muted-foreground)",
  },
  s12: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
  },
  s13: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--success) 45%, transparent)",
  },
  s14: {
    "position": "relative",
  },
  s15: {
    "marginLeft": "calc(2px * -1)",
    "display": "inline-flex",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
  },
  s16: {
    "width": "12px",
    "height": "12px",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },
  s17: {
    "transform": "rotate(90deg)",
  },
  s18: {
    "flexShrink": 0,
  },
  s19: {
    "minWidth": "0px",
    "flexShrink": 1,
    "overflow": "hidden",
  },
  s20: {
    "marginLeft": "auto",
  },
  s21: {
    "position": "relative",
  },
  s22: {
    "width": "12px",
    "height": "12px",
  },
  s23: {
    "width": "12px",
    "height": "12px",
  },
  s24: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s25: {
    "opacity": 0.7,
  },
  s26: {
    "display": {
      "default": "none",
      "@container side (min-width: 17rem)": "inline",
    },
    "minWidth": "0px",
    "maxWidth": "max-content",
    "flexGrow": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s27: {
    "width": "6px",
    "height": "6px",
  },
  s28: {
    "display": {
      "default": "none",
      "@container side (min-width: 14rem)": "inline-flex",
    },
    "flexShrink": 0,
  },
  s29: {
    "marginLeft": "auto",
  },
  s30: {
    "marginLeft": "24px",
    "display": "flex",
    "height": "24px",
    "width": "max-content",
    "alignItems": "center",
    "borderRadius": "var(--radius-md)",
    "fontSize": "11px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "outline": "none",
  },
  s31: {
    "display": "flex",
    "height": "20px",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--sidebar-border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    ":is(.group\\/pill:hover &)": {
      "backgroundColor": "var(--sidebar-accent)",
    },
    ":is(.group\\/pill:focus-visible &)": {
      "boxShadow": "0 0 0 2px var(--ring)",
    },
    ":not(#\\#) svg": {
      "width": "12px",
      "height": "12px",
    },
  },
  s32: {
    "fontVariantNumeric": "tabular-nums",
  },
  s33: {
    "width": "12px",
    "height": "12px",
  },
  s34: {
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },
  s35: {
    "transform": "rotate(90deg)",
  },
  s36: {
    "display": "flex",
    "height": "var(--side-row)",
    "width": "100%",
    "cursor": "default",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontSize": "13px",
    "color": "var(--muted-foreground)",
  },
  s37: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "textDecoration": "line-through",
    "textDecorationColor": "color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
    "opacity": 0.7,
  },
  s38: {
    "marginLeft": "auto",
    "flexShrink": 0,
    "fontSize": "10px",
  },
  s39: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s40: {
    "width": "12px",
    "height": "12px",
  },
  s41: {
    "width": "14px",
    "height": "14px",
  },
  s42: {
    "display": "inline-flex",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "color": "var(--muted-foreground)",
    ":not(#\\#) svg": {
      "width": "14px",
      "height": "14px",
    },
  },
  s43: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
  },
  s44: {
    "width": "12px",
    "height": "12px",
    "opacity": 0.8,
  },
  s45: {
    "display": "inline-flex",
    "width": "12px",
    "height": "12px",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s46: {
    "width": "4px",
    "height": "4px",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
  },
  s47: {
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s48: {
    "pointerEvents": {
      "default": "none",
      ":focus-within": "auto",
      ":is(.group\\/row:hover &)": "auto",
      ":has([data-popup-open])": "auto",
    },
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "right": "0px",
    "display": "flex",
    "alignItems": "center",
    "borderTopRightRadius": "var(--radius-lg)",
    "borderBottomRightRadius": "var(--radius-lg)",
    "paddingRight": "4px",
    "paddingLeft": "16px",
    "opacity": {
      "default": 0,
      ":focus-within": 1,
      ":is(.group\\/row:hover &)": 1,
      ":has([data-popup-open])": 1,
    },
    "transitionProperty": "opacity",
    "transitionDuration": "100ms",
    "background": "linear-gradient(var(--sidebar-accent),var(--sidebar-accent)),var(--sidebar)",
    "maskImage": "linear-gradient(to right,transparent,black 16px)",
  },
  s49: {
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
      ":hover": "var(--sidebar-accent)",
      "[data-popup-open]": "var(--sidebar-accent)",
    },
    ":not(#\\#) svg": {
      "width": "14px",
      "height": "14px",
    },
  },
  s50: {
    "borderRadius": "var(--radius-md)",
  },
  s51: {
    "backgroundColor": "color-mix(in oklab, var(--sidebar-accent) 40%, transparent)",
    "boxShadow": "0 0 0 2px color-mix(in oklab, var(--ring) 40%, transparent)",
  },
  s52: {
    "marginTop": "8px",
    "borderRadius": "var(--radius-md)",
  },
  s53: {
    "backgroundColor": "color-mix(in oklab, var(--sidebar-accent) 40%, transparent)",
    "boxShadow": "0 0 0 2px color-mix(in oklab, var(--ring) 40%, transparent)",
  },
  s54: {
    "display": "flex",
    "height": "28px",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "paddingRight": "4px",
    "paddingLeft": "6px",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--sidebar-accent) 40%, transparent)",
    },
  },
  s55: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "gap": "4px",
    "fontWeight": 500,
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s56: {
    "width": "12px",
    "height": "12px",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },
  s57: {
    "transform": "rotate(90deg)",
  },
  s58: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s59: {
    "fontWeight": 400,
    "textTransform": "none",
    "letterSpacing": "0em",
  },
  s60: {
    "opacity": {
      "default": 0,
      ":is(.group\\/row:hover &)": 1,
      ":has([data-popup-open])": 1,
    },
  },
  s61: {
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s62: {
    "position": "relative",
  },
  s63: {
    "marginLeft": "calc(2px * -1)",
    "display": "inline-flex",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
  },
  s64: {
    "width": "12px",
    "height": "12px",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },
  s65: {
    "transform": "rotate(90deg)",
  },
  s66: {
    "flexShrink": 0,
  },
  s67: {
    "display": "flex",
    "minWidth": "0px",
    "flexShrink": 1,
    "alignItems": "center",
    "gap": "2px",
    "overflow": "hidden",
  },
  s68: {
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s69: {
    "marginLeft": "auto",
  },
  s70: {
    "display": "flex",
    "maxWidth": "384px",
    "flexDirection": "column",
    "gap": "2px",
  },
  s71: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s72: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "12px",
  },
  s73: {
    "wordBreak": "break-all",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s74: {
    "flexShrink": 0,
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s75: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "fontSize": "10px",
    "color": "var(--destructive-foreground)",
  },
  s76: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "var(--destructive)",
  },
  q77: {
    "display": "flex",
    "width": "100%",
    "minWidth": "0px",
  },
  q78: {
    "display": "flex",
    "width": "100%",
    "minWidth": "0px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

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
        out.push({ key: `${b.name}/${loc.name}`, box: b, loc, main: wts.find((w) => w.main), worktrees: wts.filter((w) => !w.main).sort((x, y) => worktreeLabel(x).localeCompare(worktreeLabel(y))) });
      }
    }
    return out.sort((a, b) => a.loc.name.localeCompare(b.loc.name) || a.box.name.localeCompare(b.box.name));
  }, [boxes, data]);

  const group = (list: Repo[], chip: boolean) => list.map((r) => <RepoGroup key={r.key} repo={r} chip={chip} prefs={prefs} update={update} />);

  // By repository, boxes only appear when there is something to say: an
  // empty box, one that is not online, or one whose link is slow (below the
  // projects, so nothing above it moves).
  const notable = boxes.filter((b) => b.state !== "online" || b.link?.slow || !data[b.name]?.locations?.length);

  return (
    <>
      {prefs.groupBy === "project" ? (
        <>
          <ProjectSections prefs={prefs} update={update} />
          {notable.length > 0 && (
            <div className={sx(paint.s0)}>
              {notable.map((b) => (
                <BoxHeader key={b.name} box={b} empty={!data[b.name]?.locations?.length} />
              ))}
            </div>
          )}
        </>
      ) : (
        boxes.map((b) => (
          <div key={b.name} className={sx(paint.s1)}>
            <BoxHeader box={b} empty={!data[b.name]?.locations?.length} />
            <SidebarMenu gap="tight">
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
      {/* Focusable for its menu (Shift-F10 or the menu key). */}
      <div
        tabIndex={0}
        role="group"
        aria-label={`${box.name}, ${online ? (box.link?.slow ? "online, slow link" : "online") : awayText(box)}`}
        className={[sx(paint.s2), "group/row"].filter(Boolean).join(" ")}
      >
        {online ? <ServerIcon className={sx(paint.s3)} /> : <ServerOffIcon className={sx(paint.s4)} />}
        <span className={sx(paint.s5)}>{box.name}</span>
        {online ? (
          <span className={sx(paint.s6)}>
            {empty && <span>no projects</span>}
            {/* A slow link says so instead of its latency: still online, not alarming. */}
            {box.link?.slow ? <span data-testid="box-slow">slow</span> : box.latency_ms !== undefined && <span>{box.latency_ms} ms</span>}
            <BoxStateDot box={box.name} />
          </span>
        ) : (
          <span className={sx(paint.s7)}>
            {awayText(box)}
            <BoxStateDot box={box.name} />
          </span>
        )}
        <RowOverlay corner="md">
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
      className={[sx(paint.s9), online ? sx(paint.s10) : sx(paint.s11)].filter(Boolean).join(" ")}
    >
      {!online && <span className={sx(paint.s12)} />}
      {online && box.link?.slow && <span className={sx(paint.s13)} />}
      {box.name}
    </span>
  );
  // The name says it all while the box is up; otherwise say why it is dim.
  if (online && box.link?.slow) return <Tip label={`${box.name}'s link is slow; requests still go through`}>{chip}</Tip>;
  return online ? chip : <Tip label={`${box.name} is ${awayText(box)}`}>{chip}</Tip>;
}

function RepoGroup({ repo, chip, prefs, update }: { repo: Repo; chip: boolean; prefs: SidebarPrefs; update(p: Partial<SidebarPrefs>): void }) {
  const { box, loc, main, worktrees } = repo;
  const data = useStore((s) => s.boxes[box.name]);
  const removals = useRemovals((s) => s.byKey);
  const current = useWorkspaces((s) => s.current);
  const inWorkspace = useStore((s) => s.view.kind === "workspace");
  const online = box.state === "online";
  const collapsed = prefs.collapsed[repo.key] ?? false;
  const all = prefs.show === "all";
  const expanded = all || (prefs.expanded[repo.key] ?? false);

  const mainSessions = main ? worktreeSessions(data?.sessions, main) : [];
  const mainSel = !!main && inWorkspace && current === wsKey(box.name, main.path);
  const rows: TreeRow[] = worktrees.map((wt) => ({
    key: wt.path,
    box: box.name,
    loc,
    wt,
    data,
    sessions: worktreeSessions(data?.sessions, wt),
    selected: inWorkspace && current === wsKey(box.name, wt.path),
    away: online ? undefined : box,
  }));
  const isActive = (r: TreeRow) => r.sessions.some((s) => !s.exited) || r.selected || !!removalOf(removals, box.name, r.wt.path);
  const active = rows.filter(isActive);
  const tree = nest(rows, (r) => r.key, (r) => r.wt.parent);
  const shown = expanded ? tree : prune(tree, isActive);
  const hidden = rows.length - size(shown);
  const drawn = new Set<string>();
  if (all && main) drawn.add(main.path);
  collectPaths(shown, drawn);
  const here = new Set((loc.worktrees ?? []).map((w) => w.path));
  const chats = sidebarChats((data?.sessions ?? []).filter((s) => here.has(s.dir)), drawn);
  const open = (wt: Worktree) => selectFolder(refOf(box.name, loc, wt));
  const toggle = () => update({ collapsed: { ...prefs.collapsed, [repo.key]: !collapsed } });

  return (
    <SidebarMenuItem>
      <ContextRow items={() => projectActions(box.name, loc)} marker="group/row" look={paint.s14}>
        <Tip side="right" delay={700} wrapClassName={sx(paint.q77)} label={<PlaceTip name={`${loc.name} on ${box.name}`} lines={[loc.path]} />}>
          <SidebarMenuButton
            size="sm"
            isActive={mainSel && !all}
            disabled={!online || !main}
            onClick={() => main && open(main)}
            // → shows its worktrees, ← hides them, as in a tree.
            aria-expanded={!collapsed}
            onKeyDown={(e: React.KeyboardEvent) => {
              if ((e.key === "ArrowRight" && collapsed) || (e.key === "ArrowLeft" && !collapsed)) {
                e.preventDefault();
                toggle();
              }
            }}
            density="place"
            offline={!online}
          >
            {/* The pointer's way; the keyboard's is ← and → on the row. */}
            <Tip label={collapsed ? `Show ${loc.name}` : `Hide ${loc.name}`} side="right">
              <span
                aria-hidden
                data-fold=""
                className={sx(paint.s15)}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle();
                }}
              >
                <ChevronRightIcon className={[sx(paint.s16), !collapsed && sx(paint.s17)].filter(Boolean).join(" ")} />
              </span>
            </Tip>
            <LeadIcon sessions={!all && main ? mainSessions : []} data={data} icon={<FolderGitIcon />} />
            <span className={sx(paint.s18)}>{loc.name}</span>
            {chip && (
              <span className={sx(paint.s19)}>
                <BoxChip box={box} />
              </span>
            )}
            <span className={sx(paint.s20)} />
            {!all && main && <Glyphs sessions={mainSessions} data={data} />}
          </SidebarMenuButton>
        </Tip>
        {online && main && (
          <RowActions box={box.name} loc={loc} wt={main} project onNewWorktree={() => useStore.getState().openNewWorktree({ box: box.name, location: loc.name })} />
        )}
      </ContextRow>

      {!collapsed && (all || shown.length > 0 || hidden > 0 || chats.length > 0) && (
        <SidebarMenuSub indent="repo">
          {all && main && <WorktreeRow box={box.name} loc={loc} wt={main} sessions={mainSessions} data={data} selected={mainSel} onOpen={() => open(main)} away={online ? undefined : box} />}
          <WorktreeNodes nodes={shown} depth={0} prefs={prefs} update={update} />
          {chats.map((s) => (
            <SidebarMenuSubItem key={s.name}>
              <SidebarMenuSubButton
                render={<button type="button" data-testid="project-chat" data-session={s.name} />}
                size="sm"
                density="row"
                onClick={() => openSession(box.name, s)}
              >
                <MessageSquareIcon className={sx(paint.s22)} />
                <span className={sx(paint.s24)}>{sessionName(s, { sessions: data?.sessions, agent: true })}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
          {hidden > 0 && (
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                render={<button type="button" />}
                size="sm"
                density="quiet"
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
                density="quiet"
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

interface WorktreeRowProps {
  box: string;
  loc: Location;
  wt: Worktree;
  sessions: Session[];
  data?: BoxData;
  selected: boolean;
  onOpen(): void;
  // Shown when the project spans boxes, to tell its copies apart.
  chip?: BoxStatus;
  // The row's box when it is not online. The row stays, dimmed and marked,
  // so the worktree you have open never vanishes from under you; what it
  // last ran is not shown, since the box cannot say whether it still runs.
  away?: BoxStatus;
}

// A row is drawn again only when what it shows changed: its worktree, its
// sessions, the box's report of its agents, whether it is selected, and its
// box chip's name and state. onOpen opens the worktree it was given, and
// the store keeps what a refresh didn't change (lib/share.ts), so a rename
// or an agent's new state draws one row, not hundreds.
const sameList = (a: Session[], b: Session[]) => a.length === b.length && a.every((s, i) => s === b[i]);
const sameRow = (a: WorktreeRowProps, b: WorktreeRowProps) =>
  a.box === b.box &&
  a.loc === b.loc &&
  a.wt === b.wt &&
  a.selected === b.selected &&
  a.away === b.away &&
  a.chip?.name === b.chip?.name &&
  a.chip?.state === b.chip?.state &&
  a.data?.stats?.agents === b.data?.stats?.agents &&
  sameList(a.sessions, b.sessions);

const WorktreeRow = memo(function WorktreeRow({ box, loc, wt, sessions, data, selected, onOpen, chip, away }: WorktreeRowProps) {
  // Its agents by what they work on ("Fix checkout webhook · Claude Code").
  const agents = away ? [] : sessions.filter((s) => agentOf(s) && !s.exited).map((s) => sessionName(s, { sessions, agent: true }));
  // A renamed worktree's tip says its own name and branch under the title.
  const own = `${wt.name}${wt.branch && wt.branch !== wt.name ? ` · ${wt.branch}` : ""}`;
  const where = (
    <PlaceTip
      name={wt.main ? `Main checkout${wt.branch && wt.branch !== wt.name ? ` · ${wt.branch}` : ""}` : wt.title ? wt.title : own}
      sub={!wt.main && wt.title ? own : undefined}
      work={agents}
      lines={[wt.path, ...(away ? [`${away.name} is ${awayText(away)}`] : [])]}
    />
  );
  // On its way out (lib/removing.ts): dimmed, with nothing to open or do,
  // until the box says it went or puts it back.
  const removal = useRemoval(box, wt.path);
  const labs = usePrefs((p) => p.labs);
  const editing = useRenamingWorktree((s) => s.key === renameKey(box, wt.path));
  if (removal) return <LeavingRow wt={wt} label={removalLabel(removal)} script={removal.script} />;
  const key = wsKey(box, wt.path);
  const name = wt.main ? (wt.branch ?? "main") : worktreeLabel(wt);
  // A worktree on an away box can still be renamed: the name waits for it.
  const canRename = !wt.main && !away;
  if (editing && canRename)
    return (
      <SidebarMenuSubItem>
        <WorktreeNameField box={box} loc={loc} wt={wt} onDone={stopRenamingWorktree} />
      </SidebarMenuSubItem>
    );
  return (
    <SidebarMenuSubItem>
      <ContextRow items={() => (away ? awayActions(away) : worktreeActions(box, loc, wt))} marker="group/row" look={paint.s21}>
        <Tip side="right" delay={700} label={where}>
          <SidebarMenuSubButton
            render={<button type="button" />}
            data-testid="worktree-row"
            data-worktree={`${box}/${wt.main ? loc.name : wt.name}`}
            data-title={wt.title || undefined}
            isActive={selected}
            // Labs: ⌥-click adds its tabs to the strip as a group; dragged
            // onto the strip it does the same, onto a pane it splits its
            // agent in (tab-drag.tsx).
            onClick={(e: React.MouseEvent) => (e.altKey && labs ? void addGroup(key) : onOpen())}
            // Double-click or F2 renames it in place.
            onDoubleClick={() => canRename && startRenamingWorktree(box, wt.path)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "F2" && canRename) {
                e.preventDefault();
                startRenamingWorktree(box, wt.path);
              }
            }}
            onPointerDown={(e: React.PointerEvent<HTMLElement>) => labs && !away && armDrag(e, { kind: "worktree", key }, wt.main ? loc.name : name, wt.main ? <HomeIcon className={sx(paint.s22)} /> : <GitBranchIcon className={sx(paint.s23)} />)}
            density="row"
            away={!!away}
          >
            <LeadIcon sessions={away ? [] : sessions} data={data} icon={wt.main ? <HomeIcon /> : <GitBranchIcon />} />
            <span className={[sx(paint.s24), away && sx(paint.s25)].filter(Boolean).join(" ")}>{name}</span>
            {/* Its own name beside the title, when the sidebar is wide enough. */}
            {!wt.main && wt.title && <span data-testid="worktree-row-name" className={sx(paint.s26)}>{wt.name}</span>}
            {/* On screen beside another worktree: its colour. */}
            <WtDot wsKey={key} className={sx(paint.s27)} />
            {/* Narrower than the default the name needs the room more; the
                tip still says which box. */}
            {chip && (
              <span className={sx(paint.s28)}>
                <BoxChip box={chip} />
              </span>
            )}
            {!away && <SetupMark box={box} wt={wt} />}
            <span className={sx(paint.s29)} />
            {away ? <AwayMark box={away} short={!!chip} /> : <Glyphs sessions={sessions} data={data} />}
          </SidebarMenuSubButton>
        </Tip>
        {!away && <RowActions box={box} loc={loc} wt={wt} />}
      </ContextRow>
    </SidebarMenuSubItem>
  );
}, sameRow);

// TreeRow is one worktree as a project's tree holds it; key is unique
// across the project's boxes.
interface TreeRow {
  key: string;
  box: string;
  loc: Location;
  wt: Worktree;
  data?: BoxData;
  sessions: Session[];
  selected: boolean;
  chip?: BoxStatus;
  away?: BoxStatus;
}

function collectPaths(nodes: TreeNode<TreeRow>[], into: Set<string>) {
  for (const n of nodes) {
    into.add(n.row.wt.path);
    collectPaths(n.children, into);
  }
}

// WorktreeNodes draws worktrees with the ones handed off from each under
// it (lib/worktree-tree.ts).
function WorktreeNodes({ nodes, depth, prefs, update }: { nodes: TreeNode<TreeRow>[]; depth: number; prefs: SidebarPrefs; update(p: Partial<SidebarPrefs>): void }) {
  return nodes.map((n) => <WorktreeNode key={n.key} node={n} depth={depth} prefs={prefs} update={update} />);
}

// WorktreeNode is a worktree and, under a pill saying how many, its
// children. The pill folds them; a fold never hides the worktree you have
// open, and while folded it shows the most urgent agent inside.
function WorktreeNode({ node, depth, prefs, update }: { node: TreeNode<TreeRow>; depth: number; prefs: SidebarPrefs; update(p: Partial<SidebarPrefs>): void }) {
  const r = node.row;
  const row = (
    <WorktreeRow box={r.box} loc={r.loc} wt={r.wt} sessions={r.sessions} data={r.data} selected={r.selected} chip={r.chip} away={r.away} onOpen={() => selectFolder(refOf(r.box, r.loc, r.wt))} />
  );
  if (!node.children.length) return row;
  const fold = `wt:${node.key}`;
  const inside = below(node);
  const closed = (prefs.collapsed[fold] ?? false) && !inside.some((c) => c.selected);
  const n = node.children.length;
  const what = `${n} ${n === 1 ? "child" : "children"}`;
  const { state } = closed ? summary(inside.flatMap((c) => (c.away ? [] : c.sessions)), r.data) : {};
  return (
    <>
      {row}
      <SidebarMenuSubItem>
        <button
          type="button"
          data-testid="worktree-children"
          aria-expanded={!closed}
          aria-label={`${closed ? "Show" : "Hide"} ${what} of ${worktreeLabel(r.wt)}`}
          onClick={() => update({ collapsed: { ...prefs.collapsed, [fold]: !closed } })}
          // A 24px target around a 20px pill.
          className={[sx(paint.s30), "group/pill"].filter(Boolean).join(" ")}
        >
          <span className={sx(paint.s31)}>
            <WorkflowIcon />
            <span className={sx(paint.s32)}>{what}</span>
            {(state === "running" || state === "waiting" || state === "finished") && <StateGlyph state={state} className={sx(paint.s33)} />}
            <ChevronRightIcon className={[sx(paint.s34), !closed && sx(paint.s35)].filter(Boolean).join(" ")} />
          </span>
        </button>
      </SidebarMenuSubItem>
      {!closed && (
        <SidebarMenuSubItem>
          {/* Up to MAX_INDENT levels step in, with a guide; deeper ones line
              up with their parent. */}
          <SidebarMenuSub indent={depth + 1 < MAX_INDENT ? "tree" : "flush"}>
            <WorktreeNodes nodes={node.children} depth={depth + 1} prefs={prefs} update={update} />
          </SidebarMenuSub>
        </SidebarMenuSubItem>
      )}
    </>
  );
}

// LeavingRow is a worktree being archived or removed, in the row's place
// and size so nothing shifts when it goes.
function LeavingRow({ wt, label, script }: { wt: Worktree; label: string; script?: boolean }) {
  return (
    <SidebarMenuSubItem>
      <Tip side="right" delay={400} label={script ? "The repo's archive script is running on the box. The worktree goes when it finishes, or comes back if it fails." : "Waiting for the box."}>
        <div aria-disabled="true" aria-busy="true" data-leaving="" className={sx(paint.s36)}>
          <Spinner size="md" soft />
          <span className={sx(paint.s37)}>{worktreeLabel(wt)}</span>
          <span className={sx(paint.s38)}>{label}</span>
        </div>
      </Tip>
    </SidebarMenuSubItem>
  );
}

// awayActions are what a row on an away box offers: its box's own ways
// back (Reconnect, Doctor, Copy address), not forgetting it.
function awayActions(box: BoxStatus): Action[] {
  const items = boxActions(box).filter((a) => !(a.type === "item" && a.destructive));
  while (items.length && items[items.length - 1].type === "sep") items.pop();
  return items;
}

// awayText is a box's state in the model's words: offline, unreachable,
// connecting.
function awayText(box: BoxStatus) {
  return BOX_WORDS[boxState(box)].lower;
}

// AwayMark ends a row whose box is not online: the box's state, small, or
// just its icon when the row's box chip already says which box.
function AwayMark({ box, short }: { box: BoxStatus; short?: boolean }) {
  return (
    <span className={sx(paint.s39)}>
      <ServerOffIcon aria-label={short ? `${box.name} is ${awayText(box)}` : undefined} aria-hidden={!short} className={sx(paint.s40)} />
      {!short && awayText(box)}
    </span>
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
  if (state === "running" || state === "waiting" || state === "finished") return <StateGlyph state={state} className={sx(paint.s41)} />;
  return <span className={sx(paint.s42)}>{icon}</span>;
}

// Glyphs are what runs in a row: the most urgent agent's icon, or a dot for
// shells alone, and how many sessions when more than one.
function Glyphs({ sessions, data }: { sessions: Session[]; data?: BoxData }) {
  const { state, count } = summary(sessions, data);
  if (!state) return null;
  const agent = sessions.find((s) => agentOf(s) && sessionState(s, data?.stats) === state) ?? sessions.find((s) => agentOf(s) && !s.exited);
  const shells = sessions.filter((s) => !agentOf(s)).length;
  return (
    <span className={sx(paint.s43)}>
      {agent ? (
        <AgentIcon agent={agentOf(agent)} className={sx(paint.s44)} />
      ) : (
        <Tip label={`${shells} shell${shells === 1 ? "" : "s"} open`}>
          <span className={sx(paint.s45)}>
            <span className={sx(paint.s46)} />
          </span>
        </Tip>
      )}
      {count > 1 && <span className={sx(paint.s47)}>{count}</span>}
    </span>
  );
}

// RowOverlay holds a row's actions over its trailing end. It only fades
// (opacity, 100ms), and paints the row's hover colour, opaque, with a short
// fade on its left edge, so it covers chips, counts and glyphs under it and
// nothing in the row moves. Its buttons and their menus are only made once
// the row is first pointed at or focused (Armed).
function RowOverlay({ corner, children }: { corner?: "md"; children: React.ReactNode }) {
  if (!useArmed()) return null;
  return (
    <div {...stylex.props(paint.s48, corner === "md" && paint.s8)}>
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
        <RowButton label={`New task in ${loc.name}`} onClick={onNewWorktree}>
          <PlusIcon />
        </RowButton>
      )}
      {!onNewWorktree && (
        <RowButton label={`New shell in ${worktreeLabel(wt, loc)}`} onClick={() => {
          select();
          void startSession("", { kind: "tab" }, "Terminal", wsKey(box, wt.path));
        }}>
          <SquareTerminalIcon />
        </RowButton>
      )}
      <DotsMenu label={`${worktreeLabel(wt, loc)} actions`} items={() => (project ? projectActions(box, loc) : worktreeActions(box, loc, wt))} />
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
        className={sx(paint.s49)}
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
      <div {...drop(undefined)} className={[sx(paint.s50), over === "" && sx(paint.s51)].filter(Boolean).join(" ")}>
        <SidebarMenu gap="tight">{list(loose)}</SidebarMenu>
      </div>
      {sections.map((name) => {
        const inside = projects.filter((p) => p.section === name);
        const key = `section:${name}`;
        const closed = prefs.collapsed[key] ?? false;
        return (
          <div key={name} {...drop(name)} className={[sx(paint.s52), over === name && sx(paint.s53)].filter(Boolean).join(" ")}>
            <ContextRow items={() => sectionActions(name)}>
              <div className={[sx(paint.s54), "group/row"].filter(Boolean).join(" ")}>
                <button
                  type="button"
                  onClick={() => update({ collapsed: { ...prefs.collapsed, [key]: !closed } })}
                  className={sx(paint.s55)}
                >
                  <ChevronRightIcon className={[sx(paint.s56), !closed && sx(paint.s57)].filter(Boolean).join(" ")} />
                  <span className={sx(paint.s58)}>{name}</span>
                  <span className={sx(paint.s59)}>{inside.length || ""}</span>
                </button>
                <span className={sx(paint.s60)}>
                  <Armed>
                    <DotsMenu label={`${name} section`} items={() => sectionActions(name)} />
                  </Armed>
                </span>
              </div>
            </ContextRow>
            {!closed &&
              (inside.length ? <SidebarMenu gap="tight">{list(inside)}</SidebarMenu> : <p className={sx(paint.s61)}>Drag a project here.</p>)}
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
  const removals = useRemovals((s) => s.byKey);
  const current = useWorkspaces((s) => s.current);
  const inWorkspace = useStore((s) => s.view.kind === "workspace");
  const key = `project:${p.id}`;
  const collapsed = prefs.collapsed[key] ?? false;
  const all = prefs.show === "all";
  const expanded = all || (prefs.expanded[key] ?? false);
  const multi = p.members.length > 1;
  const def = p.members.find((m) => m.box.name === p.defaultBox) ?? p.members[0];
  const defMain = def.loc.worktrees?.find((w) => w.main);

  // A member whose box is away keeps its rows, dimmed (WorktreeRow).
  const rows = p.members.flatMap((m) => {
    const data = boxes[m.box.name];
    return (m.loc.worktrees ?? [])
      .filter((w) => (multi ? true : !w.main))
      .sort((a, b) => Number(!!b.main) - Number(!!a.main) || worktreeLabel(a).localeCompare(worktreeLabel(b)))
      .map(
        (wt): TreeRow => ({
          key: `${m.box.name}:${wt.path}`,
          box: m.box.name,
          loc: m.loc,
          wt,
          data,
          sessions: worktreeSessions(data?.sessions, wt),
          selected: inWorkspace && current === wsKey(m.box.name, wt.path),
          chip: multi ? m.box : undefined,
          away: m.box.state === "online" ? undefined : m.box,
        }),
      );
  });
  const isActive = (r: TreeRow) => r.sessions.some((s) => !s.exited) || r.selected || !!removalOf(removals, r.box, r.wt.path);
  const active = rows.filter(isActive);
  const tree = nest(rows, (r) => r.key, (r) => (r.wt.parent ? `${r.box}:${r.wt.parent}` : undefined));
  const shown = expanded ? tree : prune(tree, isActive);
  const hidden = rows.length - size(shown);
  // With one box, the row itself is the main checkout.
  const mainSel = !multi && !!defMain && inWorkspace && current === wsKey(def.box.name, defMain.path);
  const allSessions = p.members.flatMap((m) => (boxes[m.box.name]?.sessions ?? []).filter((s) => !s.service && m.loc.worktrees?.some((w) => w.path === s.dir)));
  const drawn = new Set<string>();
  if (!multi && all && defMain) drawn.add(defMain.path);
  collectPaths(shown, drawn);
  const chats = sidebarChats(allSessions, drawn);
  const glyphSessions = multi ? (collapsed ? allSessions : []) : defMain ? worktreeSessions(boxes[def.box.name]?.sessions, defMain) : [];
  const online = p.members.some((m) => m.box.state === "online");

  return (
    <SidebarMenuItem>
      <ContextRow items={() => projectGroupActions(p)} marker="group/row" look={paint.s62}>
        <Tip side="right" delay={700} wrapClassName={sx(paint.q78)} label={<PlaceTip name={`${p.name}${p.slug ? ` (${p.slug})` : ""}`} lines={p.members.map((m) => `${m.box.name}: ${m.loc.path}`)} />}>
          <SidebarMenuButton
            size="sm"
            draggable
            onDragStart={(e: React.DragEvent) => {
              e.dataTransfer.setData("application/x-berth-project", p.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            isActive={mainSel && !all}
            disabled={!online}
            onClick={() => defMain && def.box.state === "online" && selectFolder(refOf(def.box.name, def.loc, defMain))}
            aria-expanded={!collapsed}
            onKeyDown={(e: React.KeyboardEvent) => {
              if ((e.key === "ArrowRight" && collapsed) || (e.key === "ArrowLeft" && !collapsed)) {
                e.preventDefault();
                update({ collapsed: { ...prefs.collapsed, [key]: !collapsed } });
              }
            }}
            density="place"
            offline={!online}
          >
            <Tip label={collapsed ? `Show ${p.name}` : `Hide ${p.name}`} side="right">
              <span
                aria-hidden
                data-fold=""
                className={sx(paint.s63)}
                onClick={(e) => {
                  e.stopPropagation();
                  update({ collapsed: { ...prefs.collapsed, [key]: !collapsed } });
                }}
              >
                <ChevronRightIcon className={[sx(paint.s64), !collapsed && sx(paint.s65)].filter(Boolean).join(" ")} />
              </span>
            </Tip>
            <LeadIcon sessions={!all ? glyphSessions : []} data={boxes[def.box.name]} icon={<FolderGitIcon />} />
            <span className={sx(paint.s66)}>{p.name}</span>
            {chips && (
              <span className={sx(paint.s67)}>
                {p.members.slice(0, 3).map((m) => (
                  <BoxChip key={m.box.name} box={m.box} />
                ))}
                {p.members.length > 3 && <span className={sx(paint.s68)}>+{p.members.length - 3}</span>}
              </span>
            )}
            <span className={sx(paint.s69)} />
            {!all && <Glyphs sessions={glyphSessions} data={boxes[def.box.name]} />}
          </SidebarMenuButton>
        </Tip>
        {online && (
          <RowOverlay>
            <RowButton
              label={multi ? `New task on ${p.defaultBox}` : `New task in ${p.name}`}
              onClick={() => useStore.getState().openNewWorktree({ box: def.box.name, location: def.loc.name })}
            >
              <PlusIcon />
            </RowButton>
            <DotsMenu label={`${p.name} actions`} items={() => projectGroupActions(p)} />
          </RowOverlay>
        )}
      </ContextRow>

      {!collapsed && (all || shown.length > 0 || hidden > 0 || chats.length > 0) && (
        <SidebarMenuSub indent="repo">
          {!multi && all && defMain && (
            <WorktreeRow
              box={def.box.name}
              loc={def.loc}
              wt={defMain}
              sessions={glyphSessions}
              data={boxes[def.box.name]}
              selected={mainSel}
              onOpen={() => selectFolder(refOf(def.box.name, def.loc, defMain))}
              away={def.box.state === "online" ? undefined : def.box}
            />
          )}
          <WorktreeNodes nodes={shown} depth={0} prefs={prefs} update={update} />
          {chats.map((s) => {
            const member = p.members.find((m) => m.loc.worktrees?.some((w) => w.path === s.dir));
            if (!member) return null;
            return (
              <SidebarMenuSubItem key={`${member.box.name}:${s.name}`}>
                <SidebarMenuSubButton
                  render={<button type="button" data-testid="project-chat" data-session={s.name} />}
                  size="sm"
                  density="row"
                  onClick={() => openSession(member.box.name, s)}
                >
                  <MessageSquareIcon className={sx(paint.s22)} />
                  <span className={sx(paint.s24)}>{sessionName(s, { sessions: boxes[member.box.name]?.sessions, agent: true })}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
          {hidden > 0 && (
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                render={<button type="button" />}
                size="sm"
                density="quiet"
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
                density="quiet"
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
function PlaceTip({ name, sub, lines, work = [] }: { name: string; sub?: string; lines: string[]; work?: string[] }) {
  return (
    <span className={sx(paint.s70)}>
      <span>{name}</span>
      {sub && <span className={sx(paint.s71)}>{sub}</span>}
      {work.map((w, i) => (
        <span key={i} className={sx(paint.s72)}>
          {w}
        </span>
      ))}
      {lines.map((l) => (
        <span key={l} className={sx(paint.s73)}>
          {l}
        </span>
      ))}
    </span>
  );
}

// SetupMark says a worktree is still setting up, or that its setup failed
// (until the notification about it is dealt with), in the model's words.
function SetupMark({ box, wt }: { box: string; wt: Worktree }) {
  // Setup and archive failures share a category; the title tells them apart.
  const failed = useNotifications((s) => s.notes.find((n) => n.category === "setupFailed" && !n.resolved && n.box === box && n.path === wt.path));
  if (wt.setting_up) return <span className={sx(paint.s74)}>{WORKTREE_WORDS["setting-up"].lower}</span>;
  if (!failed) return null;
  const archive = failed.title.startsWith("Archiving");
  return (
    <Tip label={`Its ${archive ? "archive" : "setup"} script failed. The notification has its output.`}>
      <span className={sx(paint.s75)}>
        <span className={sx(paint.s76)} />
        {archive ? "archive failed" : WORKTREE_WORDS["setup-failed"].lower}
      </span>
    </Tip>
  );
}
