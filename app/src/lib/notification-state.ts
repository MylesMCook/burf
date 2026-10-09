import type { Session } from "./api";
import type { Note } from "./notifications";

// Whether a box's session rows show that a waiting request has cleared.
// asked is when those rows were asked for (sessionsAsked in lib/store.ts).
export function waitingCleared(note: Pick<Note, "session" | "time">, sessions?: Session[], asked?: string): boolean {
  if (!sessions) return false;
  const live = sessions.find((x) => x.name === note.session);
  // Absence (or exit) only settles a request when the read began after it:
  // other box updates reuse the old rows, and a read under way can land
  // after an event announcing a session it was too early to list.
  if (!live || live.exited) return !!asked && asked > note.time;
  return live.agent_state !== "waiting" && !!live.state_since && live.state_since > note.time;
}
