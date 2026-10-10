import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";

const paint = stylex.create({
  s0: {
    "pointerEvents": "none",
    "position": "relative",
    "width": "100%",
    "overflow": "hidden",
  },
  s1: {
    "position": "absolute",
    "top": "0px",
    "left": "0px",
  },

  s2: {
    transformOrigin: "top left",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Thumb draws its children at a fixed width and scales them into the
// space it has: a chart, a table or a diagram as a small picture of
// itself. Not interactive.
export function Thumb({ h, width = 720, children }: { h: number; width?: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Drawn at least at width, wider when there is room: never scaled up.
  const W = Math.max(width, w);
  const k = (w || 240) / W;
  return (
    <div ref={ref} className={sx(paint.s0)} style={{ height: h }} aria-hidden>
      {w > 0 && (
        <div className={[sx(paint.s1), sx(paint.s2)].filter(Boolean).join(" ")} style={{ width: W, height: h / k, transform: `scale(${k})` }}>
          {children}
        </div>
      )}
    </div>
  );
}
