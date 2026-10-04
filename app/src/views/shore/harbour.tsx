import { CheckIcon } from "lucide-react";
import { useMemo } from "react";

import type { SessionEntry } from "@/hooks/use-agent-counts";
import { agentLabel, agentOf, worktreeOf } from "@/lib/derive";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// Harbour puts each agent on the water as a boat, seen from the shore.
// Working agents are out on the water under sail; an agent that needs you
// comes in to a numbered berth on the quay with its lamp lit; a finished one
// lies moored at its berth. Clicking a boat opens its transcript.

export interface Boat {
  key: string;
  box: string;
  session: string;
  agent: string;
  title: string;
  state: "running" | "waiting" | "finished";
}

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

// Places on the water for boats under way: across (percent of the width)
// and depth (0 at the horizon, 1 just off the quay). Boats take them in
// order; the near ones are bigger.
const SEA: [number, number][] = [
  [17, 0.42],
  [79, 0.3],
  [36, 0.12],
  [63, 0.62],
  [90, 0.7],
  [8, 0.78],
  [52, 0.28],
  [27, 0.86],
  [71, 0.08],
];

export function Harbour({ boats, onOpen, away }: { boats: Boat[]; onOpen(b: Boat): void; away?: boolean }) {
  const out = boats.filter((b) => b.state === "running");
  // The quay: who needs you first, then the finished, then one free berth.
  const berthed = boats.filter((b) => b.state !== "running").sort((a, b) => (a.state === b.state ? 0 : a.state === "waiting" ? -1 : 1));

  return (
    <div className={cn("pointer-events-none absolute inset-0 transition-[opacity,transform] duration-500", away && "translate-y-3 opacity-0")} inert={away || undefined}>
      {out.map((b, i) => {
        const [x, d] = SEA[i % SEA.length];
        return (
          <button
            key={b.key}
            type="button"
            onClick={() => onOpen(b)}
            className="group pointer-events-auto absolute flex -translate-x-1/2 -translate-y-full flex-col items-center rounded-lg outline-none"
            style={{ left: `${x}%`, top: `calc(var(--sh-horizon) + (100% - var(--sh-horizon) - 128px) * ${d} + 12px)` }}
            aria-label={`${b.title}, ${agentLabel(b.agent)}, working`}
          >
            <span className="shore-ride relative block origin-bottom" style={{ "--ride": `${6 + (i % 3)}s` } as React.CSSProperties}>
              <BoatSide sail size={Math.round(54 + d * 30)} />
              {/* Its reflection, softened, on the water below. */}
              <BoatSide sail size={Math.round(54 + d * 30)} className="-scale-y-100 pointer-events-none absolute top-[88%] left-0 opacity-25 blur-[1.5px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
            </span>
            <span className="mt-1 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-(--sh-glass) px-2 py-0.5 font-medium text-(--sh-ink) text-[11.5px] shadow-(--sh-shadow-sm) ring-1 ring-(--sh-edge) backdrop-blur-md transition-transform group-hover:-translate-y-0.5">
              <span className="shore-spin size-2.5 shrink-0 rounded-full border-(--sh-busy) border-[1.5px] border-t-transparent" aria-hidden />
              {b.title}
            </span>
          </button>
        );
      })}

      <Quay berthed={berthed} onOpen={onOpen} />
    </div>
  );
}

// Quay is the row of numbered berths along the foot of the window, with
// one free berth at the end that takes you to the composer.
function Quay({ berthed, onOpen }: { berthed: Boat[]; onOpen(b: Boat): void }) {
  const slots = [...berthed, null];
  const no = (i: number) => String(i + 1).padStart(2, "0");
  return (
    <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
      <ol aria-label="Quay" className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-[22px] bg-(--sh-glass-2) p-1.5 shadow-(--sh-shadow) ring-(--sh-edge) ring-1 backdrop-blur-xl [scrollbar-width:none]">
        {slots.map((b, i) => (
          <li key={b?.key ?? "free"} className="shrink-0">
            {b ? (
              <button
                type="button"
                onClick={() => onOpen(b)}
                className={cn(
                  "group flex h-[62px] w-[164px] items-center gap-2.5 rounded-2xl pr-3 pl-2 text-left outline-none transition-colors max-[1100px]:w-[148px]",
                  b.state === "waiting" ? "bg-(--sh-glass-hi) shadow-(--sh-shadow-sm)" : "hover:bg-(--sh-glass)",
                )}
                aria-label={`Berth ${i + 1}: ${b.title}, ${agentLabel(b.agent)}, ${b.state === "waiting" ? "needs you" : "finished"}`}
              >
                <span className="flex shrink-0 flex-col items-center">
                  <BoatSide lamp={b.state === "waiting"} size={42} />
                  <span className="-mt-px font-mono text-(--sh-ink-3) text-[9.5px] leading-3 tabular-nums">{no(i)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-(--sh-ink) text-[13px] leading-5">{b.title}</span>
                  <span className={cn("flex items-center gap-1 text-[12px] leading-4", b.state === "waiting" ? "font-medium text-(--sh-lamp-ink)" : "text-(--sh-ink-3)")}>
                    {b.state === "waiting" ? (
                      "Needs you"
                    ) : (
                      <>
                        <CheckIcon className="size-3 text-(--sh-done)" strokeWidth={3} />
                        Done
                      </>
                    )}
                  </span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => document.querySelector<HTMLTextAreaElement>(".shore-dock textarea")?.focus()}
                aria-label={`Berth ${i + 1} is free: start something`}
                className="flex h-[62px] w-[84px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-(--sh-line-2) border-dashed text-(--sh-ink-3) text-[12px] outline-none transition-colors hover:bg-(--sh-glass) hover:text-(--sh-ink-2)"
              >
                <span>Free</span>
                <span className="font-mono text-[9.5px] tabular-nums">{no(i)}</span>
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

// BoatSide is the brand's boat from the side: hull, mast and the lamp at
// its head. Under way it carries a mainsail and a jib; tied up, the sails
// are stowed and the cabin shows. At a berth that needs you, the lamp is lit.
export function BoatSide({ size = 40, sail, lamp, className }: { size?: number; sail?: boolean; lamp?: boolean; className?: string }) {
  const line = { stroke: "var(--sh-hull-line)", strokeWidth: 1.4 };
  return (
    <svg width={size} height={(size * 40) / 48} viewBox="0 0 48 40" className={cn("block shrink-0 overflow-visible", className)} aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round">
      {lamp && <circle className="shore-lamp" cx="24" cy="8.6" r="5" fill="var(--sh-lamp)" opacity="0.32" />}
      <path d={sail ? "M24 4 V29" : "M24 9 V29"} {...line} />
      {sail ? (
        <>
          <path d="M25.6 6 C 31.5 12 35 19.5 36 27.5 H25.6 Z" fill="var(--sh-sail)" {...line} />
          <path d="M22.4 9.5 C 19 15.5 15.5 21.5 13 27.5 H22.4 Z" fill="var(--sh-sail)" {...line} />
        </>
      ) : (
        <>
          <rect x="16" y="21.5" width="13" height="7.5" rx="1.5" fill="var(--sh-hull)" {...line} />
          <path d="M19.5 25 H22.5" {...line} strokeWidth={1.2} />
        </>
      )}
      <path d="M4.5 29.5 H43.5 C 41.8 33.6 38.4 36 34 36 H14 C 9.6 36 6.2 33.6 4.5 29.5 Z" fill="var(--sh-hull)" {...line} />
      <path d="M8.5 32.4 H39.5" stroke="var(--sh-hull-line)" strokeOpacity="0.22" strokeWidth="1.2" />
      <circle cx="24" cy={sail ? 3.6 : 8.6} r="2" fill={lamp ? "var(--sh-lamp)" : "var(--sh-hull-line)"} />
      <path d="M2 39 q3 -1.6 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t4 0" stroke="var(--sh-hull-line)" strokeOpacity="0.25" strokeWidth="1.2" />
    </svg>
  );
}
