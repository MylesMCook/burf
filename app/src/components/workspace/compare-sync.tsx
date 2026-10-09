import { type RefObject, useContext, useEffect, useRef } from "react";

import { CompareSideContext, sendPlace, useCompareSync } from "@/lib/compare-actions";

// Sync between a Compare tab's two sides (lib/compare.ts): scrolling one
// diff takes the other to the same file. Each side says where it got to;
// the other goes there if it has that file. A move made to follow the other side
// isn't sent back. Outside a Compare tab, or with Sync off, nothing happens.

// How long a followed move takes to settle, during which this side's own
// scrolling is that move arriving, not the person's.
const SETTLE_MS = 900;

export interface Follower {
  // Sync is on for this pane.
  on: boolean;
  // This side scrolled to place at.
  moved(at: string | number): void;
}

// useFollow keeps a pane's side in step: go takes it to where the other
// side went. The returned ref's moved says where this one got to.
export function useFollow(what: "file", go: (at: string | number) => boolean): RefObject<Follower> {
  const side = useContext(CompareSideContext);
  const last = useRef<string | number | undefined>(undefined);
  const followedAt = useRef(0);
  const goRef = useRef(go);
  goRef.current = go;
  const follower = useRef<Follower>({ on: false, moved: () => {} });
  follower.current = {
    on: !!side?.sync,
    moved: (at) => {
      if (!side?.sync || at === last.current) return;
      last.current = at;
      if (Date.now() - followedAt.current < SETTLE_MS) return;
      sendPlace(what, side.tab, side.pane, at);
    },
  };
  useEffect(() => {
    if (!side?.sync) return;
    return useCompareSync.subscribe((s, prev) => {
      const p = s[what][side.tab];
      if (!p || p === prev[what][side.tab] || p.from === side.pane) return;
      if (goRef.current(p.at)) {
        last.current = p.at;
        followedAt.current = Date.now();
      }
    });
  }, [what, side?.tab, side?.pane, side?.sync]);
  return follower;
}
