import { create } from "zustand";

import { load, save } from "@/lib/storage";
import { DEFAULT_TERMINAL_PREFS, type TerminalPrefs } from "@/lib/terminal";

// The person's preferences, kept on this computer.

export interface Prefs {
  terminal: TerminalPrefs;
  notify: { waiting: boolean; finished: boolean; setupFailed: boolean; sound: boolean };
  density: "compact" | "comfortable";
  uiFontSize: number;
  copyOnSelect: boolean;
  // Built-in plugins turned off. The agent's "disabled" marker only covers
  // plugins in ~/.berth/plugins.
  disabledPlugins: string[];
  // Built-in plugins that are off until turned on ("defaultEnabled": false)
  // and have been turned on.
  enabledPlugins: string[];
  // The sidebar folded to a rail of icons (⌘\).
  sidebarCollapsed: boolean;
  // Ask before closing a pane or tab stops a shell on its box.
  confirmCloseShells: boolean;
  // What closing an agent's pane or tab does to the agent: leave it running
  // on its box, stop it, or ask each time.
  closeAgents: "keep" | "stop" | "ask";
  // How many times "keeps running" was said on closing an agent; it stops
  // after a few.
  agentCloseTips: number;
  // Labs: the harbour home (no worktree open) and the Terminal |
  // Conversation switch on agent panes.
  labs: boolean;
  // Labs: how an agent's pane opens, until switched.
  agentView: "terminal" | "conversation";
  // Labs: zen (⌘.): no sidebar or status bar, a switcher for a tab strip,
  // agents as conversations.
  zen: boolean;
  // Update a box's berthd as soon as Berth ships a newer one
  // (lib/outdated.ts). Off: the status bar offers it instead.
  autoUpdateBoxes: boolean;
}

const DEFAULTS: Prefs = {
  terminal: DEFAULT_TERMINAL_PREFS,
  notify: { waiting: true, finished: true, setupFailed: true, sound: false },
  density: "compact",
  uiFontSize: 13,
  copyOnSelect: false,
  disabledPlugins: [],
  enabledPlugins: [],
  sidebarCollapsed: false,
  confirmCloseShells: true,
  closeAgents: "keep",
  agentCloseTips: 0,
  labs: false,
  agentView: "terminal",
  zen: false,
  autoUpdateBoxes: false,
};

const saved = load<Partial<Prefs>>("berth.prefs", {});

export const usePrefs = create<Prefs>()(() => ({
  ...DEFAULTS,
  ...saved,
  terminal: { ...DEFAULTS.terminal, ...saved.terminal },
  notify: { ...DEFAULTS.notify, ...saved.notify },
}));

usePrefs.subscribe((p) => save("berth.prefs", p));

// ?labs=1 turns Labs on, ?zen=1 zen, and ?view=conversation opens agents
// as conversations, for the demo.
{
  const q = new URLSearchParams(location.search);
  if (q.has("labs")) usePrefs.setState({ labs: q.get("labs") !== "0" });
  if (q.has("zen")) usePrefs.setState({ zen: q.get("zen") !== "0" });
  const v = q.get("view");
  if (v === "terminal" || v === "conversation") usePrefs.setState({ agentView: v });
}

// The interface's text size scales everything sized in rem, from 13px as
// designed; density is left to styles that read data-density.
function applyUiPrefs(p: Prefs) {
  const root = document.documentElement;
  root.style.fontSize = p.uiFontSize === 13 ? "" : `${(16 * p.uiFontSize) / 13}px`;
  root.dataset.density = p.density;
}
applyUiPrefs(usePrefs.getState());
usePrefs.subscribe((p, prev) => {
  if (p.uiFontSize !== prev.uiFontSize || p.density !== prev.density) applyUiPrefs(p);
});

// useTerminalPrefs is what a terminal needs to draw itself; it changes only
// when one of those settings does.
export function useTerminalPrefs(): TerminalPrefs {
  return usePrefs((p) => p.terminal);
}

export function setPrefs(patch: Partial<Prefs>) {
  usePrefs.setState(patch);
}

export function setTerminalPrefs(patch: Partial<TerminalPrefs>) {
  usePrefs.setState((p) => ({ terminal: { ...p.terminal, ...patch } }));
}

// builtinOn says whether a built-in plugin runs: one that is on by default
// until turned off, or off by default until turned on.
export function builtinOn(p: { id: string; defaultEnabled?: boolean }, prefs: Pick<Prefs, "disabledPlugins" | "enabledPlugins"> = usePrefs.getState()): boolean {
  return p.defaultEnabled === false ? (prefs.enabledPlugins ?? []).includes(p.id) : !(prefs.disabledPlugins ?? []).includes(p.id);
}

// setBuiltinOn turns a built-in plugin on or off, against its default.
export function setBuiltinOn(p: { id: string; defaultEnabled?: boolean }, on: boolean) {
  const key = p.defaultEnabled === false ? "enabledPlugins" : "disabledPlugins";
  const list = new Set(usePrefs.getState()[key] ?? []);
  if (on === (key === "enabledPlugins")) list.add(p.id);
  else list.delete(p.id);
  usePrefs.setState({ [key]: [...list] } as Partial<Prefs>);
}
