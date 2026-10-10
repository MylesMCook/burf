import * as stylex from "@stylexjs/stylex";
import type * as React from "react";

import { color, radius } from "@/styles/tokens.stylex";

const sm = "@media (min-width: 640px)";

const styles = stylex.create({
  base: {
    position: "relative",
    display: "grid",
    width: "100%",
    alignItems: "start",
    columnGap: 8,
    rowGap: 2,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 14,
    paddingRight: 14,
    color: color.cardForeground,
    fontSize: 14,
    gridTemplateColumns: {
      default: "1fr",
      ":has(> svg)": "16px 1fr",
      ":has([data-slot='alert-action'])": "1fr auto",
      ":has(> svg):has([data-slot='alert-action'])": "16px 1fr auto",
    },
  },
  default: {
    backgroundColor: "var(--alert-fill)",
  },
  error: {
    borderColor: "color-mix(in oklab, var(--destructive) 32%, transparent)",
    backgroundColor: "color-mix(in oklab, var(--destructive) 4%, transparent)",
  },
  info: {
    borderColor: "color-mix(in oklab, var(--info) 32%, transparent)",
    backgroundColor: "color-mix(in oklab, var(--info) 4%, transparent)",
  },
  success: {
    borderColor: "color-mix(in oklab, var(--success) 32%, transparent)",
    backgroundColor: "color-mix(in oklab, var(--success) 4%, transparent)",
  },
  warning: {
    borderColor: "color-mix(in oklab, var(--warning) 32%, transparent)",
    backgroundColor: "color-mix(in oklab, var(--warning) 4%, transparent)",
  },
  title: { fontWeight: 500 },
  description: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    color: color.mutedForeground,
  },
  action: {
    display: "flex",
    gap: 4,
    alignSelf: { default: "auto", [sm]: "center" },
    gridRow: { default: "auto", [sm]: "1 / 3" },
    marginTop: { default: 8, [sm]: 0 },
  },
});

const variantStyle = {
  default: styles.default,
  error: styles.error,
  info: styles.info,
  success: styles.success,
  warning: styles.warning,
} as const;

export type AlertVariant = keyof typeof variantStyle;

export function Alert({
  variant = "default",
  ...props
}: Omit<React.ComponentProps<"div">, "className" | "style"> & {
  variant?: AlertVariant;
}): React.ReactElement {
  return <div {...stylex.props(styles.base, variantStyle[variant])} data-slot="alert" role="alert" {...props} />;
}

export function AlertTitle(props: Omit<React.ComponentProps<"div">, "className" | "style">): React.ReactElement {
  return <div {...stylex.props(styles.title)} data-slot="alert-title" {...props} />;
}

export function AlertDescription(props: Omit<React.ComponentProps<"div">, "className" | "style">): React.ReactElement {
  return <div {...stylex.props(styles.description)} data-slot="alert-description" {...props} />;
}

export function AlertAction(props: Omit<React.ComponentProps<"div">, "className" | "style">): React.ReactElement {
  return <div {...stylex.props(styles.action)} data-slot="alert-action" {...props} />;
}
