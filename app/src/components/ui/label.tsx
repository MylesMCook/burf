"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color } from "@/styles/tokens.stylex";

const sm = "@media (min-width: 640px)";

const styles = stylex.create({
  label: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 500,
    fontSize: { default: 16, [sm]: 14 },
    lineHeight: { default: "18px", [sm]: "16px" },
    color: color.foreground,
  },
  drag: {
    cursor: "ew-resize",
  },
});

export function Label({
  render,
  drag = false,
  ...props
}: Omit<useRender.ComponentProps<"label">, "className" | "style"> & { drag?: boolean }): React.ReactElement {
  const visual = stylex.props(styles.label, drag && styles.drag);
  return useRender({
    defaultTagName: "label",
    props: mergeProps<"label">(visual, props),
    render,
  });
}
