import { create } from "zustand";

import type { CrewMember, TranscriptItem } from "@/lib/transcript";

// The conversations the app holds for agents shown as a conversation rather
// than a terminal: each session's recent items and the crew working beside
// it. Only sessions someone opened are kept, and only their last items.

const KEEP = 200;

interface ConversationState {
  // Transcripts and crews by "box/session".
  items: Record<string, TranscriptItem[]>;
  crew: Record<string, CrewMember[]>;
  push(key: string, item: TranscriptItem): void;
  update(key: string, id: string, patch: Partial<TranscriptItem>): void;
  remove(key: string, id: string): void;
  setCrew(key: string, crew: CrewMember[]): void;
}

export const useConversations = create<ConversationState>()((set) => ({
  items: {},
  crew: {},
  push: (key, item) => set((s) => ({ items: { ...s.items, [key]: [...(s.items[key] ?? []), item].slice(-KEEP) } })),
  update: (key, id, patch) =>
    set((s) => ({ items: { ...s.items, [key]: (s.items[key] ?? []).map((i) => (i.id === id ? ({ ...i, ...patch } as TranscriptItem) : i)) } })),
  remove: (key, id) => set((s) => ({ items: { ...s.items, [key]: (s.items[key] ?? []).filter((i) => i.id !== id) } })),
  setCrew: (key, crew) => set((s) => ({ crew: { ...s.crew, [key]: crew } })),
}));

export const keyOf = (box: string, session: string) => `${box}/${session}`;
