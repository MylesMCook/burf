import { ArrowLeftRightIcon, PanelBottomIcon, PanelLeftIcon, PanelRightIcon, PanelTopIcon } from "lucide-react";
import { createPortal } from "react-dom";
import { create } from "zustand";

import { bounds, layout, leaves, movePane, place, type Rect, type Side, sideAt, swap } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { moveTab, paneBeside, paneToTab, tabIntoPane, useWorkspaces } from "@/lib/workspaces";

// Dragging a tab from the strip, or a pane by its header, as in VS Code. Over
// a pane of the tab showing, the nearest edge splits that pane and the drop
// lands on that side (a pane's own middle swaps the two); over the strip, it
// goes between two tabs. The overlay is drawn from the tree the drop would
// make, so it shows exactly where things will land.
//
// Pointer events, not HTML5 drag and drop: WebKit's drag images are poor and
// the strip is also the window's drag handle. Tabs don't carry
// data-tauri-drag-region, so pressing one never moves the window, and a press
// only becomes a drag after a few pixels, so clicks still click. Escape, or
// the window losing focus, cancels.

export type DragSource = { kind: "tab"; key: string; tab: string } | { kind: "pane"; key: string; tab: string; pane: string };

type Target =
  | { kind: "pane"; tab: string; pane: string; side: Side | "center"; rect: Rect; label: string }
  | { kind: "strip"; index: number; x: number };

interface DragState {
  source?: DragSource;
  label: string;
  icon?: React.ReactNode;
  x: number;
  y: number;
  target?: Target;
}

export const useTabDrag = create<DragState>(() => ({ label: "", x: 0, y: 0 }));

const THRESHOLD = 5;
// While dragging, nothing under the pointer (a terminal, a frame) shows its
// own cursor or takes the pointer.
const BODY = ["select-none", "[&_*]:cursor-grabbing!", "[&_iframe]:pointer-events-none"];

// armDrag starts watching a press on a tab or a pane header. Buttons and
// fields inside it (the tab's ×, a header's actions) never start a drag.
export function armDrag(e: React.PointerEvent<HTMLElement>, source: DragSource, label: string, icon?: React.ReactNode) {
  if (e.button !== 0 || e.ctrlKey || (e.target as HTMLElement).closest("button, input, a, [role=group], [data-no-drag]")) return;
  const el = e.currentTarget;
  const id = e.pointerId;
  const x0 = e.clientX;
  const y0 = e.clientY;
  let live = false;

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    if (!live) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < THRESHOLD) return;
      live = true;
      try {
        el.setPointerCapture(id);
      } catch {
        // Not capturable (it left the page); window listeners still see it.
      }
      document.body.classList.add(...BODY);
      window.getSelection()?.removeAllRanges();
    }
    useTabDrag.setState({ source, label, icon, x: ev.clientX, y: ev.clientY, target: hit(source, ev.clientX, ev.clientY) });
  };
  const end = (commit: boolean) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("blur", cancel);
    if (!live) return;
    const target = useTabDrag.getState().target;
    useTabDrag.setState({ source: undefined, target: undefined });
    document.body.classList.remove(...BODY);
    try {
      el.releasePointerCapture(id);
    } catch {
      // Already released.
    }
    // The click that follows letting go is the drag's, not the tab's.
    const swallow = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(() => window.removeEventListener("click", swallow, true), 0);
    if (commit && target) drop(source, target);
  };
  const up = (ev: PointerEvent) => ev.pointerId === id && end(true);
  const cancel = () => end(false);
  const key = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape" || !live) return;
    ev.preventDefault();
    ev.stopPropagation();
    end(false);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key, true);
  window.addEventListener("blur", cancel);
}

const LABELS: Record<Side | "center", string> = { left: "Split left", right: "Split right", top: "Split up", bottom: "Split down", center: "Swap panes" };

// hit is what the pointer is over: a gap in the strip, a side of a pane of
// the tab showing, or nothing a drop would change.
function hit(source: DragSource, x: number, y: number): Target | undefined {
  const ws = useWorkspaces.getState().spaces[source.key];
  if (!ws) return undefined;

  const strip = document.querySelector<HTMLElement>("[data-tab-strip]");
  const bar = strip?.closest<HTMLElement>("[data-tab-bar]")?.getBoundingClientRect();
  if (strip && bar && y >= bar.top && y <= bar.bottom) {
    const r = strip.getBoundingClientRect();
    // Near either end, the strip scrolls to show more of itself.
    if (x < r.left + 24) strip.scrollLeft -= 12;
    else if (x > r.right - 24 && x < r.right + 8) strip.scrollLeft += 12;
    const tabs = [...strip.querySelectorAll<HTMLElement>("[data-tab]")];
    if (!tabs.length) return undefined;
    let index = tabs.findIndex((t) => {
      const b = t.getBoundingClientRect();
      return x < b.left + b.width / 2;
    });
    if (index < 0) index = tabs.length;
    const at = index < tabs.length ? tabs[index].offsetLeft : tabs[tabs.length - 1].offsetLeft + tabs[tabs.length - 1].offsetWidth;
    if (source.kind === "tab") {
      const from = ws.tabs.findIndex((t) => t.id === source.tab);
      if (index === from || index === from + 1) return undefined;
      return { kind: "strip", index, x: at };
    }
    // A pane alone in its tab is a tab already.
    const t = ws.tabs.find((x) => x.id === source.tab);
    return t && t.root.kind !== "leaf" ? { kind: "strip", index, x: at } : undefined;
  }

  const area = document.querySelector<HTMLElement>("[data-pane-area]")?.getBoundingClientRect();
  const tab = ws.tabs.find((t) => t.id === ws.active);
  if (!area || !tab || x < area.left || x > area.right || y < area.top || y > area.bottom) return undefined;
  if (source.kind === "tab" && source.tab === tab.id) return undefined;
  if (source.kind === "pane" && source.tab !== tab.id) return undefined;
  const fx = (x - area.left) / area.width;
  const fy = (y - area.top) / area.height;
  const over = layout(tab.root).leaves.find(({ rect: r }) => fx >= r.x && fx <= r.x + r.w && fy >= r.y && fy <= r.y + r.h);
  if (!over || (source.kind === "pane" && over.leaf.id === source.pane)) return undefined;
  const r = over.rect;
  const side = sideAt((fx - r.x) / r.w, (fy - r.y) / r.h, source.kind === "pane");
  let rect: Rect | undefined;
  if (source.kind === "tab") {
    const src = ws.tabs.find((t) => t.id === source.tab);
    if (!src || side === "center") return undefined;
    rect = bounds(place(tab.root, over.leaf.id, side, src.root), leaves(src.root).map((l) => l.id));
  } else {
    rect = side === "center" ? bounds(swap(tab.root, source.pane, over.leaf.id), [source.pane]) : bounds(movePane(tab.root, source.pane, over.leaf.id, side), [source.pane]);
  }
  return rect && { kind: "pane", tab: tab.id, pane: over.leaf.id, side, rect, label: LABELS[side] };
}

function drop(source: DragSource, target: Target) {
  const ws = useWorkspaces.getState().spaces[source.key];
  if (!ws) return;
  if (target.kind === "strip") {
    if (source.kind === "pane") return paneToTab(source.key, source.tab, source.pane, target.index);
    const from = ws.tabs.findIndex((t) => t.id === source.tab);
    if (from >= 0) moveTab(source.key, from, target.index > from ? target.index - 1 : target.index);
    return;
  }
  if (source.kind === "pane") paneBeside(source.key, source.tab, source.pane, target.pane, target.side);
  else if (target.side !== "center") tabIntoPane(source.key, source.tab, target.tab, target.pane, target.side);
}

const pct = (n: number) => `${n * 100}%`;
const ICONS = { left: PanelLeftIcon, right: PanelRightIcon, top: PanelTopIcon, bottom: PanelBottomIcon, center: ArrowLeftRightIcon };

// DropOverlay is drawn over the pane area while dragging: where the drop
// will land, as a tinted rectangle. Its data-berth-overlay asks native
// browser panes, which sit above the page, to step aside meanwhile.
export function DropOverlay() {
  const dragging = useTabDrag((s) => !!s.source);
  const target = useTabDrag((s) => (s.target?.kind === "pane" ? s.target : undefined));
  const label = useTabDrag((s) => s.label);
  const icon = useTabDrag((s) => s.icon);
  if (!dragging) return null;
  const Icon = target ? ICONS[target.side] : undefined;
  return (
    <div data-berth-overlay="" className="pointer-events-none absolute inset-0 z-30">
      {target && Icon && (
        <div
          className="absolute flex items-center justify-center p-1 transition-[left,top,width,height] duration-100 ease-out"
          style={{ left: pct(target.rect.x), top: pct(target.rect.y), width: pct(target.rect.w), height: pct(target.rect.h) }}
        >
          <div className="flex size-full items-center justify-center rounded-lg border-2 border-info/70 bg-info/14 shadow-[inset_0_0_0_1px_var(--background)]">
            <span className="flex max-w-[calc(100%-16px)] items-center gap-1.5 rounded-md border border-info/40 bg-background/95 px-2 py-1 text-foreground text-xs shadow-sm">
              <Icon className="size-3.5 shrink-0 text-info" />
              <span className="shrink-0 font-medium">{target.label}</span>
              <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                <span aria-hidden>·</span>
                {icon}
                <span className="truncate">{label}</span>
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// StripMarker is the line between two tabs where a drop on the strip goes.
export function StripMarker() {
  const x = useTabDrag((s) => (s.target?.kind === "strip" ? s.target.x : undefined));
  if (x === undefined) return null;
  return <span aria-hidden className="pointer-events-none absolute inset-y-1.5 z-10 w-0.5 -translate-x-1/2 rounded-full bg-info" style={{ left: Math.max(1, x) }} />;
}

// DragGhost follows the pointer with what is being dragged. Over a pane the
// overlay says what will happen instead, so the ghost steps out of its way.
export function DragGhost() {
  const s = useTabDrag();
  if (!s.source || s.target?.kind === "pane") return null;
  return createPortal(
    <div
      className={cn("pointer-events-none fixed z-[1000] flex h-7 max-w-60 items-center gap-1.5 rounded-md border bg-popover px-2.5 text-popover-foreground text-xs shadow-lg/10", !s.target && "opacity-75")}
      // Near the window's right edge it hangs to the pointer's left instead.
      style={s.x > window.innerWidth - 260 ? { right: window.innerWidth - s.x + 12, top: s.y + 14 } : { left: s.x + 12, top: s.y + 14 }}
    >
      {s.icon}
      <span className="min-w-0 truncate">{s.label}</span>
    </div>,
    document.body,
  );
}
