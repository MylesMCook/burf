import type { Theme } from "@/lib/api";

// The theme as an artifact sees it. bklit's charts read their colours from
// --chart-* variables (ui.bklit.com/docs/theming); Berth sets them from the
// active theme, so every chart reads right in all 23 themes without
// per-theme work. A page gets the same, plus --berth-* for its surfaces,
// in its URL's fragment (the proxy's page script applies them).

const mix = (a: string, b: string, pct: number) => `color-mix(in oklab, ${a} ${pct}%, ${b})`;

// chartVars: bklit's variable names, from the theme. The series palette is
// the theme's own terminal colours, so Dracula's charts are its purple and
// pink, Nord's its frost blues.
export function chartVars(t: Theme): Record<string, string> {
  const c = t.colors;
  const k = t.terminal as unknown as Record<string, string | undefined>;
  const dark = t.appearance === "dark";
  const hot = c.destructive;
  const s1 = k.blue ?? c.primary;
  const s2 = k.magenta ?? c.info ?? c.primary;
  return {
    "--chart-1": s1,
    "--chart-2": s2,
    "--chart-3": k.cyan ?? c.success,
    "--chart-4": k.yellow ?? c.warning,
    "--chart-5": k.green ?? c.success,
    "--chart-good": c.successForeground ?? c.success,
    "--chart-bad": c.destructiveForeground ?? c.destructive,
    "--chart-warn": c.warningForeground ?? c.warning,
    "--chart-muted": mix(c.mutedForeground, c.background, 55),
    "--chart-background": c.card,
    "--chart-foreground": c.foreground,
    "--chart-foreground-muted": c.mutedForeground,
    "--chart-label": c.mutedForeground,
    "--chart-grid": mix(c.border, c.background, dark ? 100 : 80),
    "--chart-crosshair": mix(c.foreground, c.background, 45),
    "--chart-brush-border": c.border,
    "--chart-line-primary": s1,
    "--chart-line-secondary": s2,
    "--chart-tooltip-background": mix(c.popover, "transparent", 94),
    "--chart-tooltip-foreground": c.foreground,
    "--chart-tooltip-muted": c.mutedForeground,
    "--chart-marker-background": c.card,
    "--chart-marker-border": c.border,
    "--chart-marker-foreground": c.foreground,
    "--chart-indicator-color": s1,
    "--chart-indicator-secondary-color": s2,
    "--chart-segment-background": mix(c.foreground, "transparent", 6),
    "--chart-segment-line": mix(c.foreground, "transparent", 30),
    // Heat: from the surface through the theme's warning to its red.
    "--chart-scale-01": mix(c.muted, c.background, 70),
    "--chart-scale-02": mix(c.warning, c.muted, 30),
    "--chart-scale-03": mix(c.warning, c.muted, 70),
    "--chart-scale-04": mix(hot, c.warning, 55),
    "--chart-scale-05": hot,
    "--chart-scale-pattern-color": c.background,
    // Text on heat cells: quiet on the low levels; on the warm ones the
    // surface colour in a dark theme, the text colour in a light one.
    "--chart-heat-ink-lo": c.mutedForeground,
    "--chart-heat-ink-hi": dark ? c.background : c.foreground,
  };
}

export function berthVars(t: Theme): Record<string, string> {
  const c = t.colors;
  return {
    "--berth-bg": c.background,
    "--berth-fg": c.foreground,
    "--berth-card": c.card,
    "--berth-muted": c.muted,
    "--berth-muted-fg": c.mutedForeground,
    "--berth-border": c.border,
    "--berth-accent": c.primary,
    "--berth-accent-fg": c.primaryForeground,
    "--berth-good": c.successForeground ?? c.success,
    "--berth-bad": c.destructiveForeground ?? c.destructive,
    "--berth-warn": c.warningForeground ?? c.warning,
    "--berth-info": c.infoForeground ?? c.info ?? c.primary,
    "--berth-radius": "8px",
    "--berth-font": `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
    "--berth-mono": `ui-monospace, "SF Mono", Menlo, monospace`,
  };
}

// pageTheme is what a page is given: its variables and colour scheme, as
// the proxy's page script reads them (#berth=…, or a berth:theme message).
export function pageTheme(t: Theme): { berth: "theme"; vars: Record<string, string>; scheme: "light" | "dark" } {
  return { berth: "theme", vars: { ...berthVars(t), ...chartVars(t) }, scheme: t.appearance };
}

export const themeFragment = (t: Theme) => `#berth=${encodeURIComponent(JSON.stringify({ vars: pageTheme(t).vars, scheme: t.appearance }))}`;
