import { confirm } from "@/components/sidebar/confirm";
import { toastManager } from "@/components/ui/toast";
import { usePrefs } from "@/lib/prefs";
import { type AgentPreset, boxApi, type Location, type Worktree } from "@/lib/api";
import { agentLabel, agentOf } from "@/lib/derive";
import { errorMessage } from "@/lib/format";
import { findLeaf, type Leaf, leaves, type PaneContent } from "@/lib/layout";
import { scheduleRefresh, useStore } from "@/lib/store";
import { resolveBrowserInput } from "@/lib/browser-url";
import { currentSpace, openTab, removePane, selectWorktree, setPaneContent, splitPane, useWorkspaces, type WorktreeRef, wsKey } from "@/lib/workspaces";

// Agents offered when a box does not list its own.
export const DEFAULT_AGENTS: AgentPreset[] = [
  { id: "claude", name: "Claude Code", command: "claude" },
  { id: "codex", name: "Codex", command: "codex" },
  { id: "shell", name: "Terminal", command: "" },
];

// agentPresets is what can be started on a box: the repository's own agents
// first, when a location is given, then the box's.
export function agentPresets(box: string, loc?: Location | string): AgentPreset[] {
  const data = useStore.getState().boxes[box];
  const l = typeof loc === "string" ? data?.locations?.find((x) => x.name === loc) : loc;
  const fromBox = data?.info?.agents;
  const all = [...(l?.agents ?? []), ...(fromBox?.length ? fromBox : DEFAULT_AGENTS.slice(0, 2))];
  return all.filter((p, i) => p.command && all.findIndex((q) => q.id === p.id) === i);
}

// worktreeRef is how the box API names a worktree: "loc" for the
// repository's own checkout, "loc/name" for the others.
export const worktreeRef = (loc: Location | { name: string }, wt: Worktree | { name: string; main?: boolean }) => (wt.main ? loc.name : `${loc.name}/${wt.name}`);

const refLocation = (r: WorktreeRef) => (r.main ? r.location : `${r.location}/${r.worktree}`);

export type Target = { kind: "tab" } | { kind: "split"; tab: string; pane: string; dir: "row" | "col" } | { kind: "replace"; tab: string; pane: string };

// place puts content where target says in the current workspace, and
// returns where it landed.
function place(content: PaneContent, target: Target): { key: string; tab: string; pane: string } | undefined {
  const key = useWorkspaces.getState().current;
  if (!key) return undefined;
  if (target.kind === "tab") {
    const r = openTab(content, key);
    return r && { key, ...r };
  }
  if (target.kind === "split") return { key, tab: target.tab, pane: splitPane(key, target.tab, target.pane, target.dir, content) };
  setPaneContent(key, target.tab, target.pane, content);
  return { key, tab: target.tab, pane: target.pane };
}

// startSession runs a command (an agent, or a shell when empty) in the
// current worktree and shows it in a new tab, a split, or an existing pane.
export async function startSession(command: string, target: Target = { kind: "tab" }, label = command || "Terminal") {
  const ws = currentSpace();
  const client = useStore.getState().client;
  if (!ws || !client) return;
  const at = place({ kind: "starting", label }, target);
  if (!at) return;
  try {
    const s = await boxApi.startSession(client, ws.ref.box, { location: refLocation(ws.ref), command: command || undefined });
    setPaneContent(at.key, at.tab, at.pane, { kind: "terminal", box: ws.ref.box, session: s.name });
    scheduleRefresh(ws.ref.box, ["sessions"]);
  } catch (err) {
    setPaneContent(at.key, at.tab, at.pane, { kind: "error", message: errorMessage(err) });
  }
}

export function openBrowserAt(url = "", target: Target = { kind: "tab" }) {
  place({ kind: "browser", url }, target);
}

// A URL for what was typed: a port opens on the current worktree's box, by
// the worktree's name when that is its dev server.
export function resolveUrl(input: string): string | undefined {
  const ref = currentSpace()?.ref;
  const st = useStore.getState();
  return resolveBrowserInput(input, { ref, services: ref ? st.boxes[ref.box]?.services : undefined, urlPort: st.status?.proxy.url_port });
}

// Closing never loses work without asking. A plain shell stops with its
// pane, so closing one asks first (unless the person turned that off); an
// agent keeps running on the box and is only hidden, which says so the first
// few times.

interface Closing {
  key: string;
  tab: string;
  leaves: Leaf[];
}

// What closing these panes would stop on a box.
function stopping(leavesToClose: Leaf[]) {
  const boxes = useStore.getState().boxes;
  return leavesToClose.flatMap((l) => {
    if (l.content.kind !== "terminal") return [];
    const { box, session } = l.content;
    const s = boxes[box]?.sessions?.find((x) => x.name === session);
    if (!s || s.exited || agentOf(s)) return [];
    return [{ box, session, command: s.command?.trim() || undefined }];
  });
}

async function close({ key, tab, leaves: ls }: Closing) {
  const boxes = useStore.getState().boxes;
  const agents: string[] = [];
  for (const l of ls) {
    if (l.content.kind !== "terminal") {
      removePane(key, tab, l.id);
      continue;
    }
    const { box, session } = l.content;
    const s = boxes[box]?.sessions?.find((x) => x.name === session);
    if (s && agentOf(s) && !s.exited) {
      agents.push(agentOf(s)!);
      removePane(key, tab, l.id, session);
      continue;
    }
    removePane(key, tab, l.id);
    await stopSession(box, session, true);
  }
  if (agents.length) agentKeepsRunning(agents[0], key);
}

function agentKeepsRunning(agent: string, key: string) {
  const { agentCloseTips } = usePrefs.getState();
  if (agentCloseTips >= 3) return;
  usePrefs.setState({ agentCloseTips: agentCloseTips + 1 });
  const ws = useWorkspaces.getState().spaces[key];
  toastManager.add({
    title: `${agentLabel(agent)} keeps running`,
    description: "Closing a tab only hides an agent. Reopen it from the worktree or the dashboard.",
    type: "info",
    actionProps: ws ? { children: "Reopen", onClick: () => selectWorktree(ws.ref) } : undefined,
  });
}

// ask confirms closing when it would stop shells, then closes.
function ask(c: Closing) {
  const stops = stopping(c.leaves);
  if (!stops.length || !usePrefs.getState().confirmCloseShells) return void close(c);
  const box = stops[0].box;
  const one = stops.length === 1;
  const what = stops.map((x) => x.command).filter(Boolean) as string[];
  confirm({
    title: one ? "Close shell?" : `Close ${stops.length} shells?`,
    description: `This stops ${one ? "the shell" : "them"} on ${box}${what.length ? `, and what runs in ${one ? "it" : "them"}:` : `, and anything running in ${one ? "it" : "them"}.`}`,
    detail: what.length ? what.join("\n") : undefined,
    confirm: one ? "Close shell" : "Close shells",
    destructive: true,
    options: [{ id: "never", label: "Don't ask again", hint: "Settings → General turns it back on." }],
    repeatConfirms: true,
    run: async (checked) => {
      if (checked.never) usePrefs.setState({ confirmCloseShells: false });
      await close(c);
    },
  });
}

// closePane closes one pane (⌘W, its ×, "Close pane").
export function closePane(key: string, tab: string, pane: string) {
  const t = useWorkspaces.getState().spaces[key]?.tabs.find((x) => x.id === tab);
  const l = t && findLeaf(t.root, pane);
  if (l) ask({ key, tab, leaves: [l] });
}

// closeTab closes every pane in a tab, asking once for all of them.
export function closeTab(key: string, tab: string) {
  const t = useWorkspaces.getState().spaces[key]?.tabs.find((x) => x.id === tab);
  if (t) ask({ key, tab, leaves: leaves(t.root) });
}

export async function stopSession(box: string, name: string, quiet = false) {
  const client = useStore.getState().client;
  if (!client) return;
  try {
    await boxApi.stopSession(client, box, name);
    scheduleRefresh(box, ["sessions"]);
  } catch (err) {
    if (!quiet) toastManager.add({ title: "Could not stop the session", description: errorMessage(err), type: "error" });
  }
}

export const currentKey = () => {
  const ws = currentSpace();
  return ws ? wsKey(ws.ref.box, ws.ref.path) : undefined;
};
