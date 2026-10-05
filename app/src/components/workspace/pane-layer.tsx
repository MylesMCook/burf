import { useRef } from "react";

import { Pane } from "@/components/workspace/pane";
import { DragGhost, DropOverlay } from "@/components/workspace/tab-drag";
import { type Divider, layout, mixed } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { resizeSplit, useWorkspaces } from "@/lib/workspaces";

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

  const items = mounted.flatMap((key) => {
    const ws = spaces[key];
    if (!ws) return [];
    return ws.tabs.flatMap((tab) => {
      const visible = showing && key === current && tab.id === ws.active;
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
            className={cn("absolute overflow-hidden", rect.x > 0 && "border-l", rect.y > 0 && "border-t")}
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
    <div ref={area} data-pane-area className="absolute inset-0" style={{ visibility: showing ? "visible" : "hidden" }}>
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
      className={cn("absolute z-10 transition-colors hover:bg-ring/40", row ? "cursor-col-resize" : "cursor-row-resize")}
      style={style}
      onPointerDown={(e) => {
        const box = area.current?.getBoundingClientRect();
        if (!box) return;
        e.preventDefault();
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        // Iframes would swallow the pointer while dragging over them.
        document.body.classList.add("[&_iframe]:pointer-events-none");
        const move = (ev: PointerEvent) => {
          const r = row ? ((ev.clientX - box.left) / box.width - d.area.x) / d.area.w : ((ev.clientY - box.top) / box.height - d.area.y) / d.area.h;
          onRatio(r);
        };
        const up = () => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", up);
          document.body.classList.remove("[&_iframe]:pointer-events-none");
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
      }}
    />
  );
}
