import * as stylex from "@stylexjs/stylex";
import { HouseIcon, PlusIcon } from "lucide-react";
import { Fragment } from "react";

import { openHomeTerminal } from "@/components/box-picker";
import { Tip } from "@/components/tip";
import { PaneActions } from "@/components/workspace/pane";
import { TabButton } from "@/components/workspace/tab-strip";
import { closeTab } from "@/lib/actions";
import { useStore } from "@/lib/store";
import { activateTab, goHome, homeBox, showHome, tabBeside, unsplitTab, useWorkspaces } from "@/lib/workspaces";
import { platformKeys } from "@/lib/platform";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "40px",
    "flexShrink": 0,
    "alignItems": "stretch",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "var(--sidebar)",
  },
  s1: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "stretch",
    "overflowX": "auto",
    "scrollbarWidth": "none",
  },
  s2: {
    "position": "relative",
    "display": "flex",
    "height": "100%",
    "width": "40px",
    "flexShrink": 0,
    "cursor": "default",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s3: {
    "backgroundColor": "var(--background)",
    "color": "var(--foreground)",
  },
  s4: {
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--background) 40%, transparent)",
    },
  },
  s5: {
    "position": "absolute",
    "left": 0,
    "right": 0,
    "top": "0px",
    "height": "1px",
    "backgroundColor": "color-mix(in oklab, var(--foreground) 50%, transparent)",
  },
  s6: {
    "width": "14px",
    "height": "14px",
  },
  s7: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "paddingLeft": "4px",
    "paddingRight": "4px",
  },
  s8: {
    "minWidth": "16px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s9: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "paddingRight": "8px",
    "paddingLeft": "12px",
  },
  s10: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "paddingRight": "6px",
    "paddingLeft": "10px",
  },
  s11: {
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--accent) 70%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s12: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s13: {
    "color": "var(--muted-foreground)",
  },
  s14: {
    "display": "inline-flex",
    "width": "28px",
    "height": "28px",
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
  s15: {
    "width": "16px",
    "height": "16px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// HomeTabs is the strip over Home: the terminals open in boxes' homes
// (lib/box-home.ts), each box's after a chip that names it ("devl · ~"),
// with Home itself first. They are tabs like a worktree's, in the same
// panes; closing the last one goes back to plain Home. With none, it is the
// plain strip Home always had.
export function HomeTabs() {
  const current = useWorkspaces((s) => s.current);
  const spaces = useWorkspaces((s) => s.spaces);
  const homes = Object.keys(spaces)
    .filter((k) => homeBox(k) && spaces[k].tabs.length)
    .sort();
  const front = homeBox(current) ? spaces[current!] : undefined;
  const active = front?.tabs.find((t) => t.id === front.active);
  const lone = active && active.root.kind === "leaf" ? active.root : undefined;
  const onHome = !front;

  return (
    <div data-tauri-drag-region data-tab-bar className={sx(paint.s0)}>
      {homes.length > 0 && (
        <div data-tauri-drag-region data-tab-strip role="tablist" aria-label="Home tabs" className={sx(paint.s1)}>
          <Tip label="Home" side="bottom">
            <div
              role="tab"
              aria-label="Home"
              aria-selected={onHome}
              tabIndex={onHome ? 0 : -1}
              data-home-tab
              onClick={goHome}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goHome();
                }
              }}
              className={[sx(paint.s2), onHome ? sx(paint.s3) : sx(paint.s4)].filter(Boolean).join(" ")}
            >
              {onHome && <span className={sx(paint.s5)} />}
              <HouseIcon className={sx(paint.s6)} />
            </div>
          </Tip>
          {homes.map((key) => {
            const ws = spaces[key];
            return (
              <Fragment key={key}>
                <BoxHomeChip box={homeBox(key)!} />
                {ws.tabs.map((t) => (
                  <TabButton
                    key={t.id}
                    tab={t}
                    wsKey={key}
                    active={key === current && t.id === ws.active}
                    onActivate={() => {
                      showHome(key);
                      activateTab(key, t.id);
                    }}
                    onClose={() => void closeTab(key, t.id)}
                    // Home's tabs stay on Home: no dragging them into a worktree's.
                    onDrag={() => {}}
                    onSplit={ws.tabs.length > 1 ? (dir) => tabBeside(key, t.id, dir) : undefined}
                    onUnsplit={() => unsplitTab(key, t.id)}
                  />
                ))}
              </Fragment>
            );
          })}
        </div>
      )}
      {homes.length > 0 && (
        <div className={sx(paint.s7)}>
          <NewHomeTerminal box={homeBox(current) ?? homeBox(homes[homes.length - 1])!} />
        </div>
      )}
      <div data-tauri-drag-region className={sx(paint.s8)} />
      {current && active && lone && (
        <div className={sx(paint.s9)}>
          <PaneActions wsKey={current} tab={active.id} pane={lone} />
        </div>
      )}
    </div>
  );
}

// BoxHomeChip names the box the terminals after it run on, in its home.
function BoxHomeChip({ box }: { box: string }) {
  const home = useStore((s) => (s.boxes[box]?.info as { home?: string } | undefined)?.home);
  return (
    <Tip label={`Terminals in ${box}'s home folder${home ? `, ${home}` : ""}. They belong to no worktree.`} side="bottom">
      <span data-tauri-drag-region data-home-box={box} className={sx(paint.s10)}>
        <span className={sx(paint.s11)}>{box} · ~</span>
      </span>
    </Tip>
  );
}

// NewHomeTerminal opens another terminal in the same box's home.
function NewHomeTerminal({ box }: { box: string }) {
  return (
    <Tip
      label={
        <span className={sx(paint.s12)}>
          New terminal on {box}
          <span className={sx(paint.s13)}>{platformKeys("⌘T")}</span>
        </span>
      }
      side="bottom"
    >
      <button
        type="button"
        aria-label={`New terminal on ${box}`}
        onClick={() => void openHomeTerminal(box)}
        className={sx(paint.s14)}
      >
        <PlusIcon className={sx(paint.s15)} />
      </button>
    </Tip>
  );
}
