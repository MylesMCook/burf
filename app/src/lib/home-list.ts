// A list widget tells its card whether it has rows. "loading" keeps the
// card (a skeleton). "empty" lets the card leave the grid. "shown" is a
// real row, an error, or an offline note.
export type HomeList = "loading" | "empty" | "shown";

export function homePresence(loading: boolean, count: number, keep = false): HomeList {
  if (loading && count === 0) return "loading";
  if (count === 0 && !keep) return "empty";
  return "shown";
}
