import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import { memo, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// ChatList draws a conversation's rows in its pane's scroller, only those
// near the view (a long chat holds thousands), each measured as it draws.
// It keeps to the foot while new work arrives, unless the person has
// scrolled up to read; rows added above (older turns) leave what they read
// where it was. A row seen before draws without its entrance motion.

export interface ChatListApi {
  // Bring a row to the middle of the view.
  scrollToRow(index: number): void;
  scroller: HTMLElement | null;
  // The rows drawn now, by index.
  drawn(): { index: number; el: HTMLElement }[];
  virtualizer: Virtualizer<HTMLElement, Element>;
}

export interface ChatListProps<T> {
  rows: T[];
  rowKey(row: T): string;
  // A first guess at a row's height, until it is drawn.
  estimate(row: T): number;
  render(row: T, index: number): ReactNode;
  // Above the rows (older turns loading) and after them (queued prompts).
  header?: ReactNode;
  tail?: ReactNode;
  // Changes when the last row grows (streamed words), to keep to the foot.
  grew?: unknown;
  // Changes when the person sends something: back to the foot.
  repin?: unknown;
  // The person scrolled near the top.
  onNearTop?(): void;
  // Parts that need the list (search).
  children?(api: ChatListApi): ReactNode;
  className?: string;
}

const GAP = 16;
// Far enough up to read before older turns are fetched.
const NEAR_TOP = 900;

export function ChatList<T>({ rows, rowKey, estimate, render, header, tail, grew, repin, onNearTop, children, className }: ChatListProps<T>) {
  const root = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => setScroller(root.current?.closest<HTMLElement>(".overflow-y-auto") ?? null), []);

  // Where the rows start in the scroller: below its padding and the header.
  useLayoutEffect(() => {
    const sc = scroller;
    const el = top.current;
    if (!sc || !el) return;
    const measure = () => setMargin(Math.round(el.getBoundingClientRect().bottom - sc.getBoundingClientRect().top + sc.scrollTop));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scroller]);

  const v = useVirtualizer<HTMLElement, Element>({
    count: rows.length,
    getScrollElement: () => scroller,
    estimateSize: (i) => estimate(rows[i]),
    getItemKey: (i) => rowKey(rows[i]),
    overscan: 6,
    gap: GAP,
    scrollMargin: margin,
    // Rows added above keep the row being read in place.
    anchorTo: "end",
  });

  // Following the foot: true until the person scrolls up to read.
  const pinned = useRef(true);
  const userAt = useRef(0);
  const nearTop = useRef(onNearTop);
  nearTop.current = onNearTop;
  useEffect(() => {
    const sc = scroller;
    if (!sc) return;
    const user = () => {
      userAt.current = Date.now();
    };
    const onScroll = () => {
      const near = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 120;
      if (near) pinned.current = true;
      else if (Date.now() - userAt.current < 1000) pinned.current = false;
      if (!pinned.current && sc.scrollTop < NEAR_TOP) nearTop.current?.();
    };
    const opts = { passive: true };
    sc.addEventListener("scroll", onScroll, opts);
    for (const e of ["wheel", "touchmove", "pointerdown", "keydown"]) sc.addEventListener(e, user, opts);
    return () => {
      sc.removeEventListener("scroll", onScroll);
      for (const e of ["wheel", "touchmove", "pointerdown", "keydown"]) sc.removeEventListener(e, user);
    };
  }, [scroller]);

  // Whatever changes the height (a row measured, words streamed, a queued
  // prompt) keeps a pinned view at the foot; a fold the person just opened
  // doesn't pull the view away from it.
  useEffect(() => {
    const sc = scroller;
    const el = root.current;
    if (!sc || !el) return;
    const stick = () => {
      if (pinned.current && Date.now() - userAt.current > 600) sc.scrollTop = sc.scrollHeight;
    };
    stick();
    const ro = new ResizeObserver(stick);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scroller]);
  useLayoutEffect(() => {
    if (pinned.current && scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [scroller, rows.length, grew]);
  useLayoutEffect(() => {
    if (repin === undefined || !scroller) return;
    pinned.current = true;
    scroller.scrollTop = scroller.scrollHeight;
  }, [repin, scroller]);

  // Rows already seen draw still; only rows new since the list opened move in.
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null) seen.current = new Set(rows.map(rowKey));
  const items = v.getVirtualItems();
  useEffect(() => {
    for (const vi of items) seen.current!.add(String(vi.key));
  });

  const api: ChatListApi = {
    scrollToRow: (i) => {
      pinned.current = false;
      userAt.current = Date.now();
      v.scrollToIndex(i, { align: "center" });
    },
    scroller,
    drawn: () => {
      const out: { index: number; el: HTMLElement }[] = [];
      root.current?.querySelectorAll<HTMLElement>("[data-chat-row]").forEach((el) => out.push({ index: Number(el.dataset.index), el }));
      return out;
    },
    virtualizer: v,
  };

  return (
    <div ref={root} className={cn("flex flex-col", className)}>
      <div ref={top}>{header}</div>
      <div className="relative w-full" style={{ height: v.getTotalSize() }}>
        {items.map((vi) => {
          const key = String(vi.key);
          return (
            <div
              key={key}
              data-chat-row={key}
              data-index={vi.index}
              ref={v.measureElement}
              className={cn("absolute top-0 left-0 flex w-full flex-col gap-4", seen.current!.has(key) && "cv-still")}
              style={{ transform: `translateY(${vi.start - margin}px)` }}
            >
              <Row row={rows[vi.index]} index={vi.index} render={render as (r: unknown, i: number) => ReactNode} />
            </div>
          );
        })}
      </div>
      {tail && <div className="mt-4 flex flex-col gap-4">{tail}</div>}
      {children?.(api)}
    </div>
  );
}

// Row draws one row, again only when it or how rows draw changes: scrolling
// moves rows without drawing them anew.
const Row = memo(function Row({ row, index, render }: { row: unknown; index: number; render(row: unknown, index: number): ReactNode }) {
  return render(row, index);
});
