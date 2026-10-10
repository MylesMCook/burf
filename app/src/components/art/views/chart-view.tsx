import * as stylex from "@stylexjs/stylex";
import { MotionConfig, MotionGlobalConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Area } from "@/components/charts/area";
import { AreaChart } from "@/components/charts/area-chart";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { FunnelChart } from "@/components/charts/funnel-chart";
import { Gauge } from "@/components/charts/gauge";
import { Grid } from "@/components/charts/grid";
import { Line } from "@/components/charts/line";
import { LineChart } from "@/components/charts/line-chart";
import { PieCenter } from "@/components/charts/pie-center";
import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { Ring } from "@/components/charts/ring";
import { RingCenter } from "@/components/charts/ring-center";
import { RingChart } from "@/components/charts/ring-chart";
import { SankeyChart, SankeyLink, SankeyNode, SankeyTooltip } from "@/components/charts/sankey";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import type { ViewProps } from "@/components/art/kinds";
import { Thumb } from "@/components/art/thumb";
import { useActiveTheme } from "@/hooks/use-theme";
import { type BerthChart, type ChartPlan, fmt, legend, parseChart, plan, series } from "@/lib/art/chart-spec";
import { chartVars } from "@/lib/art/theme";

const paint = stylex.create({
  s0: {
    "pointerEvents": "none",
  },
  s1: {
    "height": "100%",
  },
  s2: {
    "display": "flex",
    "height": "100%",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "gap": "12px",
  },
  s3: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "baseline",
    "justifyContent": "space-between",
    "columnGap": "16px",
    "rowGap": "4px",
  },
  s4: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s5: {
    "position": "relative",
    "maxHeight": "36rem",
    "minHeight": "14rem",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s6: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
  },
  s7: {
    "listStyleType": "disc",
    "paddingInlineStart": "16px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s8: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s9: {
    "maxHeight": "100%",
  },
  s10: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s11: {
    "aspectRatio": "1 / 1",
    "height": "100%",
    "maxHeight": "100%",
    "maxWidth": "100%",
  },
  s12: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s13: {
    "aspectRatio": "1 / 1",
    "height": "100%",
    "maxHeight": "100%",
    "maxWidth": "100%",
  },
  s14: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s15: {
    "width": "100%",
  },
  s16: {
    "maxWidth": "19rem",
  },
  s17: {
    "maxWidth": "34rem",
  },
  s18: {
    "overflow": "auto",
  },
  s19: {
    "width": "100%",
  },
  s20: {
    "paddingLeft": "2px",
    "paddingRight": "2px",
    "paddingBottom": "4px",
    "textAlign": "center",
    "fontWeight": 400,
  },
  s21: {
    "whiteSpace": "nowrap",
    "paddingInlineEnd": "8px",
    "fontWeight": 400,
  },
  s22: {
    "borderRadius": "4px",
    "textAlign": "center",
    "fontVariantNumeric": "tabular-nums",
  },
  s23: {
    "marginTop": "8px",
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "flex-end",
    "gap": "6px",
    "fontSize": "0.6875rem",
    "color": "var(--muted-foreground)",
  },
  s24: {
    "fontVariantNumeric": "tabular-nums",
  },
  s25: {
    "height": "10px",
    "width": "20px",
    "borderRadius": "3px",
  },
  s26: {
    "fontVariantNumeric": "tabular-nums",
  },
  s27: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "12px",
    "rowGap": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s28: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s29: {
    "width": "8px",
    "height": "8px",
    "borderRadius": "999px",
  },
  s30: {
    "display": "flex",
    "flexWrap": "wrap",
    "gap": "6px",
  },
  s31: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s32: {
    "color": "var(--muted-foreground)",
  },
  s33: {
    "fontWeight": 500,
    "fontVariantNumeric": "tabular-nums",
  },
  s34: {
    "color": "var(--muted-foreground)",
  },
  s35: {
    "display": "flex",
    "height": "100%",
    "minHeight": "80px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "var(--border)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  n0: {
    "fontWeight": 500,
    "fontVariantNumeric": "tabular-nums",
  },
  n1: {
    "color": "var(--muted-foreground)",
  },
  n2: {
    "color": "var(--success-foreground)",
  },
  n3: {
    "color": "var(--destructive-foreground)",
  },

  s36: {
    borderCollapse: "separate",
  },
  s37: {
    borderSpacing: 3,
  },
  s38: {
    textAlign: "end",
  },
  s39: {
    height: "100%",
    width: "100%",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// A berth.chart drawn with bklit UI's charts (components/charts), in the
// theme's colours: its tooltips render in a portal on <body>, so the
// --chart-* variables are set on the document as well as on the chart.
// Motion follows the person's reduced-motion setting.

// The size a thumbnail is drawn at before it is scaled down.
const THUMB_W = 560;

export default function ChartView({ body, size, height }: ViewProps) {
  const spec = useMemo(() => parseChart(body), [body]);
  const [box, width] = useWidth();
  useDocumentChartVars();
  if (!spec) return <Broken why="This chart's JSON doesn't parse." />;
  const p = plan(spec);
  if (size === "thumb") {
    const h = height ?? 120;
    // The funnel measures itself on screen, scaled or not: drawn at the
    // thumbnail's own size.
    if (p.type === "funnel")
      return (
        <div className={sx(paint.s0)} style={{ height: h }} aria-hidden>
          <MotionConfig reducedMotion="user">
            <Drawn spec={spec} p={p} thumb />
          </MotionConfig>
        </div>
      );
    return (
      <Thumb h={h} width={THUMB_W}>
        <div className={[sx(paint.s1), "art-thumb-chart"].filter(Boolean).join(" ")}>
          <MotionConfig reducedMotion="user">
            <Drawn spec={spec} p={p} thumb />
          </MotionConfig>
        </div>
      </Thumb>
    );
  }
  return (
    <div className={sx(paint.s2)} data-chart-type={spec.type}>
      {(spec.subtitle || legend(spec).length > 0) && (
        <div className={sx(paint.s3)}>
          {spec.subtitle && <p className={sx(paint.s4)}>{spec.subtitle}</p>}
          <Legend spec={spec} />
        </div>
      )}
      <div ref={box} className={sx(paint.s5)}>
        <div className={sx(paint.s6)}>
          <MotionConfig reducedMotion="user">
            <Drawn spec={spec} p={narrowBars(p, width)} />
          </MotionConfig>
        </div>
      </div>
      <Changes spec={spec} />
      {spec.notes?.length ? (
        <ul className={sx(paint.s7)}>
          {spec.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function useWidth(): [React.RefCallback<HTMLDivElement>, number] {
  const [w, setW] = useState(0);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    ro.current?.disconnect();
    if (!el) return;
    ro.current = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.current.observe(el);
  }, []);
  return [ref, w];
}

// narrowBars lays a bar chart sideways when its categories' names wouldn't
// fit under the bars.
function narrowBars(p: ChartPlan, width: number): ChartPlan {
  if (p.type !== "bar" || p.horizontal || !width) return p;
  const longest = Math.max(...p.data.map((r) => String(r[p.x] ?? "").length));
  return longest * 7 + 16 > width / Math.max(1, p.data.length) ? { ...p, horizontal: true } : p;
}

// Reduce motion: bklit's charts are drawn at once. MotionConfig's
// reducedMotion keeps their fades and reveals (1.1s); this skips them.
if (typeof matchMedia !== "undefined") {
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const apply = () => {
    MotionGlobalConfig.skipAnimations = still.matches;
  };
  apply();
  still.addEventListener("change", apply);
}

// useDocumentChartVars puts the theme's chart variables on <html> while a
// chart is shown, for bklit's tooltips (portalled to <body>).
let users = 0;
function useDocumentChartVars() {
  const theme = useActiveTheme();
  useEffect(() => {
    const vars = chartVars(theme);
    const root = document.documentElement;
    users++;
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    return () => {
      users--;
      if (users === 0) for (const k of Object.keys(vars)) root.style.removeProperty(k);
    };
  }, [theme]);
}

const fill = (sx(paint.s39) ?? "");
const fillStyle = { aspectRatio: "auto", height: "100%" } as const;

function Drawn({ spec, p, thumb }: { spec: BerthChart; p: ChartPlan; thumb?: boolean }) {
  const units = spec.units;
  const margin = thumb ? { top: 12, right: 26, bottom: 28, left: 26 } : { top: 16, right: 16, bottom: 36, left: 16 };
  switch (p.type) {
    case "bar":
      return (
        <BarChart data={p.data} xDataKey={p.x} aspectRatio="auto" className={fill} stacked={p.stacked} orientation={p.horizontal ? "horizontal" : "vertical"} margin={p.horizontal ? { ...margin, right: 12, left: Math.round(Math.min(180, Math.max(60, Math.max(...p.data.map((r) => String(r[p.x] ?? "").length)) * (thumb ? 6.4 : 7.2) + 24))) } : margin} barGap={0.28}>
          <Grid horizontal={!p.horizontal} vertical={p.horizontal} />
          {p.series.map((s) => (
            <Bar key={s.key} dataKey={s.key} fill={s.color} stroke={s.color} lineCap={4} animationType="grow" />
          ))}
          {p.horizontal ? <BarYAxis /> : <BarXAxis showAllLabels={p.data.length <= 8} />}
          {!thumb && <ChartTooltip />}
        </BarChart>
      );
    case "line":
      return (
        <LineChart data={p.data} aspectRatio="" className={fill} margin={margin}>
          <Grid horizontal />
          {p.series.map((s) => (
            <Line key={s.key} dataKey={s.key} stroke={s.color} strokeWidth={thumb ? 3 : 2.5} />
          ))}
          <XAxis numTicks={thumb ? 3 : 6} />
          {!thumb && <ChartTooltip />}
        </LineChart>
      );
    case "area":
      return (
        <AreaChart data={p.data} aspectRatio="auto" className={fill} margin={margin}>
          <Grid horizontal />
          {p.series.map((s) => (
            <Area key={s.key} dataKey={s.key} fill={s.color} stroke={s.color} />
          ))}
          <XAxis numTicks={thumb ? 3 : 6} />
          {!thumb && <ChartTooltip />}
        </AreaChart>
      );
    case "funnel":
      return (
        <div className={[fill, sx(paint.s8)].filter(Boolean).join(" ")}>
          <FunnelChart data={p.stages} color={p.color} orientation="horizontal" showPercentage showValues showLabels={!thumb} formatValue={(v) => fmt(v, units)} style={{ ...fillStyle, maxHeight: "100%" }} className={sx(paint.s9)} />
        </div>
      );
    case "pie": {
      return (
        <div className={[fill, sx(paint.s10)].filter(Boolean).join(" ")}>
          <div className={sx(paint.s11)}>
            <PieChart data={p.slices} innerRadius={0} padAngle={0.01} cornerRadius={3} className={fill}>
              {p.slices.map((s, i) => (
                <PieSlice index={i} key={s.label} />
              ))}
              {!thumb && <PieCenter defaultLabel={units ? `Total, ${units}` : "Total"} />}
            </PieChart>
          </div>
        </div>
      );
    }
    case "ring":
      return (
        <div className={[fill, sx(paint.s12)].filter(Boolean).join(" ")}>
          <div className={sx(paint.s13)}>
            <RingChart data={p.rings} strokeWidth={thumb ? 16 : 22} ringGap={thumb ? 6 : 8} baseInnerRadius={thumb ? undefined : 96} className={fill}>
              {p.rings.map((r, i) => (
                <Ring index={i} key={r.label} />
              ))}
              {!thumb && <RingCenter defaultLabel={units ? `Total, ${units}` : "Total"} />}
            </RingChart>
          </div>
        </div>
      );
    case "sankey":
      return (
        <SankeyChart data={{ nodes: p.nodes.map((n) => ({ name: n.name })), links: p.links }} aspectRatio="auto" className={fill} margin={thumb ? { top: 8, right: 110, bottom: 8, left: 90 } : { top: 16, right: 150, bottom: 16, left: 120 }} nodeWidth={thumb ? 12 : 14} nodePadding={thumb ? 14 : 20}>
          <SankeyLink useGradient getNodeColor={(_, i) => p.nodes[i]?.color ?? "var(--chart-1)"} />
          <SankeyNode getNodeColor={(_, i) => p.nodes[i]?.color ?? "var(--chart-1)"} showValueLabels={false} />
          {!thumb && <SankeyTooltip />}
        </SankeyChart>
      );
    case "gauge":
      return (
        <div className={[fill, sx(paint.s14)].filter(Boolean).join(" ")}>
          <div className={[sx(paint.s15), thumb ? sx(paint.s16) : sx(paint.s17)].filter(Boolean).join(" ")}>
            <Gauge value={p.percent} centerValue={p.value} defaultLabel={p.label} suffix={units === "%" ? "%" : units ? ` ${units}` : undefined} totalNotches={thumb ? 28 : 40} activeFill={p.color} minWidth={thumb ? 240 : 280} />
          </div>
        </div>
      );
    case "heatmap":
      return <Heatmap p={p} units={units} thumb={thumb} />;
  }
}

// Heatmap: a matrix of cells in bklit's scale colours, values printed.
function Heatmap({ p, units, thumb }: { p: Extract<ChartPlan, { type: "heatmap" }>; units?: string; thumb?: boolean }) {
  return (
    <div className={[fill, sx(paint.s18)].filter(Boolean).join(" ")} data-heatmap>
      <table className={[[sx(paint.s19), [sx(paint.s36), "art-heat"].filter(Boolean).join(" ")].filter(Boolean).join(" "), thumb ? sx(paint.s37) : sx(paint.s37)].filter(Boolean).join(" ")}>
        <thead>
          <tr>
            <th aria-label="Row" />
            {p.cols.map((c) => (
              <th key={c} scope="col" className={[sx(paint.s20), "art-tick"].filter(Boolean).join(" ")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.rows.map((r, ri) => (
            <tr key={r}>
              <th scope="row" className={[sx(paint.s21), [sx(paint.s38), "art-tick"].filter(Boolean).join(" ")].filter(Boolean).join(" ")}>
                {r}
              </th>
              {p.cols.map((c, ci) => {
                const v = p.cells[ri][ci];
                const lv = p.levels[ri][ci];
                return (
                  <td
                    key={c}
                    className={[sx(paint.s22), "art-cell"].filter(Boolean).join(" ")}
                    data-level={lv}
                    aria-label={v === null ? `${r} at ${c}: no data` : `${r} at ${c}: ${fmt(v, units)}`}
                    style={{ background: lv < 0 ? "transparent" : `var(--chart-scale-0${lv + 1})`, color: `var(--chart-heat-ink-${lv + 1})`, animationDelay: `${Math.min(ri * 40 + ci * 12, 600)}ms` }}
                  >
                    {v === null ? "" : fmt(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!thumb && (
        <div className={sx(paint.s23)}>
          <span className={sx(paint.s24)}>{fmt(p.min, units)}</span>
          {[1, 2, 3, 4, 5].map((l) => (
            <span key={l} className={sx(paint.s25)} style={{ background: `var(--chart-scale-0${l})` }} />
          ))}
          <span className={sx(paint.s26)}>{fmt(p.max, units)}</span>
        </div>
      )}
    </div>
  );
}

function Legend({ spec }: { spec: BerthChart }) {
  const items = legend(spec);
  if (!items.length) return null;
  return (
    <ul className={sx(paint.s27)} aria-label="Legend">
      {items.map((s) => (
        <li key={s.label} className={sx(paint.s28)}>
          <span className={sx(paint.s29)} style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

// Changes: a two-series bar chart with a better direction lists each
// category's change, good or bad, under the chart.
function Changes({ spec }: { spec: BerthChart }) {
  if (spec.type !== "bar" || !spec.better) return null;
  const ss = series(spec);
  if (ss.length !== 2) return null;
  const [b, a] = ss;
  const x = spec.x ?? "x";
  return (
    <ul className={sx(paint.s30)} aria-label="Changes">
      {(spec.data ?? []).map((r) => {
        const from = Number(r[b.key]);
        const to = Number(r[a.key]);
        const d = from ? (to - from) / from : 0;
        const good = spec.better === "higher" ? d > 0 : d < 0;
        const flat = Math.abs(d) < 0.005;
        return (
          <li key={String(r[x])} className={sx(paint.s31)}>
            <span className={sx(paint.s32)}>{String(r[x])}</span>
            <span className={[sx(paint.n0), flat ? sx(paint.n1) : good ? sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")}>
              {flat ? "±0%" : `${d > 0 ? "+" : "−"}${Math.abs(Math.round(d * 100))}%`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Broken({ why }: { why: string }) {
  return <div className={sx(paint.s35)}>{why}</div>;
}
