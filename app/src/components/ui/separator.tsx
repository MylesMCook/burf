import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color } from "@/styles/tokens.stylex";

const styles = stylex.create({
  base: {
    flexShrink: 0,
    backgroundColor: color.border,
    pointerEvents: "none",
  },
  horizontal: {
    height: 1,
    width: "100%",
  },
  vertical: {
    width: 1,
    alignSelf: "stretch",
  },
  input: {
    backgroundColor: color.input,
  },
  // The line between two controls. Focus on the control beside it moves the
  // line 1px toward that control and paints it with the ring, so the focus
  // stroke stays one line. The dark shade sits on ::before.
  shift: {
    position: "relative",
    zIndex: 2,
    backgroundColor: {
      default: color.input,
      ":has(+ :focus-within)": color.ring,
      ":is(:focus-within + *)": color.ring,
      ":has(+ [data-slot='select-trigger']:focus-visible)": color.ring,
      ":is([data-slot='input-control']:focus-within + *)": color.ring,
      ":is([data-slot='number-field']:focus-within + input + *)": color.ring,
    },
    transform: {
      default: "translateX(0)",
      ":has(+ :focus-within)": "translateX(1px)",
      ":has(+ [data-slot='select-trigger']:focus-visible)": "translateX(1px)",
      ":is(:focus-within + *)": "translateX(-1px)",
      ":is([data-slot='input-control']:focus-within + *)": "translateX(-1px)",
      ":is([data-slot='number-field']:focus-within + input + *)": "translateX(-1px)",
    },
    "::before": {
      content: '""',
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: "var(--separator-shade)",
    },
  },
  sidebar: {
    backgroundColor: color.sidebarBorder,
    marginLeft: 8,
    marginRight: 8,
    width: "auto",
  },
});

export function Separator({
  orientation = "horizontal",
  tone = "border",
  shift = false,
  ...props
}: Omit<SeparatorPrimitive.Props, "className" | "style"> & {
  tone?: "border" | "input" | "sidebar";
  shift?: boolean;
}): React.ReactElement {
  return (
    <SeparatorPrimitive
      className={(state) =>
        stylex.props(
          styles.base,
          state.orientation === "vertical" ? styles.vertical : styles.horizontal,
          tone === "input" && styles.input,
          tone === "sidebar" && styles.sidebar,
          shift && styles.shift,
        ).className
      }
      data-slot="separator"
      orientation={orientation}
      {...props}
    />
  );
}

export { SeparatorPrimitive };
