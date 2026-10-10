import * as stylex from "@stylexjs/stylex";
import { useRef } from "react";

import { COMPARE_BAR, CompareBar, useSideStates } from "@/components/workspace/compare-view";
import { useTiny } from "@/components/workspace/worktree-tone";
import { Pane } from "@/components/workspace/pane";
import { DragGhost, DropOverlay } from "@/components/workspace/tab-drag";
import { shownSides, sides } from "@/lib/compare";
import { type Divider, layout, mixed } from "@/lib/layout";
import { resizeSplit, useWorkspaces } from "@/lib/workspaces";

const paint = stylex.create({
  s0: {
    "position": "absolute",
    "overflow": "hidden",
  },
  s1: {
    "borderLeftWidth": 1,
    "borderLeftStyle": "solid",
    "borderLeftColor": "var(--border)",
  },
  s2: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
  },
  s3: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "overflow": "hidden",
  },
  s4: {
    "position": "absolute",
    "overflow": "hidden",
  },
  s5: {
    "borderLeftWidth": 1,
    "borderLeftStyle": "solid",
    "borderLeftColor": "var(--border)",
  },
  s6: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
  },
  s7: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
  },
  s8: {
    "position": "absolute",
    "zIndex": 10,
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--ring) 40%, transparent)",
    },
  },
  s9: {
    "cursor": "col-resize",
  },
  s10: {
    "cursor": "row-resize",
  },
  s11: {
    ":not(#\\#) iframe": {
      pointerEvents: "none",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const pct = (n: number) => `${n * 100}%`;

// PaneLayer draws every pane of every workspace opened since launch, in one
// flat list positioned from each tab's split tree. Keeping them in one list,
// keyed by pane id, is what lets a terminal survive its tab being split,
// hidden, moved to another tab, or its worktree switched away from: React
// never remounts it. They are sorted by id, so a pane moving between tabs
// never moves in the DOM either (a moved frame would reload).
export function PaneLayer({ showing }: { showing: boolean }) {
  const area = useRef<HTMLDivElement>(null);
  const current = useWorkspaces((s) => s.current);
  const mounted = useWorkspaces((s) => s.mounted);
  const spaces = useWorkspaces((s) => s.spaces);
  // Compare tabs' sides, and whether each can show (compare-view.tsx).
  const compared = mounted.flatMap((k) => spaces[k]?.tabs.flatMap((t) => (t.compare ? [t.compare.a, t.compare.b] : [])) ?? []);
  const states = useSideStates(compared);
  const stateOf = (k: string) => states[compared.indexOf(k)] ?? "ok";
  // In a tiny window a Compare tab's sides stack, each the tab's full width.
  const tiny = useTiny();

  const items = mounted.flatMap((key) => {
    const ws = spaces[key];
    if (!ws) return [];
    return ws.tabs.flatMap((tab) => {
      const visible = showing && key === current && tab.id === ws.active;
      // A Compare tab: its bar, then its two panes below it, one filling
      // the tab when the other side can't show; its other lanes' panes
      // stay mounted, hidden.
      const pair = sides(tab);
      if (tab.compare && pair) {
        const c = tab.compare;
        const ratio = tab.root.kind === "split" ? tab.root.ratio : 0.5;
        const show = shownSides([stateOf(c.a), stateOf(c.b)]);
        const whole = { x: 0, y: 0, w: 1, h: 1 };
        const halves = tiny ? [{ ...whole, h: 0.5 }, { ...whole, y: 0.5, h: 0.5 }] : [{ ...whole, w: ratio }, { ...whole, x: ratio, w: 1 - ratio }];
        const rects = show[0] && show[1] ? halves : show[0] ? [whole, undefined] : [undefined, whole];
        return [
          ...(visible ? [<CompareBar key={`bar:${tab.id}`} wsKey={key} tab={tab} />] : []),
          ...pair.map((leaf, i) => {
            const r = rects[i];
            const on = visible && !!r;
            return (
              <div
                key={leaf.id}
                data-testid="pane"
                data-pane-kind={leaf.content.kind}
                data-compare-side={i}
                data-pane-focused={on && tab.focus === leaf.id ? "" : undefined}
                className={[sx(paint.s0), r && r.x > 0 && sx(paint.s1), r && r.y > 0 && sx(paint.s2)].filter(Boolean).join(" ")}
                style={{ left: pct(r?.x ?? 0), width: pct(r?.w ?? 1), top: `calc(${COMPARE_BAR}px + (100% - ${COMPARE_BAR}px) * ${r?.y ?? 0})`, height: `calc((100% - ${COMPARE_BAR}px) * ${r?.h ?? 1})`, display: on ? "block" : "none" }}
              >
                <Pane wsKey={key} tab={tab.id} pane={leaf} visible={on} focused={tab.focus === leaf.id} split={false} mixed compare={{ tab: tab.id, pane: leaf.id, side: i as 0 | 1, sync: c.sync }} />
              </div>
            );
          }),
          ...(c.parked ?? []).map((leaf) => (
            <div key={leaf.id} className={sx(paint.s3)} style={{ display: "none" }}>
              <Pane wsKey={key} tab={tab.id} pane={leaf} visible={false} focused={false} split={false} mixed />
            </div>
          )),
        ];
      }
      const { leaves, dividers } = layout(tab.root);
      const split = leaves.length > 1;
      const several = mixed(tab.root, key);
      return [
        ...leaves.map(({ leaf, rect }) => (
          <div
            key={leaf.id}
            data-testid="pane"
            data-pane-kind={leaf.content.kind}
            // Where the keyboard goes home to when what had it closes (lib/focus-home.ts).
            data-pane-focused={visible && tab.focus === leaf.id ? "" : undefined}
            className={[sx(paint.s4), rect.x > 0 && sx(paint.s5), rect.y > 0 && sx(paint.s6)].filter(Boolean).join(" ")}
            style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h), display: visible ? "block" : "none" }}
          >
            <Pane wsKey={key} tab={tab.id} pane={leaf} visible={visible} focused={tab.focus === leaf.id} split={split} mixed={several} />
          </div>
        )),
        ...(visible ? dividers.map((d) => <DividerHandle key={d.id} d={d} area={area} onRatio={(r) => resizeSplit(key, tab.id, d.id, r)} />) : []),
      ];
    });
  });

  return (
    <div ref={area} data-pane-area className={sx(paint.s7)} style={{ visibility: showing ? "visible" : "hidden" }}>
      {items.sort((a, b) => (String(a.key) < String(b.key) ? -1 : 1))}
      {showing && <DropOverlay />}
      <DragGhost />
    </div>
  );
}

// DividerHandle is the invisible, wider grab area over a split's line.
function DividerHandle({ d, area, onRatio }: { d: Divider; area: React.RefObject<HTMLDivElement | null>; onRatio(r: number): void }) {
  const row = d.dir === "row";
  const style = row
    ? { left: `calc(${pct(d.at)} - 3px)`, top: pct(d.area.y), width: 6, height: pct(d.area.h) }
    : { top: `calc(${pct(d.at)} - 3px)`, left: pct(d.area.x), height: 6, width: pct(d.area.w) };

  return (
    <div
      role="separator"
      aria-orientation={row ? "vertical" : "horizontal"}
      className={[sx(paint.s8), row ? sx(paint.s9) : sx(paint.s10)].filter(Boolean).join(" ")}
      style={style}
      onPointerDown={(e) => {
        const box = area.current?.getBoundingClientRect();
        if (!box) return;
        e.preventDefault();
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        // Iframes would swallow the pointer while dragging over them.
        document.body.classList.add(sx(paint.s11));
        const move = (ev: PointerEvent) => {
          const r = row ? ((ev.clientX - box.left) / box.width - d.area.x) / d.area.w : ((ev.clientY - box.top) / box.height - d.area.y) / d.area.h;
          onRatio(r);
        };
        const up = () => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", up);
          document.body.classList.remove(sx(paint.s11));
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
      }}
    />
  );
}
