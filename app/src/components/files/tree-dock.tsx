import * as stylex from "@stylexjs/stylex";
import { PanelRightIcon } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { TreePanel } from "@/components/files/file-tree";
import { Tip } from "@/components/tip";
import { NARROW, setTreeOpen, toggleTree, useTouchedLive, useTree, useWorkingSessions } from "@/lib/file-tree";
import { openFile, useFiles } from "@/lib/files";
import { findLeaf, paneWorktree } from "@/lib/layout";
import { usePrefs } from "@/lib/prefs";
import { useHereKey, useHereRef, useWorkspaces } from "@/lib/workspaces";

const paint = stylex.create({
  s0: {
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "left": "0px",
  },
  s1: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "zIndex": NaN,
    "backgroundColor": {
      "default": "light-dark(color-mix(in oklab, #000 25%, transparent), color-mix(in oklab, #000 45%, transparent))",
    },
  },
  s2: {
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "right": "0px",
    "display": "flex",
    "flexDirection": "column",
    "borderLeftWidth": 1,
    "borderLeftStyle": "solid",
    "borderLeftColor": "var(--border)",
    "backgroundColor": "var(--sidebar)",
  },
  s3: {
    "zIndex": NaN,
    "boxShadow": "-18px 0 40px -10px rgb(0 0 0/0.45)",
  },
  s4: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s5: {
    "position": "relative",
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
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
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s7: {
    "width": "14px",
    "height": "14px",
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
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The Files panel: the worktree's files at the right of its tabs, under the
// tab strip, beside whatever tab is in front (Chat, Shell, Preview, a File
// tab). It is the worktree's, not the app's: it follows the worktree in
// front, and ⌘⇧E (View › Files panel) or its button in the strip shows and
// hides it, for every worktree, across restarts (prefs.filesPanel). Below a
// 1100px window it floats over the tabs with a scrim instead of taking
// their room, and goes once you pick a file or press esc; floating doesn't
// change the pref. The app's sidebar stays projects and agents.

export const DOCK_W = 264;
const FLOAT_W = 280;

function useNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(NARROW);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(NARROW).matches,
  );
}

// useFrontFile is the file in front: the focused pane's, when it is a File
// tab of this worktree.
function useFrontFile(ws: string | undefined) {
  return useWorkspaces((s) => {
    const sp = s.current ? s.spaces[s.current] : undefined;
    const tab = sp?.tabs.find((t) => t.id === sp.active);
    const leaf = tab ? findLeaf(tab.root, tab.focus) : undefined;
    return leaf && leaf.content.kind === "file" && s.current && paneWorktree(s.current, leaf) === ws ? leaf.content.path : undefined;
  });
}

// usePanelOpen: the panel shows, docked or floating.
function usePanelOpen() {
  const docked = usePrefs((p) => p.filesPanel);
  const floating = useTree((s) => s.floating);
  return useNarrow() ? floating : docked;
}

export function TreeDockFrame({ showing, children }: { showing: boolean; children: React.ReactNode }) {
  const open = usePanelOpen();
  const ws = useHereKey();
  const ref = useHereRef();
  const hasTabs = useWorkspaces((s) => !!(s.current && s.spaces[s.current]?.tabs.length));
  const front = useFrontFile(ws);
  const narrow = useNarrow();
  const on = showing && open && !!ws && !!ref && hasTabs;
  const float = on && narrow;
  // A wider window docks the panel (or not) by the pref; the floating one
  // is forgotten.
  useEffect(() => {
    if (!narrow) useTree.setState({ floating: false });
  }, [narrow]);
  const working = useWorkingSessions(ref);
  useTouchedLive(ws, ref, on, working.size > 0);
  // The loops panel sits clear of a docked panel; a floating
  // one covers it with the rest.
  useEffect(() => {
    document.documentElement.style.setProperty("--berth-dock-w", on && !float ? `${DOCK_W}px` : "0px");
  }, [on, float]);
  // Floating, it takes the keys: the tree has focus, and esc closes it
  // before a terminal behind it could take esc as its own.
  const aside = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!float) return;
    aside.current?.querySelector<HTMLElement>("[role=tree]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("[role=dialog], [role=alertdialog]")) return;
      // New file's own esc puts away the name first.
      if ((e.target as HTMLElement | null)?.closest?.("[data-testid=tree-new-file]")) return;
      e.preventDefault();
      e.stopPropagation();
      setTreeOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [float]);
  return (
    <>
      <div className={sx(paint.s0)} style={{ right: on && !float ? DOCK_W : 0 }}>
        {children}
      </div>
      {float && <div aria-hidden data-testid="tree-scrim" className={sx(paint.s1)} onClick={() => setTreeOpen(false)} />}
      {on && (
        <aside
          ref={aside}
          aria-label="Files in this worktree"
          data-testid="files-panel"
          data-float={float || undefined}
          className={[sx(paint.s2), float && sx(paint.s3)].filter(Boolean).join(" ")}
          style={{ width: float ? FLOAT_W : DOCK_W }}
        >
          <TreePanel
            ws={ws}
            wref={ref}
            current={front}
            onOpen={(p, how) => {
              openFile(p, how);
              if (float && how !== "external") setTreeOpen(false);
            }}
            onClose={() => setTreeOpen(false)}
            className={sx(paint.s4)}
          />
        </aside>
      )}
    </>
  );
}

// DockButton is the strip's button for the panel. Closed, it carries a
// blue dot while the agents have changed files this turn: the one place
// that says there is something to look at without opening anything.
export function DockButton() {
  const open = usePanelOpen();
  const ws = useHereKey();
  const ref = useHereRef();
  const n = useFiles((s) => (ws ? (s.touched[ws]?.files.length ?? 0) : 0));
  if (!ref) return null;
  return (
    <Tip label={open ? "Hide files (⌘⇧E)" : n > 0 ? `Files: ${n} changed this turn (⌘⇧E)` : "Files (⌘⇧E)"} side="bottom">
      <button
        type="button"
        aria-label={open ? "Hide files" : "Show files"}
        aria-pressed={open}
        data-testid="files-panel-button"
        onClick={toggleTree}
        className={[sx(paint.s5), open && sx(paint.s6)].filter(Boolean).join(" ")}
      >
        <PanelRightIcon className={sx(paint.s7)} />
        {!open && n > 0 && <span data-testid="files-panel-dot" className={sx(paint.s8)} />}
      </button>
    </Tip>
  );
}
