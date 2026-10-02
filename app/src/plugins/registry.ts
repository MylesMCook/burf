import type { Command, EventHandler, Screen, SidebarItem, StatusBarItem, WorktreePanel } from "@berth/plugin";
import { create } from "zustand";

import type { BerthEvent, Theme } from "@/lib/api";

// Everything plugins have added, tagged with the plugin that added it so a
// plugin's contributions can all be removed together.

export interface Contribution<T> {
  plugin: string;
  item: T;
}

export interface PluginStatus {
  id: string;
  name: string;
  version?: string;
  state: "loading" | "active" | "failed";
  error?: string;
  builtin?: boolean;
}

interface Registry {
  sidebarItems: Contribution<SidebarItem>[];
  screens: Contribution<Screen>[];
  worktreePanels: Contribution<WorktreePanel>[];
  commands: Contribution<Command>[];
  statusBarItems: Contribution<StatusBarItem>[];
  themes: Contribution<Theme>[];
  handlers: Contribution<{ type: string; handler: EventHandler }>[];
  plugins: PluginStatus[];
}

type ListKey = Exclude<keyof Registry, "plugins">;

export const useRegistry = create<Registry>()(() => ({
  sidebarItems: [],
  screens: [],
  worktreePanels: [],
  commands: [],
  statusBarItems: [],
  themes: [],
  handlers: [],
  plugins: [],
}));

// contribute adds item to a list and returns how to take it out again.
export function contribute<K extends ListKey>(key: K, entry: Registry[K][number]): () => void {
  useRegistry.setState((s) => ({ [key]: [...s[key], entry] }) as Partial<Registry>);
  return () => useRegistry.setState((s) => ({ [key]: (s[key] as unknown[]).filter((e) => e !== entry) }) as Partial<Registry>);
}

// removePlugin drops everything a plugin added, for unloading or reloading it.
export function removePlugin(plugin: string) {
  useRegistry.setState((s) => {
    const next: Partial<Registry> = {};
    for (const key of Object.keys(s) as (keyof Registry)[]) {
      if (key === "plugins") continue;
      (next as Record<string, unknown>)[key] = (s[key] as Contribution<unknown>[]).filter((c) => c.plugin !== plugin);
    }
    return next;
  });
}

export function setPluginStatus(status: PluginStatus) {
  useRegistry.setState((s) => ({ plugins: [...s.plugins.filter((p) => p.id !== status.id), status] }));
}

export function matchesEvent(pattern: string, type: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith(".*")) return type.startsWith(pattern.slice(0, -1));
  return pattern === type;
}

// dispatch hands an event to every plugin listening for it. A handler that
// throws is reported and skipped; it never stops the others.
export function dispatch(e: BerthEvent) {
  for (const { plugin, item } of useRegistry.getState().handlers) {
    if (!matchesEvent(item.type, e.type)) continue;
    try {
      item.handler(e);
    } catch (err) {
      console.error(`plugin ${plugin}: handler for ${e.type} failed`, err);
    }
  }
}
