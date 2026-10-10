import * as stylex from "@stylexjs/stylex";
import { ALargeSmallIcon, SquareTerminalIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { TERMINAL_SIZES, UI_SIZES, useZoomHud } from "@/lib/zoom";
import { platformKeys } from "@/lib/platform";

const paint = stylex.create({
  s0: {
    "pointerEvents": "none",
    "position": "fixed",
    "top": "64px",
    "zIndex": 70,
    "display": "flex",
    "width": "244px",
    "flexDirection": "column",
    "gap": "10px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--popover)",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--popover-foreground)",
    "boxShadow": "0 20px 25px color-mix(in oklab, var(--foreground) 16%, transparent)",
  },
  s1: {
    "opacity": 0,
    "transitionDuration": "200ms",
    "transitionTimingFunction": "cubic-bezier(0, 0, 0.2, 1)",
  },
  s2: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "13px",
    "lineHeight": "16px",
  },
  s3: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s4: {
    "fontWeight": 500,
  },
  s5: {
    "marginInlineStart": "auto",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s6: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "3px",
  },
  s7: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "alignItems": "center",
    "gap": "3px",
  },
  s8: {
    "height": "6px",
    "width": "100%",
    "borderRadius": "999px",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  s9: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s10: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 12%, transparent)",
  },
  s11: {
    "width": "3px",
    "height": "3px",
    "borderRadius": "999px",
  },
  s12: {
    "backgroundColor": "var(--muted-foreground)",
  },
  s13: {
    "backgroundColor": "transparent",
  },
  s14: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "space-between",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "lineHeight": "14px",
  },
  s15: {
    "fontFamily": "var(--font-sans)",
  },

  s16: {
    left: "50%",
    translate: "-50%",
  },
  s17: {
    transitionProperty: "opacity, translate",
    opacity: { "[data-shown]": 1 },
    translate: { default: "0px -4px", "[data-shown]": "0px 0px" },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// ZoomHud shows the text size for a moment after ⌘+, ⌘− or ⌘0 (lib/zoom.ts):
// what changed, its size, and where that sits in the range. It is sized in
// px, not rem, so it holds still while everything behind it grows.

const SHOW_MS = 1100;

export function ZoomHud() {
  const { target, size, at } = useZoomHud();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!at) return;
    setShown(true);
    const t = window.setTimeout(() => setShown(false), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [at]);
  if (!target || size === undefined) return null;
  const range = target === "terminal" ? TERMINAL_SIZES : UI_SIZES;
  const Icon = target === "terminal" ? SquareTerminalIcon : ALargeSmallIcon;
  const steps = range.max - range.min + 1;
  const edge = size === range.max ? "Largest" : size === range.min ? "Smallest" : size === range.default ? "Default" : undefined;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="zoom-hud"
      data-shown={shown || undefined}
      className={[[sx(paint.s0), sx(paint.s16)].filter(Boolean).join(" "), [sx(paint.s1), sx(paint.s17)].filter(Boolean).join(" ")].filter(Boolean).join(" ")}
    >
      <div className={sx(paint.s2)}>
        <Icon className={sx(paint.s3)} />
        <span className={sx(paint.s4)}>{target === "terminal" ? "Terminal text" : "Text size"}</span>
        <span className={sx(paint.s5)}>{size}px</span>
      </div>
      {/* One notch a step; the dot under one marks the default. */}
      <div className={sx(paint.s6)} aria-hidden>
        {Array.from({ length: steps }, (_, i) => {
          const n = range.min + i;
          return (
            <span key={n} className={sx(paint.s7)}>
              <span className={[sx(paint.s8), n <= size ? sx(paint.s9) : sx(paint.s10)].filter(Boolean).join(" ")} />
              <span className={[sx(paint.s11), n === range.default ? sx(paint.s12) : sx(paint.s13)].filter(Boolean).join(" ")} />
            </span>
          );
        })}
      </div>
      <div className={sx(paint.s14)}>
        <span>{edge ?? `${size > range.default ? "+" : "−"}${Math.abs(size - range.default)} from default`}</span>
        <span>
          <kbd className={sx(paint.s15)}>{platformKeys("⌘0")}</kbd> resets
        </span>
      </div>
    </div>
  );
}
