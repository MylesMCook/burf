"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color, radius } from "@/styles/tokens.stylex";


const sm = "@media (min-width: 640px)";

const styles = stylex.create({
  root: {
    display: "inline-flex",
    height: { default: 22, [sm]: 18 },
    width: { default: 38, [sm]: 30 },
    flexShrink: 0,
    alignItems: "center",
    borderRadius: radius.full,
    padding: 1,
    outline: "none",
    backgroundColor: "color-mix(in oklab, var(--input) 100%, transparent)",
    boxShadow: {
      default: "none",
      ":focus-visible": "0 0 0 1px var(--background), 0 0 0 3px var(--ring)",
    },
    opacity: { default: 1, ":disabled": 0.64 },
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    transitionProperty: "background-color, box-shadow",
    transitionDuration: "200ms",
  },
  on: { backgroundColor: color.primary },
  off: {
    backgroundColor: "var(--switch-off)",
  },
  thumb: {
    pointerEvents: "none",
    display: "block",
    aspectRatio: "1",
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: color.background,
    boxShadow: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)",
    transform: "translateX(0)",
    transformOrigin: "left center",
    transitionProperty: "transform, border-radius, background-color",
    transitionDuration: "150ms",
  },
  thumbOn: {
    transform: { default: "translateX(16px)", [sm]: "translateX(12px)" },
    transformOrigin: { default: "20px 50%", [sm]: "16px 50%" },
  },
  thumbOff: {
    backgroundColor: "var(--switch-thumb-off)",
  },
});

export function Switch({
  ...props
}: Omit<SwitchPrimitive.Root.Props, "className" | "style">): React.ReactElement {
  return (
    // Off, in dark themes, the track and thumb are drawn from the
    // foreground: --input and the background are too close to tell apart.
    <SwitchPrimitive.Root
      className={(state) => stylex.props(styles.root, state.checked ? styles.on : styles.off).className}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={(state) =>
          stylex.props(styles.thumb, state.checked ? styles.thumbOn : styles.thumbOff).className
        }
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { SwitchPrimitive };
