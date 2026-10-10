"use client";

import * as stylex from "@stylexjs/stylex";
import { memo, useRef, useEffect, type ComponentPropsWithoutRef, type FC } from "react";
import {
  ComposerPrimitive,
  unstable_useTriggerPopoverScopeContext,
  defaultDirectiveFormatter,
  type DirectiveFormatter,
  type TriggerItem,
} from "@assistant-ui/react";
import { ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from "lucide-react";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "flexDirection": "column",
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s1: {
    "backgroundColor": {
      ":hover": "var(--accent)",
      ":focus": "var(--accent)",
      "[data-highlighted]": "var(--accent)",
    },
    "display": "flex",
    "cursor": "pointer",
    "alignItems": "center",
    "justifyContent": "space-between",
    "gap": "8px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    "outline": "none",
  },
  s2: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s3: {
    "color": "var(--muted-foreground)",
    "width": "16px",
    "height": "16px",
  },
  s4: {
    "color": "var(--muted-foreground)",
    "width": "16px",
    "height": "16px",
  },
  s5: {
    "color": "var(--muted-foreground)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s6: {
    "display": "flex",
    "flexDirection": "column",
  },
  s7: {
    "color": "var(--muted-foreground)",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    "display": "flex",
    "cursor": "pointer",
    "alignItems": "center",
    "gap": "6px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "letterSpacing": "0.025em",
    "textTransform": "uppercase",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  s8: {
    "width": "14px",
    "height": "14px",
  },
  s9: {
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s10: {
    "backgroundColor": {
      ":hover": "var(--accent)",
      ":focus": "var(--accent)",
      "[data-highlighted]": "var(--accent)",
    },
    "display": "flex",
    "width": "100%",
    "cursor": "pointer",
    "flexDirection": "column",
    "alignItems": "flex-start",
    "gap": "2px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    "outline": "none",
  },
  s11: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "fontWeight": 500,
  },
  s12: {
    "color": "var(--primary)",
    "width": "14px",
    "height": "14px",
  },
  s13: {
    "color": "var(--muted-foreground)",
    "marginInlineStart": "22px",
    "fontSize": "12px",
    "lineHeight": "1.25",
  },
  s14: {
    "color": "var(--muted-foreground)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s15: {
    "backgroundColor": "var(--popover)",
    "color": "var(--popover-foreground)",
    "position": "absolute",
    "insetInlineStart": "0px",
    "bottom": "100%",
    "zIndex": 50,
    "marginBottom": "8px",
    "width": "256px",
    "overflow": "hidden",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  q16: {
    "textAlign": "start",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

type IconComponent = FC<{ className?: string }>;

type DirectiveBehaviorProps = {
  /** Formatter used to serialize the selected item into composer text. */
  formatter?: DirectiveFormatter | undefined;
  /** Called after the directive text has been inserted into the composer. */
  onInserted?: ((item: TriggerItem) => void) | undefined;
};

type ActionBehaviorProps = {
  /** Formatter used to serialize the audit-trail chip (when `removeOnExecute` is false). */
  formatter?: DirectiveFormatter | undefined;
  /** Invoked with the selected item at the moment of selection. */
  onExecute: (item: TriggerItem) => void;
  /** If `true`, strip the trigger text from the composer after executing. @default false */
  removeOnExecute?: boolean | undefined;
};

type ComposerTriggerPopoverBaseProps = Omit<
  ComponentPropsWithoutRef<typeof ComposerPrimitive.TriggerPopover>,
  "children"
> & {
  /**
   * Maps icon keys to components. Items look up via `item.metadata?.icon`
   * (string); categories look up via their `id`.
   */
  iconMap?: Record<string, IconComponent>;
  /** Fallback icon when no entry in `iconMap` matches. */
  fallbackIcon?: IconComponent;
  /** Label shown on the back button. @default "Back" */
  backLabel?: string;
  /** Label shown when no categories are available. @default "No items available" */
  emptyCategoriesLabel?: string;
  /** Label shown when no items match. @default "No matching items" */
  emptyItemsLabel?: string;
  /** Label shown while an async adapter is resolving items. @default "Loading…" */
  loadingLabel?: string;
  onQueryChange?: (query: string | undefined) => void;
};

type ComposerTriggerPopoverProps = ComposerTriggerPopoverBaseProps &
  (
    | {
        /** Insert-directive behavior. */
        directive: DirectiveBehaviorProps;
        action?: never;
      }
    | {
        /** Action behavior. */
        action: ActionBehaviorProps;
        directive?: never;
      }
  );

function resolveIcon(
  iconKey: string | undefined,
  iconMap: Record<string, IconComponent> | undefined,
  fallback: IconComponent,
): IconComponent {
  if (iconKey && iconMap?.[iconKey]) return iconMap[iconKey]!;
  return fallback;
}

type CategoriesProps = {
  iconMap: Record<string, IconComponent> | undefined;
  fallbackIcon: IconComponent;
  emptyLabel: string;
};

const Categories: FC<CategoriesProps> = ({
  iconMap,
  fallbackIcon,
  emptyLabel,
}) => (
  <ComposerPrimitive.TriggerPopoverCategories>
    {(categories) => (
      <div
        data-slot="composer-trigger-popover-categories"
        className={sx(paint.s0)}
      >
        {categories.map((cat) => {
          const Icon = resolveIcon(cat.id, iconMap, fallbackIcon);
          return (
            <ComposerPrimitive.TriggerPopoverCategoryItem
              key={cat.id}
              categoryId={cat.id}
              className={sx(paint.s1)}
            >
              <span className={sx(paint.s2)}>
                <Icon className={sx(paint.s3)} />
                {cat.label}
              </span>
              <ChevronRightIcon className={sx(paint.s4)} />
            </ComposerPrimitive.TriggerPopoverCategoryItem>
          );
        })}
        {categories.length === 0 && (
          <div className={sx(paint.s5)}>
            {emptyLabel}
          </div>
        )}
      </div>
    )}
  </ComposerPrimitive.TriggerPopoverCategories>
);

type ItemsProps = {
  iconMap: Record<string, IconComponent> | undefined;
  fallbackIcon: IconComponent;
  backLabel: string;
  emptyLabel: string;
  loadingLabel: string;
  isLoading: boolean;
};

const Items: FC<ItemsProps> = ({
  iconMap,
  fallbackIcon,
  backLabel,
  emptyLabel,
  loadingLabel,
  isLoading,
}) => {
  return (
    <ComposerPrimitive.TriggerPopoverItems>
      {(items) => (
        <div
          data-slot="composer-trigger-popover-items"
          className={sx(paint.s6)}
        >
          <ComposerPrimitive.TriggerPopoverBack className={sx(paint.s7)}>
            <ChevronLeftIcon className={sx(paint.s8)} />
            {backLabel}
          </ComposerPrimitive.TriggerPopoverBack>

          <div className={sx(paint.s9)}>
            {items.map((item, index) => {
              const iconKey =
                typeof item.metadata?.icon === "string"
                  ? item.metadata.icon
                  : undefined;
              const Icon = resolveIcon(iconKey, iconMap, fallbackIcon);
              return (
                <ComposerPrimitive.TriggerPopoverItem
                  key={item.id}
                  item={item}
                  index={index}
                  className={[sx(paint.s10), sx(paint.q16)].filter(Boolean).join(" ")}
                >
                  <span className={sx(paint.s11)}>
                    <Icon className={sx(paint.s12)} />
                    {item.label}
                  </span>
                  {item.description && (
                    <span className={sx(paint.s13)}>
                      {item.description}
                    </span>
                  )}
                </ComposerPrimitive.TriggerPopoverItem>
              );
            })}
            {items.length === 0 && (
              <div className={sx(paint.s14)}>
                {isLoading ? loadingLabel : emptyLabel}
              </div>
            )}
          </div>
        </div>
      )}
    </ComposerPrimitive.TriggerPopoverItems>
  );
};

function QueryState({ onChange }: { onChange?: (query: string | undefined) => void }) {
  const { query, open } = unstable_useTriggerPopoverScopeContext();
  useEffect(() => onChange?.(open ? query : undefined), [query, open, onChange]);
  return null;
}

/**
 * Pre-built popover UI for a trigger-driven picker (mentions, slash commands, etc).
 * Pass exactly one of `directive` (inserts a chip) or `action` (fires a handler).
 */
const ComposerTriggerPopoverImpl: FC<ComposerTriggerPopoverProps> = ({
  iconMap,
  fallbackIcon = SparklesIcon,
  backLabel = "Back",
  emptyCategoriesLabel = "No items available",
  emptyItemsLabel = "No matching items",
  loadingLabel = "Loading…",
  isLoading = false,
  className,
  directive,
  action,
  onQueryChange,
  ...props
}) => {
  const warnedRef = useRef(false);
  if (
    process.env.NODE_ENV !== "production" &&
    !warnedRef.current &&
    Boolean(directive) === Boolean(action)
  ) {
    warnedRef.current = true;
    console.warn(
      "[assistant-ui] ComposerTriggerPopover requires exactly one of `directive` or `action` props.",
    );
  }

  return (
    <ComposerPrimitive.TriggerPopover
      data-slot="composer-trigger-popover"
      className={[[sx(paint.s15), "aui-composer-trigger-popover"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      isLoading={isLoading}
      {...props}
    >
      <QueryState onChange={onQueryChange} />
      {directive ? (
        <ComposerPrimitive.TriggerPopover.Directive
          formatter={directive.formatter ?? defaultDirectiveFormatter}
          onInserted={directive.onInserted}
        />
      ) : action ? (
        <ComposerPrimitive.TriggerPopover.Action
          formatter={action.formatter ?? defaultDirectiveFormatter}
          onExecute={action.onExecute}
          removeOnExecute={action.removeOnExecute}
        />
      ) : null}
      <Categories
        iconMap={iconMap}
        fallbackIcon={fallbackIcon}
        emptyLabel={emptyCategoriesLabel}
      />
      <Items
        iconMap={iconMap}
        fallbackIcon={fallbackIcon}
        backLabel={backLabel}
        emptyLabel={emptyItemsLabel}
        loadingLabel={loadingLabel}
        isLoading={isLoading}
      />
    </ComposerPrimitive.TriggerPopover>
  );
};
ComposerTriggerPopoverImpl.displayName = "ComposerTriggerPopover";

export const ComposerTriggerPopover = memo(
  ComposerTriggerPopoverImpl,
) as FC<ComposerTriggerPopoverProps>;
