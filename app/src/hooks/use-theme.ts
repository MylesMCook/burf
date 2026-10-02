import { useEffect, useMemo, useSyncExternalStore } from "react";

import type { Theme } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useRegistry } from "@/plugins/registry";
import { applyTheme } from "@/themes/apply";
import { berthDark, builtinThemes } from "@/themes/builtin";

// useThemes lists every theme: built-in, then ~/.berth/themes, then plugins'.
// A later one with the same id replaces an earlier one.
export function useThemes(): Theme[] {
  const server = useStore((s) => s.serverThemes);
  const fromPlugins = useRegistry((s) => s.themes);
  return useMemo(() => {
    const byId = new Map<string, Theme>();
    for (const t of [...builtinThemes, ...server, ...fromPlugins.map((c) => c.item)]) {
      if (t?.id && t.colors && t.terminal) byId.set(t.id, t);
    }
    return [...byId.values()];
  }, [server, fromPlugins]);
}

// SYSTEM_THEME follows the computer's light or dark appearance.
export const SYSTEM_THEME = "system";

const darkQuery = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : undefined;

function useSystemDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      darkQuery?.addEventListener("change", onChange);
      return () => darkQuery?.removeEventListener("change", onChange);
    },
    () => darkQuery?.matches ?? true,
  );
}

export function useActiveTheme(): Theme {
  const themes = useThemes();
  const id = useStore((s) => s.themeId);
  const dark = useSystemDark();
  const want = id === SYSTEM_THEME ? (dark ? "berth-dark" : "berth-light") : id;
  return themes.find((t) => t.id === want) ?? berthDark;
}

// useApplyTheme keeps the document's colors in step with the chosen theme.
export function useApplyTheme() {
  const theme = useActiveTheme();
  useEffect(() => applyTheme(theme), [theme]);
}
