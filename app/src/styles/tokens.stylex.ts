import * as stylex from "@stylexjs/stylex";

// Themeable values. applyTheme still writes the CSS variables. StyleX points
// at them, so a theme change reaches every StyleX surface.
export const color = stylex.defineVars({
  background: "var(--background)",
  foreground: "var(--foreground)",
  muted: "var(--muted)",
  mutedForeground: "var(--muted-foreground)",
  popover: "var(--popover)",
  popoverForeground: "var(--popover-foreground)",
  accent: "var(--accent)",
  accentForeground: "var(--accent-foreground)",
  border: "var(--border)",
  ring: "var(--ring)",
  primary: "var(--primary)",
  primaryForeground: "var(--primary-foreground)",
  input: "var(--input)",
  destructive: "var(--destructive)",
  destructiveForeground: "var(--destructive-foreground)",
  card: "var(--card)",
  cardForeground: "var(--card-foreground)",
  secondary: "var(--secondary)",
  secondaryForeground: "var(--secondary-foreground)",
  sidebar: "var(--sidebar)",
  sidebarForeground: "var(--sidebar-foreground)",
  sidebarBorder: "var(--sidebar-border)",
  sidebarAccent: "var(--sidebar-accent)",
  sidebarAccentForeground: "var(--sidebar-accent-foreground)",
  success: "var(--success)",
  warning: "var(--warning)",
  info: "var(--info)",
});

export const radius = stylex.defineVars({
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  xxl: "var(--radius-2xl)",
  full: "999px",
});

export const font = stylex.defineVars({
  sans: "var(--font-sans)",
  mono: "var(--font-mono)",
});
