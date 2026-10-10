"use client";

import * as stylex from "@stylexjs/stylex";
import { memo, type ComponentProps, type FC } from "react";
import type { QuoteMessagePartComponent } from "@assistant-ui/react";
import {
  ComposerPrimitive,
  SelectionToolbarPrimitive,
} from "@assistant-ui/react";
import { QuoteIcon, XIcon } from "lucide-react";
const paint = stylex.create({
  s0: {
    "marginBottom": "8px",
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "6px",
  },
  s1: {
    "color": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
    "marginTop": "2px",
    "width": "12px",
    "height": "12px",
    "flexShrink": 0,
  },
  s2: {
    "color": "color-mix(in oklab, var(--muted-foreground) 80%, transparent)",
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
    "minWidth": "0px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "fontStyle": "italic",
  },
  s3: {
    "backgroundColor": "var(--popover)",
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s4: {
    "color": "var(--popover-foreground)",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  s5: {
    "width": "14px",
    "height": "14px",
  },
  s6: {
    "backgroundColor": "color-mix(in oklab, var(--muted) 60%, transparent)",
    "marginLeft": "12px",
    "marginRight": "12px",
    "marginTop": "8px",
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s7: {
    "color": "color-mix(in oklab, var(--muted-foreground) 70%, transparent)",
    "marginTop": "2px",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s8: {
    "color": "var(--muted-foreground)",
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s9: {
    "width": "14px",
    "height": "14px",
  },
  s10: {
    "flexShrink": 0,
    "borderRadius": "var(--radius-sm)",
    "padding": "2px",
    "color": {
      "default": "color-mix(in oklab, var(--muted-foreground) 70%, transparent)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    "transitionProperty": "color, background-color",
    "transitionDuration": "150ms",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

function QuoteBlockRoot({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="quote-block"
      className={[sx(paint.s0), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

function QuoteBlockIcon({
  className,
  ...props
}: ComponentProps<typeof QuoteIcon>) {
  return (
    <QuoteIcon
      data-slot="quote-block-icon"
      className={[sx(paint.s1), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

function QuoteBlockText({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="quote-block-text"
      className={[sx(paint.s2), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

/**
 * Renders quoted text in user messages.
 *
 * Pass this to `MessagePrimitive.Parts` as the `Quote` renderer.
 *
 * @example
 * ```tsx
 * <MessagePrimitive.Quote>
 *   {(quote) => <QuoteBlock {...quote} />}
 * </MessagePrimitive.Quote>
 * ```
 */
const QuoteBlockImpl: QuoteMessagePartComponent = ({ text }) => {
  return (
    <QuoteBlockRoot>
      <QuoteBlockIcon />
      <QuoteBlockText>{text}</QuoteBlockText>
    </QuoteBlockRoot>
  );
};

const QuoteBlock = memo(
  QuoteBlockImpl,
) as unknown as QuoteMessagePartComponent & {
  Root: typeof QuoteBlockRoot;
  Icon: typeof QuoteBlockIcon;
  Text: typeof QuoteBlockText;
};

QuoteBlock.displayName = "QuoteBlock";
QuoteBlock.Root = QuoteBlockRoot;
QuoteBlock.Icon = QuoteBlockIcon;
QuoteBlock.Text = QuoteBlockText;

function SelectionToolbarRoot({
  className,
  ...props
}: ComponentProps<typeof SelectionToolbarPrimitive.Root>) {
  return (
    <SelectionToolbarPrimitive.Root
      data-slot="selection-toolbar"
      className={[sx(paint.s3), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

function SelectionToolbarQuote({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectionToolbarPrimitive.Quote>) {
  return (
    <SelectionToolbarPrimitive.Quote
      data-slot="selection-toolbar-quote"
      className={[sx(paint.s4), className].filter(Boolean).join(" ")}
      {...props}
    >
      {children ?? (
        <>
          <QuoteIcon className={sx(paint.s5)} />
          Quote
        </>
      )}
    </SelectionToolbarPrimitive.Quote>
  );
}

/**
 * Floating toolbar that appears when text is selected in a message.
 *
 * Render anywhere inside `ThreadPrimitive.Root` (or any `AssistantRuntimeProvider` scope).
 *
 * @example
 * ```tsx
 * <ThreadPrimitive.Root>
 *   <ThreadPrimitive.Viewport>...</ThreadPrimitive.Viewport>
 *   <SelectionToolbar />
 * </ThreadPrimitive.Root>
 * ```
 */
const SelectionToolbarImpl: FC<ComponentProps<typeof SelectionToolbarRoot>> = ({
  className,
  ...props
}) => {
  return (
    <SelectionToolbarRoot className={className} {...props}>
      <SelectionToolbarQuote />
    </SelectionToolbarRoot>
  );
};

const SelectionToolbar = memo(
  SelectionToolbarImpl,
) as unknown as typeof SelectionToolbarImpl & {
  Root: typeof SelectionToolbarRoot;
  Quote: typeof SelectionToolbarQuote;
};

SelectionToolbar.displayName = "SelectionToolbar";
SelectionToolbar.Root = SelectionToolbarRoot;
SelectionToolbar.Quote = SelectionToolbarQuote;

function ComposerQuotePreviewRoot({
  className,
  ...props
}: ComponentProps<typeof ComposerPrimitive.Quote>) {
  return (
    <ComposerPrimitive.Quote
      data-slot="composer-quote"
      className={[sx(paint.s6), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

function ComposerQuotePreviewIcon({
  className,
  ...props
}: ComponentProps<typeof QuoteIcon>) {
  return (
    <QuoteIcon
      data-slot="composer-quote-icon"
      className={[sx(paint.s7), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

function ComposerQuotePreviewText({
  className,
  ...props
}: ComponentProps<typeof ComposerPrimitive.QuoteText>) {
  return (
    <ComposerPrimitive.QuoteText
      data-slot="composer-quote-text"
      className={[sx(paint.s8), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

function ComposerQuotePreviewDismiss({
  className,
  children,
  ...props
}: ComponentProps<typeof ComposerPrimitive.QuoteDismiss>) {
  return (
    <ComposerPrimitive.QuoteDismiss
      data-slot="composer-quote-dismiss"
      asChild
      className={children ? className : undefined}
      {...props}
    >
      {children ?? (
        <button
          type="button"
          aria-label="Dismiss quote"
          className={[sx(paint.s10), className].filter(Boolean).join(" ")}
        >
          <XIcon className={sx(paint.s9)} />
        </button>
      )}
    </ComposerPrimitive.QuoteDismiss>
  );
}

/**
 * Quote preview inside the composer. Only renders when a quote is set.
 *
 * Place inside `ComposerPrimitive.Root`.
 *
 * @example
 * ```tsx
 * <ComposerPrimitive.Root>
 *   <ComposerQuotePreview />
 *   <ComposerPrimitive.Input />
 *   <ComposerPrimitive.Send />
 * </ComposerPrimitive.Root>
 * ```
 */
const ComposerQuotePreviewImpl: FC<
  ComponentProps<typeof ComposerQuotePreviewRoot>
> = ({ className, ...props }) => {
  return (
    <ComposerQuotePreviewRoot className={className} {...props}>
      <ComposerQuotePreviewIcon />
      <ComposerQuotePreviewText />
      <ComposerQuotePreviewDismiss />
    </ComposerQuotePreviewRoot>
  );
};

const ComposerQuotePreview = memo(
  ComposerQuotePreviewImpl,
) as unknown as typeof ComposerQuotePreviewImpl & {
  Root: typeof ComposerQuotePreviewRoot;
  Icon: typeof ComposerQuotePreviewIcon;
  Text: typeof ComposerQuotePreviewText;
  Dismiss: typeof ComposerQuotePreviewDismiss;
};

ComposerQuotePreview.displayName = "ComposerQuotePreview";
ComposerQuotePreview.Root = ComposerQuotePreviewRoot;
ComposerQuotePreview.Icon = ComposerQuotePreviewIcon;
ComposerQuotePreview.Text = ComposerQuotePreviewText;
ComposerQuotePreview.Dismiss = ComposerQuotePreviewDismiss;

export {
  QuoteBlock,
  QuoteBlockRoot,
  QuoteBlockIcon,
  QuoteBlockText,
  SelectionToolbar,
  SelectionToolbarRoot,
  SelectionToolbarQuote,
  ComposerQuotePreview,
  ComposerQuotePreviewRoot,
  ComposerQuotePreviewIcon,
  ComposerQuotePreviewText,
  ComposerQuotePreviewDismiss,
};
