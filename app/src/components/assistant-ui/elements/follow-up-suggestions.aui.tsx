"use client";

import { AuiIf, useAuiState, ThreadPrimitive } from "@assistant-ui/react";
import { useCallback, useEffect, useRef, useState, type FC } from "react";
import * as stylex from "@stylexjs/stylex";

import { color, radius } from "@/styles/tokens.stylex";
import { mark } from "./surfaces";

const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  scroller: {
    marginTop: -4,
    marginBottom: -4,
    width: "100%",
    scrollbarWidth: "none",
    overflowX: "auto",
    paddingTop: 4,
    paddingBottom: 4,
    "::-webkit-scrollbar": { display: "none" },
  },
  row: {
    marginInline: "auto",
    display: "flex",
    minHeight: 32,
    width: "max-content",
    alignItems: "center",
    gap: 8,
    paddingLeft: 2,
    paddingRight: 2,
  },
  chip: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: {
      default: "color-mix(in oklab, var(--foreground) 10%, transparent)",
      ":hover": "color-mix(in oklab, var(--foreground) 25%, transparent)",
    },
    backgroundColor: { ":hover": "color-mix(in oklab, var(--foreground) 3%, transparent)" },
    borderRadius: radius.md,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 4,
    paddingBottom: 4,
    fontSize: 14,
    lineHeight: "20px",
    whiteSpace: "nowrap",
    transitionProperty: "background-color, border-color, color",
    transitionTimingFunction: "cubic-bezier(0.4, 0, 1, 1)",
    transitionDuration: { default: "150ms", [still]: "0s" },
  },
  label: { color: color.mutedForeground, marginInlineStart: 4 },
});

const FollowupSuggestionsRow: FC = () => {
  const suggestions = useAuiState((s) => s.thread.suggestions);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rtlRef = useRef<boolean | null>(null);
  const [fades, setFades] = useState({ left: false, right: false });

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    // scrollLeft runs 0..-max in RTL; normalize to hidden width per physical edge.
    const fromStart = Math.abs(el.scrollLeft);
    // getComputedStyle forces a style recalc per scroll event; direction is stable, read it once.
    const rtl = (rtlRef.current ??= getComputedStyle(el).direction === "rtl");
    const [left, right] = rtl
      ? [maxScroll - fromStart, fromStart]
      : [fromStart, maxScroll - fromStart];
    setFades((prev) => {
      const next = { left: left > 1, right: right > 1 };
      return prev.left === next.left && prev.right === next.right ? prev : next;
    });
  }, []);

  useEffect(() => {
    updateFades();
    const el = scrollRef.current;
    if (!el?.firstElementChild) return undefined;
    const observer = new ResizeObserver(updateFades);
    observer.observe(el);
    observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [updateFades]);

  const maskImage = `linear-gradient(to right, ${
    fades.left ? "transparent, black 2rem" : "black"
  }, ${fades.right ? "black calc(100% - 2rem), transparent" : "black"})`;

  const scroller = mark("aui-thread-followup-suggestions", styles.scroller);
  return (
    <div
      ref={scrollRef}
      onScroll={updateFades}
      className={scroller.className}
      style={{ ...scroller.style, maskImage, WebkitMaskImage: maskImage }}
    >
      <div {...mark(undefined, styles.row)}>
        {suggestions.map((suggestion, idx) => (
          <ThreadPrimitive.Suggestion
            key={idx}
            className={mark("aui-thread-followup-suggestion", styles.chip).className}
            prompt={suggestion.prompt}
            send
          >
            {suggestion.title ?? suggestion.prompt}
            {suggestion.label && (
              <span {...mark("aui-thread-followup-suggestion-label", styles.label)}>
                {suggestion.label}
              </span>
            )}
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
};

export const ThreadFollowupSuggestions: FC = () => (
  <AuiIf
    condition={(s) =>
      !s.thread.isEmpty &&
      !s.thread.isRunning &&
      s.thread.suggestions.length > 0
    }
  >
    <FollowupSuggestionsRow />
  </AuiIf>
);
