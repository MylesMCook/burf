import chart from "@/components/art/backgrounds/chart.webp";
import dawn from "@/components/art/backgrounds/dawn.webp";
import fog from "@/components/art/backgrounds/fog.webp";
import night from "@/components/art/backgrounds/night.webp";
import openSea from "@/components/art/backgrounds/open-sea.webp";
import { HARBOUR, type HarbourLight } from "@/components/art/harbour-art";

// The chat backgrounds Berth ships (lib/chat-background.ts).

export interface Builtin {
  id: string;
  name: string;
  // The picture, by the harbour's light (dark themes get the night).
  src(light: HarbourLight): string;
}

// The built-ins, all of the harbour and the sea. The harbour is the same
// painting as the first-prompt band, by the time of day; the rest were
// generated with Codex for Berth.
export const BUILTINS: Builtin[] = [
  { id: "harbour", name: "Harbour", src: (l) => HARBOUR[l] },
  { id: "dawn", name: "Dawn", src: () => dawn },
  { id: "night", name: "Night", src: () => night },
  { id: "open-sea", name: "Open sea", src: () => openSea },
  { id: "fog", name: "Fog", src: () => fog },
  { id: "chart", name: "Chart", src: () => chart },
];

export const builtin = (id: string) => BUILTINS.find((b) => b.id === id) ?? BUILTINS[0];

