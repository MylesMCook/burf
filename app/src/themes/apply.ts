import type { Theme } from "@/lib/api";

// applyTheme writes a theme's colors over the coss tokens in index.css.
// Inline custom properties on <html> win over the stylesheet's :root and
// .dark blocks, so every component follows without knowing about themes.
export function applyTheme(theme: Theme) {
  const c = theme.colors;
  const vars: Record<string, string> = {
    "--background": c.background,
    "--foreground": c.foreground,
    "--card": c.card,
    "--card-foreground": c.foreground,
    "--popover": c.popover,
    "--popover-foreground": c.foreground,
    "--primary": c.primary,
    "--primary-foreground": c.primaryForeground,
    "--secondary": c.muted,
    "--secondary-foreground": c.foreground,
    "--muted": c.muted,
    "--muted-foreground": c.mutedForeground,
    "--accent": c.accent,
    "--accent-foreground": c.accentForeground,
    "--border": c.border,
    "--input": c.border,
    "--ring": c.ring,
    "--success": c.success,
    "--warning": c.warning,
    "--destructive": c.destructive,
    "--sidebar": c.sidebar,
    "--sidebar-foreground": c.sidebarForeground,
    "--sidebar-accent": c.accent,
    "--sidebar-accent-foreground": c.accentForeground,
    "--sidebar-border": c.border,
    "--sidebar-primary": c.primary,
    "--sidebar-primary-foreground": c.primaryForeground,
    "--sidebar-ring": c.ring,
    "--terminal-background": theme.terminal.background,
  };
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.classList.toggle("dark", theme.appearance === "dark");
  root.style.colorScheme = theme.appearance;
}

// xtermTheme is the terminal palette in xterm.js's own names.
export function xtermTheme(theme: Theme) {
  return { ...theme.terminal, cursorAccent: theme.terminal.background };
}
