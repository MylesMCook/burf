import { create } from "zustand";

// Burf has no signed update feed. Keep the existing UI contract inert until
// fork-owned signing, installation and rollback are explicitly implemented.
export type UpdaterState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "current"; checkedAt: number }
  | { status: "downloading"; version: string; received: number; total?: number }
  | { status: "ready"; version: string }
  | { status: "installing"; version: string }
  | { status: "error"; error: string; checkedAt: number };

export const useUpdater = create<UpdaterState>(() => ({ status: "idle" }));
export const useAgentRestart = create<{ restarting: boolean }>(() => ({ restarting: false }));
export const updatesSupported = (): boolean => false;
export const checkForUpdate = (_options: { manual?: boolean } = {}): Promise<void> => Promise.resolve();
export const restartToUpdate = (): Promise<void> => Promise.resolve();
export function startUpdater(): void {}
