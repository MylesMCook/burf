"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color, radius } from "@/styles/tokens.stylex";


const sm = "@media (min-width: 640px)";

const styles = stylex.create({
  root: {
    position: "relative",
    display: "inline-flex",
    width: { default: 18, [sm]: 16 },
    height: { default: 18, [sm]: 16 },
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.input,
    backgroundColor: color.background,
    outline: "none",
    boxShadow: {
      default: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)",
      ":focus-visible": "0 0 0 1px var(--background), 0 0 0 3px var(--ring)",
      ":disabled": "none",
    },
    opacity: { default: 1, ":disabled": 0.64 },
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    pointerEvents: "auto",
  },
  passive: { pointerEvents: "none" },
  offset: { marginTop: 2 },
  invalid: {
    borderColor: {
      default: "color-mix(in oklab, var(--destructive) 36%, transparent)",
      ":focus-visible": "color-mix(in oklab, var(--destructive) 64%, transparent)",
    },
    boxShadow: {
      default: "none",
      ":focus-visible": "0 0 0 1px var(--background), 0 0 0 3px color-mix(in oklab, var(--destructive) 48%, transparent)",
    },
  },
  darkOff: {
    borderColor: "var(--control-off-border)",
    backgroundColor: "var(--control-fill)",
  },
  indicator: {
    position: "absolute",
    top: -1,
    right: -1,
    bottom: -1,
    left: -1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    color: color.primaryForeground,
  },
  checked: {
    backgroundColor: color.primary,
  },
  mixed: {
    color: color.foreground,
  },
  hidden: { display: "none" },
  mark: {
    width: { default: 14, [sm]: 12 },
    height: { default: 14, [sm]: 12 },
  },
});

export function Checkbox({
  passive = false,
  offset = false,
  ...props
}: Omit<CheckboxPrimitive.Root.Props, "className" | "style"> & {
  passive?: boolean;
  /** Sit 2px below the line so the box lines up with wrapping label text. */
  offset?: boolean;
}): React.ReactElement {
  return (
    // Off, the border is drawn from the foreground in dark themes, where
    // --input sits too close to the background to see.
    <CheckboxPrimitive.Root
      className={(state) =>
        stylex.props(
          styles.root,
          passive && styles.passive,
          offset && styles.offset,
          state.valid === false && styles.invalid,
          !state.checked && !state.indeterminate && styles.darkOff,
        ).className
      }
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={(state) =>
          stylex.props(
            styles.indicator,
            state.checked && !state.indeterminate && styles.checked,
            state.indeterminate && styles.mixed,
            !state.checked && !state.indeterminate && styles.hidden,
          ).className
        }
        data-slot="checkbox-indicator"
        render={(props, state) => (
          <span {...props}>
            {state.indeterminate ? (
              <svg aria-hidden="true" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg" {...stylex.props(styles.mark)}>
                <path d="M5.252 12h13.496" />
              </svg>
            ) : (
              <svg aria-hidden="true" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg" {...stylex.props(styles.mark)}>
                <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
              </svg>
            )}
          </span>
        )}
      />
    </CheckboxPrimitive.Root>
  );
}

export { CheckboxPrimitive };
