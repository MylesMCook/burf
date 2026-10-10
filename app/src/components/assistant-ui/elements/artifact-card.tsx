"use client";

import type { ComponentProps } from "react";
import { ArrowUpRightIcon, FileTextIcon } from "lucide-react";
import * as stylex from "@stylexjs/stylex";

import { radius } from "@/styles/tokens.stylex";
import { blurIn, mark, mono, paper, pulse, ShimmerLabel } from "./surfaces";

const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  card: {
    display: "flex",
    width: "100%",
    maxWidth: 320,
    cursor: "pointer",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 14,
    transform: { default: "scale(1)", ":hover": "translateY(-1px)", ":active": "scale(0.98)" },
    transitionProperty: "transform",
    transitionDuration: { default: "150ms", [still]: "0s" },
  },
  iconBox: {
    display: "flex",
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.xl,
    backgroundColor: "color-mix(in oklab, var(--foreground) 5%, transparent)",
    color: "color-mix(in oklab, var(--foreground) 45%, transparent)",
  },
  icon: { width: 16, height: 16 },
  copy: { minWidth: 0, flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  title: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13.5, fontWeight: 500 },
  meta: { display: "flex", alignItems: "center", gap: 4, color: "color-mix(in oklab, var(--foreground) 40%, transparent)" },
  nums: { fontVariantNumeric: "tabular-nums" },
  arrow: {
    width: 14,
    height: 14,
    color: "color-mix(in oklab, var(--foreground) 35%, transparent)",
    opacity: { default: 0, ":is(:hover > &)": 1 },
    transitionProperty: "opacity",
    transitionDuration: { default: "150ms", [still]: "0s" },
  },
});

export function ArtifactCard({
  title,
  meta,
  generating = false,
  words = 0,
  ...props
}: Omit<
  ComponentProps<"div">,
  "children" | "title" | "meta" | "generating" | "words" | "className" | "style"
> & {
  title: string;
  meta: string;
  generating?: boolean;
  words?: number;
}) {
  return (
    <div data-slot="artifact-card" {...mark(undefined, paper, styles.card)} {...props}>
      <span {...mark(undefined, styles.iconBox)}>
        <FileTextIcon {...mark(undefined, styles.icon, generating && pulse)} />
      </span>
      <div {...mark(undefined, styles.copy)}>
        <p {...mark(undefined, styles.title)}>{title}</p>
        {generating ? (
          <p {...mark(undefined, mono, styles.meta)}>
            <ShimmerLabel>Writing</ShimmerLabel>
            <span>·</span>
            <span {...mark(undefined, styles.nums)}>{words} words</span>
          </p>
        ) : (
          <p {...mark(undefined, mono, styles.meta, blurIn)}>{meta}</p>
        )}
      </div>
      <ArrowUpRightIcon {...mark(undefined, styles.arrow)} />
    </div>
  );
}
