import type { Activate, BerthPluginContext, EventHandler, Project } from "@berth/plugin";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useProjects as useAppProjects } from "@/lib/projects";
import { NONE, useStore } from "@/lib/store";
import { useWorkspaces } from "@/lib/workspaces";
import { PluginReactContext, pluginStorage } from "@/plugins/context";
import { contribute } from "@/plugins/registry";

// The runtime half of @berth/plugin: what `import { useBoxes } from
// "@berth/plugin"` resolves to inside a plugin. The types are in
// packages/plugin-sdk; these must match them.

export function definePlugin(activate: Activate): Activate {
  return activate;
}

export function useBerth(): BerthPluginContext {
  const ctx = useContext(PluginReactContext);
  if (!ctx) throw new Error("useBerth must be used in a plugin's component");
  return ctx;
}

export function useBoxes() {
  return useStore((s) => s.status?.boxes ?? NONE);
}

export function useLocations(box: string) {
  return useStore((s) => s.boxes[box]?.locations);
}

export function useSessions(box: string) {
  return useStore((s) => s.boxes[box]?.sessions);
}

export function useStats(box: string) {
  return useStore((s) => s.boxes[box]?.stats);
}

// useEvent listens for events while the component is mounted; the latest
// handler is always the one called.
export function useEvent(type: string, handler: EventHandler) {
  const ctx = useContext(PluginReactContext);
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(
    () => contribute("handlers", { plugin: ctx?.id ?? "app", item: { type, handler: (e) => latest.current(e) } }),
    [type, ctx?.id],
  );
}

export function useCurrentWorktree() {
  return useWorkspaces((s) => (s.current ? s.spaces[s.current]?.ref : undefined));
}

export function useStorage<T>(key: string, initial: T): [T, (value: T) => void] {
  const ctx = useContext(PluginReactContext);
  const store = pluginStorage(ctx?.id ?? "app");
  const [value, setValue] = useState<T>(() => store.get(key, initial));
  const set = useCallback(
    (v: T) => {
      setValue(v);
      pluginStorage(ctx?.id ?? "app").set(key, v);
    },
    [key, ctx?.id],
  );
  return [value, set];
}

// useProjects is the app's projects, trimmed to what plugins need.
export function useProjects(): Project[] {
  const { projects } = useAppProjects();
  return useMemo(
    () =>
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        remote: p.remote,
        defaultBox: p.defaultBox,
        members: p.members.map((m) => ({ box: m.box.name, online: m.box.state === "online", location: m.loc })),
      })),
    [projects],
  );
}

export function worktreeLocation(w: { location: string; worktree: string; main?: boolean }) {
  return w.main ? w.location : `${w.location}/${w.worktree}`;
}
