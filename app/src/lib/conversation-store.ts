import { create } from "zustand";

import type { Artifact, CrewMember, TranscriptItem } from "@/lib/transcript";

// The conversations the app holds for agents shown as a conversation rather
// than a terminal: each session's recent items and the crew working beside
// it. Only sessions someone opened are kept, and only their last items.

const KEEP = 300;

interface ConversationState {
  // Transcripts and crews by "box/session".
  items: Record<string, TranscriptItem[]>;
  crew: Record<string, CrewMember[]>;
  // When each agent last wrote to its record (ms), for Thinking's time.
  last: Record<string, number>;
  // The pages each agent published on claude.ai, newest last.
  artifacts: Record<string, Artifact[]>;
  push(key: string, item: TranscriptItem): void;
  // merge replaces items with the same id and appends the rest, as the
  // box resends a tool group that was still open.
  merge(key: string, items: TranscriptItem[]): void;
  update(key: string, id: string, patch: Partial<TranscriptItem>): void;
  remove(key: string, id: string): void;
  setCrew(key: string, crew: CrewMember[]): void;
  setLast(key: string, at: number): void;
  // Set only when the list changed, so its chip draws again only then.
  setArtifacts(key: string, list: Artifact[]): void;
}

export const useConversations = create<ConversationState>()((set) => ({
  items: {},
  last: {},
  crew: {},
  artifacts: {},
  push: (key, item) => set((s) => ({ items: { ...s.items, [key]: [...(s.items[key] ?? []), item].slice(-KEEP) } })),
  merge: (key, incoming) =>
    set((s) => {
      const list = [...(s.items[key] ?? [])];
      const at = new Map(list.map((it, i) => [it.id, i]));
      for (const it of incoming) {
        const i = at.get(it.id);
        if (i === undefined) {
          at.set(it.id, list.length);
          list.push(it);
        } else list[i] = it;
      }
      return { items: { ...s.items, [key]: list.slice(-KEEP) } };
    }),
  update: (key, id, patch) =>
    set((s) => ({ items: { ...s.items, [key]: (s.items[key] ?? []).map((i) => (i.id === id ? ({ ...i, ...patch } as TranscriptItem) : i)) } })),
  remove: (key, id) => set((s) => ({ items: { ...s.items, [key]: (s.items[key] ?? []).filter((i) => i.id !== id) } })),
  setCrew: (key, crew) => set((s) => ({ crew: { ...s.crew, [key]: crew } })),
  setLast: (key, at) => set((s) => (s.last[key] === at ? s : { last: { ...s.last, [key]: at } })),
  setArtifacts: (key, list) => set((s) => (sameArtifacts(s.artifacts[key], list) ? s : { artifacts: { ...s.artifacts, [key]: list } })),
}));

const sameArtifacts = (a: Artifact[] | undefined, b: Artifact[]) =>
  (a ?? []).length === b.length && (a ?? []).every((x, i) => x.tool === b[i].tool && x.url === b[i].url && x.title === b[i].title && x.description === b[i].description);

export const keyOf = (box: string, session: string) => `${box}/${session}`;
