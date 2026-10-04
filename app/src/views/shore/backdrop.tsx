import { useEffect, useState } from "react";

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

// useLight follows the time of day, looking again every ten minutes.
export function useLight(): Light {
  const [light, setLight] = useState(lightFor);
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) setLight(lightFor());
    }, 600_000);
    return () => clearInterval(t);
  }, []);
  return light;
}

export function Backdrop({ light, misted }: { light: Light; misted?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-(--sh-sky)">
      <img src={ART[light].plate} alt="" decoding="async" className={cn("shore-plate absolute inset-0 size-full object-cover", misted && "is-misted")} />
      <img src={ART[light].mist} alt="" decoding="async" className={cn("absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-700", misted && "opacity-100")} />
      <div className={cn("absolute inset-0 bg-(--sh-mist) opacity-0 transition-opacity duration-700", misted && "opacity-(--sh-mist-a)")} />
    </div>
  );
}
