import { sessionName } from "@/lib/derive";
import { useStore } from "@/lib/store";

// useSessionName is sessionName for a session known by box and id, or the
// id itself until the box has listed it.
export function useSessionName(box: string, session: string, place = false): string {
  return useStore((s) => {
    const b = s.boxes[box];
    const found = b?.sessions?.find((x) => x.name === session);
    return found ? sessionName(found, { sessions: b?.sessions, locations: b?.locations, place }) : session;
  });
}
