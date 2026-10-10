"use client";

import {
  memo,
  useCallback,
  useRef,
  useState,
  type FC,
  type PropsWithChildren,
} from "react";
import { ChevronDownIcon, LoaderIcon } from "lucide-react";
import { useScrollLock } from "@assistant-ui/react";
import * as stylex from "@stylexjs/stylex";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { mark, shimmer, spinFast } from "./surfaces";

const ANIMATION_DURATION = 200;
const still = "@media (prefers-reduced-motion: reduce)";

const childIn = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(-4px)", filter: "blur(2px)" },
  to: { opacity: 1, transform: "translateY(0)", filter: "blur(0)" },
});

const styles = stylex.create({
  loader: { width: 12, height: 12, flexShrink: 0 },
  label: {
    display: "inline-block",
    textAlign: "start",
    fontSize: 12,
    lineHeight: 1,
    fontWeight: {
      default: 500,
      ":is([data-variant=ghost] &)": 400,
    },
    flexGrow: {
      default: 0,
      ":is([data-variant=outline] &)": 1,
      ":is([data-variant=muted] &)": 1,
    },
  },
  chevron: {
    width: 12,
    height: 12,
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
  list: {
    display: "flex",
    flexDirection: "column",
    marginTop: {
      default: 8,
      ":is([data-variant=ghost] &)": 4,
      ":is([data-variant=outline] &)": 12,
      ":is([data-variant=muted] &)": 12,
    },
    gap: { default: 8, ":is([data-variant=ghost] &)": 4 },
    borderTopWidth: {
      default: 0,
      ":is([data-variant=outline] &)": 1,
      ":is([data-variant=muted] &)": 1,
    },
    borderTopStyle: "solid",
    borderTopColor: "var(--border)",
    paddingLeft: {
      default: 0,
      ":is([data-variant=outline] &)": 16,
      ":is([data-variant=muted] &)": 16,
    },
    paddingRight: {
      default: 0,
      ":is([data-variant=outline] &)": 16,
      ":is([data-variant=muted] &)": 16,
    },
    paddingTop: {
      default: 0,
      ":is([data-variant=outline] &)": 12,
      ":is([data-variant=muted] &)": 12,
    },
    ":not(#\\#) > *": {
      animationName: { default: childIn, [still]: "none" },
      animationDuration: "var(--animation-duration, 200ms)",
      animationTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
      animationFillMode: "both",
    },
    ":not(#\\#) > *:nth-child(2)": { animationDelay: "40ms" },
    ":not(#\\#) > *:nth-child(3)": { animationDelay: "80ms" },
    ":not(#\\#) > *:nth-child(4)": { animationDelay: "120ms" },
    ":not(#\\#) > *:nth-child(n+5)": { animationDelay: "160ms" },
  },
});

export type ToolGroupRootProps = Omit<
  React.ComponentProps<typeof Collapsible>,
  "open" | "onOpenChange"
> & {
  variant?: "outline" | "ghost" | "muted";
} & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
  };

function ToolGroupRoot({
  variant = "outline",
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  children,
  ...props
}: ToolGroupRootProps) {
  const collapsibleRef = useRef<HTMLDivElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      lockScroll();
      if (!isControlled) {
        setUncontrolledOpen(open);
      }
      controlledOnOpenChange?.(open);
    },
    [lockScroll, isControlled, controlledOnOpenChange],
  );

  return (
    <Collapsible
      ref={collapsibleRef}
      data-slot="tool-group-root"
      data-variant={variant ?? "outline"}
      open={isOpen}
      onOpenChange={handleOpenChange}
      chrome={variant === "muted" ? "tint" : variant === "ghost" ? "none" : "outline"}
      marker="aui-tool-group-root group/tool-group"
      pad={variant === "ghost" ? "none" : "block"}
      width="full"
      style={
        {
          "--animation-duration": `${ANIMATION_DURATION}ms`,
        } as React.CSSProperties
      }
      {...props}
    >
      {children}
    </Collapsible>
  );
}

function ToolGroupTrigger({
  count,
  active = false,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
  count: number;
  active?: boolean;
}) {
  const label = `${count} tool ${count === 1 ? "call" : "calls"}`;

  return (
    <CollapsibleTrigger
      data-slot="tool-group-trigger"
      look="bundle"
      marker="aui-tool-group-trigger group/trigger"
      {...props}
    >
      {active && (
        <LoaderIcon
          data-slot="tool-group-trigger-loader"
          {...mark("aui-tool-group-trigger-loader", styles.loader, spinFast)}
        />
      )}
      <span
        data-slot="tool-group-trigger-label"
        {...mark("aui-tool-group-trigger-label-wrapper", styles.label, active && shimmer)}
      >
        {label}
      </span>
      <ChevronDownIcon
        data-slot="tool-group-trigger-chevron"
        {...mark("aui-tool-group-trigger-chevron", styles.chevron)}
      />
    </CollapsibleTrigger>
  );
}

function ToolGroupContent({
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      data-slot="tool-group-content"
      marker="aui-tool-group-content group/collapsible-content"
      text="sm"
      {...props}
    >
      <div {...mark(undefined, styles.list)}>{children}</div>
    </CollapsibleContent>
  );
}

type ToolGroupComponent = FC<
  PropsWithChildren<{ startIndex: number; endIndex: number }>
> & {
  Root: typeof ToolGroupRoot;
  Trigger: typeof ToolGroupTrigger;
  Content: typeof ToolGroupContent;
};

const ToolGroupImpl: FC<
  PropsWithChildren<{ startIndex: number; endIndex: number }>
> = ({ children, startIndex, endIndex }) => {
  const toolCount = endIndex - startIndex + 1;

  return (
    <ToolGroupRoot>
      <ToolGroupTrigger count={toolCount} />
      <ToolGroupContent>{children}</ToolGroupContent>
    </ToolGroupRoot>
  );
};

/**
 * @deprecated This wrapper targets the legacy `components.ToolGroup` prop
 * on `<MessagePrimitive.Parts>`. Use `<MessagePrimitive.GroupedParts>` with
 * a `groupBy` returning `"group-tool"` and compose `ToolGroupRoot` /
 * `ToolGroupTrigger` / `ToolGroupContent` directly. See `thread.tsx`.
 */
const ToolGroup = memo(ToolGroupImpl) as unknown as ToolGroupComponent;

ToolGroup.displayName = "ToolGroup";
ToolGroup.Root = ToolGroupRoot;
ToolGroup.Trigger = ToolGroupTrigger;
ToolGroup.Content = ToolGroupContent;

export {
  ToolGroup,
  ToolGroupRoot,
  ToolGroupTrigger,
  ToolGroupContent,
};
