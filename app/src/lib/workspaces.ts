import { useMemo } from "react";
import { create } from "zustand";

import type { Location, Session, Worktree } from "@/lib/api";
import { findLeaf, type Leaf, leaf, leaves, mapLeaf, moveBetween, movePane, neighbor, newId, type PaneContent, type PaneNode, paneWorktree, place, remove, sessionsShown, setRatio, type Side, split, swap, worktreesOf } from "@/lib/layout";
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
  // Sessions the person closed. An agent may keep running on the box (the
  // dashboard and the launcher still show it), but none comes back as a tab
  // on its own.
  hidden: string[];
  // Sessions in this worktree the workspace has already seen, tab or not.
  // Only sessions it hasn't seen yet open as tabs by themselves; one seen
  // before without a tab is picked up again from the launcher. Unset until
  // the first look, which takes every session in.
  known?: string[];
  // When it was last opened, for "recent" lists.
  visitedAt?: number;
}

interface State {
  current?: string;
  // A worktree's colour, when the person picked one (lib/groups.ts tones).
  tones?: Record<string, string>;
  spaces: Record<string, Workspace>;
  // Workspaces opened since launch: their panes stay mounted, so switching
  // back is instant and nothing reconnects.
  mounted: string[];
  recentUrls: string[];
}

export const wsKey = (box: string, path: string) => `${box}:${path}`;

export const refOf = (box: string, loc: Location, wt: Worktree): WorktreeRef => ({ box, location: loc.name, worktree: wt.name, path: wt.path, main: wt.main });

// splitKey is a workspace key's box and path.
export function splitKey(key: string): { box: string; path: string } {
  const i = key.indexOf(":");
  return { box: key.slice(0, i), path: key.slice(i + 1) };
}

// lookupRef finds a worktree by its key in what its box lists.
function lookupRef(box: string, path: string, locations?: Location[]): WorktreeRef | undefined {
  for (const loc of locations ?? []) {
    const wt = loc.worktrees?.find((w) => w.path === path);
    if (wt) return refOf(box, loc, wt);
  }
  return undefined;
}

// refFor is a worktree's ref by its key: its workspace's, else its box's
// listing (a pane can belong to a worktree that has no workspace yet).
export function refFor(key: string | undefined): WorktreeRef | undefined {
  if (!key) return undefined;
  const own = useWorkspaces.getState().spaces[key]?.ref;
  if (own) return own;
  const { box, path } = splitKey(key);
  return lookupRef(box, path, useStore.getState().boxes[box]?.locations);
}

// useWorktreeRef is refFor, kept current.
export function useWorktreeRef(key: string | undefined): WorktreeRef | undefined {
  const own = useWorkspaces((s) => (key ? s.spaces[key]?.ref : undefined));
  const { box, path } = key ? splitKey(key) : { box: "", path: "" };
  const locations = useStore((s) => (own || !key ? undefined : s.boxes[box]?.locations));
  return useMemo(() => own ?? (key ? lookupRef(box, path, locations) : undefined), [own, key, box, path, locations]);
}

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

// focusedOf is the focused pane of the tab showing, and its tab.
function focusedOf(s: Pick<State, "current" | "spaces">): { key: string; tab: WsTab; leaf: Leaf } | undefined {
  const ws = s.current ? s.spaces[s.current] : undefined;
  const tab = ws?.tabs.find((t) => t.id === ws.active);
  const l = tab && findLeaf(tab.root, tab.focus);
  return s.current && tab && l ? { key: s.current, tab, leaf: l } : undefined;
}

export const focusedPane = () => focusedOf(useWorkspaces.getState());

// hereOf is the worktree you are acting in: the focused pane's
// (paneWorktree), which in a tab that mixes worktrees need not be the
// tab's. The breadcrumb, Run, the + menu, ⌘T and ⌘⇧B, the palette and
// plugins act in it. Without a tab it is the worktree showing.
export function hereOf(s: Pick<State, "current" | "spaces">): string | undefined {
  const f = focusedOf(s);
  return f ? paneWorktree(f.key, f.leaf) : s.current;
}

// onScreenOf lists the worktrees on screen, in the strip's order: the one
// showing, then any other whose pane is in the tab showing.
export function onScreenOf(s: Pick<State, "current" | "spaces">): string[] {
  const ws = s.current ? s.spaces[s.current] : undefined;
  const tab = ws?.tabs.find((t) => t.id === ws.active);
  const own = s.current ? [s.current] : [];
  return [...new Set([...own, ...(tab && s.current ? worktreesOf(tab.root, s.current) : [])])];
}

export const here = () => hereOf(useWorkspaces.getState());
export const hereRef = () => refFor(here());
export const useHereKey = () => useWorkspaces(hereOf);
export const useHereRef = () => useWorktreeRef(useHereKey());

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

// showWorktree brings a worktree's tabs to the front: what acting in a
// worktree that is not the one showing does (⌘T in a guest pane opens the
// terminal in a tab of the guest's worktree). False when nothing knows the
// worktree.
export function showWorktree(key: string): boolean {
  const s = useWorkspaces.getState();
  if (s.current === key) return true;
  const ref = refFor(key);
  if (!ref) return false;
  useWorkspaces.setState((st) => ({
    current: key,
    spaces: { ...st.spaces, [key]: st.spaces[key] ?? { ref, tabs: [], hidden: [], visitedAt: Date.now() } },
    mounted: st.mounted.includes(key) ? st.mounted : [...st.mounted, key],
  }));
  reconcile(key);
  return true;
}

// forgetWorktree drops a removed worktree's workspace, and leaves it for
// home if it was the one showing.
export function forgetWorktree(box: string, path: string) {
  const key = wsKey(box, path);
  useWorkspaces.setState((s) => {
    const { [key]: _gone, ...spaces } = s.spaces;
    return { spaces, mounted: s.mounted.filter((k) => k !== key), current: s.current === key ? undefined : s.current };
  });
}

// goHome leaves every worktree for the workspace's home (no worktree open).
export function goHome() {
  useWorkspaces.setState({ current: undefined });
  useStore.getState().setView({ kind: "workspace" });
}

// How many closed and seen session names a workspace keeps. Names are not
// dropped when a session leaves the box's list: a list fetched before it
// stopped can still arrive after, and must not bring it back.
const REMEMBER = 200;
const cap = (names: string[]) => (names.length > REMEMBER ? names.slice(-REMEMBER) : names);

// reconcile gives a tab to every session new in the worktree (made by the
// CLI, an agent, a task, another laptop), unless it is already in a pane or
// was closed by the person. A pane anywhere counts: one of this worktree's
// sessions may show in another worktree's tab, beside its panes. A session
// it has seen before is never adopted again: a new tab is always a new
// session, and one left without a tab is picked up from the launcher. While
// a pane is starting a session, it waits: that pane will show the new
// session itself.
export function reconcile(key: string) {
  const { spaces } = useWorkspaces.getState();
  const ws = spaces[key];
  if (!ws) return;
  const sessions = useStore.getState().boxes[ws.ref.box]?.sessions;
  if (!sessions) return;
  const all = Object.entries(spaces).flatMap(([k, w]) => w.tabs.map((t) => ({ k, root: t.root })));
  // A pane starting one of this worktree's sessions, here or as a guest.
  if (all.some(({ k, root }) => leaves(root).some((l) => l.content.kind === "starting" && paneWorktree(k, l) === key))) return;
  const roots = all.map((x) => x.root);
  const here = sessions.filter((s) => s.dir === ws.ref.path);
  const known = new Set(ws.known ?? []);
  const fresh = here.filter((s) => !known.has(s.name));
  // A service's terminal has its tab whenever its worktree is open, unless
  // the person closed it.
  const services = here.filter((s) => s.service && known.has(s.name));
  if (!fresh.length && !services.length && ws.known) return;
  const shown = sessionsShown(roots, ws.ref.box);
  const missing = [...fresh, ...services].filter((s) => !shown.has(s.name) && !ws.hidden.includes(s.name));
  if (!fresh.length && !missing.length && ws.known) return;
  update(key, (w) => {
    const added = missing.map(newSessionTab(w.ref.box));
    return { ...w, known: cap([...(w.known ?? []), ...fresh.map((s) => s.name)]), tabs: [...w.tabs, ...added], active: w.active ?? added[0]?.id };
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

// splitPane puts content beside a pane. wt is the worktree it belongs to,
// when that is not the tab's (a guest pane).
export function splitPane(key: string, tabId: string, paneId: string, dir: "row" | "col", content: PaneContent, wt?: string): string {
  const l = leaf(content, wt && wt !== key ? wt : undefined);
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
  if (hide) update(key, (ws) => ({ ...ws, hidden: cap([...ws.hidden.filter((h) => h !== hide), hide]) }));
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

// Moving tabs and panes (dragging them, or the tabs' and panes' menus) only
// rearranges the trees: every pane keeps its id, so PaneLayer never remounts
// it and its terminal, agent or page carries on as it was.

// tabIntoPane moves every pane of tab from into tab to, on one side of pane,
// and closes the tab it left.
export function tabIntoPane(key: string, from: string, to: string, pane: string, side: Side) {
  if (from === to) return;
  update(key, (ws) => {
    const src = ws.tabs.find((t) => t.id === from);
    const dst = ws.tabs.find((t) => t.id === to);
    if (!src || !dst || !findLeaf(dst.root, pane)) return ws;
    const root = place(dst.root, pane, side, src.root);
    const tabs = ws.tabs.filter((t) => t.id !== from).map((t) => (t.id === to ? { ...t, root, focus: src.focus } : t));
    return { ...ws, tabs, active: to };
  });
}

// moveInto moves a tab, or one pane of it, beside a pane of a tab in any
// workspace (moveBetween): into another worktree's tab, its panes become
// guests there. The receiving tab comes to the front.
export function moveInto(src: { key: string; tab: string; pane?: string }, dst: { key: string; tab: string; pane: string; side: Side }) {
  useWorkspaces.setState((s) => {
    const spaces = moveBetween(s.spaces, src, dst);
    return spaces ? { spaces, current: dst.key, mounted: s.mounted.includes(dst.key) ? s.mounted : [...s.mounted, dst.key] } : s;
  });
  useStore.getState().setView({ kind: "workspace" });
}

// tabBeside is the tab menu's Split right and Split down: the tab joins the
// one showing (or, for the one showing, its neighbour), beside its focused
// pane.
export function tabBeside(key: string, from: string, dir: "row" | "col") {
  const ws = useWorkspaces.getState().spaces[key];
  if (!ws) return;
  const i = ws.tabs.findIndex((t) => t.id === from);
  const to = ws.active !== from ? ws.tabs.find((t) => t.id === ws.active) : (ws.tabs[i - 1] ?? ws.tabs[i + 1]);
  if (i < 0 || !to) return;
  tabIntoPane(key, from, to.id, to.focus, dir === "row" ? "right" : "bottom");
}

// paneBeside moves a pane next to another in its tab, or with "center"
// swaps the two.
export function paneBeside(key: string, tab: string, pane: string, target: string, side: Side | "center") {
  updateTab(key, tab, (t) => ({ ...t, root: side === "center" ? swap(t.root, pane, target) : movePane(t.root, pane, target, side), focus: pane }));
}

// paneToTab takes a pane out of a split into a tab of its own, at index in
// the strip (just after its tab when unset). The split it leaves collapses.
export function paneToTab(key: string, tab: string, pane: string, index?: number) {
  update(key, (ws) => {
    const i = ws.tabs.findIndex((t) => t.id === tab);
    const t = ws.tabs[i];
    const l = t && findLeaf(t.root, pane);
    const rest = t && remove(t.root, pane);
    if (!l || !rest) return ws;
    const fresh: WsTab = { id: newId(), root: l, focus: l.id };
    const tabs = ws.tabs.map((x) => (x.id === tab ? { ...x, root: rest, focus: x.focus === pane ? leaves(rest)[0].id : x.focus } : x));
    tabs.splice(index ?? i + 1, 0, fresh);
    return { ...ws, tabs, active: fresh.id };
  });
}

// unsplitTab gives each pane of a split tab a tab of its own, in place.
export function unsplitTab(key: string, tab: string) {
  update(key, (ws) => {
    const i = ws.tabs.findIndex((t) => t.id === tab);
    const t = ws.tabs[i];
    if (!t || t.root.kind === "leaf") return ws;
    const parts = leaves(t.root).map((l, n): WsTab => ({ id: n === 0 ? t.id : newId(), root: l, focus: l.id }));
    const tabs = [...ws.tabs];
    tabs.splice(i, 1, ...parts);
    return { ...ws, tabs, active: ws.active === tab ? (parts.find((p) => p.focus === t.focus)?.id ?? t.id) : ws.active };
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
  // A pane may show it as a guest in another worktree's tab: that pane is
  // where it is, so focus it in place rather than open a second one.
  const found = findSession(box, session.name);
  if (found && found.key !== key) {
    if (!showWorktree(found.key)) return;
    activateTab(found.key, found.tab);
    focusPane(found.key, found.tab, found.pane.id);
    return;
  }
  selectWorktree(ref);
  if (found) focusPane(key, found.tab, found.pane.id);
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

// openFor shows content for the worktree you are acting in (here): with
// split, beside the focused pane, as a guest when that pane is another
// worktree's; else as a tab of here's own, brought to the front.
export function openFor(content: PaneContent, opts: { split?: "row" | "col" } = {}): { key: string; tab: string; pane: string } | undefined {
  const wt = here();
  const f = focusedPane();
  if (!wt) return undefined;
  useStore.getState().setView({ kind: "workspace" });
  if (opts.split && f) return { key: f.key, tab: f.tab.id, pane: splitPane(f.key, f.tab.id, f.leaf.id, opts.split, content, wt) };
  if (!showWorktree(wt)) return undefined;
  const r = openTab(content, wt);
  return r && { key: wt, ...r };
}

// openBrowser opens a page in the worktree you are acting in: a new tab, or
// with split, beside the focused pane.
export function openBrowser(url: string, opts: { split?: "row" | "col" } = {}) {
  openFor({ kind: "browser", url }, opts);
}

// openPanel opens a plugin's worktree panel for the worktree you are acting
// in: the pane that already shows it if there is one (in the tab showing,
// then in that worktree's tabs), else a new tab, or with split, beside the
// focused pane.
export function openPanel(plugin: string, panel: string, title: string, opts: { split?: "row" | "col" } = {}) {
  const wt = here();
  if (!wt) return;
  const isIt = (k: string, l: Leaf) => l.content.kind === "panel" && l.content.plugin === plugin && l.content.panel === panel && paneWorktree(k, l) === wt;
  const f = focusedPane();
  const near = f && leaves(f.tab.root).find((l) => isIt(f.key, l));
  if (f && near) {
    focusPane(f.key, f.tab.id, near.id);
    useStore.getState().setView({ kind: "workspace" });
    return;
  }
  for (const t of useWorkspaces.getState().spaces[wt]?.tabs ?? []) {
    const hit = leaves(t.root).find((l) => isIt(wt, l));
    if (hit && showWorktree(wt)) {
      activateTab(wt, t.id);
      focusPane(wt, t.id, hit.id);
      return;
    }
  }
  openFor({ kind: "panel", plugin, panel, title }, opts);
}

// recentWorktrees lists workspaces by when they were last opened.
export function recentWorktrees(spaces: Record<string, Workspace>, n = 3): Workspace[] {
  return Object.values(spaces)
    .filter((w) => w.visitedAt)
    .sort((a, b) => (b.visitedAt ?? 0) - (a.visitedAt ?? 0))
    .slice(0, n);
}

if (import.meta.env.DEV) Object.assign(window as unknown as Record<string, unknown>, { __berthWorkspaces: { useWorkspaces, selectWorktree, goHome, focusSession } });
