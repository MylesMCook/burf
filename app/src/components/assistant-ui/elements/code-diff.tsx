"use client";

import type { ComponentProps, CSSProperties } from "react";
import * as stylex from "@stylexjs/stylex";

import { font, radius } from "@/styles/tokens.stylex";
import { codeScroll, codeSurface, fadeIn, mark, mono, paper } from "./surfaces";

const styles = stylex.create({
  card: { width: "100%", maxWidth: 448, overflow: "hidden", borderRadius: radius.xxl, fontFamily: font.mono, fontSize: 12, lineHeight: "16px" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 8 },
  name: { color: "color-mix(in oklab, var(--foreground) 90%, transparent)" },
  nums: { fontVariantNumeric: "tabular-nums" },
  add: { color: "light-dark(var(--color-emerald-600), var(--color-emerald-400))" },
  del: { color: "light-dark(var(--color-red-600), var(--color-red-400))" },
  line: {
    display: "flex",
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 2,
    paddingBottom: 2,
    lineHeight: 1.625,
    whiteSpace: "pre",
  },
  context: { color: "color-mix(in oklab, var(--foreground) 45%, transparent)" },
  added: {
    backgroundColor: "color-mix(in oklab, var(--color-emerald-500) 10%, transparent)",
    color: "light-dark(var(--color-emerald-700), var(--color-emerald-300))",
  },
  removed: {
    backgroundColor: "color-mix(in oklab, var(--color-red-500) 10%, transparent)",
    color: "light-dark(var(--color-red-700), var(--color-red-300))",
  },
  gutter: { width: 16, flexShrink: 0, userSelect: "none" },
});

const kindStyle = { context: styles.context, added: styles.added, removed: styles.removed } as const;

export type DiffKind = "context" | "added" | "removed";

export interface DiffLine {
  kind: DiffKind;
  text: string;
}

const GUTTER: Record<DiffKind, string> = {
  context: "",
  added: "+",
  removed: "−",
};

export function CodeDiff({
  filename,
  additions,
  deletions,
  lines,
  cycle,
  ...props
}: Omit<
  ComponentProps<"div">,
  "children" | "filename" | "additions" | "deletions" | "lines" | "cycle" | "className" | "style"
> & {
  filename: string;
  additions: number;
  deletions: number;
  lines: readonly DiffLine[];
  cycle: number;
}) {
  return (
    <div data-slot="code-diff" {...mark(undefined, paper, styles.card)} {...props}>
      <div {...mark(undefined, styles.head)}>
        <span {...mark(undefined, styles.name)}>{filename}</span>
        <span {...mark(undefined, mono, styles.nums)}>
          <span {...mark(undefined, styles.add)}>+{additions}</span>{" "}
          <span {...mark(undefined, styles.del)}>−{deletions}</span>
        </span>
      </div>
      <div {...mark(undefined, codeScroll)}>
        <div {...mark(undefined, codeSurface)}>
          {lines.map((line, i) => {
            const row = mark(undefined, styles.line, kindStyle[line.kind], fadeIn);
            const style: CSSProperties = { ...row.style, animationDelay: `${i * 60}ms` };
            return (
              <div key={`${cycle}-${i}-${line.text}`} className={row.className} style={style}>
                <span {...mark(undefined, styles.gutter)}>{GUTTER[line.kind]}</span>
                <span>{line.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
