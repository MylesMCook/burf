import { ChevronsUpDownIcon, CommandIcon, GitBranchIcon, HouseIcon, Minimize2Icon } from "lucide-react";
import { useMemo } from "react";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { Tip } from "@/components/tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ViewSwitch } from "@/components/workspace/pane";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuSeparator, MenuShortcut, MenuTrigger } from "@/components/ui/menu";
import { useAllSessions } from "@/hooks/use-agent-counts";
import { isTauri } from "@/lib/api";
import { agentLabel, agentOf, sessionState, worktreeOf } from "@/lib/derive";
import { ago } from "@/lib/format";
import { leaves } from "@/lib/layout";
import { usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { focusSession, goHome, recentWorktrees, selectWorktree, useWorkspaces } from "@/lib/workspaces";

// Zen (Labs, ⌘⇧\) puts away everything but the agents: no sidebar, no status
// bar, one slim bar with a switcher where the tab strip was, and agents as
// conversations. ⌘⇧\ brings it all back.

// useHere is what the window shows: the worktree, and the agent in its
// focused pane.
function useHere() {
  const ws = useWorkspaces((s) => (s.current ? s.spaces[s.current] : undefined));
  const tab = ws?.tabs.find((t) => t.id === ws.active);
  const c = tab ? leaves(tab.root).find((l) => l.id === tab.focus)?.content : undefined;
  const session = useStore((s) => (c?.kind === "terminal" ? s.boxes[c.box]?.sessions?.find((x) => x.name === c.session) : undefined));
  const stats = useStore((s) => (c?.kind === "terminal" ? s.boxes[c.box]?.stats : undefined));
  const name = ws ? (ws.ref.main ? ws.ref.location : ws.ref.worktree) : undefined;
  const agent = session ? agentOf(session) : undefined;
  return { name, agent, state: session ? sessionState(session, stats) : undefined };
}

const ORDER = { waiting: 0, running: 1, finished: 2 } as const;

// ZenSwitcher is zen's way around: what is showing, and a list of the
// agents (who needs you first) and recent worktrees, and home.
export function ZenSwitcher({ className }: { className?: string }) {
  const here = useHere();
  const all = useAllSessions();
  const boxes = useStore((s) => s.boxes);
  const spaces = useWorkspaces((s) => s.spaces);
  const agents = useMemo(
    () =>
      all
        .filter((e) => agentOf(e.session) && (e.state === "waiting" || e.state === "running" || e.state === "finished"))
        .map((e) => {
          const wt = worktreeOf(boxes[e.box]?.locations, e.session);
          return { e, title: wt ? (wt.worktree.main ? wt.location.name : wt.worktree.name) : e.session.name };
        })
        .sort((a, b) => ORDER[a.e.state as keyof typeof ORDER] - ORDER[b.e.state as keyof typeof ORDER] || (b.e.session.state_since ?? "").localeCompare(a.e.session.state_since ?? ""))
        .slice(0, 9),
    [all, boxes],
  );
  const waiting = agents.filter((a) => a.e.state === "waiting").length;
  const recent = recentWorktrees(spaces, 4);

  return (
    <Menu>
      <MenuTrigger render={<Button size="sm" variant="ghost" aria-label="Switch agent or worktree" className={cn("max-w-80 gap-2", className)} />}>
        {here.name ? (
          <>
            {here.state ? <StateGlyph state={here.state} /> : <GitBranchIcon />}
            <span className="truncate font-medium">{here.name}</span>
            {here.agent && (
              <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                <AgentIcon agent={here.agent} className="size-3" />
                {agentLabel(here.agent)}
              </span>
            )}
          </>
        ) : (
          <>
            <HouseIcon />
            <span className="font-medium">Home</span>
          </>
        )}
        {waiting > 0 && <Badge variant="warning">{waiting}</Badge>}
        <ChevronsUpDownIcon className="opacity-60" />
      </MenuTrigger>
      <MenuPopup align="start" className="w-80">
        <MenuItem onClick={goHome}>
          <HouseIcon />
          Home
        </MenuItem>
        <MenuSeparator />
        <MenuGroup>
          {agents.map(({ e, title }, i) => (
            <div key={`${e.box}/${e.session.name}`} className="contents">
            {(i === 0 || agents[i - 1].e.state !== e.state) && <MenuGroupLabel>{e.state === "waiting" ? "Needs you" : e.state === "running" ? "Working" : "Done"}</MenuGroupLabel>}
            <MenuItem onClick={() => void focusSession(e.box, e.session.name)}>
              <StateGlyph state={e.state} />
              <span className="min-w-0 flex-1 truncate">{title}</span>
              <span className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
                <AgentIcon agent={agentOf(e.session)} className="size-3" />
                {ago(e.session.state_since ?? e.session.created)}
              </span>
            </MenuItem>
            </div>
          ))}
        </MenuGroup>
        {recent.length > 0 && (
          <>
            <MenuSeparator />
            <MenuGroup>
              <MenuGroupLabel>Worktrees</MenuGroupLabel>
              {recent.map((w) => (
                <MenuItem key={`${w.ref.box}:${w.ref.path}`} onClick={() => selectWorktree(w.ref)}>
                  <GitBranchIcon />
                  <span className="min-w-0 flex-1 truncate">{w.ref.main ? w.ref.location : `${w.ref.location} / ${w.ref.worktree}`}</span>
                  <span className="text-muted-foreground text-xs">{w.ref.box}</span>
                </MenuItem>
              ))}
            </MenuGroup>
          </>
        )}
        <MenuSeparator />
        <MenuItem onClick={() => useStore.getState().setPaletteOpen(true)}>
          <CommandIcon />
          Search everything
          <MenuShortcut>⌘K</MenuShortcut>
        </MenuItem>
        <MenuItem onClick={() => usePrefs.setState({ zen: false })}>
          <Minimize2Icon />
          Leave zen
          <MenuShortcut>⌘⇧\</MenuShortcut>
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}

// FocusedViewSwitch is the Terminal | Conversation switch of the focused
// pane, for zen, where panes have no header.
function FocusedViewSwitch() {
  const key = useWorkspaces((s) => s.current);
  const ws = useWorkspaces((s) => (s.current ? s.spaces[s.current] : undefined));
  const tab = ws?.tabs.find((t) => t.id === ws.active);
  const pane = tab ? leaves(tab.root).find((l) => l.id === tab.focus) : undefined;
  if (!key || !tab || !pane) return null;
  return <ViewSwitch wsKey={key} tab={tab.id} pane={pane} />;
}

// ZenBar stands in for the tab strip: the switcher at its left (clear of
// the window's buttons), ⌘K and the way out at its right. It drags the
// window.
export function ZenBar({ variant }: { variant: "bar" | "float" }) {
  const home = useWorkspaces((s) => !s.current);
  const out = (
    <Tip label={<span className="flex items-center gap-1.5">Leave zen <Kbd>⌘⇧\</Kbd></span>}>
      <Button size="icon-sm" variant="ghost" aria-label="Leave zen" onClick={() => usePrefs.setState({ zen: false })}>
        <Minimize2Icon />
      </Button>
    </Tip>
  );
  const search = (
    <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => useStore.getState().setPaletteOpen(true)}>
      Search
      <Kbd>⌘K</Kbd>
    </Button>
  );
  if (variant === "float") {
    return (
      <div data-tauri-drag-region className={cn("pointer-events-none absolute inset-x-0 top-0 z-30 flex h-12 items-center gap-2 pr-3", isTauri() ? "pl-[84px]" : "pl-3")}>
        <div className="pointer-events-auto rounded-xl border bg-popover/90 p-0.5 shadow-lg/5 backdrop-blur-md">
          <ZenSwitcher />
        </div>
        <div className="pointer-events-auto ml-auto flex items-center gap-0.5 rounded-xl border bg-popover/90 p-0.5 shadow-lg/5 backdrop-blur-md">
          <FocusedViewSwitch />
          {search}
          {out}
        </div>
      </div>
    );
  }
  // At home the bar lies over the harbour, clear, so the picture runs to
  // the top of the window.
  return (
    <div data-tauri-drag-region className={cn("flex h-10 shrink-0 items-center gap-2 pr-2", isTauri() ? "pl-[84px]" : "pl-2", home ? "absolute inset-x-0 top-0 z-30 [&_button]:bg-background/70 [&_button]:backdrop-blur-sm" : "border-b bg-background")}>
      <ZenSwitcher />
      <div data-tauri-drag-region className="flex-1 self-stretch" />
      <FocusedViewSwitch />
      {search}
      {out}
    </div>
  );
}
