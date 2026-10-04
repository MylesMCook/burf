import { cn } from "@/lib/utils";
import dawnMist from "@/views/shore/art/dawn-mist.webp";
import dawn from "@/views/shore/art/dawn.webp";
import dayMist from "@/views/shore/art/day-mist.webp";
import day from "@/views/shore/art/day.webp";
import duskMist from "@/views/shore/art/dusk-mist.webp";
import dusk from "@/views/shore/art/dusk.webp";
import nightMist from "@/views/shore/art/night-mist.webp";
import night from "@/views/shore/art/night.webp";

// Backdrop is the harbour seen from the shore at eye level: sky, a
// lighthouse on the headland, and open water down to the quay. It is a
// still painting, so it costs nothing once drawn: no canvas, no timers, no
// animation. While a session is open it fades into mist: a tiny copy of the
// same painting scaled up (blurred for free by the scaling) under a veil, so
// nothing blurs the whole window live.

export type Light = "dawn" | "day" | "dusk" | "night";

export function lightFor(d = new Date()): Light {
  const q = new URLSearchParams(location.search).get("light");
  if (q === "dawn" || q === "day" || q === "dusk" || q === "night") return q;
  const h = d.getHours();
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

const ART: Record<Light, { plate: string; mist: string }> = {
  dawn: { plate: dawn, mist: dawnMist },
  day: { plate: day, mist: dayMist },
  dusk: { plate: dusk, mist: duskMist },
  night: { plate: night, mist: nightMist },
};

// Exploration only: ?bg=paint|line|swell picks a direction.
export type Direction = "paint" | "line" | "swell";
export const directionFor = (): Direction => {
  const q = new URLSearchParams(location.search).get("bg");
  return q === "line" || q === "swell" ? q : "paint";
};

export function Backdrop({ light, misted, direction = directionFor() }: { light: Light; misted?: boolean; direction?: Direction }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-[var(--sh-sky)]">
      {direction === "paint" && (
        <>
          <img src={ART[light].plate} alt="" decoding="async" className={cn("shore-plate absolute inset-0 size-full object-cover", misted && "is-misted")} />
          <img src={ART[light].mist} alt="" decoding="async" className={cn("absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-700", misted && "opacity-100")} />
        </>
      )}
      {direction === "swell" && <Swell />}
      {direction === "line" && <Line />}
      <div className={cn("absolute inset-0 bg-[var(--sh-mist)] opacity-0 transition-opacity duration-700", misted && "opacity-[var(--sh-mist-a)]")} />
    </div>
  );
}

// Swell: a drawn sea in flat gradients with a few swells, no picture.
function Swell() {
  const swell = (y: number, amp: number, period: number, o: number, w: number) => {
    let d = `M0 ${y}`;
    for (let x = 0; x <= 1600; x += period) d += ` q${period / 4} ${-amp} ${period / 2} 0 t${period / 2} 0`;
    return <path d={d} stroke="white" strokeOpacity={o} strokeWidth={w} fill="none" strokeLinecap="round" />;
  };
  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sw-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#8ec5f4" />
          <stop offset="1" stopColor="#e8f4fb" />
        </linearGradient>
        <linearGradient id="sw-sea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3f9fd6" />
          <stop offset="0.5" stopColor="#6ccbe0" />
          <stop offset="1" stopColor="#b9ecec" />
        </linearGradient>
        <radialGradient id="sw-sun" cx="0.72" cy="0.5" r="0.35">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="575" fill="url(#sw-sky)" />
      <rect y="575" width="1600" height="425" fill="url(#sw-sea)" />
      <rect width="1600" height="1000" fill="url(#sw-sun)" />
      <ellipse cx="300" cy="300" rx="260" ry="60" fill="white" opacity="0.5" />
      <ellipse cx="1250" cy="220" rx="320" ry="70" fill="white" opacity="0.45" />
      {swell(620, 4, 80, 0.5, 1.5)}
      {swell(690, 6, 120, 0.45, 2)}
      {swell(790, 9, 180, 0.4, 2.5)}
      {swell(920, 12, 240, 0.35, 3)}
    </svg>
  );
}

// Line: the brand's line-drawn harbour scaled up to the window.
function Line() {
  const wave = (y: number, amp: number, P: number, o: number, dash?: string) => {
    let d = `M0 ${y} q${P / 4} ${-amp} ${P / 2} 0`;
    for (let x = P / 2; x < 1650; x += P / 2) d += ` t${P / 2} 0`;
    return <path d={d} stroke="#71737c" strokeOpacity={o} strokeWidth="2" fill="none" strokeDasharray={dash} strokeLinecap="round" />;
  };
  return (
    <svg className="absolute inset-0 size-full bg-[#fbfaf7]" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
      <g stroke="#71737c" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M0 575 H1600" strokeOpacity="0.35" />
        {/* Headland and lighthouse */}
        <path d="M0 575 C 60 520 140 505 220 520 C 280 532 330 560 380 575" />
        <path d="M150 512 L156 440 H176 L182 512" />
        <path d="M150 440 H182 M158 440 V424 H174 V440 M166 424 V414" />
        {/* Clouds */}
        <path d="M1050 250 c 20 -40 80 -40 95 -5 c 25 -25 75 -10 70 25 c 30 0 40 30 20 40 H1040 c -30 0 -30 -50 -5 -55" strokeOpacity="0.5" />
        <path d="M300 200 c 15 -30 60 -30 70 -4 c 20 -18 55 -6 52 18 c 22 0 30 22 15 30 H290 c -22 0 -22 -38 -3 -42" strokeOpacity="0.4" />
      </g>
      {wave(640, 3, 24, 0.45, "30 14")}
      {wave(720, 4, 32, 0.4, "40 20")}
      {wave(830, 5, 40, 0.35, "60 24")}
      {wave(960, 6, 48, 0.3, "80 30")}
    </svg>
  );
}
