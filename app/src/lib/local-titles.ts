import type { Location, Worktree } from "@/lib/api";
import { load, save } from "@/lib/storage";

// Worktree display names kept on this laptop alone, for a box whose berthd
// is older than worktree titles (it doesn't list "worktree.titles"). They
// are laid over its worktrees as they arrive (lib/store), so the rest of
// the app reads wt.title either way; once the box is updated they move to
// it (lib/worktree-names).

const KEY = "berth.worktreeTitles";

// By box, then worktree path.
type Saved = Record<string, Record<string, string>>;

let saved: Saved = load<Saved>(KEY, {});

export function localTitle(box: string, path: string): string | undefined {
  return saved[box]?.[path] || undefined;
}

export function localTitles(box: string): Record<string, string> {
  return { ...saved[box] };
}

// setLocalTitle keeps a display name for a worktree on this laptop; ""
// forgets it.
export function setLocalTitle(box: string, path: string, title: string) {
  const forBox = { ...saved[box] };
  if (title) forBox[path] = title;
  else delete forBox[path];
  saved = { ...saved, [box]: forBox };
  if (!Object.keys(forBox).length) delete saved[box];
  save(KEY, saved);
}

// withLocalTitles lays this laptop's names over a box's worktrees that the
// box itself has not named. A worktree the box names keeps the box's.
export function withLocalTitles(box: string, locations: Location[] | null | undefined): Location[] {
  const mine = saved[box];
  if (!locations || !mine) return locations ?? [];
  const named = (wt: Worktree): Worktree => (wt.title || !mine[wt.path] ? wt : { ...wt, title: mine[wt.path] });
  return locations.map((loc) => (loc.worktrees?.some((w) => mine[w.path]) ? { ...loc, worktrees: loc.worktrees.map(named) } : loc));
}

// For tests: start again from what storage holds.
export function reloadLocalTitles() {
  saved = load<Saved>(KEY, {});
}
