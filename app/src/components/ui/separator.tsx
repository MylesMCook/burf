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
  ...props
}: Omit<SeparatorPrimitive.Props, "className" | "style"> & {
  tone?: "border" | "input" | "sidebar";
}): React.ReactElement {
  return (
    <SeparatorPrimitive
      className={(state) =>
        stylex.props(
          styles.base,
          state.orientation === "vertical" ? styles.vertical : styles.horizontal,
          tone === "input" && styles.input,
          tone === "sidebar" && styles.sidebar,
        ).className
      }
      data-slot="separator"
      orientation={orientation}
      {...props}
    />
  );
}

export { SeparatorPrimitive };
