import { useMemo } from "react";

import type { Session } from "@/lib/api";
import { type SessionState, sessionState } from "@/lib/derive";
import { useStore } from "@/lib/store";

export interface SessionEntry {
  box: string;
  session: Session;
  state: SessionState;
}

// useAllSessions lists every session on every online box with its state.
export function useAllSessions(): SessionEntry[] {
  const boxes = useStore((s) => s.boxes);
  const status = useStore((s) => s.status);
  return useMemo(() => {
    const online = new Set(status?.boxes.filter((b) => b.state === "online").map((b) => b.name));
    return Object.entries(boxes)
      .filter(([box]) => online.has(box))
      .flatMap(([box, d]) => (d.sessions ?? []).map((session) => ({ box, session, state: sessionState(session, d.stats) })));
  }, [boxes, status]);
}

export function useAgentCounts() {
  const all = useAllSessions();
  return useMemo(
    () => ({
      waiting: all.filter((e) => e.state === "waiting").length,
      running: all.filter((e) => e.state === "running").length,
      finished: all.filter((e) => e.state === "finished").length,
    }),
    [all],
  );
}
