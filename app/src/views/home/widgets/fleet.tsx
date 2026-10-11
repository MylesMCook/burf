import * as stylex from "@stylexjs/stylex";
import { ArrowUpRightIcon } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { StateGlyph, StatusDot, useBoxState } from "@/components/agent-glyph";
import { Tip } from "@/components/tip";
import type { BoxStatus } from "@/lib/api";
import { hostSuffix, portUrl } from "@/lib/browser-url";
import { NONE, useStore } from "@/lib/store";
import { openBrowser, selectWorktree } from "@/lib/workspaces";
import { openAddBox } from "@/views/onboarding/add-box-dialog";

import { useAgentRows } from "./agents";
import { useHomeMachines } from "./machine-filter";
import { fitRows, useHomeWidget } from "./env";
import { fleetLayout, fleetStats, fleetVisibleCount } from "./fleet-stats";
import { Bar, More, shortAgo, WidgetEmpty, WidgetRow, WidgetSkeleton } from "./parts";
import { placeLabel } from "@/lib/worktree-names";

const paint = stylex.create({
  s0: {
    "display": "grid",
    "alignContent": "flex-start",
    "rowGap": "2px",
  },
  s1: {
    "gridTemplateColumns": "repeat(2, minmax(0, 1fr))",
    "columnGap": "8px",
  },
  s2: {
    "display": "flex",
    "width": "100%",
    "textAlign": "left",
    "backgroundColor": { default: "transparent", ":hover": "var(--accent)" },
    "outline": { ":focus-visible": "2px solid var(--ring)" },
    "outlineOffset": 2,
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
  },
  s3: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s4: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s5: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s6: {
    "width": "12px",
    "height": "12px",
  },
  s7: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s8: {
    "width": "12px",
    "height": "12px",
  },
  s9: {
    "display": "grid",
    "gridTemplateColumns": "repeat(3, minmax(0, 1fr))",
    "gap": "8px",
    "paddingLeft": "14px",
  },
  s10: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "2px",
  },
  s11: {
    "display": "flex",
    "flexDirection": { default: "row", "@container (max-width: 420px)": "column" },
    "justifyContent": "space-between",
    "gap": "4px",
    "fontSize": "12px",
    "color": "var(--muted-foreground)",
  },
  s12: {
    "color": "var(--foreground)",
    "fontWeight": 500,
    "fontVariantNumeric": "tabular-nums",
  },
  metricLabel: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  s13: {
    "height": "22px",
    "paddingLeft": "14px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s14: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "paddingLeft": "14px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s15: {
    "display": "flex",
    "flexDirection": "column",
  },
  s16: {
    "width": "6px",
    "height": "6px",
    "flexShrink": 0,
    "borderRadius": "999px",
    "backgroundColor": "var(--success)",
  },
  s17: {
    "width": "44px",
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "fontVariantNumeric": "tabular-nums",
  },
  s18: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s19: {
    "flexShrink": 0,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s20: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "opacity": 0,
    ":is(.group\\/row:hover &)": {
      "opacity": 1,
    },
    ":is(.group\\/row:focus-visible &)": {
      "opacity": 1,
    },
  },

  s21: {
    "@container (max-width: 739px)": {
      gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    },
  },
  s22: {
    "@container (max-width: 260px)": {
      display: "none",
    },
  },
  normalization: { fontSize: 12, lineHeight: "16px", color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Boxes and what runs on them: both from what the app already polls (each
// box's stats every 30s, its services), so they cost nothing extra.

export function BoxesWidget() {
  const selected = useHomeMachines();
  const { height, span } = useHomeWidget();
  const list = useStore((s) => s.status?.boxes ?? (NONE as BoxStatus[]));
  const loaded = useStore((s) => !!s.status);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { columns, rowHeight } = fleetLayout(width, span.c);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [span.c, loaded, list.length]);
  if (!loaded) return <WidgetSkeleton rows={3} />;
  if (!list.length) return <WidgetEmpty scene="arriving" title="No paired computers" hint="Add a computer to see its readings and agent activity." action="Add computer" onAction={openAddBox} />;
  // Online first, then by name; offline boxes take one line.
  const sorted = list.filter((b) => !selected || selected.includes(b.name)).sort((a, b) => Number(b.state === "online") - Number(a.state === "online") || a.name.localeCompare(b.name));
  const shown = sorted.slice(0, fleetVisibleCount(height, rowHeight, columns, sorted.length));
  return (
    <div ref={wrap} data-testid="home-machine-rows" className={[sx(paint.s0), columns === 2 && [sx(paint.s1), sx(paint.s21)].filter(Boolean).join(" ")].filter(Boolean).join(" ")}>
      {shown.map((b) => (
        <BoxRow key={b.name} b={b} />
      ))}
      <More n={sorted.length - shown.length} label={sorted.length - shown.length === 1 ? "box" : "boxes"} onClick={() => useStore.getState().setView({ kind: "settings", section: "boxes" })} />
    </div>
  );
}

function BoxRow({ b }: { b: BoxStatus }) {
  const state = useBoxState(b.name);
  const st = useStore((s) => s.boxes[b.name]?.stats);
  const mac = useStore((s) => s.boxes[b.name]?.info?.os === "darwin");
  const error = useStore((s) => {
    const data = s.boxes[b.name];
    return data?.partErrors ? data.partErrors.stats : data?.error;
  });
  const connected = useStore((s) => s.connection.state === "online");
  const sessionsKnown = useStore((s) => s.boxes[b.name]?.sessions !== undefined);
  const sessionsFailed = useStore((s) => !!s.boxes[b.name]?.partErrors?.sessions);
  const agents = useAgentRows(false);
  const working = agents.filter((a) => a.box === b.name && a.state === "running").length;
  const waiting = agents.filter((a) => a.box === b.name && a.state === "waiting").length;
  const online = b.state === "online";
  const readings = fleetStats(online && connected && !error ? st : undefined);
  const usage = [
    { label: "Load (1m)", detail: "Load (1m), not CPU utilization", value: readings.loadPerCpu, text: readings.load === undefined ? "—" : readings.load.toFixed(2), normalization: readings.loadPerCpu === undefined ? undefined : `${readings.loadPerCpu.toFixed(2)}/CPU`, full: readings.load === undefined ? "Unavailable" : `${readings.load.toFixed(2)}${readings.cpus === undefined ? "" : ` on ${readings.cpus} CPUs · ${readings.loadPerCpu!.toFixed(2)}/CPU`}` },
    { label: mac ? "RAM" : "Mem", detail: mac ? "RAM used (excludes cache)" : "Memory used", value: readings.mem, text: readings.mem === undefined ? "—" : `${Math.round(readings.mem * 100)}%`, full: readings.mem === undefined ? "Unavailable" : `${Math.round(readings.mem * 100)}%` },
    { label: readings.diskMount ? `Disk ${readings.diskMount}` : "Disk", detail: readings.diskMount ? `Disk ${readings.diskMount}, fullest filesystem` : "Disk use", value: readings.disk, text: readings.disk === undefined ? "—" : `${Math.round(readings.disk * 100)}%`, full: readings.disk === undefined ? "Unavailable" : `${Math.round(readings.disk * 100)}%` },
  ];
  const hardware = [readings.cpus && `${readings.cpus} CPU`, readings.memory && `${(readings.memory / 2 ** 30).toFixed(1)} GiB`].filter(Boolean).join(" · ");
  const readingState = !online ? (b.error ? "Can't reach it" : "Not connected") : !connected ? "Agent unreachable" : error ? "Refresh failed" : !st ? "Reading stats…" : undefined;
  const detail = `${b.name}${hardware ? ` · ${hardware}` : ""}. ${readingState ? `${readingState}. ` : ""}${usage.map((m) => `${m.detail}: ${m.full}`).join(". ")}. ${sessionsKnown ? `${working} working, ${waiting} need you${!online || !connected || sessionsFailed ? " (last known)" : ""}` : "Agent sessions unavailable"}. Open projects.`;
  return (
    <Tip label={detail}><button type="button" aria-label={detail} onClick={() => useStore.getState().setView({ kind: "worktrees", box: b.name })} className={sx(paint.s2)}>
      <span className={sx(paint.s3)}>
        <StatusDot state={state} />
        <span className={sx(paint.s4)}>{b.name}</span>
        <span className={sx(paint.s5)}>
          {online ? hardware : `offline${b.since ? ` · ${shortAgo(b.since)}` : ""}`}
        </span>
        {waiting > 0 && <span className={sx(paint.s7)}><StateGlyph state="waiting" className={sx(paint.s6)} />{waiting} need you</span>}
        {working > 0 && (
          <span className={sx(paint.s7)}>
            <StateGlyph state="running" className={sx(paint.s8)} />
            {working} working
          </span>
        )}
      </span>
      {online && connected && !error && st ? (
        <span className={sx(paint.s9)} role="group" aria-label={`${b.name}: ${usage.map(({ detail, full }) => `${detail}: ${full}`).join(", ")}`}>
          {usage.map(({ label: l, value: v, text, normalization }) => (
            <span key={l} className={sx(paint.s10)} aria-hidden>
              <span className={sx(paint.s11)}>
                <span className={sx(paint.metricLabel)}>{l}</span>
                <span className={sx(paint.s12)}>{text}</span>
              </span>
              {normalization && <span className={sx(paint.normalization)}>{normalization}</span>}
              {v !== undefined && <Bar value={v} tone={l === "Load (1m)" ? (v > 1 ? "warning" : "muted") : v > 0.9 ? "destructive" : v > 0.8 ? "warning" : "muted"} />}
            </span>
          ))}
        </span>
      ) : online ? (
        <span className={sx(paint.s13)}>{readingState}</span>
      ) : (
        <span className={sx(paint.s14)}>{readingState}</span>
      )}
    </button></Tip>
  );
}

// Dev servers and databases listening in worktrees, the noise left out.
const NOISE = /chrome|chromium|agent-browser|headless/i;

function serviceName(process?: string) {
  const p = process ?? "";
  if (/next/.test(p)) return "next dev";
  if (/storybook/.test(p)) return "storybook";
  if (/prisma/.test(p)) return "prisma studio";
  if (/vite/.test(p)) return "vite";
  if (/postgres/.test(p)) return "postgres";
  if (/redis/.test(p)) return "redis";
  return p.split(/[\s/]/).filter(Boolean).pop() ?? "";
}

export function ServicesWidget() {
  const selected = useHomeMachines();
  const { height, span } = useHomeWidget();
  const boxes = useStore((s) => s.boxes);
  const urlPort = useStore((s) => s.status?.proxy.url_port);
  const loaded = useStore((s) => !!s.status && Object.values(s.boxes).some((b) => b.services));
  const list = useMemo(
    () =>
      Object.entries(boxes)
        .filter(([box]) => !selected || selected.includes(box))
        .flatMap(([box, d]) => (d.services ?? []).filter((s) => !NOISE.test(s.process ?? "")).map((s) => ({ box, ...s, name: serviceName(s.process) })))
        .sort((a, b) => a.box.localeCompare(b.box) || a.port - b.port),
    [boxes, selected],
  );
  if (!loaded && !list.length) return <WidgetSkeleton rows={3} />;
  if (!list.length) return <WidgetEmpty scene="dock" title="Nothing is listening" hint="Dev servers your agents start in worktrees show here, a click from a tab." />;
  const shown = list.slice(0, list.length * 36 > height ? fitRows(height, 36) : list.length);
  return (
    <div className={sx(paint.s15)}>
      {shown.map((s) => (
        <WidgetRow
          key={`${s.box}:${s.port}`}
          label={`Open ${placeLabel(s, boxes)} on ${s.box}, port ${s.port}`}
          onClick={() => {
            const ref = { box: s.box, location: s.location, worktree: s.worktree, path: s.path, main: s.main };
            selectWorktree(ref);
            openBrowser(portUrl(s.port, { ref, services: boxes[s.box]?.services ?? [], urlPort }) ?? `http://${s.port}.${s.box}.localhost${hostSuffix(urlPort)}/`);
          }}
        >
          <span className={sx(paint.s16)} aria-hidden />
          <span className={sx(paint.s17)}>:{s.port}</span>
          <span className={sx(paint.s18)}>{placeLabel(s, boxes)}</span>
          <span className={sx(paint.s19)}>{s.box}</span>
          {span.c > 1 && <span className={[sx(paint.s19), sx(paint.s22)].filter(Boolean).join(" ")}>{s.name}</span>}
          <ArrowUpRightIcon className={sx(paint.s20)} />
        </WidgetRow>
      ))}
      <More n={list.length - shown.length} label="listening" />
    </div>
  );
}
