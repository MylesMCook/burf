import * as stylex from "@stylexjs/stylex";
import { useEffect, useState } from "react";

import "@/components/conversation/conversation.css";
import "@/components/pixel-loader.css";

const paint = stylex.create({
  s0: {
    "display": "inline-flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "10px",
    "color": "var(--muted-foreground)",
  },
  s1: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s2: {
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "0.92em",
    "fontVariantNumeric": "tabular-nums",
    "opacity": 0.8,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// PixelLoader is Burf's wait: a 3×3 grid of pixels with a chevron of light
// driving across it, in the dithered harbour's grain, beside what is
// happening ("Reading the conversation…") and, once it has taken a moment,
// how long it has taken. The grid is in the text's own colour, so it sits
// in any theme and at any size; it holds still for people who ask for less
// motion (the clock still counts).
//
// The grid and its timing follow Beautiful UI's Loading State
// (beautifului.dev, MIT, © 2026 Shane Levine): see THIRD_PARTY_NOTICES.md.

// Each cell's delay: its column plus its distance from the middle row, so
// the lit cells form a ">" moving right. The cycle is shorter than a sweep,
// so two fronts are always in flight.
const DELAYS = Array.from({ length: 9 }, (_, i) => ((i % 3) + Math.abs(Math.floor(i / 3) - 1)) * 90);

export function PixelGrid({ className }: { className?: string }) {
  return (
    <span aria-hidden className={["px-grid", className].filter(Boolean).join(" ")}>
      {DELAYS.map((d, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: nine fixed cells.
        <i key={i} style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

// elapsed reads a wait the way the agent's own line does: "4s", "1m 05s".
export function elapsedWords(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

// PixelLoader is the grid with its words. The time shows from the second
// second on: a wait that ends at once needn't count.
export function PixelLoader({ label, since, className }: { label: string; since?: number; className?: string }) {
  const [start] = useState(() => since ?? Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const ms = now - start;
  return (
    <span role="status" className={[sx(paint.s0), className].filter(Boolean).join(" ")}>
      <PixelGrid />
      <span className={[sx(paint.s1), "cv-shimmer"].filter(Boolean).join(" ")}>{label}</span>
      {ms >= 2000 && <span className={sx(paint.s2)}>{elapsedWords(ms)}</span>}
    </span>
  );
}
