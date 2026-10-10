import * as stylex from "@stylexjs/stylex";
import { CheckIcon, GripVerticalIcon, LayoutGridIcon, MoveDiagonal2Icon, PlusIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { add, columnsFor, LAYOUT_VERSION, move, moveToward, type Placed, readLayout, remove, resize, SIZE_ORDER, SIZES, snapSize, stepSize, type WidgetSize } from "@/lib/home-layout";
import { setPrefs, usePrefs } from "@/lib/prefs";
import { scrollBehavior } from "@/lib/motion";
import { usePluginsLoading } from "@/plugins/registry";

import { useOnScreen, WidgetBoundary, WidgetHeading, WidgetMenu } from "./card";
import { GAP, HomeWidgetProvider, ROW } from "./env";
import { AddWidgetDialog } from "./picker";
import { sizeFor, useWidgets, type WidgetDef } from "./registry";

const paint = stylex.create({
  s0: {
    "gridColumn": "span 1 / span 1",
  },
  s1: {
    "gridColumn": "span 2 / span 2",
  },
  s2: {
    "gridColumn": "span 1 / span 1",
  },
  s3: {
    "gridColumn": "span 2 / span 2",
  },
  s4: {
    "gridColumn": "span 4 / span 4",
  },
  s5: {
    "width": "100%",
  },
  s6: {
    "marginBottom": "10px",
    "display": "flex",
    "minHeight": "32px",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "8px",
    "rowGap": "6px",
  },
  s7: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s8: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s9: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s10: {
    "fontFamily": "var(--font-mono)",
  },
  s11: {
    "fontFamily": "var(--font-mono)",
  },
  s12: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s13: {
    "display": "grid",
    "gridTemplateColumns": "repeat(4, minmax(0, 1fr))",
  },
  s14: {
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "var(--border)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "14px",
    "lineHeight": "20px",
    "outline": "none",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s15: {
    "width": "16px",
    "height": "16px",
  },
  s16: {
    "position": "absolute",
    "width": "1px",
    "height": "1px",
    "padding": 0,
    "margin": "-1px",
    "overflow": "hidden",
    "clip": "rect(0,0,0,0)",
    "whiteSpace": "nowrap",
    "borderWidth": 0,
  },
  s17: {
    "position": "relative",
    "minHeight": "0px",
    "minWidth": "0px",
  },
  s18: {
    "position": "relative",
    "width": "100%",
    "height": "100%",
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s19: {
    "position": "absolute",
    "top": "6px",
    "right": "6px",
    "zIndex": 10,
    "backgroundColor": "color-mix(in oklab, var(--background) 80%, transparent)",
  },
  s20: {
    "position": "relative",
    "display": "flex",
    "width": "100%",
    "height": "100%",
    "minHeight": "0px",
    "flexDirection": "column",
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    "color": "var(--card-foreground)",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s21: {
    "borderStyle": "dashed",
  },
  s22: {
    "opacity": 0.4,
    "boxShadow": "0 0 0 2px var(--ring)",
  },
  s23: {
    "display": "flex",
    "height": "36px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "paddingRight": "6px",
    "paddingLeft": "4px",
  },
  s24: {
    "display": "flex",
    "height": "28px",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "cursor": {
      "default": "grab",
      ":active": "grabbing",
    },
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "textAlign": "left",
    "outline": "none",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s25: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s26: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s27: {
    "display": "flex",
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
  s28: {
    "width": "14px",
    "height": "14px",
  },
  s29: {
    "position": "relative",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "paddingBottom": "6px",
  },
  s30: {
    "pointerEvents": "none",
    "userSelect": "none",
  },
  s31: {
    "marginLeft": "6px",
    "marginRight": "6px",
    "marginBottom": "6px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "0px",
    "paddingRight": "0px",
    "paddingBottom": "0px",
  },
  s32: {
    "position": "absolute",
    "right": "4px",
    "bottom": "4px",
    "zIndex": 10,
    "display": "flex",
    "width": "20px",
    "height": "20px",
    "cursor": "se-resize",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--popover)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s33: {
    "width": "12px",
    "height": "12px",
  },
  s34: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "padding": "2px",
  },
  s35: {
    "height": "20px",
    "minWidth": "24px",
    "borderRadius": "5px",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
    "fontVariantNumeric": "tabular-nums",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s36: {
    "backgroundColor": "var(--foreground)",
    "color": "var(--background)",
  },
  s37: {
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s38: {
    "position": "relative",
    "minHeight": "0px",
    "minWidth": "0px",
  },
  s39: {
    "display": "flex",
    "width": "100%",
    "height": "100%",
    "flexDirection": "column",
    "gap": "12px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    "padding": "12px",
  },
  s40: {
    "height": "14px",
    "width": "112px",
  },
  s41: {
    "height": "12px",
  },
  s42: {
    "height": "12px",
  },
  s43: {
    "position": "relative",
    "minHeight": "0px",
    "minWidth": "0px",
  },
  s44: {
    "display": "flex",
    "width": "100%",
    "height": "100%",
    "flexDirection": "column",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "var(--border)",
    "padding": "12px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s45: {
    "fontWeight": 500,
    "color": "var(--foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s46: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
  },
  s47: {
    "textWrap": "balance",
  },
  s48: {
    "marginTop": "4px",
  },
  s49: {
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "var(--border)",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "48px",
    "paddingBottom": "48px",
    "textAlign": "center",
  },
  s50: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s51: {
    "marginTop": "8px",
    "display": "flex",
    "gap": "8px",
  },

  s52: {
    containerType: "inline-size",
  },
  s53: {
    gridAutoFlow: "row dense",
    "@container (max-width: 480px)": {
      gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    },
    "@container (max-width: 800px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
  },
  s54: {
    backdropFilter: "blur(4px)",
  },
  s55: {
    touchAction: "none",
  },
  s56: {
    "@container (max-width: 200px)": {
      display: "none",
    },
  },
  s57: {
    width: "75%",
  },
  s58: {
    width: "50%",
  },
  s59: {
    gridColumn: "span 1 / span 1",
    gridRow: "span 1 / span 1",
  },
  s60: {
    gridColumn: "span 2 / span 2",
    gridRow: "span 1 / span 1",
    "@container (max-width: 480px)": {
      gridColumn: "span 1 / span 1",
    },
  },
  s61: {
    gridColumn: "span 1 / span 1",
    gridRow: "span 2 / span 2",
  },
  s62: {
    gridColumn: "span 2 / span 2",
    gridRow: "span 2 / span 2",
    "@container (max-width: 480px)": {
      gridColumn: "span 1 / span 1",
    },
  },
  s63: {
    gridColumn: "span 4 / span 4",
    gridRow: "span 1 / span 1",
    "@container (max-width: 800px)": {
      gridColumn: "span 2 / span 2",
    },
    "@container (max-width: 480px)": {
      gridColumn: "span 1 / span 1",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Home's grid of widgets, under the composer. Four columns, two in a
// narrower window and one in a narrow one (container queries, so the
// first paint is already right). The layout is the person's (Prefs.home,
// lib/home-layout.ts), read before the first paint, and every cell's size
// is fixed by its widget's size, so nothing moves while widgets load.
//
// Customize turns each card's heading into a handle: drag it to move the
// widget, or focus it and use the arrow keys; [ and ] change its size,
// Delete removes it, Escape leaves. The corner resizes it with a pointer.

// Each size's cells, as Tailwind classes (written out so they're built).
const SPAN: Record<WidgetSize, string> = {
  s: (sx(paint.s59) ?? ""),
  m: (sx(paint.s60) ?? ""),
  t: (sx(paint.s61) ?? ""),
  l: (sx(paint.s62) ?? ""),
  w: (sx(paint.s63) ?? ""),
};

type Dir = "left" | "right" | "up" | "down";
const ARROWS: Record<string, Dir> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };

export function HomeGrid({ className }: { className?: string }) {
  const saved = usePrefs((p) => p.home);
  const items = useMemo(() => readLayout(saved).items, [saved]);
  const latest = useRef(items);
  latest.current = items;
  const setItems = useCallback((next: Placed[]) => setPrefs({ home: { version: LAYOUT_VERSION, items: next } }), []);

  const defs = useWidgets();
  const byId = useMemo(() => new Map(defs.map((d) => [d.id, d])), [defs]);
  const pluginsLoading = usePluginsLoading();
  const [edit, setEdit] = useState(false);
  const [picker, setPicker] = useState(false);
  const [drag, setDrag] = useState<string>();
  const [refresh, setRefresh] = useState<Record<string, number>>({});
  const [said, say] = useState("");

  // Columns as drawn, for the keyboard's up and down and each body's span.
  const wrap = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const read = () => setCols(columnsFor(el.clientWidth));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A plugin's widget keeps its place while plugins load; once they have,
  // one whose plugin is off is kept in the layout but drawn only in
  // Customize, to be removed.
  const pending = (id: string) => !byId.has(id) && pluginsLoading && id.includes("/");
  const drawn = items.filter((p) => byId.has(p.id) || pending(p.id) || edit);
  const drawable = items.filter((p) => byId.has(p.id));

  const handles = useRef(new Map<string, HTMLElement>());
  const focusHandle = (id: string | undefined) => requestAnimationFrame(() => id && handles.current.get(id)?.focus());
  const titleOf = (id: string) => byId.get(id)?.title ?? "Widget";
  const position = (list: Placed[], id: string) => `${list.findIndex((p) => p.id === id) + 1} of ${list.length}`;

  const onKey = (id: string, e: KeyboardEvent) => {
    const now = latest.current;
    const p = now.find((x) => x.id === id);
    if (!p) return;
    const def = byId.get(id);
    const dir = ARROWS[e.key];
    if (dir) {
      e.preventDefault();
      const next = moveToward(now, id, dir, cols);
      setItems(next);
      say(`${titleOf(id)}, ${position(next, id)}`);
      focusHandle(id);
    } else if ((e.key === "[" || e.key === "]" || e.key === "-" || e.key === "=" || e.key === "+") && def) {
      e.preventDefault();
      const size = stepSize(def.sizes, sizeFor(def, p.size), e.key === "[" || e.key === "-" ? -1 : 1);
      setItems(resize(now, id, size));
      say(`${titleOf(id)}, ${SIZES[size].label.toLowerCase()}, ${SIZES[size].c} by ${SIZES[size].r}`);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const i = now.findIndex((x) => x.id === id);
      const next = remove(now, id);
      setItems(next);
      say(`${titleOf(id)} removed`);
      focusHandle(next[Math.min(i, next.length - 1)]?.id);
    }
  };

  // Dragging a heading moves its widget into the place of whichever one
  // the pointer is over; Escape puts everything back.
  const dragging = useRef<{ id: string; x: number; y: number; from: Placed[]; over?: string; moved: boolean }>(undefined);
  const onPointerDown = (id: string, e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    dragging.current = { id, x: e.clientX, y: e.clientY, from: latest.current, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragging.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
    if (!d.moved) {
      d.moved = true;
      setDrag(d.id);
    }
    const over = (document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-widget]") as HTMLElement | null)?.dataset.widget;
    if (!over || over === d.id || over === d.over) return;
    d.over = over;
    setItems(move(latest.current, d.id, over));
  };
  const endDrag = () => {
    const d = dragging.current;
    dragging.current = undefined;
    setDrag(undefined);
    if (d?.moved) say(`${titleOf(d.id)}, ${position(latest.current, d.id)}`);
  };
  useEffect(() => {
    if (!drag) return;
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || !dragging.current) return;
      e.stopPropagation();
      setItems(dragging.current.from);
      dragging.current = undefined;
      setDrag(undefined);
    };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, [drag, setItems]);

  // Escape leaves Customize (unless a menu or dialog has it).
  useEffect(() => {
    if (!edit || picker) return;
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector("[data-slot=menu-popup]")) setEdit(false);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [edit, picker]);

  const reset = () => {
    setPrefs({ home: null });
    say("Home is back to the default widgets");
  };

  return (
    <section aria-label="Your widgets" data-testid="home-grid" data-editing={edit || undefined} className={[sx(paint.s5), className].filter(Boolean).join(" ")}>
      <div className={sx(paint.s6)}>
        {edit ? (
          <>
            <div className={sx(paint.s7)}>
              <h2 className={sx(paint.s8)}>Customize Home</h2>
              <p id="home-grid-hint" className={sx(paint.s9)}>
                Drag a heading to move a widget, or focus it and use the arrow keys. <kbd className={sx(paint.s10)}>[</kbd> <kbd className={sx(paint.s11)}>]</kbd> resize, Delete removes. Saved as you go.
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={reset}>
              <RotateCcwIcon />
              Reset
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPicker(true)}>
              <PlusIcon />
              Add widget
            </Button>
            <Button size="sm" onClick={() => setEdit(false)}>
              <CheckIcon />
              Done
            </Button>
          </>
        ) : (
          <>
            <span className={sx(paint.s12)} />
            <Button size="sm" variant="ghost"  onClick={() => setEdit(true)} data-testid="home-customize" muted>
              <LayoutGridIcon />
              Customize
            </Button>
          </>
        )}
      </div>
      <div ref={wrap} className={sx(paint.s52)}>
        {drawn.length === 0 ? (
          <EmptyGrid onAdd={() => setPicker(true)} onReset={reset} />
        ) : (
          <div role="list" aria-label="Home widgets" className={[sx(paint.s13), sx(paint.s53)].filter(Boolean).join(" ")} style={{ gridAutoRows: ROW, gap: GAP }}>
            {drawn.map((p) => {
              const def = byId.get(p.id);
              if (!def)
                return pending(p.id) ? <PendingCell key={p.id} p={p} /> : <OffCell key={p.id} p={p} onRemove={() => setItems(remove(latest.current, p.id))} />;
              return (
                <Cell
                  key={p.id}
                  def={def}
                  size={sizeFor(def, p.size)}
                  cols={cols}
                  edit={edit}
                  dragging={drag === p.id}
                  refresh={refresh[p.id] ?? 0}
                  handleRef={(el) => (el ? handles.current.set(p.id, el) : handles.current.delete(p.id))}
                  onKeyDown={(e) => onKey(p.id, e)}
                  onPointerDown={(e) => onPointerDown(p.id, e)}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onSize={(s) => {
                    setItems(resize(latest.current, p.id, s));
                    say(`${def.title}, ${SIZES[s].label.toLowerCase()}`);
                  }}
                  onRemove={() => {
                    setItems(remove(latest.current, p.id));
                    say(`${def.title} removed`);
                  }}
                  onRefresh={() => setRefresh((r) => ({ ...r, [p.id]: (r[p.id] ?? 0) + 1 }))}
                  onCustomize={() => setEdit(true)}
                />
              );
            })}
            {edit && (
              <button
                type="button"
                onClick={() => setPicker(true)}
                className={sx(paint.s14)}
              >
                <PlusIcon className={sx(paint.s15)} />
                Add widget
              </button>
            )}
          </div>
        )}
      </div>
      <p className={sx(paint.s16)} aria-live="polite">
        {said}
      </p>
      <AddWidgetDialog
        open={picker}
        onOpenChange={setPicker}
        defs={defs}
        have={drawable.map((p) => p.id)}
        onAdd={(id, size) => {
          setItems(add(latest.current, id, size));
          setPicker(false);
          say(`${titleOf(id)} added`);
          // Show where it went.
          requestAnimationFrame(() => document.querySelector(`[data-widget="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() }));
        }}
      />
    </section>
  );
}

interface CellProps {
  def: WidgetDef;
  size: WidgetSize;
  cols: number;
  edit: boolean;
  dragging: boolean;
  refresh: number;
  handleRef(el: HTMLElement | null): void;
  onKeyDown(e: KeyboardEvent): void;
  onPointerDown(e: ReactPointerEvent<HTMLElement>): void;
  onPointerMove(e: ReactPointerEvent<HTMLElement>): void;
  onPointerUp(): void;
  onSize(s: WidgetSize): void;
  onRemove(): void;
  onRefresh(): void;
  onCustomize(): void;
}

function Cell({ def, size, cols, edit, dragging, refresh, handleRef, onKeyDown, onPointerDown, onPointerMove, onPointerUp, onSize, onRemove, onRefresh, onCustomize }: CellProps) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const onScreen = useOnScreen(el);
  const headingId = `w-${def.id.replace(/[^a-z0-9-]/gi, "-")}`;
  const Body = def.Component;
  const body = (
    <WidgetBoundary title={def.title}>
      <Body />
    </WidgetBoundary>
  );
  const content = def.wrap ? def.wrap(body) : body;

  // The corner snaps to the nearest size this widget takes.
  const startResize = (e: ReactPointerEvent) => {
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const r = el.getBoundingClientRect();
    const sp = SIZES[size];
    const col = (r.width + GAP) / Math.min(sp.c, cols);
    let current = size;
    const onMove = (m: PointerEvent) => {
      const c = Math.max(1, Math.min(cols, Math.round((m.clientX - r.left + GAP) / col)));
      const rr = Math.max(1, Math.round((m.clientY - r.top + GAP) / (ROW + GAP)));
      const best = snapSize(def.sizes, c, rr, current);
      if (best !== current) {
        current = best;
        onSize(best);
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", up);
  };

  return (
    <div ref={setEl} role="listitem" data-widget={def.id} data-size={size} className={[sx(paint.s17), SPAN[size]].filter(Boolean).join(" ")}>
      <HomeWidgetProvider size={size} cols={cols} visible={onScreen} refresh={refresh} bare={def.bare && !edit}>
      {def.bare && !edit ? (
        <section aria-label={def.title} className={[sx(paint.s18), "group/w"].filter(Boolean).join(" ")}>
          {content}
          <WidgetMenu def={def} size={size} onSize={onSize} onRefresh={onRefresh} onRemove={onRemove} onCustomize={onCustomize} className={[sx(paint.s19), sx(paint.s54)].filter(Boolean).join(" ")} />
        </section>
      ) : (
        <section
          aria-labelledby={headingId}
          className={[[sx(paint.s20), "group/w"].filter(Boolean).join(" "), edit && sx(paint.s21), dragging && sx(paint.s22)].filter(Boolean).join(" ")}
        >
          {edit ? (
            <div className={sx(paint.s23)}>
              <button
                ref={handleRef}
                type="button"
                aria-label={`Move ${def.title}`}
                aria-describedby="home-grid-hint"
                aria-roledescription="movable widget"
                data-testid="widget-handle"
                onKeyDown={onKeyDown}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className={[sx(paint.s24), sx(paint.s55)].filter(Boolean).join(" ")}
              >
                <GripVerticalIcon className={sx(paint.s25)} />
                <span id={headingId} className={sx(paint.s26)}>
                  {def.title}
                </span>
              </button>
              <SizeChips def={def} size={size} onSize={onSize} />
              <Tip label={`Remove ${def.title}`}>
                <button
                  type="button"
                  aria-label={`Remove ${def.title}`}
                  onClick={onRemove}
                  className={sx(paint.s27)}
                >
                  <XIcon className={sx(paint.s28)} />
                </button>
              </Tip>
            </div>
          ) : (
            <WidgetHeading def={def} id={headingId} actions={<WidgetMenu def={def} size={size} onSize={onSize} onRefresh={onRefresh} onRemove={onRemove} onCustomize={onCustomize} />} />
          )}
          <div className={[[sx(paint.s29), sx(paint.s52)].filter(Boolean).join(" "), edit && sx(paint.s30), def.bare && edit && sx(paint.s31)].filter(Boolean).join(" ")} inert={edit || undefined}>
            {content}
          </div>
          {edit && def.sizes.length > 1 && (
            <span
              aria-hidden
              onPointerDown={startResize}
              className={[sx(paint.s32), sx(paint.s55)].filter(Boolean).join(" ")}
            >
              <MoveDiagonal2Icon className={sx(paint.s33)} />
            </span>
          )}
        </section>
      )}
      </HomeWidgetProvider>
    </div>
  );
}

function SizeChips({ def, size, onSize }: { def: WidgetDef; size: WidgetSize; onSize(s: WidgetSize): void }) {
  if (def.sizes.length < 2) return null;
  return (
    <div role="group" aria-label={`${def.title} size`} className={[sx(paint.s34), sx(paint.s56)].filter(Boolean).join(" ")}>
      {SIZE_ORDER.filter((s) => def.sizes.includes(s)).map((s) => (
        <Tip key={s} label={`${SIZES[s].label}, ${SIZES[s].c}×${SIZES[s].r}`}>
          <button
            type="button"
            aria-pressed={s === size}
            aria-label={`${SIZES[s].label}, ${SIZES[s].c} by ${SIZES[s].r}`}
            onClick={() => onSize(s)}
            className={[sx(paint.s35), s === size ? sx(paint.s36) : sx(paint.s37)].filter(Boolean).join(" ")}
          >
            {s.toUpperCase()}
          </button>
        </Tip>
      ))}
    </div>
  );
}

// A plugin's widget while plugins load: its cell, so nothing moves.
function PendingCell({ p }: { p: Placed }) {
  return (
    <div role="listitem" data-widget={p.id} className={[sx(paint.s38), SPAN[p.size] ?? SPAN.m].filter(Boolean).join(" ")}>
      <div className={sx(paint.s39)} role="status" aria-busy="true" aria-label="Loading">
        <div className={sx(paint.s40)}><Skeleton  /></div>
        <div className={[sx(paint.s41), sx(paint.s57)].filter(Boolean).join(" ")}><Skeleton  /></div>
        <div className={[sx(paint.s42), sx(paint.s58)].filter(Boolean).join(" ")}><Skeleton  /></div>
      </div>
    </div>
  );
}

// A widget whose plugin is off, in Customize: it comes back when the
// plugin does, or can be removed.
function OffCell({ p, onRemove }: { p: Placed; onRemove(): void }) {
  const plugin = p.id.includes("/") ? p.id.split("/")[0] : undefined;
  return (
    <div role="listitem" data-widget={p.id} className={[sx(paint.s43), SPAN[p.size] ?? SPAN.m].filter(Boolean).join(" ")}>
      <div className={sx(paint.s44)}>
        <p className={sx(paint.s45)}>{plugin ? "Its plugin is off" : "Not available"}</p>
        <p className={sx(paint.s46)}>{p.id}</p>
        <p className={sx(paint.s47)}>{plugin ? `Turn ${plugin} on in Settings → Plugins and it comes back here.` : "This version of Burf has no such widget."}</p>
        <span className={sx(paint.s48)}><Button size="xs" variant="outline"  onClick={onRemove}>
          Remove
        </Button></span>
      </div>
    </div>
  );
}

function EmptyGrid({ onAdd, onReset }: { onAdd(): void; onReset(): void }) {
  return (
    <div className={sx(paint.s49)}>
      <h3 className={sx(paint.s50)}>No widgets on Home</h3>
      <div className={sx(paint.s51)}>
        <Button size="sm" onClick={onAdd}>
          <PlusIcon />
          Add a widget
        </Button>
        <Button size="sm" variant="outline" onClick={onReset}>
          <RotateCcwIcon />
          Restore the default
        </Button>
      </div>
    </div>
  );
}

