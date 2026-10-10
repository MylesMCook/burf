import { Loader2Icon } from "lucide-react";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color } from "@/styles/tokens.stylex";

const spin = stylex.keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  spin: {
    animationName: spin,
    animationDuration: { default: "1s", [still]: "0s" },
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
    flexShrink: 0,
  },
  xs: { width: 10, height: 10 },
  sm: { width: 12, height: 12 },
  md: { width: 14, height: 14 },
  lg: { width: 16, height: 16 },
  muted: { color: color.mutedForeground },
  soft: { opacity: 0.6 },
  cover: {
    position: "absolute",
    pointerEvents: "none",
  },
});

export function Spinner({
  size = "lg",
  muted = false,
  soft = false,
  cover = false,
  ...props
}: Omit<React.ComponentProps<typeof Loader2Icon>, "className" | "style"> & {
  size?: "xs" | "sm" | "md" | "lg";
  muted?: boolean;
  soft?: boolean;
  cover?: boolean;
}): React.ReactElement {
  return (
    <Loader2Icon
      aria-label="Loading"
      role="status"
      {...stylex.props(styles.spin, styles[size], muted && styles.muted, soft && styles.soft, cover && styles.cover)}
      {...props}
    />
  );
}
