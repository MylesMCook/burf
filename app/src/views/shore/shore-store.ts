import { create } from "zustand";

import type { CrewMember, TranscriptItem } from "@/lib/transcript";

// What Shore mode shows, and the transcripts it holds while open. Only the
// sessions someone opened are kept, and only their last items.

export type ShoreView = { kind: "home" } | { kind: "session"; box: string; session: string; title: string; agent: string };

const KEEP = 200;

interface ShoreState {
  view: ShoreView;
  // Transcripts and crews by "box/session".
  items: Record<string, TranscriptItem[]>;
  crew: Record<string, CrewMember[]>;
  setView(v: ShoreView): void;
  push(key: string, item: TranscriptItem): void;
  update(key: string, id: string, patch: Partial<TranscriptItem>): void;
  remove(key: string, id: string): void;
  setCrew(key: string, crew: CrewMember[]): void;
}

export const useShore = create<ShoreState>()((set) => ({
  view: { kind: "home" },
  items: {},
  crew: {},
  setView: (view) => set({ view }),
  push: (key, item) => set((s) => ({ items: { ...s.items, [key]: [...(s.items[key] ?? []), item].slice(-KEEP) } })),
  update: (key, id, patch) =>
    set((s) => ({ items: { ...s.items, [key]: (s.items[key] ?? []).map((i) => (i.id === id ? ({ ...i, ...patch } as TranscriptItem) : i)) } })),
  remove: (key, id) => set((s) => ({ items: { ...s.items, [key]: (s.items[key] ?? []).filter((i) => i.id !== id) } })),
  setCrew: (key, crew) => set((s) => ({ crew: { ...s.crew, [key]: crew } })),
}));

export const keyOf = (box: string, session: string) => `${box}/${session}`;
