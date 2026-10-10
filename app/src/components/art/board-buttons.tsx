import * as stylex from "@stylexjs/stylex";
import { LayoutGridIcon } from "lucide-react";
import { useContext } from "react";

import { Tip } from "@/components/tip";
import { useArt, useWorktreeArt } from "@/lib/art/model";
import { openBoard } from "@/lib/art/open";
import { PaneContext } from "@/lib/pane-context";
import { useStore } from "@/lib/store";
import { useHereKey, wsKey } from "@/lib/workspaces";

const paint = stylex.create({
  s0: {
    "color": "color-mix(in oklab, var(--foreground) 85%, transparent)",
  },
  s1: {
    "position": "relative",
    "display": "flex",
  },
  s2: {
    "width": "14px",
    "height": "14px",
  },
  s3: {
    "position": "absolute",
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "var(--info)",
    "boxShadow": "0 0 0 2px var(--background)",
  },
  s4: {
    "fontVariantNumeric": "tabular-nums",
  },
  s5: {
    "position": "relative",
    "display": "inline-flex",
    "height": "24px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "outline": "none",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s6: {
    "width": "14px",
    "height": "14px",
  },
  s7: {
    "fontSize": "0.6875rem",
    "fontVariantNumeric": "tabular-nums",
  },
  s8: {
    "position": "absolute",
    "top": "2px",
    "right": "2px",
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "var(--info)",
    "boxShadow": "0 0 0 2px var(--background)",
  },

  s9: {
    top: -2,
    right: -2,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The ways to the board: "N artifacts" by the reply box (the worktree's,
// with a dot when one has a version not yet looked at), and a button in
// the worktree's toolbar beside Files.

function useFresh(list: { id: string }[]): boolean {
  return useArt((s) => list.some((a) => a.id in s.unseen));
}

// useSessionArt is the artifacts of the worktree a session runs in.
export function useSessionArt(box: string, session: string) {
  const dir = useStore((s) => s.boxes[box]?.sessions?.find((x) => x.name === session)?.dir);
  return useWorktreeArt(dir ? wsKey(box, dir) : undefined);
}

export function ArtBoardChip({ box, session, className }: { box: string; session: string; className?: string }) {
  const dir = useStore((s) => s.boxes[box]?.sessions?.find((x) => x.name === session)?.dir);
  return <WorktreeArtChip wt={dir ? wsKey(box, dir) : undefined} className={className} />;
}

// WorktreeArtChip is the same chip for a chat that names its worktree itself (a structured chat has no session).
export function WorktreeArtChip({ wt, className }: { wt?: string; className?: string }) {
  const list = useWorktreeArt(wt);
  const fresh = useFresh(list);
  const pane = useContext(PaneContext);
  if (!list.length || !wt) return null;
  const n = list.length;
  return (
    <Tip label="This worktree's artifacts, on its board · ⌘-click beside the chat">
      <button
        type="button"
        data-testid="art-chip"
        aria-label={`${n} ${n === 1 ? "artifact" : "artifacts"} in this worktree${fresh ? ", one updated" : ""}`}
        className={[className, fresh && sx(paint.s0)].filter(Boolean).join(" ")}
        onClick={(e) => openBoard(wt, { split: e.metaKey || e.ctrlKey, from: pane ? { wsKey: pane.wsKey, tab: pane.tab, pane: pane.pane } : undefined })}
      >
        <span className={sx(paint.s1)}>
          <LayoutGridIcon className={sx(paint.s2)} />
          {fresh && <span aria-hidden className={[sx(paint.s3), sx(paint.s9)].filter(Boolean).join(" ")} />}
        </span>
        <span className={sx(paint.s4)}>
          {n} {n === 1 ? "artifact" : "artifacts"}
        </span>
      </button>
    </Tip>
  );
}

export function BoardButton() {
  const key = useHereKey();
  const list = useWorktreeArt(key);
  const fresh = useFresh(list);
  if (!key || !list.length) return null;
  return (
    <Tip label={`Artifacts: ${list.length} in this worktree`} side="bottom">
      <button
        type="button"
        aria-label={`Artifacts board, ${list.length}`}
        data-testid="art-board-button"
        onClick={() => openBoard(key)}
        className={sx(paint.s5)}
      >
        <LayoutGridIcon className={sx(paint.s6)} />
        <span className={sx(paint.s7)}>{list.length}</span>
        {fresh && <span className={sx(paint.s8)} />}
      </button>
    </Tip>
  );
}
