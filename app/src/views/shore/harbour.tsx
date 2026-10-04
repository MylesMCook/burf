import { useMemo } from "react";

import type { SessionEntry } from "@/hooks/use-agent-counts";
import { agentLabel, agentOf, worktreeOf } from "@/lib/derive";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// Harbour puts each agent on the water as a boat seen from above. Working
// agents are out at sea under way, leaving a wake; an agent that needs you
// comes in to a berth on the quay with its lamp lit; a finished one is tied
// up at its berth. Clicking a boat opens its transcript.

export interface Boat {
  key: string;
  box: string;
  session: string;
  agent: string;
  title: string;
  state: "running" | "waiting" | "finished";
}

// Places out at sea, in percent of the water, kept clear of the composer in
// the middle. Boats take them in order.
const OUT = [
  [16, 20],
  [80, 16],
  [34, 9],
  [66, 30],
  [88, 52],
  [9, 46],
  [24, 64],
  [76, 70],
  [52, 12],
];

export function useBoats(all: SessionEntry[]): Boat[] {
  const boxes = useStore((s) => s.boxes);
  return useMemo(
    () =>
      all
        .filter((e) => agentOf(e.session) && (e.state === "running" || e.state === "waiting" || e.state === "finished"))
        .map((e) => {
          const wt = worktreeOf(boxes[e.box]?.locations, e.session);
          const title = wt ? (wt.worktree.main ? wt.location.name : wt.worktree.name) : e.session.name;
          const agent = agentOf(e.session) ?? "agent";
          return { key: `${e.box}/${e.session.name}`, box: e.box, session: e.session.name, agent, title, state: e.state as Boat["state"] };
        })
        .sort((a, b) => a.key.localeCompare(b.key)),
    [all, boxes],
  );
}

export function Harbour({ boats, onOpen, dim }: { boats: Boat[]; onOpen(b: Boat): void; dim?: boolean }) {
  const out = boats.filter((b) => b.state === "running");
  const berthed = boats.filter((b) => b.state !== "running").sort((a, b) => (a.state === b.state ? 0 : a.state === "waiting" ? -1 : 1));
  const berths = Math.max(6, berthed.length + 2);

  return (
    <div className={cn("pointer-events-none absolute inset-0 transition-opacity duration-500", dim && "opacity-0")}>
      {out.map((b, i) => {
        const [x, y] = OUT[i % OUT.length];
        return (
          <button
            key={b.key}
            type="button"
            onClick={() => onOpen(b)}
            className="shore-boat group pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            style={{ left: `${x}%`, top: `${y * 0.82}%`, "--drift": `${18 + (i % 4) * 5}s`, "--turn": `${i % 2 ? -14 : 12}deg` } as React.CSSProperties}
            aria-label={`${b.title}, ${agentLabel(b.agent)}, working`}
          >
            <BoatTop under />
            <Label boat={b} hover />
          </button>
        );
      })}

      {/* The quay along the bottom, with its numbered berths. */}
      <div className="absolute inset-x-0 bottom-0 h-[104px]">
        <Quay berths={berths} />
        {berthed.map((b, i) => (
          <button
            key={b.key}
            type="button"
            onClick={() => onOpen(b)}
            className="shore-moored group pointer-events-auto absolute bottom-[38px] -translate-x-1/2 outline-none"
            style={{ left: `${((i + 1) / (berths + 1)) * 100}%` }}
            aria-label={`${b.title}, ${agentLabel(b.agent)}, ${b.state === "waiting" ? "needs you" : "finished"}`}
          >
            <BoatTop lamp={b.state === "waiting"} moored />
            <Label boat={b} hover={b.state !== "waiting"} above />
          </button>
        ))}
      </div>
    </div>
  );
}

function Label({ boat, hover, above }: { boat: Boat; hover?: boolean; above?: boolean }) {
  return (
    <span
      className={cn(
        "-translate-x-1/2 absolute left-1/2 whitespace-nowrap rounded-full bg-white/85 px-2 py-0.5 font-medium text-[11px] text-slate-700 shadow-sm backdrop-blur-sm transition-opacity",
        above ? "bottom-full mb-1.5" : "top-full mt-1",
        hover ? "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" : "opacity-100",
      )}
    >
      {boat.title}
      <span className="text-slate-400"> · {boat.state === "waiting" ? "needs you" : boat.state === "finished" ? "done" : agentLabel(boat.agent)}</span>
    </span>
  );
}

// BoatTop is a small boat from above, bow up: hull, cabin, mast, and a wake
// behind it when it is under way.
function BoatTop({ under, lamp, moored }: { under?: boolean; lamp?: boolean; moored?: boolean }) {
  return (
    <svg width="45" height={under ? 96 : 66} viewBox={`0 0 30 ${under ? 64 : 44}`} className="block overflow-visible text-[#1d2a55]" aria-hidden>
      {under && (
        <g className="shore-wake" stroke="white" strokeLinecap="round" fill="none">
          <path d="M11 40 L4 62" strokeWidth="1.6" opacity="0.7" strokeDasharray="3 3" />
          <path d="M19 40 L26 62" strokeWidth="1.6" opacity="0.7" strokeDasharray="3 3" />
          <path d="M15 42 V58" strokeWidth="2.4" opacity="0.45" />
        </g>
      )}
      <g className={cn(moored && "shore-bob")}>
        <path d="M15 2 C 23 9 25 18 24.5 28 L 23.5 40 H 6.5 L 5.5 28 C 5 18 7 9 15 2 Z" fill="white" stroke="currentColor" strokeWidth="1.6" />
        <rect x="9.5" y="20" width="11" height="12" rx="2" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="15" cy="14" r="1.6" fill="currentColor" />
        {lamp && (
          <>
            <circle className="shore-lamp" cx="15" cy="14" r="7" fill="#f2b23a" opacity="0.35" />
            <circle cx="15" cy="14" r="2.6" fill="#f2b23a" />
          </>
        )}
      </g>
      {moored && <path d="M15 40 V45" stroke="currentColor" strokeWidth="1.2" />}
    </svg>
  );
}

// Quay is the timber edge of the harbour: a kerb, a plank deck, and a
// bollard with its number at every berth.
function Quay({ berths }: { berths: number }) {
  return (
    <svg className="absolute inset-0 size-full" aria-hidden>
      <defs>
        <pattern id="shore-planks" width="34" height="12" patternUnits="userSpaceOnUse">
          <rect width="34" height="12" fill="#efe3cc" />
          <path d="M0 11.5 H34" stroke="#d8c6a4" strokeWidth="1" />
          <path d="M17 0 V12" stroke="#e1d1b2" strokeWidth="1" />
        </pattern>
      </defs>
      {/* Shadow on the water, the kerb, then the deck. */}
      <rect x="0" y="62" width="100%" height="6" fill="#1d2a55" opacity="0.18" />
      <rect x="0" y="66" width="100%" height="38" fill="url(#shore-planks)" />
      <rect x="0" y="64" width="100%" height="6" fill="#d9c7a3" />
      {Array.from({ length: berths }, (_, i) => {
        const x = `${((i + 1) / (berths + 1)) * 100}%`;
        return (
          <g key={i}>
            <circle cx={x} cy="67" r="4.5" fill="#7d6648" />
            <text x={x} y="92" textAnchor="middle" className="fill-[#9a8462] font-mono text-[10px]">
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
