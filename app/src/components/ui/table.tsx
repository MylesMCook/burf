"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color, radius } from "@/styles/tokens.stylex";

const card = ":is([data-variant='card'] &)";
const plain = ":is(:not([data-variant='card']) &)";

const styles = stylex.create({
  frame: { position: "relative", width: "100%", overflowX: "auto" },
  table: {
    width: "100%",
    captionSide: "bottom",
    fontSize: 14,
    borderCollapse: { [card]: "separate" },
    borderSpacing: { [card]: 0 },
  },
  header: { ":not(#\\#) tr": { borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: color.border } },
  body: {
    position: "relative",
    ":not(#\\#) tr:last-child": { borderBottomWidth: 0 },
    "::before": {
      content: { [card]: '""' },
      pointerEvents: "none",
      position: "absolute",
      inset: 1,
      borderRadius: "calc(var(--radius-xl) - 1px)",
      boxShadow: "var(--dialog-edge)",
    },
    [card]: { borderRadius: radius.xl, boxShadow: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)" },
  },
  footer: {
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: color.border,
    backgroundColor: { default: "var(--footer-fill)", [card]: "transparent" },
    fontWeight: 500,
    ":not(#\\#) > tr:last-child": { borderBottomWidth: 0 },
    [card]: { borderTopWidth: 0 },
  },
  row: {
    position: "relative",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: color.border,
    backgroundColor: {
      [plain]: "transparent",
      [`${plain}:hover`]: "var(--row-hover)",
      [`${plain}[data-state='selected']`]: "var(--row-selected)",
    },
  },
  head: {
    height: 40,
    whiteSpace: "nowrap",
    paddingLeft: 10,
    paddingRight: 10,
    textAlign: "left",
    verticalAlign: "middle",
    fontWeight: 500,
    color: color.mutedForeground,
    lineHeight: 1,
  },
  end: { textAlign: "right" },
  cell: {
    whiteSpace: "nowrap",
    backgroundClip: "padding-box",
    padding: 10,
    verticalAlign: "middle",
    lineHeight: 1,
    backgroundColor: { [card]: color.card },
    borderBottomWidth: { [card]: 1 },
    borderBottomStyle: { [card]: "solid" },
    borderBottomColor: { [card]: color.border },
  },
  nums: { fontVariantNumeric: "tabular-nums" },
  muted: { color: color.mutedForeground },
  medium: { fontWeight: 500 },
  truncate: { maxWidth: "14rem", overflow: "hidden", textOverflow: "ellipsis" },
  caption: { marginTop: 16, color: color.mutedForeground, fontSize: 14 },
});

export type TableVariant = "default" | "card";

export type TableProps = Omit<React.ComponentProps<"table">, "className"> & {
  variant?: TableVariant;
  render?: useRender.ComponentProps<"div">["render"];
};

export function Table({ variant = "default", render, ...props }: TableProps): React.ReactElement {
  const defaultProps = {
    children: <table className={stylex.props(styles.table).className} data-slot="table" {...props} />,
    className: stylex.props(styles.frame).className,
    "data-slot": "table-container",
    "data-variant": variant,
  };
  return useRender({ defaultTagName: "div", props: mergeProps<"div">(defaultProps, {}), render });
}

export function TableHeader(props: Omit<React.ComponentProps<"thead">, "className">): React.ReactElement {
  return <thead className={stylex.props(styles.header).className} data-slot="table-header" {...props} />;
}

export function TableBody(props: Omit<React.ComponentProps<"tbody">, "className">): React.ReactElement {
  return <tbody className={stylex.props(styles.body).className} data-slot="table-body" {...props} />;
}

export function TableFooter(props: Omit<React.ComponentProps<"tfoot">, "className">): React.ReactElement {
  return <tfoot className={stylex.props(styles.footer).className} data-slot="table-footer" {...props} />;
}

export function TableRow(props: Omit<React.ComponentProps<"tr">, "className">): React.ReactElement {
  return <tr className={stylex.props(styles.row).className} data-slot="table-row" {...props} />;
}

export function TableHead({
  end = false,
  ...props
}: Omit<React.ComponentProps<"th">, "className"> & { end?: boolean }): React.ReactElement {
  return <th className={stylex.props(styles.head, end && styles.end).className} data-slot="table-head" {...props} />;
}

export function TableCell({
  end = false,
  nums = false,
  tone,
  weight,
  truncate = false,
  ...props
}: Omit<React.ComponentProps<"td">, "className"> & {
  end?: boolean;
  nums?: boolean;
  tone?: "muted";
  weight?: "medium";
  truncate?: boolean;
}): React.ReactElement {
  return (
    <td
      className={stylex.props(
        styles.cell,
        end && styles.end,
        nums && styles.nums,
        tone === "muted" && styles.muted,
        weight === "medium" && styles.medium,
        truncate && styles.truncate,
      ).className}
      data-slot="table-cell"
      {...props}
    />
  );
}

export function TableCaption(props: Omit<React.ComponentProps<"caption">, "className">): React.ReactElement {
  return <caption className={stylex.props(styles.caption).className} data-slot="table-caption" {...props} />;
}
