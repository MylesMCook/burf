import * as stylex from "@stylexjs/stylex";
import type * as React from "react";

import { platformKeys } from "@/lib/platform";
import { color, font, radius } from "@/styles/tokens.stylex";

const styles = stylex.create({
  kbd: {
    pointerEvents: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 20,
    minWidth: 20,
    userSelect: "none",
    borderRadius: radius.sm,
    backgroundColor: color.muted,
    paddingLeft: 4,
    paddingRight: 4,
    fontWeight: 500,
    fontFamily: font.sans,
    fontSize: 12,
    color: color.mutedForeground,
  },
  group: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
});

// A key hint as a string is written for this platform (lib/platform.ts):
// ⌘K on a Mac, Ctrl+K on Linux.
export function Kbd({ children, ...props }: Omit<React.ComponentProps<"kbd">, "className" | "style">): React.ReactElement {
  return (
    <kbd {...stylex.props(styles.kbd)} data-slot="kbd" {...props}>
      {typeof children === "string" ? platformKeys(children) : children}
    </kbd>
  );
}

export function KbdGroup(props: Omit<React.ComponentProps<"kbd">, "className" | "style">): React.ReactElement {
  return <kbd {...stylex.props(styles.group)} data-slot="kbd-group" {...props} />;
}
