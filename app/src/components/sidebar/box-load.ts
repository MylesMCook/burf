import { agentOf, sessionState } from "@/lib/derive";
import { useStore } from "@/lib/store";

// boxLoad is how busy a box is, for choosing where new work goes: memory in
// use and agents working there. "59% mem · 2 agents".
export function boxLoad(box: string): string {
  const d = useStore.getState().boxes[box];
  const mem = d?.stats?.memory;
  const agents = (d?.sessions ?? []).filter((s) => agentOf(s) && !s.exited && ["running", "waiting"].includes(sessionState(s, d?.stats))).length;
  const parts = [mem?.total ? `${Math.round((mem.used / mem.total) * 100)}% mem` : "", agents ? `${agents} ${agents === 1 ? "agent" : "agents"}` : ""].filter(Boolean);
  return parts.join(" · ");
}
