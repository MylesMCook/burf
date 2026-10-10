"use client";

import * as stylex from "@stylexjs/stylex";
import { useState, type ComponentProps } from "react";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { fadeIn, inkButton, mono, paper, spin } from "./surfaces";
import { clamp } from "../utils/range";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "gap": "2px",
  },
  s1: {
    "fontSize": "13.5px",
    "lineHeight": "20px",
    "overflowWrap": "break-word",
  },
  s2: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "overflowWrap": "break-word",
  },
  s3: {
    "display": "flex",
    "width": "100%",
    "flexDirection": "column",
    "gap": "4px",
    "borderRadius": "var(--radius-2xl)",
    "padding": "8px",
    "maxWidth": "384px",
  },
  s4: {
    "color": "color-mix(in oklab, var(--foreground) 35%, transparent)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s5: {
    "color": "color-mix(in oklab, var(--foreground) 70%, transparent)",
  },
  s6: {
    "display": "flex",
    "height": "20px",
    "width": "14px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
  },
  s7: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "width": "14px",
    "height": "14px",
  },
  s8: {
    "position": "absolute",
    "width": "1px",
    "height": "1px",
    "padding": 0,
    "margin": "-1px",
    "overflow": "hidden",
    "clip": "rect(0,0,0,0)",
    "whiteSpace": "nowrap",
    "borderWidth": 0,
  },
  s9: {
    "color": "color-mix(in oklab, var(--foreground) 35%, transparent)",
  },
  s10: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s11: {
    "display": "flex",
    "height": "20px",
    "width": "14px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
  },
  s12: {
    "display": "flex",
    "width": "14px",
    "height": "14px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "5px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  s13: {
    "borderColor": "var(--foreground)",
    "backgroundColor": "var(--foreground)",
  },
  s14: {
    "borderColor": "color-mix(in oklab, var(--foreground) 15%, transparent)",
  },
  s15: {
    "color": "var(--background)",
    "width": "10px",
    "height": "10px",
    "transitionDuration": "200ms",
  },
  s16: {
    "display": "flex",
    "height": "20px",
    "width": "14px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
  },
  s17: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "width": "14px",
    "height": "14px",
  },
  s18: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingBottom": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "overflowWrap": "break-word",
    "color": "light-dark(var(--color-red-600), var(--color-red-400))",
  },
  s19: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "space-between",
    "gap": "12px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "4px",
  },
  s20: {
    "color": "color-mix(in oklab, var(--foreground) 35%, transparent)",
    "fontVariantNumeric": "tabular-nums",
  },
  s21: {
    "display": "flex",
    "height": "32px",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "999px",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontWeight": 500,
  },
  s22: {
    "cursor": "default",
    "opacity": {
      "default": 0.4,
      ":hover": 0.4,
    },
  },
  s23: {
    "width": "14px",
    "height": "14px",
  },
  s24: {
    "maxWidth": "none",
    "borderWidth": 0,
    "backgroundColor": "transparent",
    "padding": "0px",
  },
  s25: {
    "display": "flex",
    "width": "100%",
    "alignItems": "flex-start",
    "gap": "10px",
    "borderRadius": "var(--radius-xl)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "textAlign": "start",
    "transitionProperty": "color, background-color",
    "transitionDuration": "150ms",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 1px color-mix(in oklab, var(--foreground) 20%, transparent)",
    },
  },
  s26: {
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--foreground) 3.5%, transparent)",
    },
  },
  s27: {
    "color": "color-mix(in oklab, var(--foreground) 90%, transparent)",
  },
  s28: {
    "cursor": "default",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export interface OptionListOption {
  id: string;
  label: string;
  description?: string | undefined;
  disabled?: boolean | undefined;
}

export interface OptionListProps extends Omit<
  ComponentProps<"div">,
  "children" | "defaultValue" | "onChange"
> {
  options: readonly OptionListOption[];
  /** One option answers the question, or several do. */
  selectionMode?: "single" | "multiple" | undefined;
  /**
   * Options the list starts selected: checked in a multiple selection, and
   * marked as the current answer in a single one.
   */
  defaultValue?: readonly string[] | undefined;
  /** The fewest options a multiple selection confirms with. */
  minSelections?: number | undefined;
  /** The most options a multiple selection may hold. */
  maxSelections?: number | undefined;
  /**
   * Commits the answer: a single selection commits on pick, a multiple one on
   * the confirm button. Without it the list only displays its options. A
   * rejected promise reopens the list, because the answer never landed.
   */
  onConfirm?: ((ids: string[]) => void | Promise<void>) | undefined;
  confirmLabel?: string | undefined;
  /**
   * The committed answer. Once set, the list is a receipt of just these
   * options and takes no further input.
   */
  choice?: readonly string[] | undefined;
  /** Drop the card chrome so a parent can draw the frame. */
  bare?: boolean | undefined;
}

function OptionText({ option }: { option: OptionListOption }) {
  return (
    <span className={sx(paint.s0)}>
      <span className={sx(paint.s1)}>
        {option.label}
      </span>
      {option.description ? (
        <span className={sx(paint.s2)}>
          {option.description}
        </span>
      ) : null}
    </span>
  );
}

export function OptionList({
  options,
  selectionMode = "single",
  defaultValue,
  minSelections = 1,
  maxSelections,
  onConfirm,
  confirmLabel = "Confirm",
  choice,
  bare = false,
  className,
  ...props
}: OptionListProps) {
  const multiple = selectionMode === "multiple";
  const [selected, setSelected] = useState<readonly string[]>(() =>
    (defaultValue ?? []).filter((id) => options.some((o) => o.id === id)),
  );
  const [pending, setPending] = useState<readonly string[] | null>(null);
  const [confirmed, setConfirmed] = useState<readonly string[] | undefined>();
  const [error, setError] = useState<string | null>(null);

  const root = [sx(paper, paint.s3, bare && paint.s24), className].filter(Boolean).join(" ");

  const confirmedChoice = choice ?? confirmed;

  if (confirmedChoice !== undefined) {
    const chosen = options.filter((option) =>
      confirmedChoice.includes(option.id),
    );
    return (
      <div
        data-slot="option-list"
        data-state="receipt"
        className={root}
        {...props}
      >
        {chosen.length === 0 ? (
          <span className={sx(mono, paint.s4)}>
            Nothing selected
          </span>
        ) : (
          chosen.map((option) => (
            <div key={option.id} className={sx(paint.s25, paint.s5)}>
              <span className={sx(paint.s6)}>
                <CheckIcon
                  aria-hidden
                  className={sx(paint.s7)}
                />
                <span className={sx(paint.s8)}>Selected:</span>
              </span>
              <OptionText option={option} />
            </div>
          ))
        )}
      </div>
    );
  }

  if (!onConfirm) {
    return (
      <div data-slot="option-list" className={root} {...props}>
        {options.map((option) => (
          <div
            key={option.id}
            className={sx(paint.s25, option.disabled && paint.s9)}
          >
            <OptionText option={option} />
          </div>
        ))}
      </div>
    );
  }

  const locked = pending !== null;
  const max = Math.floor(
    clamp(maxSelections ?? options.length, 0, options.length),
  );
  const min = Math.floor(clamp(minSelections, 0, max));
  const optionIds = new Set(options.map((option) => option.id));
  const selectedIds = selected.filter((id) => optionIds.has(id));

  const commit = (ids: string[]) => {
    if (locked) return;
    setPending(ids);
    setError(null);
    void (async () => {
      try {
        await onConfirm(ids);
        setConfirmed(ids);
      } catch (commitError) {
        setPending(null);
        setError(
          commitError instanceof Error
            ? commitError.message
            : String(commitError),
        );
      }
    })();
  };

  const toggle = (id: string) => {
    if (locked) return;
    setSelected((current) => {
      const available = current.filter((value) => optionIds.has(value));
      return available.includes(id)
        ? available.filter((value) => value !== id)
        : available.length < max
          ? [...available, id]
          : available;
    });
  };

  const count = selectedIds.length;
  const canConfirm = !locked && count >= min && count <= max;

  return (
    <div
      role="group"
      data-slot="option-list"
      data-state={locked ? "pending" : "open"}
      aria-busy={locked || undefined}
      className={root}
      {...props}
    >
      {options.map((option) => {
        const isSelected = multiple
          ? selectedIds.includes(option.id)
          : (pending ?? selected).includes(option.id);
        const unavailable =
          option.disabled === true || (multiple && !isSelected && count >= max);
        return (
          <button
            key={option.id}
            type="button"
            {...(multiple
              ? { role: "checkbox", "aria-checked": isSelected }
              : {})}
            aria-disabled={unavailable || locked || undefined}
            disabled={option.disabled}
            onClick={() => {
              if (unavailable) return;
              if (multiple) toggle(option.id);
              else commit([option.id]);
            }}
            className={sx(
              paint.s25,
              isSelected ? paint.s10 : !unavailable && !locked && paint.s26,
              unavailable ? paint.s9 : paint.s27,
              (unavailable || locked) && paint.s28,
            )}
          >
            {multiple ? (
              <span
                aria-hidden
                className={sx(paint.s11)}
              >
                <span
                  className={[sx(paint.s12), isSelected ? sx(paint.s13) : sx(paint.s14)].filter(Boolean).join(" ")}
                >
                  {isSelected ? (
                    <CheckIcon className={sx(paint.s15, fadeIn)} />
                  ) : null}
                </span>
              </span>
            ) : pending?.includes(option.id) ? (
              <span
                aria-hidden
                className={sx(paint.s16)}
              >
                <Loader2Icon className={sx(paint.s17, spin)} />
              </span>
            ) : null}
            <OptionText option={option} />
          </button>
        );
      })}
      {error ? (
        <p
          role="alert"
          className={sx(paint.s18)}
        >
          {error}
        </p>
      ) : null}
      {multiple ? (
        <div className={sx(paint.s19)}>
          <span className={sx(mono, paint.s20)}>
            {count} of {max}
          </span>
          <button
            type="button"
            aria-disabled={!canConfirm || undefined}
            onClick={() => {
              if (!canConfirm) return;
              commit(
                options
                  .filter((option) => selectedIds.includes(option.id))
                  .map((option) => option.id),
              );
            }}
            className={sx(inkButton, paint.s21, !canConfirm && paint.s22)}
          >
            {locked ? (
              <Loader2Icon
                aria-hidden
                className={sx(paint.s23, spin)}
              />
            ) : null}
            {confirmLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
