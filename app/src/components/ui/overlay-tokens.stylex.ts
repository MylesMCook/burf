import * as stylex from "@stylexjs/stylex";

// A shadow casts shade in every theme; foreground-derived shadows glow in dark themes.
export const overlay = stylex.defineVars({
  selectMaxWidth: "352px",
  selectMaxHeight: "320px",
  shadow: "0 8px 24px rgb(0 0 0 / 0.18)",
});
