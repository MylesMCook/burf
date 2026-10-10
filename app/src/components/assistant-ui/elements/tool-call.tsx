"use client";

import { CheckIcon, ChevronRightIcon } from "lucide-react";
import * as stylex from "@stylexjs/stylex";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { font, radius } from "@/styles/tokens.stylex";
import { field, mark, mono, popIn, ShimmerLabel, SwapLabel } from "./surfaces";

const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  chevron: {
    width: 14,
    height: 14,
    flexShrink: 0,
    opacity: 0.6,
    transform: {
      default: "rotate(0deg)",
      ":is([data-open] > &)": "rotate(90deg)",
      ":is([data-panel-open] > &)": "rotate(90deg)",
      ":is([data-state=open] > &)": "rotate(90deg)",
    },
    transitionProperty: "transform",
    transitionDuration: { default: "200ms", [still]: "0s" },
    transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
  },
  chip: {
    backgroundColor: "color-mix(in oklab, var(--foreground) 6%, transparent)",
    color: "color-mix(in oklab, var(--foreground) 70%, transparent)",
    borderRadius: radius.md,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 2,
    paddingBottom: 2,
  },
  checkSlot: { marginInlineStart: "auto", display: "flex", width: 16, alignItems: "center", justifyContent: "flex-end" },
  check: { width: 14, height: 14, color: "var(--color-emerald-500)" },
  body: { marginTop: 8, overflow: "hidden", borderRadius: radius.xxl, fontSize: 12, lineHeight: "16px" },
  request: { paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 8 },
  result: { paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 10 },
  kicker: { marginBottom: 4, color: "color-mix(in oklab, var(--foreground) 35%, transparent)" },
  requestText: { color: "color-mix(in oklab, var(--foreground) 55%, transparent)", fontFamily: font.mono },
  resultText: { color: "color-mix(in oklab, var(--foreground) 90%, transparent)" },
  rule: { height: 1, marginLeft: 14, marginRight: 14, backgroundColor: "color-mix(in oklab, var(--foreground) 6%, transparent)" },
});

export interface ToolCallProps {
  label: string;
  activeLabel: string;
  query: string;
  request: string;
  result: string;
  running: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ToolCall({
  label,
  activeLabel,
  query,
  request,
  result,
  running,
  open,
  onOpenChange,
}: ToolCallProps) {
  return (
    <Collapsible data-slot="tool-call" onOpenChange={onOpenChange} open={open} width="tool">
      <CollapsibleTrigger look="tool" marker="group/trigger">
        <ChevronRightIcon {...mark(undefined, styles.chevron)} />
        <SwapLabel active={running ? 0 : 1} align="start">
          <ShimmerLabel active={running}>{activeLabel}</ShimmerLabel>
          <>{label}</>
        </SwapLabel>
        <span {...mark(undefined, mono, styles.chip)}>{query}</span>
        <span {...mark(undefined, styles.checkSlot)}>
          {!running && <CheckIcon {...mark(undefined, styles.check, popIn)} />}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div {...mark(undefined, field, styles.body)}>
          <div {...mark(undefined, styles.request)}>
            <p {...mark(undefined, mono, styles.kicker)}>Request</p>
            <p {...mark(undefined, styles.requestText)}>{request}</p>
          </div>
          <div {...mark(undefined, styles.rule)} />
          <div {...mark(undefined, styles.result)}>
            <p {...mark(undefined, mono, styles.kicker)}>Result</p>
            <p {...mark(undefined, styles.resultText)}>{result}</p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
