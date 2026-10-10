import * as stylex from "@stylexjs/stylex";

import { color, radius } from "@/styles/tokens.stylex";

// The chat box in DESIGN.md. The thread composer and the edit composer use
// this shell. Marker classes stay so assistant-ui can find the input.
const styles = stylex.create({
  shell: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
    cursor: "text",
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: {
      default: "color-mix(in oklab, var(--foreground) 10%, transparent)",
      ":focus-within": "color-mix(in oklab, var(--foreground) 25%, transparent)",
    },
    backgroundColor: "color-mix(in oklab, var(--muted) 30%, transparent)",
    padding: 8,
  },
  alignEnd: {
    marginLeft: "auto",
    maxWidth: "85%",
  },
  input: {
    width: "100%",
    maxHeight: "12rem",
    minHeight: "2.5rem",
    resize: "none",
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 10,
    paddingRight: 10,
    caretColor: color.primary,
    color: "inherit",
    fontFamily: "inherit",
    fontSize: 16,
    lineHeight: "24px",
    outline: "none",
    "::placeholder": {
      color: "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
    },
  },
  editInput: {
    minHeight: "3.5rem",
    paddingTop: 12,
    paddingBottom: 4,
    paddingLeft: 16,
    paddingRight: 16,
  },
});

export function chatBoxShellClass(alignEnd?: boolean): string | undefined {
  return stylex.props(styles.shell, alignEnd && styles.alignEnd).className;
}

export function chatBoxInputClass(edit?: boolean): string | undefined {
  return stylex.props(styles.input, edit && styles.editInput).className;
}
