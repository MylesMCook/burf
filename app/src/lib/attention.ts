// The bell and the notification header count the same set: unresolved
// needs-you notes, plus agents waiting now that have no note yet.

export function countNeedsYou(notes: { needs: boolean; resolved?: boolean; snoozedUntil?: string }[], now = Date.now()): number {
  return notes.filter((n) => n.needs && !n.resolved && !(n.snoozedUntil && Date.parse(n.snoozedUntil) > now)).length;
}

export function attentionCount(unresolvedNeeds: number, liveWaiting: number): number {
  return unresolvedNeeds + liveWaiting;
}

// A resolved waiting note leaves the needs-you list. Its title must not
// still say that someone needs you.
export function shownNoteTitle(title: string, resolved?: boolean): string {
  if (resolved && title.endsWith(" needs you")) return title.slice(0, -" needs you".length);
  return title;
}
