import * as stylex from "@stylexjs/stylex";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useMemo, useState } from "react";

import type { ViewProps } from "@/components/art/kinds";
import { Thumb } from "@/components/art/thumb";
import { parseTable, verdict } from "@/lib/art/table-data";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "100%",
    "alignItems": "center",
    "justifyContent": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s1: {
    "display": "flex",
    "height": "100%",
    "minHeight": "0px",
    "flexDirection": "column",
  },
  s2: {
    "pointerEvents": "none",
  },
  s3: {
    "display": "flex",
    "flexShrink": 0,
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "12px",
    "rowGap": "4px",
    "paddingBottom": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s5: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "6px",
    "fontVariantNumeric": "tabular-nums",
  },
  s6: {
    "width": "8px",
    "height": "8px",
    "borderRadius": "999px",
    "backgroundColor": "var(--chart-good)",
  },
  s7: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "6px",
    "fontVariantNumeric": "tabular-nums",
  },
  s8: {
    "fontWeight": 500,
    "color": "var(--destructive-foreground)",
  },
  s9: {
    "width": "8px",
    "height": "8px",
    "borderRadius": "999px",
    "backgroundColor": "var(--chart-bad)",
  },
  s10: {
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s11: {
    "marginLeft": "auto",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s12: {
    "borderColor": "transparent",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 15%, transparent)",
    "color": "var(--destructive-foreground)",
  },
  s13: {
    "color": "var(--muted-foreground)",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s14: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s15: {
    "overflow": "hidden",
  },
  s16: {
    "overflow": "auto",
  },
  s17: {
    "width": "100%",
  },
  s18: {
    "fontSize": "11px",
    "lineHeight": "16px",
  },
  s19: {
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s20: {
    "position": "sticky",
    "top": "0px",
    "zIndex": 10,
    "backgroundColor": "color-mix(in oklab, var(--muted) 90%, transparent)",
  },
  s21: {
    "whiteSpace": "nowrap",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
  },
  s22: {
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s23: {
    "paddingTop": "6px",
    "paddingBottom": "6px",
  },
  s24: {
    "textAlign": "right",
  },
  s25: {
    "textAlign": "left",
  },
  s26: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "color": {
      ":hover": "var(--foreground)",
    },
  },
  s27: {
    "width": "12px",
    "height": "12px",
  },
  s28: {
    "width": "12px",
    "height": "12px",
  },
  s29: {
    "borderBottomWidth": {
      "default": 1,
      ":last-child": 0,
    },
    "borderBottomStyle": {
      "default": "solid",
      ":last-child": "solid",
    },
    "borderBottomColor": {
      "default": "var(--border)",
      ":last-child": "var(--border)",
    },
  },
  s30: {
    "backgroundColor": "color-mix(in oklab,var(--chart-bad) 11%,transparent)",
  },
  s31: {
    "color": "var(--muted-foreground)",
  },
  s32: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "verticalAlign": "top",
  },
  s33: {
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s34: {
    "paddingTop": "6px",
    "paddingBottom": "6px",
  },
  s35: {
    "textAlign": "right",
    "fontVariantNumeric": "tabular-nums",
  },
  s36: {
    "whiteSpace": "nowrap",
  },
  s37: {
    "maxWidth": "24rem",
  },
  s38: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "fontWeight": 500,
  },
  s39: {
    "color": "var(--destructive-foreground)",
  },
  s40: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s41: {
    "backgroundColor": "var(--chart-bad)",
  },
  s42: {
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 3,
    "WebkitBoxOrient": "vertical",
    "overflowWrap": "break-word",
  },
  s43: {
    "color": "var(--destructive-foreground)",
  },
  s44: {
    "paddingTop": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  n0: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "fontWeight": 500,
  },
  n1: {
    "color": "var(--destructive-foreground)",
  },
  n2: {
    "color": "var(--success-foreground)",
  },
  n3: {
    "color": "var(--muted-foreground)",
  },
  n4: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  n5: {
    "backgroundColor": "var(--chart-bad)",
  },
  n6: {
    "backgroundColor": "var(--chart-good)",
  },
  n7: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
  },

  s45: {
    borderCollapse: "collapse",
  },
  s46: {
    backdropFilter: "blur(8px)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// A table artifact: CSV, TSV or JSON rows, as text. A status column
// colours its rows (failures stand out, skips go quiet) and can be
// filtered to failures; numbers align right; headers sort.

const isNum = (s: string) => s.trim() !== "" && !Number.isNaN(Number(s));

function cellText(col: string, v: string): string {
  if (isNum(v) && /_ms$/i.test(col)) {
    const n = Number(v);
    return n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${n} ms`;
  }
  return isNum(v) && Math.abs(Number(v)) >= 1000 ? Number(v).toLocaleString("en-US") : v;
}

const header = (c: string) => c.replace(/_ms$/i, "").replace(/_/g, " ").replace(/^./, (m) => m.toUpperCase());
const rank = (v: string) => (verdict(v) === "fail" ? 0 : verdict(v) === "skip" ? 2 : 1);

export default function TableView({ art, body, size, height }: ViewProps) {
  const t = useMemo(() => parseTable(body, art.format), [body, art.format]);
  if (size === "thumb")
    return (
      <Thumb h={height ?? 120} width={620}>
        <Table t={t} thumb />
      </Thumb>
    );
  return <Table t={t} />;
}

function Table({ t, thumb }: { t: ReturnType<typeof parseTable>; thumb?: boolean }) {
  const { head, rows, status: si } = t;
  const [sort, setSort] = useState<{ i: number; dir: 1 | -1 } | null>(si >= 0 ? { i: si, dir: 1 } : null);
  const [only, setOnly] = useState(false);
  const shown = useMemo(() => {
    let out = rows;
    if (only && si >= 0) out = out.filter((r) => verdict(r[si] ?? "") === "fail");
    if (sort) {
      const { i, dir } = sort;
      out = [...out].sort((a, b) => {
        const x = a[i] ?? "";
        const y = b[i] ?? "";
        if (i === si) return (rank(x) - rank(y)) * dir;
        if (isNum(x) && isNum(y)) return (Number(x) - Number(y)) * dir;
        return x.localeCompare(y) * dir;
      });
    }
    return out;
  }, [rows, only, si, sort]);
  const counts = si >= 0 ? { fail: rows.filter((r) => verdict(r[si] ?? "") === "fail").length, pass: rows.filter((r) => verdict(r[si] ?? "") === "pass").length, skip: rows.filter((r) => verdict(r[si] ?? "") === "skip").length } : undefined;
  const numeric = head.map((_, i) => rows.length > 0 && rows.every((r) => (r[i] ?? "") === "" || isNum(r[i] ?? "")));
  const limit = thumb ? 8 : 2000;
  if (!head.length) return <div className={sx(paint.s0)}>This table has no rows.</div>;
  return (
    <div className={[sx(paint.s1), thumb && sx(paint.s2)].filter(Boolean).join(" ")} data-art-table>
      {counts && !thumb && (
        <div className={sx(paint.s3)}>
          <span className={sx(paint.s4)}>{rows.length.toLocaleString("en-US")} rows</span>
          <span className={sx(paint.s5)}>
            <span className={sx(paint.s6)} aria-hidden />
            {counts.pass} passed
          </span>
          <span className={[sx(paint.s7), counts.fail > 0 && sx(paint.s8)].filter(Boolean).join(" ")}>
            <span className={sx(paint.s9)} aria-hidden />
            {counts.fail} failed
          </span>
          {counts.skip > 0 && <span className={sx(paint.s10)}>{counts.skip} skipped</span>}
          {counts.fail > 0 && (
            <button type="button" onClick={() => setOnly((o) => !o)} aria-pressed={only} className={[sx(paint.s11), only ? sx(paint.s12) : sx(paint.s13)].filter(Boolean).join(" ")}>
              Failures only
            </button>
          )}
        </div>
      )}
      <div className={[sx(paint.s14), thumb ? sx(paint.s15) : sx(paint.s16)].filter(Boolean).join(" ")}>
        <table className={[[sx(paint.s17), sx(paint.s45)].filter(Boolean).join(" "), thumb ? sx(paint.s18) : sx(paint.s19)].filter(Boolean).join(" ")}>
          <thead className={[sx(paint.s20), sx(paint.s46)].filter(Boolean).join(" ")}>
            <tr>
              {head.map((c, i) => (
                <th key={`${c}-${i}`} scope="col" aria-sort={sort?.i === i ? (sort.dir === 1 ? "ascending" : "descending") : undefined} className={[sx(paint.s21), thumb ? sx(paint.s22) : sx(paint.s23), numeric[i] ? sx(paint.s24) : sx(paint.s25)].filter(Boolean).join(" ")}>
                  {thumb ? (
                    header(c)
                  ) : (
                    <button type="button" className={sx(paint.s26)} onClick={() => setSort((s) => ({ i, dir: s?.i === i ? (-s.dir as 1 | -1) : 1 }))}>
                      {header(c)}
                      {sort?.i === i && (sort.dir === 1 ? <ArrowDownIcon className={sx(paint.s27)} /> : <ArrowUpIcon className={sx(paint.s28)} />)}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, limit).map((r, k) => {
              const st = si >= 0 ? verdict(r[si] ?? "") : undefined;
              return (
                <tr key={k} data-verdict={st} className={[sx(paint.s29), st === "fail" && sx(paint.s30), st === "skip" && sx(paint.s31)].filter(Boolean).join(" ")}>
                  {head.map((col, i) => {
                    const v = r[i] ?? "";
                    return (
                      <td key={i} className={[sx(paint.s32), thumb ? sx(paint.s33) : sx(paint.s34), numeric[i] && sx(paint.s35), i === si && sx(paint.s36), !thumb && i !== si && !numeric[i] && sx(paint.s37)].filter(Boolean).join(" ")}>
                        {i === si ? (
                          <span className={[sx(paint.n0), st === "fail" ? sx(paint.n1) : st === "pass" ? sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")}>
                            <span className={[sx(paint.n4), st === "fail" ? sx(paint.n5) : st === "pass" ? sx(paint.n6) : sx(paint.n7)].filter(Boolean).join(" ")} aria-hidden />
                            {v}
                          </span>
                        ) : (
                          <span className={[!thumb && sx(paint.s42), st === "fail" && /note|message|error|reason/i.test(col) && sx(paint.s43)].filter(Boolean).join(" ")}>{cellText(col, v)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {shown.length > limit && !thumb && <div className={sx(paint.s44)}>and {(shown.length - limit).toLocaleString("en-US")} more rows; the source has them all</div>}
    </div>
  );
}
