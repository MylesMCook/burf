import { cn } from "@berth/plugin/ui";
import { useEffect, useRef, useState } from "react";

import type { Agent } from "./box";
import { AGENT_NAME, compact } from "./data";

// Tokens per day, stacked by agent. Colors follow the agent: Claude Code
// orange, Codex blue, validated for both themes and color blindness against
// Berth's surfaces.
export const SERIES: Record<Agent, { fill: string; dot: string }> = {
  claude: { fill: "fill-[#eb6834] dark:fill-[#d95926]", dot: "bg-[#eb6834] dark:bg-[#d95926]" },
  codex: { fill: "fill-[#2a78d6] dark:fill-[#3987e5]", dot: "bg-[#2a78d6] dark:bg-[#3987e5]" },
};
const ORDER: Agent[] = ["claude", "codex"];

const H = 140;

function dayLabel(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function DailyChart({ days, byDay }: { days: string[]; byDay: Map<string, Map<Agent, number>> }) {
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
  const value = (d: string, a: Agent) => byDay.get(d)?.get(a) ?? 0;
  const present = ORDER.filter((a) => days.some((d) => value(d, a) > 0));
  const totals = days.map((d) => ORDER.reduce((n, a) => n + value(d, a), 0));
  const max = Math.max(1, ...totals);
  const slot = W / days.length;
  const bar = Math.max(4, Math.min(28, slot - 6));
  const every = Math.ceil(days.length / Math.max(2, Math.floor(W / 90)));

  return (
    <figure ref={ref} className="relative">
      <div className="mb-2 flex items-center gap-3 text-muted-foreground text-xs">
        {present.map((a) => (
          <span key={a} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-[2px]", SERIES[a].dot)} />
            {AGENT_NAME[a]}
          </span>
        ))}
        <span className="ml-auto tabular-nums">Busiest day {compact(max)} tokens</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} width={W} height={H + 18} className="block overflow-visible" role="img" aria-label="Tokens per day by agent" onMouseLeave={() => setHover(undefined)}>
        <line x1={0} x2={W} y1={H + 0.5} y2={H + 0.5} className="stroke-border" />
        {days.map((d, i) => {
          const x = i * slot + (slot - bar) / 2;
          const segs = ORDER.filter((a) => value(d, a) > 0);
          let y = H;
          return (
            <g key={d} onMouseEnter={() => setHover(i)}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              {segs.map((a, j) => {
                const h = Math.max(2, (value(d, a) / max) * (H - 4));
                y -= h;
                const top = j === segs.length - 1;
                // A 2px gap of surface between stacked segments.
                return <rect key={a} x={x} y={y} width={bar} height={Math.max(1, h - (j > 0 ? 2 : 0))} rx={top ? Math.min(4, bar / 2) : 0} className={cn(SERIES[a].fill, hover !== undefined && hover !== i && "opacity-50")} />;
              })}
              {(days.length - 1 - i) % every === 0 && (
                <text x={i * slot + slot / 2} y={H + 13} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {days.length === 1 ? "Today" : dayLabel(d)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== undefined && (
        <div
          className="pointer-events-none absolute top-6 z-10 min-w-40 rounded-md border bg-popover px-2.5 py-2 text-xs shadow-md"
          style={{ left: `clamp(0px, calc(${((hover + 0.5) / days.length) * 100}% - 80px), calc(100% - 170px))` }}
        >
          <div className="mb-1 font-medium">{dayLabel(days[hover])}</div>
          {ORDER.map((a) => (
            <div key={a} className="flex items-center gap-2">
              <span className={cn("size-2 rounded-[2px]", SERIES[a].dot)} />
              <span className="text-muted-foreground">{AGENT_NAME[a]}</span>
              <span className="ml-auto tabular-nums">{compact(value(days[hover], a))}</span>
            </div>
          ))}
        </div>
      )}
    </figure>
  );
}
