"use client";

import * as stylex from "@stylexjs/stylex";
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowDownIcon } from "lucide-react";
import { fadeIn, field, floating, paper, riseIn } from "./surfaces";

const paint = stylex.create({
  s0: {
    "position": "relative",
    "height": "256px",
    "width": "100%",
    "maxWidth": "384px",
    "overflow": "hidden",
    "borderRadius": "var(--radius-2xl)",
  },
  s1: {
    "display": "flex",
    "height": "100%",
    "flexDirection": "column",
    "gap": "10px",
    "overflowY": "hidden",
    "scrollBehavior": "smooth",
    "padding": "16px",
  },
  s2: {
    "maxWidth": "85%",
    "fontSize": "12px",
    "lineHeight": "1.625",
    "transitionDuration": "300ms",
  },
  s3: {
    "color": "color-mix(in oklab, var(--foreground) 55%, transparent)",
    "alignSelf": "flex-start",
  },
  s4: {
    "pointerEvents": "none",
    "position": "absolute",
    "left": 0,
    "right": 0,
    "top": "0px",
    "height": "24px",
    "backgroundImage": "linear-gradient(to bottom, light-dark(var(--background), var(--popover)), transparent)",
  },
  s5: {
    "position": "absolute",
    "left": 0,
    "right": 0,
    "bottom": "12px",
    "marginLeft": "auto",
    "marginRight": "auto",
    "display": "flex",
    "width": "fit-content",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "999px",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "transitionProperty": "transform",
    "transitionDuration": "200ms",
    "transform": {
      ":hover": "translateY(-1px)",
    },
  },
  s7: {
    "alignSelf": "flex-end",
    "borderRadius": "var(--radius-2xl)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
  },
  s6: {
    "width": "12px",
    "height": "12px",
    "opacity": 0.6,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export interface ScrollAnchorMessage {
  role: "user" | "assistant";
  text: string;
}

const INITIAL_COUNT = 3;
const APPEND_MS = 1300;

export function ScrollAnchor({
  messages,
  paused = false,
  onSettled,
  className,
  ...props
}: Omit<
  ComponentProps<"div">,
  "children" | "messages" | "paused" | "onSettled"
> & {
  messages: ScrollAnchorMessage[];
  paused?: boolean;
  onSettled?: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(INITIAL_COUNT);
  const [pinned, setPinned] = useState(true);
  const [seenCount, setSeenCount] = useState(INITIAL_COUNT);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setCount((current) => {
        if (current >= messages.length) return current;
        return current + 1;
      });
    }, APPEND_MS);
    return () => clearInterval(id);
  }, [messages.length, paused]);

  useEffect(() => {
    if (count >= messages.length && pinned) onSettled?.();
  }, [count, pinned, messages.length, onSettled]);

  useEffect(() => {
    if (count === INITIAL_COUNT + 1) {
      // The unpin lands one commit after the count that triggers it, so the
      // pinned scroll still runs for that message.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPinned(false);
      setSeenCount(count);
      const viewport = viewportRef.current;
      if (viewport) viewport.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [count]);

  useEffect(() => {
    if (!pinned) return;
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight });
  }, [count, pinned]);

  const jump = useCallback(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    }
    setPinned(true);
    setSeenCount(count);
  }, [count]);

  useEffect(() => {
    if (paused || pinned || count - seenCount < 2) return;
    const id = setTimeout(jump, 2400);
    return () => clearTimeout(id);
  }, [paused, pinned, count, seenCount, jump]);

  const newCount = pinned ? 0 : count - seenCount;

  return (
    <div
      data-slot="scroll-anchor"
      className={[sx(paper, paint.s0), className].filter(Boolean).join(" ")}

      {...props}
    >
      <div
        ref={viewportRef}
        className={sx(paint.s1)}
      >
        {messages.slice(0, count).map((message, i) => (
          <div
            key={i}
            className={sx(
              fadeIn,
              riseIn,
              paint.s2,
              message.role === "user" ? field : false,
              message.role === "user" ? paint.s7 : paint.s3,
            )}
          >
            {message.text}
          </div>
        ))}
      </div>
      <div
        aria-hidden
        className={sx(paint.s4)}
      />
      {!pinned && newCount > 0 && (
        <button
          type="button"
          onClick={jump}
          className={sx(floating, paint.s5, fadeIn, riseIn)}
        >
          <ArrowDownIcon className={sx(paint.s6)} />
          {newCount} new {newCount === 1 ? "message" : "messages"}
        </button>
      )}
    </div>
  );
}
