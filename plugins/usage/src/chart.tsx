import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";

import type { Agent } from "./box";
import { AGENT_NAME, compact } from "./data";

const paint = stylex.create({
  s0: {
    "fill": {
      "default": "light-dark(#eb6834, #d95926)",
    },
  },
  s1: {
    "backgroundColor": {
      "default": "light-dark(#eb6834, #d95926)",
    },
  },
  s2: {
    "fill": {
      "default": "light-dark(#2a78d6, #3987e5)",
    },
  },
  s3: {
    "backgroundColor": {
      "default": "light-dark(#2a78d6, #3987e5)",
    },
  },
  s4: {
    "fill": {
      "default": "light-dark(#1baf7a, #199e70)",
    },
  },
  s5: {
    "backgroundColor": {
      "default": "light-dark(#1baf7a, #199e70)",
    },
  },
  s6: {
    "fill": {
      "default": "light-dark(#eda100, #c98500)",
    },
  },
  s7: {
    "backgroundColor": {
      "default": "light-dark(#eda100, #c98500)",
    },
  },
  s8: {
    "fill": {
      "default": "light-dark(#e87ba4, #d55181)",
    },
  },
  s9: {
    "backgroundColor": {
      "default": "light-dark(#e87ba4, #d55181)",
    },
  },
  s10: {
    "fill": {
      "default": "#008300",
    },
  },
  s11: {
    "backgroundColor": {
      "default": "#008300",
    },
  },
  s12: {
    "fill": {
      "default": "light-dark(#4a3aa7, #9085e9)",
    },
  },
  s13: {
    "backgroundColor": {
      "default": "light-dark(#4a3aa7, #9085e9)",
    },
  },
  s14: {
    "fill": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },
  s15: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },
  s16: {
    "position": "relative",
  },
  s17: {
    "marginBottom": "8px",
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "12px",
    "rowGap": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s18: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s19: {
    "width": "8px",
    "height": "8px",
    "borderRadius": "2px",
  },
  s20: {
    "marginLeft": "auto",
    "fontVariantNumeric": "tabular-nums",
  },
  s21: {
    "display": "block",
    "overflow": "visible",
  },
  s22: {
    "stroke": "var(--border)",
  },
  s23: {
    "opacity": 0.5,
  },
  s24: {
    "fill": "var(--muted-foreground)",
    "fontSize": "10px",
  },
  s25: {
    "pointerEvents": "none",
    "position": "absolute",
    "top": "24px",
    "zIndex": 10,
    "minWidth": "160px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--popover)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "boxShadow": "0 4px 6px color-mix(in oklab, var(--foreground) 10%, transparent)",
  },
  s26: {
    "marginBottom": "4px",
    "fontWeight": 500,
  },
  s27: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s28: {
    "width": "8px",
    "height": "8px",
    "borderRadius": "2px",
  },
  s29: {
    "color": "var(--muted-foreground)",
  },
  s30: {
    "marginLeft": "auto",
    "paddingLeft": "12px",
    "fontVariantNumeric": "tabular-nums",
  },
  q31: {
    "fill": {
      "default": "light-dark(#eb6834, #d95926)",
    },
  },
  q32: {
    "backgroundColor": {
      "default": "light-dark(#eb6834, #d95926)",
    },
  },
  q33: {
    "fill": {
      "default": "light-dark(#2a78d6, #3987e5)",
    },
  },
  q34: {
    "backgroundColor": {
      "default": "light-dark(#2a78d6, #3987e5)",
    },
  },
  q35: {
    "fill": {
      "default": "light-dark(#1baf7a, #199e70)",
    },
  },
  q36: {
    "backgroundColor": {
      "default": "light-dark(#1baf7a, #199e70)",
    },
  },
  q37: {
    "fill": {
      "default": "light-dark(#eda100, #c98500)",
    },
  },
  q38: {
    "backgroundColor": {
      "default": "light-dark(#eda100, #c98500)",
    },
  },
  q39: {
    "fill": {
      "default": "light-dark(#e87ba4, #d55181)",
    },
  },
  q40: {
    "backgroundColor": {
      "default": "light-dark(#e87ba4, #d55181)",
    },
  },
  q41: {
    "fill": {
      "default": "#008300",
    },
  },
  q42: {
    "backgroundColor": {
      "default": "#008300",
    },
  },
  q43: {
    "fill": {
      "default": "light-dark(#4a3aa7, #9085e9)",
    },
  },
  q44: {
    "backgroundColor": {
      "default": "light-dark(#4a3aa7, #9085e9)",
    },
  },
  q45: {
    "fill": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },
  q46: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Colors follow the thing they stand for, in both themes, and were checked
// for color blindness against Burf's surfaces. Agents: Claude Code orange,
// Codex blue.
export const SERIES: Record<Agent, { fill: string; dot: string }> = {
  claude: { fill: sx(paint.q31), dot: sx(paint.q32) },
  codex: { fill: sx(paint.q33), dot: sx(paint.q34) },
};

// Boxes take the next hues, never the agents' two: aqua, yellow, magenta,
// green, violet. A sixth box and beyond fold into "Other boxes".
const BOX_HUES = [
  { fill: sx(paint.q35), dot: sx(paint.q36) },
  { fill: sx(paint.q37), dot: sx(paint.q38) },
  { fill: sx(paint.q39), dot: sx(paint.q40) },
  { fill: sx(paint.q41), dot: sx(paint.q42) },
  { fill: sx(paint.q43), dot: sx(paint.q44) },
];
const OTHER = { fill: sx(paint.q45), dot: sx(paint.q46) };
export const OTHER_BOXES = "\u0000other";

export interface Series {
  key: string;
  label: string;
  fill: string;
  dot: string;
}

export const agentSeries = (): Series[] => (["claude", "codex"] as Agent[]).map((a) => ({ key: a, label: AGENT_NAME[a], ...SERIES[a] }));

// boxColor gives a box its hue by its place among every paired box, sorted
// by name, so a box keeps its color when others go offline.
export function boxColor(box: string, allBoxes: string[]) {
  const i = [...allBoxes].sort().indexOf(box);
  return i >= 0 && i < BOX_HUES.length ? BOX_HUES[i] : OTHER;
}

// boxSeries is the chart's series for the counted boxes; boxes past the
// fifth hue share one "Other boxes" series.
export function boxSeries(counted: string[], allBoxes: string[]): Series[] {
  const sorted = [...allBoxes].sort();
  const named = counted.filter((b) => sorted.indexOf(b) < BOX_HUES.length).sort((a, b) => sorted.indexOf(a) - sorted.indexOf(b));
  const out: Series[] = named.map((b) => ({ key: b, label: b, ...boxColor(b, allBoxes) }));
  if (counted.length > named.length) out.push({ key: OTHER_BOXES, label: "Other boxes", ...OTHER });
  return out;
}

const H = 140;

function dayLabel(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

// DailyChart: tokens per day, stacked by series.
export function DailyChart({ days, byDay, series }: { days: string[]; byDay: Map<string, Map<string, number>>; series: Series[] }) {
  const [hover, setHover] = useState<number>();
  // Drawn at the figure's real width, so bars and labels keep their size.
  const ref = useRef<HTMLElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const value = (d: string, k: string) => byDay.get(d)?.get(k) ?? 0;
  const present = series.filter((s) => days.some((d) => value(d, s.key) > 0));
  const totals = days.map((d) => series.reduce((n, s) => n + value(d, s.key), 0));
  const max = Math.max(1, ...totals);
  const slot = W / days.length;
  const bar = Math.max(4, Math.min(28, slot - 6));
  const every = Math.ceil(days.length / Math.max(2, Math.floor(W / 90)));

  return (
    <figure ref={ref} className={sx(paint.s16)}>
      <div className={sx(paint.s17)}>
        {present.map((s) => (
          <span key={s.key} className={sx(paint.s18)}>
            <span className={[sx(paint.s19), s.dot].filter(Boolean).join(" ")} />
            {s.label}
          </span>
        ))}
        <span className={sx(paint.s20)}>Busiest day {compact(max)} tokens</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} width={W} height={H + 18} className={sx(paint.s21)} role="img" aria-label={`Tokens per day by ${series.map((s) => s.label).join(", ")}`} onMouseLeave={() => setHover(undefined)}>
        <line x1={0} x2={W} y1={H + 0.5} y2={H + 0.5} className={sx(paint.s22)} />
        {days.map((d, i) => {
          const x = i * slot + (slot - bar) / 2;
          const segs = series.filter((s) => value(d, s.key) > 0);
          let y = H;
          return (
            <g key={d} onMouseEnter={() => setHover(i)}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              {segs.map((s, j) => {
                const h = Math.max(2, (value(d, s.key) / max) * (H - 4));
                y -= h;
                const top = j === segs.length - 1;
                // A 2px gap of surface between stacked segments.
                return <rect key={s.key} x={x} y={y} width={bar} height={Math.max(1, h - (j > 0 ? 2 : 0))} rx={top ? Math.min(4, bar / 2) : 0} className={[s.fill, hover !== undefined && hover !== i && sx(paint.s23)].filter(Boolean).join(" ")} />;
              })}
              {(days.length - 1 - i) % every === 0 && (
                <text x={i * slot + slot / 2} y={H + 13} textAnchor="middle" className={sx(paint.s24)}>
                  {days.length === 1 ? "Today" : dayLabel(d)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== undefined && (
        <div
          className={sx(paint.s25)}
          style={{ left: `clamp(0px, calc(${((hover + 0.5) / days.length) * 100}% - 80px), calc(100% - 170px))` }}
        >
          <div className={sx(paint.s26)}>{dayLabel(days[hover])}</div>
          {present.map((s) => (
            <div key={s.key} className={sx(paint.s27)}>
              <span className={[sx(paint.s28), s.dot].filter(Boolean).join(" ")} />
              <span className={sx(paint.s29)}>{s.label}</span>
              <span className={sx(paint.s30)}>{compact(value(days[hover], s.key))}</span>
            </div>
          ))}
        </div>
      )}
    </figure>
  );
}
