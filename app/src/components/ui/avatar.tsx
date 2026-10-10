"use client";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color, radius } from "@/styles/tokens.stylex";

const styles = stylex.create({
  root: {
    position: "relative",
    isolation: "isolate",
    display: "inline-flex",
    width: 32,
    height: 32,
    flexShrink: 0,
    userSelect: "none",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: radius.full,
    backgroundColor: color.background,
    verticalAlign: "middle",
    fontWeight: 500,
    fontSize: 12,
  },
  fill: { width: "100%", height: "100%", borderRadius: 0 },
  image: {
    position: "absolute",
    inset: 0,
    zIndex: 10,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  hidden: { visibility: "hidden" },
  fallback: {
    position: "absolute",
    inset: 0,
    display: "flex",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: color.muted,
  },
});

export function Avatar({
  fill = false,
  marker,
  ...props
}: Omit<AvatarPrimitive.Root.Props, "className" | "style"> & {
  fill?: boolean;
  marker?: string;
}): React.ReactElement {
  const visual = stylex.props(styles.root, fill && styles.fill);
  const className = marker ? [marker, visual.className].filter(Boolean).join(" ") : visual.className;
  return <AvatarPrimitive.Root className={className} data-slot="avatar" {...props} />;
}

export function AvatarImage({
  marker,
  ...props
}: Omit<AvatarPrimitive.Image.Props, "className" | "style"> & { marker?: string }): React.ReactElement {
  return (
    <AvatarPrimitive.Image
      className={(state) => {
        const painted = stylex.props(styles.image, (state.imageLoadingStatus === "error" || state.imageLoadingStatus === "loading") && styles.hidden);
        return marker ? [marker, painted.className].filter(Boolean).join(" ") : painted.className;
      }}
      data-slot="avatar-image"
      {...props}
    />
  );
}

export function AvatarFallback(props: Omit<AvatarPrimitive.Fallback.Props, "className" | "style">): React.ReactElement {
  return <AvatarPrimitive.Fallback className={stylex.props(styles.fallback).className} data-slot="avatar-fallback" {...props} />;
}

export { AvatarPrimitive };
