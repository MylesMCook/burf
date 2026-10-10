"use client";

import type { ComponentProps } from "react";
import { CopyIcon, RefreshCwIcon } from "lucide-react";
import * as stylex from "@stylexjs/stylex";

import { radius } from "@/styles/tokens.stylex";
import { fadeIn, ghostButton, live, mark, paper, pulse, slow } from "./surfaces";
import { take } from "../utils/range";

const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  root: { display: "flex", width: "100%", maxWidth: 384, flexDirection: "column", gap: 20 },
  user: { maxWidth: "85%", alignSelf: "flex-end", fontSize: 14, lineHeight: "20px" },
  bubble: { borderRadius: radius.xxl, paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8 },
  flat: { color: "color-mix(in oklab, var(--foreground) 90%, transparent)", textAlign: "end" },
  reply: { display: "flex", flexDirection: "column", alignItems: "flex-start" },
  body: { minHeight: 68, fontSize: 14, lineHeight: 1.625 },
  word: { transitionProperty: "color", transitionDuration: { default: "700ms", [still]: "0s" } },
  caret: {
    marginBottom: -2,
    marginLeft: 2,
    display: "inline-block",
    height: 16,
    width: 2,
    borderRadius: radius.full,
    backgroundColor: "light-dark(var(--color-blue-500), var(--color-blue-400))",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    paddingTop: 4,
    opacity: { default: 0, ":is(:hover > &)": 1, ":is(:focus-within > &)": 1 },
    transitionProperty: "opacity",
    transitionDuration: { default: "150ms", [still]: "0s" },
  },
  button: { width: 28, height: 28 },
  icon: { width: 14, height: 14 },
});

export interface MessagePairProps extends Omit<
  ComponentProps<"div">,
  "children" | "onCopy" | "className" | "style"
> {
  userMessage: string;
  words: readonly string[];
  visibleWords: number;
  streaming: boolean;
  variant?: "bubble" | "flat";
  onCopy?: () => void;
  onRegenerate?: () => void;
}

export function MessagePair({
  userMessage,
  words,
  visibleWords,
  streaming,
  variant = "bubble",
  onCopy,
  onRegenerate,
  ...props
}: MessagePairProps) {
  const shown = take(words, visibleWords);

  return (
    <div data-slot="message-pair" {...mark(undefined, styles.root)} {...props}>
      <p {...mark(undefined, styles.user, variant === "bubble" ? paper : null, variant === "bubble" ? styles.bubble : styles.flat)}>
        {userMessage}
      </p>
      <div {...mark(undefined, styles.reply)}>
        <p {...mark(undefined, styles.body)}>
          {shown.map((word, index) => {
            const fresh = streaming && shown.length - 1 - index < 2;
            return (
              <span key={`${word}-${index}`} {...mark(undefined, fadeIn, slow)}>
                <span {...mark(undefined, styles.word, fresh && live)}>{word}</span>{" "}
              </span>
            );
          })}
          {streaming && shown.length > 0 && <span aria-hidden {...mark(undefined, styles.caret, pulse)} />}
        </p>
        {(onCopy || onRegenerate) && (
          <div {...mark(undefined, styles.actions)}>
            {onCopy && (
              <button type="button" aria-label="Copy response" onClick={onCopy} {...mark(undefined, ghostButton, styles.button)}>
                <CopyIcon {...mark(undefined, styles.icon)} />
              </button>
            )}
            {onRegenerate && (
              <button type="button" aria-label="Regenerate response" onClick={onRegenerate} {...mark(undefined, ghostButton, styles.button)}>
                <RefreshCwIcon {...mark(undefined, styles.icon)} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
