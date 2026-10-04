import { create } from "zustand";

import type { Location, Session, Worktree } from "@/lib/api";
import { type Leaf, leaf, leaves, mapLeaf, neighbor, newId, type PaneContent, type PaneNode, remove, setRatio, split } from "@/lib/layout";
import { load, save } from "@/lib/storage";
import { useStore } from "@/lib/store";

// A workspace is one worktree's tabs, as in Orca: selecting a worktree in the
// sidebar swaps the tab strip to its tabs. Each tab is a tree of split panes.
// Workspaces persist on this computer, layout and all.

export interface WorktreeRef {
  box: string;
  location: string;
  worktree: string;
  path: string;
  main?: boolean;
}

export interface WsTab {
  id: string;
  root: PaneNode;
  focus: string;
}

export interface Workspace {
  ref: WorktreeRef;
  tabs: WsTab[];
  active?: string;
  // Agent sessions the person closed. They keep running on the box (the
  // dashboard still shows them) but do not come back as tabs on their own.
  hidden: string[];
  // When it was last opened, for "recent" lists.
  visitedAt?: number;
}

interface State {
  current?: string;
  spaces: Record<string, Workspace>;
  // Workspaces opened since launch: their panes stay mounted, so switching
  // back is instant and nothing reconnects.
  mounted: string[];
  recentUrls: string[];
}

export const wsKey = (box: string, path: string) => `${box}:${path}`;

export const refOf = (box: string, loc: Location, wt: Worktree): WorktreeRef => ({ box, location: loc.name, worktree: wt.name, path: wt.path, main: wt.main });

// Panes that were starting when the app closed did not finish; drop them.
function sanitize(spaces: Record<string, Workspace>): Record<string, Workspace> {
  const out: Record<string, Workspace> = {};
  for (const [k, ws] of Object.entries(spaces)) {
    const tabs: WsTab[] = [];
    for (const t of ws.tabs) {
      let root: PaneNode | undefined = t.root;
      for (const l of leaves(t.root)) if (l.content.kind === "starting" || l.content.kind === "error") root = root && remove(root, l.id);
      if (root) tabs.push({ ...t, root, focus: leaves(root).some((l) => l.id === t.focus) ? t.focus : leaves(root)[0].id });
    }
    out[k] = { ...ws, tabs, active: tabs.some((t) => t.id === ws.active) ? ws.active : tabs[0]?.id, hidden: ws.hidden ?? [] };
  }
  return out;
}

const saved = load<Partial<State>>("berth.workspaces", {});

export const useWorkspaces = create<State>()(() => ({
  current: saved.current,
  spaces: sanitize(saved.spaces ?? {}),
  mounted: saved.current ? [saved.current] : [],
  recentUrls: saved.recentUrls ?? [],
}));

useWorkspaces.subscribe((s) => save("berth.workspaces", { current: s.current, spaces: s.spaces, recentUrls: s.recentUrls }));

function update(key: string, fn: (ws: Workspace) => Workspace) {
  useWorkspaces.setState((s) => (s.spaces[key] ? { spaces: { ...s.spaces, [key]: fn(s.spaces[key]) } } : s));
}

function updateTab(key: string, tabId: string, fn: (t: WsTab) => WsTab | undefined) {
  update(key, (ws) => {
    const tabs: WsTab[] = [];
    for (const t of ws.tabs) {
      if (t.id !== tabId) tabs.push(t);
      else {
        const next = fn(t);
        if (next) tabs.push(next);
      }
    }
    const i = ws.tabs.findIndex((t) => t.id === tabId);
    const active = tabs.some((t) => t.id === ws.active) ? ws.active : tabs[Math.min(i, tabs.length - 1)]?.id;
    return { ...ws, tabs, active };
  });
}

export function currentSpace(): Workspace | undefined {
  const s = useWorkspaces.getState();
  return s.current ? s.spaces[s.current] : undefined;
}

// selectWorktree makes a worktree's workspace the one shown.
export function selectWorktree(ref: WorktreeRef) {
  const key = wsKey(ref.box, ref.path);
  useWorkspaces.setState((s) => ({
    current: key,
    spaces: { ...s.spaces, [key]: s.spaces[key] ? { ...s.spaces[key], ref, visitedAt: Date.now() } : { ref, tabs: [], hidden: [], visitedAt: Date.now() } },
    mounted: s.mounted.includes(key) ? s.mounted : [...s.mounted, key],
  }));
  useStore.getState().setView({ kind: "workspace" });
  reconcile(key);
}

// goHome leaves every worktree for the workspace's home (no worktree open).
export function goHome() {
  useWorkspaces.setState({ current: undefined });
  useStore.getState().setView({ kind: "workspace" });
}

// reconcile gives every session running in the worktree a tab, unless it is
// already in a pane or was closed by the person. Sessions made anywhere (the
// CLI, an agent, another laptop) show up this way.
export function reconcile(key: string) {
  const ws = useWorkspaces.getState().spaces[key];
  if (!ws) return;
  const sessions = useStore.getState().boxes[ws.ref.box]?.sessions;
  if (!sessions) return;
  const here = sessions.filter((s) => s.dir === ws.ref.path);
  const shown = new Set(ws.tabs.flatMap((t) => leaves(t.root)).flatMap((l) => (l.content.kind === "terminal" ? [l.content.session] : [])));
  const missing = here.filter((s) => !shown.has(s.name) && !ws.hidden.includes(s.name));
  const names = new Set(sessions.map((s) => s.name));
  const hidden = ws.hidden.filter((h) => names.has(h));
  if (!missing.length && hidden.length === ws.hidden.length) return;
  update(key, (w) => {
    const added = missing.map(newSessionTab(w.ref.box));
    return { ...w, hidden, tabs: [...w.tabs, ...added], active: w.active ?? added[0]?.id };
  });
}

const newSessionTab = (box: string) => (s: Session): WsTab => {
  const l = leaf({ kind: "terminal", box, session: s.name });
  return { id: newId(), root: l, focus: l.id };
};

// openTab adds a tab showing content to the current workspace.
export function openTab(content: PaneContent, key = useWorkspaces.getState().current): { tab: string; pane: string } | undefined {
  if (!key) return undefined;
  const l = leaf(content);
  const tab = { id: newId(), root: l, focus: l.id };
  update(key, (ws) => ({ ...ws, tabs: [...ws.tabs, tab], active: tab.id }));
  useStore.getState().setView({ kind: "workspace" });
  return { tab: tab.id, pane: l.id };
}

export function splitPane(key: string, tabId: string, paneId: string, dir: "row" | "col", content: PaneContent): string {
  const l = leaf(content);
  updateTab(key, tabId, (t) => ({ ...t, root: split(t.root, paneId, dir, l), focus: l.id }));
  return l.id;
}

export function setPaneContent(key: string, tabId: string, paneId: string, content: PaneContent) {
  updateTab(key, tabId, (t) => ({ ...t, root: mapLeaf(t.root, paneId, (l) => ({ ...l, content })) }));
}

// removePane takes a pane out of its tab, and the tab out when it was the
// last one. hide marks a session that keeps running on the box.
export function removePane(key: string, tabId: string, paneId: string, hide?: string) {
  updateTab(key, tabId, (t) => {
    const root = remove(t.root, paneId);
    if (!root) return undefined;
    return { ...t, root, focus: t.focus === paneId ? leaves(root)[0].id : t.focus };
  });
  if (hide) update(key, (ws) => ({ ...ws, hidden: [...new Set([...ws.hidden, hide])] }));
}

export function resizeSplit(key: string, tabId: string, splitId: string, ratio: number) {
  updateTab(key, tabId, (t) => ({ ...t, root: setRatio(t.root, splitId, ratio) }));
}

export function focusPane(key: string, tabId: string, paneId: string) {
  update(key, (ws) => ({ ...ws, active: tabId, tabs: ws.tabs.map((t) => (t.id === tabId ? { ...t, focus: paneId } : t)) }));
}

export function moveFocus(dir: "left" | "right" | "up" | "down") {
  const s = useWorkspaces.getState();
  const ws = currentSpace();
  const tab = ws?.tabs.find((t) => t.id === ws.active);
  if (!s.current || !tab) return;
  const next = neighbor(tab.root, tab.focus, dir);
  if (next) focusPane(s.current, tab.id, next);
}

export function activateTab(key: string, tabId: string) {
  update(key, (ws) => ({ ...ws, active: tabId }));
  useStore.getState().setView({ kind: "workspace" });
}

export function moveTab(key: string, from: number, to: number) {
  update(key, (ws) => {
    const tabs = [...ws.tabs];
    const [t] = tabs.splice(from, 1);
    tabs.splice(to, 0, t);
    return { ...ws, tabs };
  });
}

// findSession locates the pane showing a session, in any workspace.
export function findSession(box: string, session: string): { key: string; tab: string; pane: Leaf } | undefined {
  for (const [key, ws] of Object.entries(useWorkspaces.getState().spaces)) {
    if (ws.ref.box !== box) continue;
    for (const t of ws.tabs) {
      const l = leaves(t.root).find((x) => x.content.kind === "terminal" && x.content.session === session);
      if (l) return { key, tab: t.id, pane: l };
    }
  }
  return undefined;
}

// openSession shows a session: its worktree's workspace, then its pane,
// adding a tab for it when it has none.
export function openSession(box: string, session: Session) {
  const locations = useStore.getState().boxes[box]?.locations ?? [];
  const loc = locations.find((l) => l.worktrees?.some((w) => w.path === session.dir));
  const wt = loc?.worktrees?.find((w) => w.path === session.dir);
  if (!loc || !wt) return;
  const ref = refOf(box, loc, wt);
  const key = wsKey(box, wt.path);
  update(key, (ws) => ({ ...ws, hidden: ws.hidden.filter((h) => h !== session.name) }));
  selectWorktree(ref);
  const found = findSession(box, session.name);
  if (found && found.key === key) focusPane(key, found.tab, found.pane.id);
  else openTab({ kind: "terminal", box, session: session.name }, key);
}

export function rememberUrl(url: string) {
  useWorkspaces.setState((s) => ({ recentUrls: [url, ...s.recentUrls.filter((u) => u !== url)].slice(0, 20) }));
}

// New sessions on a box get tabs in every open workspace they belong to.
useStore.subscribe((s, prev) => {
  if (s.boxes === prev.boxes) return;
  for (const key of useWorkspaces.getState().mounted) reconcile(key);
});

// The pane API other parts of the app (dashboard, orchestration, plugins)
// use. They never touch the tree directly.

// focusSession shows a session: its worktree's workspace, then its pane,
// adding a tab for it when it has none. openTerminal is the same.
export async function focusSession(box: string, session: string) {
  let s = useStore.getState().boxes[box]?.sessions?.find((x) => x.name === session);
  if (!s) {
    await useStore.getState().refreshBox(box, ["locations", "sessions"]);
    s = useStore.getState().boxes[box]?.sessions?.find((x) => x.name === session);
  }
  if (s) openSession(box, s);
}

export const openTerminal = focusSession;

// openBrowser opens a page in the current worktree's workspace: a new tab,
// or with split, beside the focused pane.
export function openBrowser(url: string, opts: { split?: "row" | "col" } = {}) {
  const key = useWorkspaces.getState().current;
  const ws = currentSpace();
  if (!key || !ws) return;
  const tab = ws.tabs.find((t) => t.id === ws.active);
  if (opts.split && tab) splitPane(key, tab.id, tab.focus, opts.split, { kind: "browser", url });
  else openTab({ kind: "browser", url }, key);
  useStore.getState().setView({ kind: "workspace" });
}

// openPanel opens a plugin's worktree panel in the current worktree: the tab
// that already shows it if there is one, else a new tab, or with split,
// beside the focused pane.
export function openPanel(plugin: string, panel: string, title: string, opts: { split?: "row" | "col" } = {}) {
  const key = useWorkspaces.getState().current;
  const ws = currentSpace();
  if (!key || !ws) return;
  for (const t of ws.tabs) {
    const hit = leaves(t.root).find((l) => l.content.kind === "panel" && l.content.plugin === plugin && l.content.panel === panel);
    if (hit) {
      activateTab(key, t.id);
      focusPane(key, t.id, hit.id);
      useStore.getState().setView({ kind: "workspace" });
      return;
    }
  }
  const content = { kind: "panel" as const, plugin, panel, title };
  const tab = ws.tabs.find((t) => t.id === ws.active);
  if (opts.split && tab) splitPane(key, tab.id, tab.focus, opts.split, content);
  else openTab(content, key);
  useStore.getState().setView({ kind: "workspace" });
}

// recentWorktrees lists workspaces by when they were last opened.
export function recentWorktrees(spaces: Record<string, Workspace>, n = 3): Workspace[] {
  return Object.values(spaces)
    .filter((w) => w.visitedAt)
    .sort((a, b) => (b.visitedAt ?? 0) - (a.visitedAt ?? 0))
    .slice(0, n);
}
