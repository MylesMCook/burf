"use client";

// Adapted from https://r.assistant-ui.com/elements-data-table.json.
// Stock props are retained; Burf's compact view also exposes sorting.

import { useEffect, useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "@/components/ui/select";
import { Tip } from "@/components/tip";
import * as stylex from "@stylexjs/stylex";
import { color, font, radius } from "@/styles/tokens.stylex";
import { safeHref } from "../utils/href";
import { clamp } from "../utils/range";
import { field, paper, mark, withClass } from "./surfaces";

const still = "@media (prefers-reduced-motion: reduce)";
const styles = stylex.create({
  root: {
    containerType: "inline-size",
    width: "100%",
    minWidth: 0,
    overflow: "hidden",
    borderRadius: radius.sm,
    fontFamily: font.sans
  },
  table: {
    display: {
      default: "none",
      "@container (min-width: 448px)": "table"
    },
    width: "100%",
    borderCollapse: "collapse"
  },
  head: {
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: color.border
  },
  heading: {
    color: color.mutedForeground,
    padding: "12px 16px",
    fontWeight: 500,
    fontSize: 12
  },
  cell: {
    color: color.foreground,
    padding: "10px 16px",
    verticalAlign: "top",
    fontSize: 13,
    lineHeight: "20px",
    overflowWrap: "anywhere"
  },
  end: {
    textAlign: "end",
    fontVariantNumeric: "tabular-nums"
  },
  start: {
    textAlign: "start"
  },
  row: {
    backgroundColor: {
      ":hover": "color-mix(in oklab, var(--foreground) 2.5%, transparent)"
    },
    transitionProperty: "background-color",
    transitionDuration: {
      default: "150ms",
      [still]: "0s"
    }
  },
  empty: {
    color: color.mutedForeground,
    padding: "24px 16px",
    textAlign: "center",
    fontSize: 13
  },
  cards: {
    display: {
      default: "flex",
      "@container (min-width: 448px)": "none"
    },
    flexDirection: "column",
    gap: 8,
    padding: 10
  },
  compactSort: {
    display: { default: "block", "@container (min-width: 448px)": "none" },
    padding: "10px 10px 0",
  },
  card: {
    backgroundColor: {
      default: "color-mix(in oklab, var(--foreground) 2.5%, transparent)",
      ":hover": "color-mix(in oklab, var(--foreground) 4%, transparent)"
    },
    borderRadius: radius.sm,
    padding: "8px 12px",
    transitionProperty: "background-color",
    transitionDuration: {
      default: "150ms",
      [still]: "0s"
    }
  },
  primary: {
    color: color.foreground,
    fontSize: 13,
    lineHeight: "20px",
    fontWeight: 500,
    overflowWrap: "anywhere"
  },
  details: {
    marginTop: 6,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      "@container (min-width: 320px)": "repeat(2, minmax(0, 1fr))"
    },
    columnGap: 16,
    rowGap: 4,
    fontSize: 12,
    lineHeight: "16px"
  },
  detail: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8
  },
  term: {
    color: color.mutedForeground,
    overflowWrap: "anywhere"
  },
  definition: {
    color: color.foreground,
    minWidth: 0,
    textAlign: "end",
    fontVariantNumeric: "tabular-nums",
    overflowWrap: "anywhere"
  },
  muted: {
    color: color.mutedForeground
  },
  good: {
    color: "light-dark(var(--color-emerald-600), var(--color-emerald-400))"
  },
  bad: {
    color: "light-dark(var(--color-red-600), var(--color-red-400))"
  },
  link: {
    textDecoration: "underline",
    textUnderlineOffset: 2
  },
  sr: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0
  },
  badge: {
    display: "inline-flex",
    borderRadius: radius.full,
    padding: "2px 8px",
    fontSize: 12,
    fontWeight: 500
  },
  neutral: {
    color: color.foreground
  },
  success: {
    backgroundColor: "color-mix(in oklab, var(--color-emerald-500) 12%, transparent)",
    color: "light-dark(var(--color-emerald-700), var(--color-emerald-300))"
  },
  warning: {
    backgroundColor: "color-mix(in oklab, var(--color-amber-500) 12%, transparent)",
    color: "light-dark(var(--color-amber-700), var(--color-amber-300))"
  },
  danger: {
    backgroundColor: "color-mix(in oklab, var(--color-red-500) 12%, transparent)",
    color: "light-dark(var(--color-red-700), var(--color-red-300))"
  },
  list: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4
  },
  chip: {
    color: color.foreground,
    borderRadius: radius.md,
    padding: "2px 6px",
    fontSize: 12
  },
  more: {
    color: color.mutedForeground,
    padding: "2px 6px",
    fontSize: 12
  },
  arrow: {
    marginInlineStart: 4
  }
});
const sx = (...parts: readonly (false | null | undefined | object)[]) => mark(undefined, ...parts).className;

export type DataTableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number)[];

export type DataTableRow = Readonly<Record<string, DataTableValue>>;

export type DataTableFormat =
  | { kind: "text" }
  | {
      kind: "number";
      decimals?: number | undefined;
      compact?: boolean | undefined;
      unit?: string | undefined;
    }
  | {
      kind: "currency";
      currency: string;
      decimals?: number | undefined;
      compact?: boolean | undefined;
    }
  | {
      kind: "percent";
      decimals?: number | undefined;
      basis?: "fraction" | "unit" | undefined;
    }
  | {
      kind: "delta";
      decimals?: number | undefined;
      unit?: string | undefined;
      upIsGood?: boolean | undefined;
    }
  | { kind: "date"; style?: "date" | "datetime" | "relative" | undefined }
  | {
      kind: "boolean";
      trueLabel?: string | undefined;
      falseLabel?: string | undefined;
    }
  | { kind: "link"; hrefKey?: string | undefined }
  | {
      kind: "badge";
      tones?:
        | Readonly<Record<string, "neutral" | "success" | "warning" | "danger">>
        | undefined;
    }
  | { kind: "list"; max?: number | undefined };

export interface DataTableColumn {
  key: string;
  label: string;
  format?: DataTableFormat | undefined;
  align?: "start" | "end" | undefined;
  sortable?: boolean | undefined;
  priority?: "primary" | "secondary" | undefined;
  width?: string | undefined;
}

export interface DataTableSort {
  key: string;
  direction: "asc" | "desc";
}

export interface DataTableProps extends Omit<
  ComponentProps<"div">,
  "children"
> {
  columns: readonly DataTableColumn[];
  rows: readonly DataTableRow[];
  rowKey?: string | undefined;
  caption?: string | undefined;
  defaultSort?: DataTableSort | undefined;
  sort?: DataTableSort | null | undefined;
  onSortChange?: ((sort: DataTableSort | null) => void) | undefined;
  locale?: string | undefined;
  emptyMessage?: string | undefined;
  relativeTo?: number | undefined;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T.*)?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const isEmpty = (value: DataTableValue) =>
  value === null || value === undefined;

const textValue = (value: Exclude<DataTableValue, null | undefined>) =>
  Array.isArray(value) ? value.join(", ") : String(value);

const isCalendarDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth =
    month === 2
      ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
        ? 29
        : 28
      : [4, 6, 9, 11].includes(month)
        ? 30
        : 31;
  return day <= daysInMonth;
};

const asDate = (value: DataTableValue) => {
  const timestamp =
    typeof value === "number"
      ? value
      : typeof value === "string" &&
          ISO_DATE.test(value) &&
          isCalendarDate(value)
        ? Date.parse(value)
        : Number.NaN;
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp);
};

const fractionDigits = (decimals: number | undefined) =>
  decimals === undefined || !Number.isFinite(decimals)
    ? {}
    : {
        minimumFractionDigits: Math.floor(clamp(decimals, 0, 20)),
        maximumFractionDigits: Math.floor(clamp(decimals, 0, 20)),
      };

const numberOptions = (decimals: number | undefined, compact: boolean) => ({
  notation: compact ? ("compact" as const) : ("standard" as const),
  ...fractionDigits(decimals),
});

/**
 * Formats with Intl, falling back to the raw value: a model can send a
 * currency code or locale that Intl rejects by throwing.
 */
const formatted = (
  value: Exclude<DataTableValue, null | undefined>,
  format: () => string,
) => {
  try {
    return format();
  } catch {
    return textValue(value);
  }
};

const numericValue = (value: DataTableValue) =>
  typeof value === "number" && !Number.isNaN(value) ? value : undefined;

const relativeDate = (date: Date, locale: string, relativeTo: number) => {
  const seconds = Math.round((date.getTime() - relativeTo) / 1000);
  const units: readonly [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ];
  const [unit, amount] = units.find(
    ([, size]) => Math.abs(seconds) >= size,
  ) ?? ["second", 1];
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    Math.round(seconds / amount),
    unit,
  );
};

const relativeRefreshDelay = (
  columns: readonly DataTableColumn[],
  rows: readonly DataTableRow[],
  now: number,
) => {
  const relativeKeys = columns
    .filter(
      (column) =>
        column.format?.kind === "date" && column.format.style === "relative",
    )
    .map((column) => column.key);
  const freshestAge = rows.reduce((minimum, row) => {
    for (const key of relativeKeys) {
      const date = asDate(row[key]);
      if (date) minimum = Math.min(minimum, Math.abs(now - date.getTime()));
    }
    return minimum;
  }, Number.POSITIVE_INFINITY);

  if (freshestAge < 60_000) return 1_000;
  if (freshestAge < 3_600_000) return 30_000;
  if (freshestAge < 86_400_000) return 60_000;
  if (freshestAge < 604_800_000) return 3_600_000;
  return 86_400_000;
};

const withUnit = (text: string, unit: string | undefined) =>
  unit === undefined || unit === ""
    ? text
    : /^[%‰°]/.test(unit)
      ? `${text}${unit}`
      : `${text} ${unit}`;

const EmptyValue = () => <span className={sx(styles.muted)}>none</span>;

function Value({
  column,
  row,
  locale,
  relativeTo,
  suppressRelativeHydrationWarning,
}: {
  column: DataTableColumn;
  row: DataTableRow;
  locale: string;
  relativeTo: number;
  suppressRelativeHydrationWarning: boolean;
}) {
  const value = row[column.key];
  if (isEmpty(value)) return <EmptyValue />;

  const format = column.format ?? { kind: "text" as const };
  if (format.kind === "number") {
    const number = numericValue(value);
    if (number === undefined) return <>{textValue(value)}</>;
    const content = formatted(value, () =>
      new Intl.NumberFormat(
        locale,
        numberOptions(format.decimals, format.compact === true),
      ).format(number),
    );
    return <>{withUnit(content, format.unit)}</>;
  }

  if (format.kind === "currency") {
    const number = numericValue(value);
    if (number === undefined) return <>{textValue(value)}</>;
    return (
      <>
        {formatted(value, () =>
          new Intl.NumberFormat(locale, {
            style: "currency",
            currency: format.currency,
            ...numberOptions(format.decimals, format.compact === true),
          }).format(number),
        )}
      </>
    );
  }

  if (format.kind === "percent") {
    const number = numericValue(value);
    if (number === undefined) return <>{textValue(value)}</>;
    return (
      <>
        {formatted(value, () =>
          new Intl.NumberFormat(locale, {
            style: "percent",
            ...fractionDigits(format.decimals),
          }).format(format.basis === "unit" ? number / 100 : number),
        )}
      </>
    );
  }

  if (format.kind === "delta") {
    const number = numericValue(value);
    if (number === undefined) return <>{textValue(value)}</>;
    const direction = number > 0 ? "↑" : number < 0 ? "↓" : "→";
    const good = number === 0 || number > 0 === (format.upIsGood ?? true);
    const content = formatted(value, () =>
      new Intl.NumberFormat(locale, {
        signDisplay: "never",
        ...fractionDigits(format.decimals),
      }).format(number),
    );
    return (
      <span
        className={sx(
          number === 0
            ? styles.muted
            : good
              ? styles.good
              : styles.bad,
        )}
      >
        {direction} {withUnit(content, format.unit)}
      </span>
    );
  }

  if (format.kind === "date") {
    const date = asDate(value);
    if (!date) return <>{textValue(value)}</>;
    const style = format.style ?? "date";
    const content = formatted(value, () =>
      style === "relative"
        ? relativeDate(date, locale, relativeTo)
        : new Intl.DateTimeFormat(
            locale,
            style === "datetime"
              ? { dateStyle: "medium", timeStyle: "short" }
              : {
                  dateStyle: "medium",
                  ...(typeof value === "string" && DATE_ONLY.test(value)
                    ? { timeZone: "UTC" }
                    : {}),
                },
          ).format(date),
    );
    return (
      <Tip label={date.toISOString()}>
      <span tabIndex={0}
        {...(style === "relative" && suppressRelativeHydrationWarning
          ? { suppressHydrationWarning: true }
          : {})}
      >
        {content}
      </span>
      </Tip>
    );
  }

  if (format.kind === "boolean") {
    if (typeof value !== "boolean") return <>{textValue(value)}</>;
    return (
      <>{value ? (format.trueLabel ?? "Yes") : (format.falseLabel ?? "No")}</>
    );
  }

  if (format.kind === "link") {
    const hrefValue = format.hrefKey ? row[format.hrefKey] : value;
    const href = safeHref(
      typeof hrefValue === "string" ? hrefValue : undefined,
    );
    if (!href) return <>{textValue(value)}</>;
    const external = /^https?:/.test(href);
    return external ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={sx(styles.link)}
      >
        {textValue(value)}
        <span className={sx(styles.sr)}> (opens in a new tab)</span>
      </a>
    ) : (
      <a href={href} className={sx(styles.link)}>
        {textValue(value)}
      </a>
    );
  }

  if (format.kind === "badge") {
    const tone = format.tones?.[textValue(value)] ?? "neutral";
    return (
      <span
        className={sx(
          styles.badge,
          tone === "neutral" && field,
          tone === "neutral" && styles.neutral,
          tone === "success" &&
            styles.success,
          tone === "warning" &&
            styles.warning,
          tone === "danger" && styles.danger,
        )}
      >
        {textValue(value)}
      </span>
    );
  }

  if (format.kind === "list" && Array.isArray(value)) {
    const max = Math.max(0, Math.floor(format.max ?? value.length));
    const shown = value.slice(0, max);
    return (
      <span className={sx(styles.list)}>
        {shown.map((item, index) => (
          <span
            key={index}
            className={sx(
              field,
              styles.chip,
            )}
          >
            {item}
          </span>
        ))}
        {value.length > shown.length ? (
          <span className={sx(styles.more)}>
            +{value.length - shown.length}
          </span>
        ) : null}
      </span>
    );
  }

  return <>{textValue(value)}</>;
}

const isNumeric = (format: DataTableFormat | undefined) =>
  format?.kind === "number" ||
  format?.kind === "currency" ||
  format?.kind === "percent" ||
  format?.kind === "delta";

const compareValues = (
  a: DataTableValue,
  b: DataTableValue,
  column: DataTableColumn,
  collator: Intl.Collator,
) => {
  if (isEmpty(a)) return isEmpty(b) ? 0 : 1;
  if (isEmpty(b)) return -1;
  if (column.format?.kind === "date") {
    const first = asDate(a);
    const second = asDate(b);
    if (first && second) return first.getTime() - second.getTime();
  }
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }
  if (Array.isArray(a) && Array.isArray(b)) return a.length - b.length;
  return collator.compare(textValue(a), textValue(b));
};

const collatorFor = (locale: string) => {
  try {
    return new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  } catch {
    return new Intl.Collator("en-US", { numeric: true, sensitivity: "base" });
  }
};

const rowIdentifier = (
  row: DataTableRow,
  key: string | undefined,
  index: number,
) => {
  const value = key === undefined ? undefined : row[key];
  return value === null || value === undefined ? index : textValue(value);
};

export function DataTable({
  columns,
  rows,
  rowKey,
  caption,
  defaultSort,
  sort,
  onSortChange,
  locale = "en-US",
  emptyMessage = "No rows",
  relativeTo,
  className,
  ...props
}: DataTableProps) {
  const [internalSort, setInternalSort] = useState<DataTableSort | null>(
    defaultSort ?? null,
  );
  const [announcement, setAnnouncement] = useState("");
  const activeSort = sort === undefined ? internalSort : sort;
  const hasRelativeDates = columns.some(
    (column) =>
      column.format?.kind === "date" && column.format.style === "relative",
  );
  const [, setTick] = useState(0);
  const relativeTime = relativeTo ?? Date.now();
  const refreshDelay =
    relativeTo === undefined && hasRelativeDates
      ? relativeRefreshDelay(columns, rows, relativeTime)
      : undefined;

  useEffect(() => {
    if (refreshDelay === undefined) return;
    const timeout = window.setTimeout(
      () => setTick((tick) => tick + 1),
      refreshDelay,
    );
    return () => window.clearTimeout(timeout);
  });
  const sortColumn = columns.find((column) => column.key === activeSort?.key);
  const collator = collatorFor(locale);
  const indexedRows = rows.map((row, index) => ({ row, index }));
  const sortedRows =
    activeSort && sortColumn
      ? indexedRows.sort((a, b) => {
          const result = compareValues(
            a.row[sortColumn.key],
            b.row[sortColumn.key],
            sortColumn,
            collator,
          );
          if (result === 0) return a.index - b.index;
          if (
            isEmpty(a.row[sortColumn.key]) ||
            isEmpty(b.row[sortColumn.key])
          ) {
            return result;
          }
          return activeSort.direction === "asc" ? result : -result;
        })
      : indexedRows;
  const primaryColumn =
    columns.find((column) => column.priority === "primary") ?? columns[0];

  const applySort = (next: DataTableSort | null) => {
    const label = columns.find((column) => column.key === next?.key)?.label;
    if (sort === undefined) setInternalSort(next);
    setAnnouncement(next ? `Sorted by ${label}, ${next.direction === "asc" ? "ascending" : "descending"}` : "Sorting cleared");
    onSortChange?.(next);
  };
  const changeSort = (column: DataTableColumn) => {
    applySort(
      activeSort?.key !== column.key
        ? { key: column.key, direction: "asc" as const }
        : activeSort.direction === "asc"
          ? { key: column.key, direction: "desc" as const }
          : null,
    );
  };
  const directions: DataTableSort["direction"][] = ["asc", "desc"];
  const sortOptions: { id: string; label: string; sort: DataTableSort | null }[] = [
    { id: "source", label: "Source order", sort: null },
    ...columns.filter((column) => column.sortable !== false).flatMap((column, index) => directions.map((direction) => ({
      id: `${index}-${direction}`, label: `${column.label}, ${direction === "asc" ? "ascending" : "descending"}`, sort: { key: column.key, direction },
    }))),
  ];
  const selectedSort = sortOptions.find((option) => option.sort?.key === activeSort?.key && option.sort?.direction === activeSort?.direction) ?? sortOptions[0];

  const cellClass = (column: DataTableColumn) =>
    sx(
      styles.cell,
      (column.align ?? (isNumeric(column.format) ? "end" : "start")) ===
        "end" && styles.end,
    );

  return (
    <div
      data-slot="data-table"
      className={withClass(undefined, className, paper,
        styles.root,
      ).className}
      {...props}
    >
      {sortOptions.length > 1 && <div className={sx(styles.compactSort)}>
        <Select value={selectedSort.id} onValueChange={(value) => {
          const option = sortOptions.find((option) => option.id === value);
          if (option) applySort(option.sort);
        }}>
          <SelectTrigger aria-label="Sort table" size="sm"><SelectValue>{selectedSort.label}</SelectValue></SelectTrigger>
          <SelectPopup>{sortOptions.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectPopup>
        </Select>
      </div>}
      <table className={sx(styles.table)}>
        {caption ? <caption className={sx(styles.sr)}>{caption}</caption> : null}
        <thead className={sx(styles.head)}>
          <tr>
            {columns.map((column) => {
              const direction =
                activeSort?.key === column.key
                  ? activeSort.direction
                  : undefined;
              const sortable = column.sortable !== false;
              return (
                <th
                  key={column.key}
                  scope="col"
                  {...(direction
                    ? {
                        "aria-sort":
                          direction === "asc" ? "ascending" : "descending",
                      }
                    : {})}
                  style={column.width ? { width: column.width } : undefined}
                  className={sx(
                          styles.heading,
                    (column.align ??
                      (isNumeric(column.format) ? "end" : "start")) === "end"
                      ? styles.end
                      : styles.start,
                  )}
                >
                  {sortable ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      type="button"
                      onClick={() => changeSort(column)}
                      aria-label={`Sort by ${column.label}`}
                    >
                      {column.label}
                      {direction ? (
                        <span aria-hidden className={sx(styles.arrow)}>
                          {direction === "asc" ? "↑" : "↓"}
                        </span>
                      ) : null}
                    </Button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(columns.length, 1)}
                className={sx(styles.empty)}
              >
                <span role="status">{emptyMessage}</span>
              </td>
            </tr>
          ) : (
            sortedRows.map(({ row, index }) => (
              <tr
                key={rowIdentifier(row, rowKey, index)}
                className={sx(styles.row)}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cellClass(column)}>
                    <Value
                      column={column}
                      row={row}
                      locale={locale}
                      relativeTo={relativeTime}
                      suppressRelativeHydrationWarning={
                        relativeTo === undefined
                      }
                    />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div role="list" className={sx(styles.cards)}>
        {sortedRows.length === 0 ? (
          <div
            role="status"
            className={sx(styles.empty)}
          >
            {emptyMessage}
          </div>
        ) : (
          sortedRows.map(({ row, index }) => (
            <div
              key={rowIdentifier(row, rowKey, index)}
              role="listitem"
              className={sx(styles.card)}
            >
              {primaryColumn ? (
                <div className={sx(styles.primary)}>
                  <span className={sx(styles.sr)}>{primaryColumn.label}: </span>
                  <Value
                    column={primaryColumn}
                    row={row}
                    locale={locale}
                    relativeTo={relativeTime}
                    suppressRelativeHydrationWarning={relativeTo === undefined}
                  />
                </div>
              ) : null}
              {columns.length > 1 ? (
                <dl className={sx(styles.details)}>
                  {columns
                    .filter((column) => column.key !== primaryColumn?.key)
                    .map((column) => (
                      <div
                        key={column.key}
                        className={sx(styles.detail)}
                      >
                        <dt className={sx(styles.term)}>
                          {column.label}
                        </dt>
                        <dd className={sx(styles.definition)}>
                          <Value
                            column={column}
                            row={row}
                            locale={locale}
                            relativeTo={relativeTime}
                            suppressRelativeHydrationWarning={
                              relativeTo === undefined
                            }
                          />
                        </dd>
                      </div>
                    ))}
                </dl>
              ) : null}
            </div>
          ))
        )}
      </div>
      <p aria-live="polite" className={sx(styles.sr)}>
        {announcement}
      </p>
    </div>
  );
}
