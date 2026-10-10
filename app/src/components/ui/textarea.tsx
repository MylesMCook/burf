"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { mergeProps } from "@base-ui/react/merge-props";
import * as stylex from "@stylexjs/stylex";
import type * as React from "react";
import { useCallback, useLayoutEffect, useRef } from "react";

import { color, font, radius } from "@/styles/tokens.stylex";


const sm = "@media (min-width: 640px)";

const styles = stylex.create({
  shell: {
    position: "relative",
    display: "inline-flex",
    width: "100%",
    minWidth: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: {
      default: color.input,
      ":has(:focus-visible)": color.ring,
      ':has([aria-invalid="true"])': "color-mix(in oklab, var(--destructive) 36%, transparent)",
      ':has(:focus-visible):has([aria-invalid="true"])': "color-mix(in oklab, var(--destructive) 64%, transparent)",
    },
    backgroundColor: "var(--control-fill)",
    color: color.foreground,
    fontSize: { default: 16, [sm]: 14 },
    boxShadow: {
      default: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)",
      ":has(:focus-visible)": "0 0 0 3px color-mix(in oklab, var(--ring) 24%, transparent)",
      ':has(:focus-visible):has([aria-invalid="true"])': "0 0 0 3px var(--invalid-ring)",
      ":has(:disabled)": "none",
      ':has([aria-invalid="true"])': "none",
    },
    opacity: { default: 1, ":has(:disabled)": 0.64 },
    transitionProperty: "box-shadow",
    transitionDuration: "150ms",
  },
  bare: {
    display: "inline-flex",
    width: "100%",
    minWidth: 0,
  },
  field: {
    fieldSizing: "content",
    minHeight: { default: 82, [sm]: 70 },
    width: "100%",
    borderRadius: "inherit",
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 11,
    paddingRight: 11,
    color: color.foreground,
    outline: "none",
    resize: "vertical",
    "::placeholder": { color: "color-mix(in oklab, var(--muted-foreground) 72%, transparent)" },
  },
  fieldSm: {
    minHeight: { default: 78, [sm]: 66 },
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 9,
    paddingRight: 9,
  },
  fieldLg: {
    minHeight: { default: 86, [sm]: 74 },
    paddingTop: 7,
    paddingBottom: 7,
  },
  mono: { fontFamily: font.mono },
  xs: { fontSize: 12 },
  prompt: { fontSize: 13 },
  script: { minHeight: 52, maxHeight: 192 },
  note: { minHeight: 64 },
});

export type TextareaProps = Omit<React.ComponentPropsWithoutRef<"textarea">, "className" | "style"> &
  React.RefAttributes<HTMLTextAreaElement> & {
    size?: "sm" | "default" | "lg" | number;
    unstyled?: boolean;
    mono?: boolean;
    text?: "default" | "xs" | "prompt";
    /** script: a short command. note: a few lines of mono text. */
    span?: "auto" | "script" | "note";
  };

export function Textarea({
  size = "default",
  unstyled = false,
  mono = false,
  text = "default",
  span = "auto",
  ref,
  ...props
}: TextareaProps): React.ReactElement {
  const shell = stylex.props(
    unstyled ? styles.bare : styles.shell,
    mono && styles.mono,
    text === "xs" && styles.xs,
    text === "prompt" && styles.prompt,
  );
  const field = stylex.props(
    styles.field,
    size === "sm" && styles.fieldSm,
    size === "lg" && styles.fieldLg,
    mono && styles.mono,
    text === "xs" && styles.xs,
    text === "prompt" && styles.prompt,
    span === "script" && styles.script,
    span === "note" && styles.note,
  );
  return (
    <span {...shell} data-size={size} data-slot="textarea-control">
      <FieldPrimitive.Control
        ref={ref}
        value={props.value}
        defaultValue={props.defaultValue}
        disabled={props.disabled}
        id={props.id}
        name={props.name}
        render={(defaultProps: React.ComponentProps<"textarea">) => (
          <ValueTextarea
            {...mergeProps(defaultProps, props, { className: field.className, "data-slot": "textarea" })}
          />
        )}
      />
    </span>
  );
}

// ValueTextarea is a textarea whose value, when it is given one, is set as
// the element's property rather than by React. React writes a controlled
// textarea's text node (its defaultValue) on every update as well, and in
// Chromium that one change re-checks the app's :has() rules up the whole
// page: about 8 ms a keystroke in the chat's reply box, the same in a
// short chat or a long one. The property alone doesn't (0.04 ms). It reads
// and behaves as a controlled one: what is typed comes through onChange,
// and a value set from outside (cleared after sending, a recalled prompt)
// replaces what is there.
function ValueTextarea({ value, ref, ...props }: React.ComponentProps<"textarea">) {
  const el = useRef<HTMLTextAreaElement | null>(null);
  const setRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      el.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  const text = value == null ? undefined : String(value);
  useLayoutEffect(() => {
    const t = el.current;
    if (t && text !== undefined && t.value !== text) t.value = text;
  }, [text]);
  return <textarea ref={setRef} {...props} />;
}

export { FieldPrimitive };
