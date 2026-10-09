import { create } from "zustand";

// Bumped when This computer's main pane refreshes so the sidebar tree reloads.
export const useLocalComputerRefresh = create<{ n: number; bump(): void }>((set) => ({
  n: 0,
  bump: () => set((s) => ({ n: s.n + 1 })),
}));
