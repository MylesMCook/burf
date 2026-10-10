import * as stylex from "@stylexjs/stylex";
import { ChevronsUpDownIcon, CommandIcon, EllipsisIcon, PencilIcon, FolderIcon, GitBranchIcon, GitBranchPlusIcon, HouseIcon, KeyboardIcon, Minimize2Icon, SettingsIcon } from "lucide-react";
import { useMemo } from "react";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { NotificationBell } from "@/components/notifications/notification-center";
import { openShortcuts } from "@/components/shortcuts-sheet";
import { ActionItems, worktreeActions } from "@/components/sidebar/actions";
import { MoreItems, useArrangedNav, useNavItems } from "@/components/sidebar/nav";
import { runShortcut } from "@/hooks/use-shortcuts";
import { keysFor } from "@/lib/shortcuts";
import { Tip } from "@/components/tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuSeparator, MenuShortcut, MenuSub, MenuSubPopup, MenuSubTrigger, MenuTrigger, menuWidths } from "@/components/ui/menu";
import { TitleInput } from "@/components/workspace/tab-strip";
import { renameSession, startRenaming, useRenaming } from "@/lib/session-title";
import { useAllSessions } from "@/hooks/use-agent-counts";
import { hasTrafficLights } from "@/lib/api";
import { agentLabel, agentOf, sessionName, type SessionState, sessionState, worktreeOf } from "@/lib/derive";
import { sessionWord } from "@/lib/state-model";
import { ago } from "@/lib/format";
import { leaves } from "@/lib/layout";
import { usePrefs } from "@/lib/prefs";
import { removalLabel, removalOf, useRemoval, useRemovals } from "@/lib/removing";
import { useStore } from "@/lib/store";
import { focusSession, homeBox, recentWorktrees, refOf, selectWorktree, useHereKey, useHereRef, useWorkspaces } from "@/lib/workspaces";
import { useLabel, useTone, WtDot } from "@/components/workspace/worktree-tone";
import { placeLabel, worktreeLabel } from "@/lib/worktree-names";

const paint = stylex.create({
  s0: {
    "minWidth": "0px",
    "maxWidth": "384px",
    "gap": "8px",
  },
  s1: {
    "fontWeight": 500,
  },
  s2: {
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "alignItems": "center",
    "justifyContent": "center",
    "color": "var(--muted-foreground)",
    ":not(#\\#) svg": {
      "width": "16px",
      "height": "16px",
    },
  },
  s3: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s4: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s5: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--muted-foreground)",
  },
  s6: {
    "width": "12px",
    "height": "12px",
  },
  s7: {
    "opacity": 0.6,
  },
  s8: {
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "alignItems": "center",
    "justifyContent": "center",
    ":not(#\\#) svg": {
      "width": "16px",
      "height": "16px",
    },
  },
  s9: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s10: {
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s11: {
    "color": "var(--warning-foreground)",
  },
  s12: {
    "color": "var(--muted-foreground)",
  },
  s13: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s14: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s15: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s16: {
    "marginLeft": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s17: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s18: {
    "width": "12px",
    "height": "12px",
  },
  s19: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s20: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s21: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s22: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s23: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s24: {
    "width": "6px",
    "height": "6px",
  },
  s25: {
    "display": "flex",
    "height": "32px",
    "width": "288px",
    "minWidth": "0px",
    "alignItems": "center",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s26: {
    "display": "flex",
    "height": "32px",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-lg)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s27: {
    "display": "flex",
    "height": "40px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "paddingRight": "8px",
  },
  s28: {
    "paddingLeft": "84px",
  },
  s29: {
    "paddingLeft": "8px",
  },
  s30: {
    "position": "absolute",
    "left": 0,
    "right": 0,
    "top": "0px",
    "zIndex": 30,
    ":not(#\\#) button": {
      "backgroundColor": "color-mix(in oklab, var(--background) 70%, transparent)",
    },
  },
  s31: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "var(--background)",
  },
  s32: {
    "display": "contents",
  },
  s33: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignSelf": "stretch",
  },
  s34: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s35: {
    "pointerEvents": "none",
    "position": "fixed",
    "top": "13px",
    "left": "13px",
    "zIndex": NaN,
    "display": "flex",
    "gap": "8px",
  },
  s36: {
    "width": "12px",
    "height": "12px",
    "borderRadius": "999px",
    "boxShadow": "0 0 0 2px color-mix(in oklab, #000 10%, transparent)",
  },

  s37: {
    ":not(#\\#) button": {
      backdropFilter: "blur(4px)",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Zen (Labs, ⌘.) puts away everything but the agents: no sidebar, no status
// bar, and one slim bar over every view, with a switcher where the tab strip
// was. Agents open as conversations. ⌘. brings it all back.

// useHere is what the window shows: a view, or a worktree and the agent in
// its focused pane, or home.
function useHere() {
  const view = useStore((s) => s.view);
  const nav = useNavItems();
  const ws = useWorkspaces((s) => (s.current ? s.spaces[s.current] : undefined));
  const tab = ws?.tabs.find((t) => t.id === ws.active);
  const c = tab ? leaves(tab.root).find((l) => l.id === tab.focus)?.content : undefined;
  // The focused pane's worktree, which in a tab that mixes worktrees need
  // not be the tab's.
  const key = useHereKey();
  const ref = useHereRef();
  const session = useStore((s) => (c?.kind === "terminal" ? s.boxes[c.box]?.sessions?.find((x) => x.name === c.session) : undefined));
  const stats = useStore((s) => (c?.kind === "terminal" ? s.boxes[c.box]?.stats : undefined));
  // The same honesty as the pane: no state while its box is away, ended
  // once the box no longer lists the session.
  const away = useStore((s) => c?.kind === "terminal" && !!s.status && s.status.boxes.find((b) => b.name === c.box)?.state !== "online");
  const gone = useStore((s) => c?.kind === "terminal" && !session && !!s.boxes[c.box]?.sessions);
  const state: SessionState | undefined = away ? undefined : session ? sessionState(session, stats) : gone ? "exited" : undefined;
  if (view.kind === "settings") return { kind: "view" as const, label: "Settings", icon: <SettingsIcon /> };
  if (view.kind === "project") return { kind: "view" as const, label: `${view.location} settings`, icon: <SettingsIcon /> };
  if (view.kind !== "workspace") {
    const item = nav.find((n) => n.active);
    return { kind: "view" as const, label: item?.label ?? "Burf", icon: item?.icon };
  }
  // A box's home terminal is on Home.
  if (!ws || !key || homeBox(key)) return { kind: "home" as const };
  const agent = session ? agentOf(session) : undefined;
  // A titled agent is named after its work; its worktree is in the tooltip.
  const at = ref ?? ws.ref;
  const place = at.main ? at.location : at.worktree;
  return { kind: "worktree" as const, key, name: session?.title?.trim() || (c?.kind === "terminal" ? c.title : undefined) || place, place, agent: agent ?? (c?.kind === "terminal" ? c.agent : undefined), state };
}

const ORDER = { waiting: 0, running: 1, finished: 2 } as const;
const HEADINGS = { waiting: sessionWord("waiting"), running: sessionWord("running"), finished: sessionWord("finished") } as const;

// ZenSwitcher is zen's way around: where you are, then the sidebar's places
// in the sidebar's order (one model: useArrangedNav, More and all), then the
// agents (who needs you first), worktrees, and the actions.
export function ZenSwitcher({ className }: { className?: string }) {
  const here = useHere();
  // With two worktrees on screen the place names the pane, not its agent.
  const placeTone = useTone(here.kind === "worktree" ? here.key : undefined);
  const { pinned, more } = useArrangedNav();
  const all = useAllSessions();
  const boxes = useStore((s) => s.boxes);
  const spaces = useWorkspaces((s) => s.spaces);
  const agents = useMemo(
    () =>
      all
        .filter((e) => agentOf(e.session) && (e.state === "waiting" || e.state === "running" || e.state === "finished"))
        .map((e) => {
          const wt = worktreeOf(boxes[e.box]?.locations, e.session);
          const place = wt ? worktreeLabel(wt.worktree, wt.location) : e.session.name;
          // Named after its work when it has a title, with its place after.
          const title = e.session.title?.trim();
          return { e, state: e.state as keyof typeof ORDER, title: title || place, place: title ? place : undefined };
        })
        .sort((a, b) => ORDER[a.state] - ORDER[b.state] || (b.e.session.state_since ?? "").localeCompare(a.e.session.state_since ?? ""))
        .slice(0, 8)
        // Two agents in one worktree are told apart as the panes do: "Claude Code 2".
        .map((a, _, list) =>
          list.filter((b) => b.title === a.title).length > 1 ? { ...a, title: `${a.title} · ${sessionName(a.e.session, { sessions: boxes[a.e.box]?.sessions })}` } : a,
        ),
    [all, boxes],
  );
  const waiting = agents.filter((a) => a.state === "waiting").length;
  const recent = recentWorktrees(spaces, 3);
  const removals = useRemovals((s) => s.byKey);
  const setView = useStore((s) => s.setView);

  return (
    <Menu>
      <MenuTrigger render={<span className={[sx(paint.s0), className].filter(Boolean).join(" ")}><Button size="sm" variant="ghost" aria-label="Go to" /></span>}>
        {here.kind === "home" ? (
          <>
            <HouseIcon />
            <span className={sx(paint.s1)}>Home</span>
          </>
        ) : here.kind === "view" ? (
          <>
            <span className={sx(paint.s2)}>{here.icon}</span>
            <span className={sx(paint.s3)}>{here.label}</span>
          </>
        ) : (
          <>
            {here.state ? <StateGlyph state={here.state} /> : <GitBranchIcon />}
            <Tip label={here.place !== here.name ? here.place : undefined} width="lg">
              <span className={sx(paint.s4)}>{here.name}</span>
            </Tip>
            {/* Two worktrees on screen: whose pane this is, in its colour. */}
            <ZenPlace wsKey={here.key} name={here.name} />
            {here.agent && !placeTone && (
              <span className={sx(paint.s5)}>
                <AgentIcon agent={here.agent} className={sx(paint.s6)} />
                {agentLabel(here.agent)}
              </span>
            )}
          </>
        )}
        {waiting > 0 && <Badge variant="warning">{waiting}</Badge>}
        <ChevronsUpDownIcon className={sx(paint.s7)} />
      </MenuTrigger>
      <MenuPopup align="start" width={menuWidths.fixed80}>
        {pinned.map((n) => (
          <MenuItem key={n.id} onClick={n.go} aria-current={n.active ? "page" : undefined} current={n.active}>
            <span className={sx(paint.s8)}>{n.icon}</span>
            <span className={sx(paint.s9)}>{n.label}</span>
            {n.badge && <span className={[sx(paint.s10), n.badge.loud ? sx(paint.s11) : sx(paint.s12)].filter(Boolean).join(" ")}>{n.badge.count}</span>}
          </MenuItem>
        ))}
        <MenuSub>
          <MenuSubTrigger>
            <EllipsisIcon />
            <span className={sx(paint.s13)}>More</span>
            {more.find((n) => n.active) && <span className={sx(paint.s14)}>{more.find((n) => n.active)!.label}</span>}
          </MenuSubTrigger>
          <MenuSubPopup width={menuWidths.w72}>
            <MoreItems more={more} />
          </MenuSubPopup>
        </MenuSub>
        {agents.length > 0 && <MenuSeparator />}
        {agents.map(({ e, state, title, place }, i) => (
          <MenuGroup key={`${e.box}/${e.session.name}`}>
            {(i === 0 || agents[i - 1].state !== state) && <MenuGroupLabel>{HEADINGS[state]}</MenuGroupLabel>}
            <MenuItem onClick={() => void focusSession(e.box, e.session.name)}>
              <StateGlyph state={e.state} />
              <span className={sx(paint.s15)}>
                {title}
                {place && <span className={sx(paint.s16)}>{place}</span>}
              </span>
              <span className={sx(paint.s17)}>
                <AgentIcon agent={agentOf(e.session)} className={sx(paint.s18)} />
                {ago(e.session.state_since ?? e.session.created)}
              </span>
            </MenuItem>
          </MenuGroup>
        ))}
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>Worktrees</MenuGroupLabel>
          {recent.map((w) => {
            const leaving = removalOf(removals, w.ref.box, w.ref.path);
            return (
              <MenuItem key={`${w.ref.box}:${w.ref.path}`} disabled={!!leaving} onClick={() => selectWorktree(w.ref)}>
                <GitBranchIcon />
                <span className={sx(paint.s19)}>{placeLabel(w.ref)}</span>
                <span className={sx(paint.s20)}>{leaving ? removalLabel(leaving) : w.ref.box}</span>
              </MenuItem>
            );
          })}
          <AllWorktrees />
          <MenuItem onClick={() => runShortcut("new-worktree", "menu")}>
            <GitBranchPlusIcon />
            New task…
            <MenuShortcut>{keysFor("new-worktree")}</MenuShortcut>
          </MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuItem onClick={() => useStore.getState().setPaletteOpen(true)}>
          <CommandIcon />
          Search everything
          <MenuShortcut>{keysFor("palette")}</MenuShortcut>
        </MenuItem>
        <MenuItem onClick={openShortcuts}>
          <KeyboardIcon />
          Keyboard shortcuts
          <MenuShortcut>{keysFor("shortcuts")}</MenuShortcut>
        </MenuItem>
        <MenuItem onClick={() => setView({ kind: "settings" })}>
          <SettingsIcon />
          Settings
        </MenuItem>
        <MenuItem onClick={() => usePrefs.setState({ zen: false })}>
          <Minimize2Icon />
          Leave zen
          <MenuShortcut>{keysFor("zen")}</MenuShortcut>
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}

// AllWorktrees is every project on every online box, each a submenu of its
// worktrees: the sidebar's tree, folded into the switcher.
function AllWorktrees() {
  const boxes = useStore((s) => s.boxes);
  const removals = useRemovals((s) => s.byKey);
  const status = useStore((s) => s.status);
  const online = useMemo(() => status?.boxes.filter((b) => b.state === "online").map((b) => b.name) ?? [], [status]);
  const projects = online.flatMap((box) => (boxes[box]?.locations ?? []).filter((l) => l.worktrees?.length).map((loc) => ({ box, loc })));
  if (!projects.length) return null;
  return (
    <MenuSub>
      <MenuSubTrigger>
        <FolderIcon />
        All worktrees
      </MenuSubTrigger>
      <MenuSubPopup width={menuWidths.w56}>
        {online.map((box) => {
          const here = projects.filter((p) => p.box === box);
          if (!here.length) return null;
          return (
            <MenuGroup key={box}>
              <MenuGroupLabel>{box}</MenuGroupLabel>
              {here.map(({ loc }) => (
                <MenuSub key={loc.name}>
                  <MenuSubTrigger>
                    <FolderIcon />
                    {loc.name}
                  </MenuSubTrigger>
                  <MenuSubPopup width={menuWidths.w72}>
                    {loc.worktrees!.map((wt) => {
                      const leaving = removalOf(removals, box, wt.path);
                      return (
                        <MenuItem key={wt.path} disabled={!!leaving} onClick={() => selectWorktree(refOf(box, loc, wt))}>
                          {wt.main ? <HouseIcon /> : <GitBranchIcon />}
                          <span className={sx(paint.s21)}>{wt.main ? "main" : worktreeLabel(wt)}</span>
                          {leaving && <span className={sx(paint.s22)}>{removalLabel(leaving)}</span>}
                        </MenuItem>
                      );
                    })}
                  </MenuSubPopup>
                </MenuSub>
              ))}
            </MenuGroup>
          );
        })}
      </MenuSubPopup>
    </MenuSub>
  );
}

// ZenPlace names the focused pane's worktree in its colour while more than
// one is on screen (a tab that mixes worktrees, or groups).
function ZenPlace({ wsKey, name }: { wsKey?: string; name: string }) {
  const tone = useTone(wsKey);
  const { label } = useLabel(wsKey);
  if (!tone || !label) return null;
  return (
    <span className={sx(paint.s23)} style={{ color: tone }}>
      <WtDot wsKey={wsKey} className={sx(paint.s24)} />
      {label !== name && label}
    </span>
  );
}

// WorktreeMenu is the open worktree's actions, as the sidebar's ⋯ on its
// row: open in an editor, new agent or terminal, stop its sessions, remove.
// useFocusedSession is the session in the focused pane, if it is one.
function useFocusedSession() {
  const ws = useWorkspaces((s) => (s.current ? s.spaces[s.current] : undefined));
  const tab = ws?.tabs.find((t) => t.id === ws.active);
  const c = tab ? leaves(tab.root).find((l) => l.id === tab.focus)?.content : undefined;
  const session = useStore((s) => (c?.kind === "terminal" ? s.boxes[c.box]?.sessions?.find((x) => x.name === c.session) : undefined));
  return c?.kind === "terminal" && session ? { box: c.box, session } : undefined;
}

// ZenRename names the focused agent's work in place of the switcher: zen
// has no tabs to double-click.
function ZenRename({ box, s }: { box: string; s: { name: string; title?: string } }) {
  return (
    <div className={sx(paint.s25)}>
      <TitleInput
        initial={s.title ?? ""}
        placeholder="Name this session"
        onDone={(next) => {
          useRenaming.setState({ key: undefined });
          if (next !== undefined && next !== (s.title ?? "")) void renameSession(box, s.name, next);
        }}
      />
    </div>
  );
}

function WorktreeMenu() {
  const focused = useFocusedSession();
  // The focused pane's worktree.
  const ref = useHereRef();
  const workspace = useStore((s) => s.view.kind === "workspace");
  const loc = useStore((s) => (ref ? s.boxes[ref.box]?.locations?.find((l) => l.name === ref.location) : undefined));
  const wt = loc?.worktrees?.find((w) => w.path === ref?.path);
  const leaving = useRemoval(ref?.box ?? "", ref?.path);
  if (!workspace || !ref || !loc || !wt) return null;
  // On its way out: nothing to do with it but wait.
  if (leaving)
    return (
      <span aria-busy="true" className={sx(paint.s26)}>
        <Spinner  size="sm"/>
        {removalLabel(leaving)}
      </span>
    );
  return (
    <Menu>
      <Tip label="Worktree actions">
        <MenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`${worktreeLabel(wt, loc)} actions`} />}>
          <EllipsisIcon />
        </MenuTrigger>
      </Tip>
      <MenuPopup align="start" width={menuWidths.w56}>
        {focused && (
          <>
            <MenuItem onClick={() => startRenaming(focused.box, focused.session.name)}>
              <PencilIcon />
              Rename session…
            </MenuItem>
            <MenuSeparator />
          </>
        )}
        <ActionItems items={worktreeActions(ref.box, loc, wt).filter((a) => !(a.type === "item" && a.label === "Open"))} />
      </MenuPopup>
    </Menu>
  );
}

// ZenBar stands in for the sidebar and the tab strip on every view: the
// switcher at its left, clear of the window's buttons, then search,
// notifications and the way out. It drags the window. At home it lies
// clear over the harbour, so the picture runs to the top of the window.
export function ZenBar() {
  const noWorktree = useWorkspaces((s) => !s.current);
  const workspace = useStore((s) => s.view.kind === "workspace");
  const home = noWorktree && workspace;
  const focused = useFocusedSession();
  const renaming = useRenaming((s) => !!focused && s.key === `${focused.box}/${focused.session.name}`);
  return (
    <div
      data-burf-drag-region
      className={[sx(paint.s27), hasTrafficLights() ? sx(paint.s28) : sx(paint.s29), home ? [sx(paint.s30), sx(paint.s37)].filter(Boolean).join(" ") : sx(paint.s31)].filter(Boolean).join(" ")}
    >
      {renaming && focused ? (
        <ZenRename box={focused.box} s={focused.session} />
      ) : (
        <div className={sx(paint.s32)} onDoubleClick={() => focused && startRenaming(focused.box, focused.session.name)}>
          <ZenSwitcher />
        </div>
      )}
      <WorktreeMenu />
      <div data-burf-drag-region className={sx(paint.s33)} />
      <Button size="sm" variant="ghost"  onClick={() => useStore.getState().setPaletteOpen(true)} muted>
        Search
        <Kbd>⌘K</Kbd>
      </Button>
      <NotificationBell />
      <Tip
        label={
          <span className={sx(paint.s34)}>
            Leave zen <Kbd>⌘.</Kbd>
          </span>
        }
      >
        <Button size="icon-sm" variant="ghost" aria-label="Leave zen" onClick={() => usePrefs.setState({ zen: false })}>
          <Minimize2Icon />
        </Button>
      </Tip>
    </div>
  );
}

// FakeTrafficLights draws the window's three buttons in the mock with
// ?traffic=1, so screenshots show what has to leave them room.
export function FakeTrafficLights() {
  return (
    <div aria-hidden className={sx(paint.s35)}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <span key={c} className={sx(paint.s36)} style={{ background: c }} />
      ))}
    </div>
  );
}
