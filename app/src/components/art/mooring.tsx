import { useId } from "react";

import { cn } from "@/lib/utils";

import "./mooring.css";

// Mooring is Berth's small drawing for a quiet state: a jetty with a cleat,
// open water, and the logo's amber dot as a buoy.
//
//   ended    the berth is empty: a slack line trails into the water and the
//            buoy bobs. What ran here has left.
//   offline  fog over the water and the buoy's light turning slowly: the box
//            is out of sight, and Berth keeps looking for it.
//   moored   a small boat tied up at the jetty, its masthead light lit and
//            riding the swell: ready to set off.
//
// Lines take currentColor (muted unless the caller says otherwise) and the
// buoy the theme's amber, so it reads in every theme. Motion is CSS only,
// slow and a pixel or two at most, and stops under reduced motion.
export function Mooring({ variant = "ended", width = 144, className }: { variant?: "ended" | "offline" | "moored"; width?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const fade = `ba-fade-${id}`;
  const rope = `ba-rope-${id}`;
  const still = variant === "offline";
  const moored = variant === "moored";
  return (
    <svg
      aria-hidden
      viewBox="0 16 160 52"
      width={width}
      height={(width * 52) / 160}
      className={cn("berth-art shrink-0", className)}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        {/* Water and fog fade out at both ends, so the scene has no edges. */}
        <linearGradient id={`${fade}-g`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.18" stopColor="#fff" />
          <stop offset="0.82" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={fade} maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="72">
          <rect x="0" y="0" width="160" height="72" fill={`url(#${fade}-g)`} />
        </mask>
        <linearGradient id={rope} gradientUnits="userSpaceOnUse" x1="64" x2="104" y1="0" y2="0">
          <stop offset="0" stopColor="currentColor" />
          <stop offset="0.65" stopColor="currentColor" stopOpacity="0.6" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {still && (
        <g mask={`url(#${fade})`} stroke="currentColor" strokeWidth="1.4">
          <path className="ba-fog" d="M16 21 H144" strokeDasharray="14 8" opacity="0.3" />
          <path className="ba-fog ba-rev" d="M28 27 H132" strokeDasharray="8 9" opacity="0.2" />
        </g>
      )}

      {/* The jetty: deck, pilings (fainter below the waterline) and a cleat. */}
      <g stroke="currentColor">
        <path d="M8 36 H66" strokeWidth="2.8" />
        <path d="M15 38 V48 M33 38 V48 M51 38 V48" strokeWidth="2.4" />
        <path d="M15 51.5 V60 M33 51.5 V60 M51 51.5 V60" strokeWidth="2.4" opacity="0.26" />
        <path d="M56.5 31.2 H65.5 M61 31.6 V34.4" strokeWidth="2.3" />
      </g>

      {/* A slack line from the cleat, trailing off into the water. */}
      {!still && !moored && <path d="M63.5 32.2 C 69 45, 82 53.5, 104 50.5" stroke={`url(#${rope})`} strokeWidth="1.4" strokeDasharray="2.4 1.5" />}

      {/* The buoy is the logo's dot. */}
      {moored ? (
        <>
          {/* A taut line from the cleat to the bow. */}
          <path d="M64.5 32.6 Q 76 38.5 87.5 42.4" stroke="currentColor" strokeWidth="1.4" />
          {/* The boat: hull, a small cabin, and a mast whose light is the
              logo's dot. It rides the swell. */}
          <g className="ba-ride" stroke="currentColor">
            <path d="M86 42.2 H131 L125.5 49.6 H92 Z" fill="currentColor" fillOpacity="0.1" strokeWidth="2.2" />
            <path d="M99 42 V37.2 H110.5 L114 42" strokeWidth="1.8" />
            <path d="M106 37 V24.6" strokeWidth="1.6" />
            <circle cx="106" cy="23" r="2.7" fill="var(--warning)" stroke="none" />
          </g>
          <path className="ba-glint" d="M102 53.4 H110" stroke="var(--warning)" strokeWidth="1.3" />
        </>
      ) : (
        <>
          <g className={still ? "ba-beacon" : "ba-buoy"}>
            <circle cx="124" cy="44.4" r="4.4" fill="var(--warning)" />
          </g>
          {!still && <path className="ba-glint" d="M120 53 H128" stroke="var(--warning)" strokeWidth="1.3" />}
        </>
      )}

      {/* Open water: one long swell, then broken lines further out. */}
      <g mask={`url(#${fade})`} stroke="currentColor" strokeWidth="1.4">
        <Wave y={49.4} amp={1.3} dur={still ? 0 : 7} opacity={0.72} />
        <Wave y={55.6} amp={1.1} dur={still ? 0 : 11} opacity={0.42} dash="16 8" shift={24} reverse />
        <Wave y={61.6} amp={1} dur={still ? 0 : 15} opacity={0.22} dash="6 10 14 6" shift={36} />
      </g>
    </svg>
  );
}

// Wave is one line of water: a sine of period 12, drawn wider than the
// scene on the right so sliding it by `shift` (a whole number of periods, and
// of its dash pattern) loops without a seam.
function Wave({ y, amp, dur, opacity, dash, shift = 12, reverse }: { y: number; amp: number; dur: number; opacity: number; dash?: string; shift?: number; reverse?: boolean }) {
  const P = 12;
  let d = `M${-P} ${y} q${P / 4} ${-amp} ${P / 2} 0`;
  for (let x = -P / 2; x < 160 + shift; x += P / 2) d += ` t${P / 2} 0`;
  return (
    <path
      d={d}
      opacity={opacity}
      strokeDasharray={dash}
      className={dur ? cn("ba-wave", reverse && "ba-rev") : undefined}
      style={dur ? ({ "--ba-d": `${dur}s`, "--ba-x": `${-shift}px` } as React.CSSProperties) : undefined}
    />
  );
}
