import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color, radius } from "@/styles/tokens.stylex";

const sweep = stylex.keyframes({
  to: { backgroundPosition: "-200% 0" },
});

const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  bone: {
    width: "100%",
    height: "100%",
    borderRadius: radius.sm,
    backgroundColor: color.muted,
    backgroundImage: "linear-gradient(120deg, transparent 40%, color-mix(in oklab, var(--foreground) 12%, transparent) 50%, transparent 60%)",
    backgroundSize: "200% 100%",
    animationName: sweep,
    animationDuration: { default: "2s", [still]: "0s" },
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
  },
  lg: { borderRadius: radius.xl },
  full: { borderRadius: radius.full },
});

export function Skeleton({
  shape = "sm",
  ...props
}: Omit<React.ComponentProps<"div">, "className" | "style"> & {
  shape?: "sm" | "lg" | "full";
}): React.ReactElement {
  return <div {...stylex.props(styles.bone, shape === "lg" && styles.lg, shape === "full" && styles.full)} data-slot="skeleton" {...props} />;
}
