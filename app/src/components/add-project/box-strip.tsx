import * as stylex from "@stylexjs/stylex";
import { useRef } from "react";

import { boxLoad } from "@/components/sidebar/box-load";
import type { BoxStatus } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Tip } from "@/components/tip";

const paint = stylex.create({
  s0: {
    "marginLeft": "calc(4px * -1)",
    "marginRight": "calc(4px * -1)",
    "display": "flex",
    "gap": "8px",
    "overflowX": "auto",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "scrollbarWidth": "none",
  },
  s1: {
    "position": "relative",
    "display": "flex",
    "height": "52px",
    "minWidth": "0px",
    "flexShrink": 0,
    "flexDirection": "column",
    "justifyContent": "center",
    "gap": "2px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "textAlign": "left",
    "outline": "none",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px color-mix(in oklab, var(--ring) 40%, transparent)",
    },
  },
  s2: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s3: {
    "width": "160px",
  },
  s4: {
    "borderColor": "color-mix(in oklab, var(--foreground) 20%, transparent)",
    "backgroundColor": {
      "default": "light-dark(color-mix(in oklab, var(--accent) 72%, transparent), color-mix(in oklab, var(--input) 64%, transparent))",
    },
  },
  s5: {
    "borderColor": "color-mix(in oklab, var(--border) 80%, transparent)",
    "backgroundColor": {
      ":hover": "light-dark(color-mix(in oklab, var(--accent) 40%, transparent), color-mix(in oklab, var(--input) 32%, transparent))",
    },
  },
  s6: {
    "borderStyle": "dashed",
    "opacity": 0.64,
    "cursor": {
      ":disabled": "not-allowed",
    },
  },
  s7: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
  },
  s8: {
    "width": "8px",
    "height": "8px",
    "flexShrink": 0,
    "borderRadius": "999px",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  s9: {
    "backgroundColor": "var(--foreground)",
  },
  s10: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s11: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "paddingInlineStart": "16px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  n0: {
    "width": "8px",
    "height": "8px",
    "flexShrink": 0,
    "borderRadius": "999px",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  n1: {
    "backgroundColor": "var(--foreground)",
  },
  n2: {
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--muted-foreground) 48%, transparent)",
  },
  n3: {
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "color-mix(in oklab, var(--muted-foreground) 48%, transparent)",
  },

  s12: {
    flexBasis: 0,
  },
  s13: {
    display: "flex",
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// BoxStrip is where the project will live: every box, how it is doing, and
// how many projects it has. The chosen one carries the logo's amber dot.
// Arrow keys move between online boxes.
export function BoxStrip({ boxes, value, onChange }: { boxes: BoxStatus[]; value: string; onChange(box: string): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const online = boxes.filter((b) => b.state === "online");
  const many = boxes.length > 3;

  const move = (d: number) => {
    if (!online.length) return;
    const i = online.findIndex((b) => b.name === value);
    const next = online[(i + d + online.length) % online.length].name;
    onChange(next);
    ref.current?.querySelector<HTMLButtonElement>(`[data-box="${CSS.escape(next)}"]`)?.focus();
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="Box"
      className={sx(paint.s0)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {boxes.map((b) => (
        <Tile key={b.name} box={b} selected={b.name === value} wide={!many} onSelect={() => onChange(b.name)} />
      ))}
    </div>
  );
}

function Tile({ box, selected, wide, onSelect }: { box: BoxStatus; selected: boolean; wide: boolean; onSelect(): void }) {
  const projects = useStore((s) => s.boxes[box.name]?.locations?.length);
  const online = box.state === "online";
  const load = online ? boxLoad(box.name) : "";
  const facts = online ? [box.latency_ms !== undefined ? `${box.latency_ms}ms` : "", projects !== undefined ? `${projects} ${projects === 1 ? "project" : "projects"}` : ""].filter(Boolean).join(" · ") : box.state;
  const tile = (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-box={box.name}
      tabIndex={selected ? 0 : -1}
      disabled={!online && !selected}
      onClick={onSelect}
      className={[[sx(paint.s1), "group"].filter(Boolean).join(" "), wide ? [sx(paint.s2), sx(paint.s12)].filter(Boolean).join(" ") : sx(paint.s3), selected ? sx(paint.s4) : sx(paint.s5), !online && sx(paint.s6)].filter(Boolean).join(" ")}
    >
      <span className={sx(paint.s7)}>
        <span
          aria-hidden
          className={[sx(paint.n0), selected && online ? sx(paint.n1) : online ? sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")}
        />
        <span className={sx(paint.s10)}>{box.name}</span>
      </span>
      <span className={sx(paint.s11)}>{facts}</span>
    </button>
  );
  return load ? <Tip label={load} wrapClassName={wide ? sx(paint.s13) : undefined}>{tile}</Tip> : tile;
}
