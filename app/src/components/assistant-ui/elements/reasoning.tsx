"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import * as stylex from "@stylexjs/stylex";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { mark, shimmer, withClass } from "./surfaces";

export const ANIMATION_DURATION = 200;

const still = "@media (prefers-reduced-motion: reduce)";

const textIn = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(-16px)", filter: "blur(2px)" },
  to: { opacity: 1, transform: "translateY(0)", filter: "blur(0)" },
});

const textOut = stylex.keyframes({
  from: { opacity: 1, transform: "translateY(0)", filter: "blur(0)" },
  to: { opacity: 0, transform: "translateY(-16px)", filter: "blur(2px)" },
});

const fadeFrames = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const styles = stylex.create({
  fade: {
    pointerEvents: "none",
    position: "absolute",
    insetInline: 0,
    zIndex: 10,
    height: 32,
    animationName: { default: fadeFrames, [still]: "none" },
    animationDuration: "var(--animation-duration, 200ms)",
    animationFillMode: "both",
  },
  fadeTop: {
    top: 0,
    backgroundImage: {
      default: "linear-gradient(to bottom, var(--background), transparent)",
      ":is([data-variant=muted] &)": "linear-gradient(to bottom, color-mix(in oklab, var(--muted) 50%, var(--background)), transparent)",
    },
  },
  fadeBottom: {
    bottom: 0,
    backgroundImage: {
      default: "linear-gradient(to top, var(--background), transparent)",
      ":is([data-variant=muted] &)": "linear-gradient(to top, color-mix(in oklab, var(--muted) 50%, var(--background)), transparent)",
    },
  },
  icon: { width: 16, height: 16, flexShrink: 0 },
  label: { display: "inline-block", lineHeight: 1, fontVariantNumeric: "tabular-nums" },
  chevron: {
    marginTop: 2,
    width: 16,
    height: 16,
    flexShrink: 0,
    transform: {
      default: "rotate(-90deg)",
      ":is([data-open] > &)": "rotate(0deg)",
      ":is([data-panel-open] > &)": "rotate(0deg)",
      ":is([data-state=open] > &)": "rotate(0deg)",
    },
    transitionProperty: "transform",
    transitionDuration: { default: "var(--animation-duration, 200ms)", [still]: "0s" },
    transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
  },
  text: {
    position: "relative",
    zIndex: 0,
    maxHeight: 256,
    overflowY: "auto",
    paddingInlineStart: 24,
    paddingTop: 8,
    paddingBottom: 8,
    lineHeight: 1.625,
    textWrap: "pretty",
    transform: "translateZ(0)",
    transitionProperty: "transform, opacity",
    transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
    animationDuration: "var(--animation-duration, 200ms)",
    animationFillMode: "both",
    animationName: {
      default: "none",
      ":is([data-open] > &)": textIn,
      ":is([data-state=open] > &)": textIn,
      ":is([data-closed] > &)": textOut,
      ":is([data-state=closed] > &)": textOut,
      [still]: "none",
    },
  },
  content: {
    ":not(#\\#) > :not(:first-child)": { marginTop: 16 },
  },
});

const ReasoningPreviewContext = createContext(false);

export type ReasoningRootProps = Omit<
  React.ComponentProps<typeof Collapsible>,
  "open" | "onOpenChange"
> & {
  variant?: "outline" | "ghost" | "muted";
} & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
    /**
     * Whether the reasoning is currently streaming. While `true` the
     * disclosure is held open with a bottom-pinned live preview; when
     * streaming ends it returns to `defaultOpen`, and the first manual
     * toggle takes over the open/close state permanently. The live preview
     * keeps following the newest tokens while the disclosure is open during
     * streaming, even after a manual toggle, and pauses while the reader is
     * scrolled up.
     */
    streaming?: boolean;
    /** Called right before the disclosure animates, on toggle and on streaming transitions. */
    onAnimationStart?: () => void;
  };

function ReasoningRoot({
  variant = "outline",
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  streaming,
  onAnimationStart,
  children,
  ...props
}: ReasoningRootProps) {
  const [initialOpen] = useState(defaultOpen);
  const [userOpen, setUserOpen] = useState<boolean | null>(null);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled
    ? controlledOpen
    : (userOpen ?? (streaming || initialOpen));
  const isPreview = streaming === true && isOpen;

  const prevStreamingRef = useRef(streaming);
  useLayoutEffect(() => {
    if (prevStreamingRef.current === streaming) return;
    prevStreamingRef.current = streaming;
    // A streaming transition only animates the panel when the resting state
    // is collapsed; with `defaultOpen` the disclosure stays open across it.
    if (!isControlled && userOpen === null && !initialOpen) {
      onAnimationStart?.();
    }
  }, [streaming, isControlled, userOpen, initialOpen, onAnimationStart]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onAnimationStart?.();
      if (!isControlled) {
        setUserOpen(open);
      }
      controlledOnOpenChange?.(open);
    },
    [onAnimationStart, isControlled, controlledOnOpenChange],
  );

  return (
    <Collapsible
      data-slot="reasoning-root"
      data-variant={variant}
      open={isOpen}
      onOpenChange={handleOpenChange}
      below
      chrome={variant === "muted" ? "muted" : variant === "ghost" ? "none" : "outline"}
      marker="aui-reasoning-root group/reasoning-root"
      pad={variant === "ghost" ? "none" : "text"}
      width="full"
      style={
        {
          "--animation-duration": `${ANIMATION_DURATION}ms`,
        } as React.CSSProperties
      }
      {...props}
    >
      <ReasoningPreviewContext.Provider value={isPreview}>
        {children}
      </ReasoningPreviewContext.Provider>
    </Collapsible>
  );
}

function ReasoningFade({
  side = "bottom",
  className,
  ...props
}: React.ComponentProps<"div"> & { side?: "top" | "bottom" }) {
  return (
    <div
      data-slot="reasoning-fade"
      {...withClass("aui-reasoning-fade", className, styles.fade, side === "top" ? styles.fadeTop : styles.fadeBottom)}
      {...props}
    />
  );
}

function ReasoningTrigger({
  active,
  duration,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
  active?: boolean;
  duration?: number | undefined;
}) {
  const durationText = duration ? ` (${duration}s)` : "";

  return (
    <CollapsibleTrigger
      data-slot="reasoning-trigger"
      look="reason"
      marker="aui-reasoning-trigger group/trigger"
      {...props}
    >
      <BrainIcon
        data-slot="reasoning-trigger-icon"
        {...mark("aui-reasoning-trigger-icon", styles.icon)}
      />
      <span
        data-slot="reasoning-trigger-label"
        {...mark("aui-reasoning-trigger-label-wrapper", styles.label, active && shimmer)}
      >
        Reasoning{durationText}
      </span>
      <ChevronDownIcon
        data-slot="reasoning-trigger-chevron"
        {...mark("aui-reasoning-trigger-chevron", styles.chevron)}
      />
    </CollapsibleTrigger>
  );
}

function ReasoningContent({
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  const isPreview = useContext(ReasoningPreviewContext);

  return (
    <CollapsibleContent
      data-slot="reasoning-content"
      marker="aui-reasoning-content group/collapsible-content"
      text="sm"
      tone="muted"
      {...props}
    >
      <ReasoningFade side="top" />
      {children}
      {isPreview ? <ReasoningFade /> : null}
    </CollapsibleContent>
  );
}

function ReasoningText({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const isPreview = useContext(ReasoningPreviewContext);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPreview) return;
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl) return;

    let pinned = true;
    let lastScrollTop = scrollEl.scrollTop;
    let lastScrollHeight = scrollEl.scrollHeight;
    const isAtBottom = () =>
      Math.abs(
        scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight,
      ) <= 1 || scrollEl.scrollHeight <= scrollEl.clientHeight;

    const pin = () => {
      if (!pinned) return;
      scrollEl.scrollTop = scrollEl.scrollHeight;
    };
    // A pin's own scroll event can arrive after new content grew the scroll
    // height and read as "not at bottom"; only an upward move at unchanged
    // scroll height is user intent.
    const onScroll = () => {
      if (isAtBottom()) {
        pinned = true;
      } else if (
        scrollEl.scrollTop < lastScrollTop &&
        scrollEl.scrollHeight === lastScrollHeight
      ) {
        pinned = false;
      }
      lastScrollTop = scrollEl.scrollTop;
      lastScrollHeight = scrollEl.scrollHeight;
    };

    pin();
    scrollEl.addEventListener("scroll", onScroll);
    const observer = new ResizeObserver(pin);
    observer.observe(contentEl);
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [isPreview]);

  return (
    <div
      ref={scrollRef}
      data-slot="reasoning-text"
      {...withClass("aui-reasoning-text", className, styles.text)}
      {...props}
    >
      <div ref={contentRef} {...mark("aui-reasoning-text-content", styles.content)}>
        {children}
      </div>
    </div>
  );
}

export {
  ReasoningRoot,
  ReasoningTrigger,
  ReasoningContent,
  ReasoningText,
  ReasoningFade,
};
