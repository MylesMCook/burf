import { create } from "zustand";

import type { BerthEvent } from "@/lib/api";
import { agentLabel, agentOf } from "@/lib/derive";
import { notify } from "@/lib/notify";
import { handlePreview } from "@/lib/preview";
import { handleSessionOpen } from "@/lib/session-open";
import { type BoxPart, scheduleRefresh, useStore } from "@/lib/store";
import { focusSession } from "@/lib/workspaces";
import { dispatch } from "@/plugins/registry";

// What each kind of event invalidates on its box.
const refreshes: [prefix: string, parts: BoxPart[]][] = [
  ["location.", ["locations", "services"]],
  ["worktree.", ["locations", "services"]],
  ["session.", ["sessions"]],
  ["agent.", ["sessions", "stats"]],
];

// The most recent events, newest first, for the Automations view.
export const useEventLog = create<{ events: BerthEvent[] }>()(() => ({ events: [] }));

// handleEvent is the one place events land: plugins hear them, the store
// refetches what they changed, and agents that need someone notify.
export function handleEvent(e: BerthEvent) {
  useEventLog.setState((s) => ({ events: [e, ...s.events].slice(0, 200) }));
  dispatch(e);
  const store = useStore.getState();

  if (e.type.startsWith("box.") || e.type.startsWith("forward.")) {
    void store.refreshStatus();
    const name = (e.data?.box as string | undefined) ?? e.box;
    if (e.type === "box.connected" && name) scheduleRefresh(name, ["locations", "sessions", "stats", "services", "info"]);
  }
  if (e.box) {
    for (const [prefix, parts] of refreshes) {
      if (e.type.startsWith(prefix)) scheduleRefresh(e.box, parts);
    }
  }

  if (e.type === "agent.waiting" || e.type === "agent.finished") {
    const where = describeAgent(e);
    const open = where.session && e.box ? { label: "Open", run: () => void focusSession(e.box!, where.session!) } : undefined;
    notify(e.type === "agent.waiting" ? `${where.agent} is waiting for you` : `${where.agent} finished`, where.place, e.type === "agent.waiting" ? "warning" : "success", open);
  }
  if (e.type === "preview.open") handlePreview(e);
  if (e.type === "session.open") handleSessionOpen(e);
  if (e.type === "worktree.setup.failed") {
    notify(`Setup failed for ${String(e.data?.name ?? "a worktree")}`, e.error, "error");
  }
  // A flow's notify step: its own title and body, from whichever box.
  if (e.type === "notify") {
    const title = String(e.data?.title ?? "Berth");
    const body = [e.data?.body, e.box && `on ${e.box}`].filter(Boolean).join(" · ");
    notify(title, body || undefined, "info");
  }
}

// describeAgent names an agent event's agent and place the same way every
// time: "cal / qa-deck · devl".
function describeAgent(e: BerthEvent): { agent: string; place: string; session?: string } {
  const path = e.data?.path as string | undefined;
  const data = e.box ? useStore.getState().boxes[e.box] : undefined;
  const session = data?.sessions?.find((s) => s.dir === path);
  const loc = data?.locations?.find((l) => l.worktrees?.some((w) => w.path === path));
  const wt = loc?.worktrees?.find((w) => w.path === path);
  const raw = (session && agentOf(session)) ?? (e.data?.agent as string | undefined) ?? e.origin ?? "an agent";
  const where = loc && wt ? (wt.main ? loc.name : `${loc.name} / ${wt.name}`) : (path?.split("/").pop() ?? "");
  const place = [where, e.box].filter(Boolean).join(" · ");
  return { agent: agentLabel(raw), place, session: session?.name };
}
