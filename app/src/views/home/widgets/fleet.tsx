import * as stylex from "@stylexjs/stylex";
import { ArrowUpRightIcon } from "lucide-react";
import { useMemo } from "react";

import { StateGlyph, StatusDot, useBoxState } from "@/components/agent-glyph";
import type { BoxStatus } from "@/lib/api";
import { hostSuffix, portUrl } from "@/lib/browser-url";
import { bytes } from "@/lib/format";
import { NONE, useStore } from "@/lib/store";
import { openBrowser, selectWorktree } from "@/lib/workspaces";
import { openAddBox } from "@/views/onboarding/add-box-dialog";

import { useAgentRows } from "./agents";
import { fitRows, useHomeWidget } from "./env";
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
    "justifyContent": "space-between",
    "gap": "4px",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s12: {
    "fontVariantNumeric": "tabular-nums",
  },
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
    "@container (max-width: 420px)": {
      gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    },
  },
  s22: {
    "@container (max-width: 260px)": {
      display: "none",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Boxes and what runs on them: both from what the app already polls (each
// box's stats every 30s, its services), so they cost nothing extra.

export function BoxesWidget() {
  const { height, span } = useHomeWidget();
  const list = useStore((s) => s.status?.boxes ?? (NONE as BoxStatus[]));
  const loaded = useStore((s) => !!s.status);
  if (!loaded) return <WidgetSkeleton rows={3} />;
  if (!list.length) return <WidgetEmpty scene="arriving" title="No boxes yet" hint="A box is a computer your agents work on: this Mac, a server, a VM." action="Add a box" onAction={openAddBox} />;
  // Online first, then by name; offline boxes take one line.
  const sorted = [...list].sort((a, b) => Number(b.state === "online") - Number(a.state === "online") || a.name.localeCompare(b.name));
  const shown = sorted.slice(0, Math.max(1, fitRows(height, 44)));
  return (
    <div className={[sx(paint.s0), span.c >= 2 && [sx(paint.s1), sx(paint.s21)].filter(Boolean).join(" ")].filter(Boolean).join(" ")}>
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
  const agents = useAgentRows();
  const working = agents.filter((a) => a.box === b.name && a.state === "running").length;
  const waiting = agents.filter((a) => a.box === b.name && a.state === "waiting").length;
  const online = b.state === "online";
  const cpu = st?.load?.length ? st.load[0] / Math.max(1, st.cpus) : 0;
  const mem = st ? st.memory.used / Math.max(1, st.memory.total) : 0;
  const disk = st?.disks[0] ? st.disks[0].used / Math.max(1, st.disks[0].total) : 0;
  return (
    <div className={sx(paint.s2)}>
      <span className={sx(paint.s3)}>
        <StatusDot state={state} />
        <span className={sx(paint.s4)}>{b.name}</span>
        <span className={sx(paint.s5)}>
          {online ? (st ? `${st.cpus} CPU · ${bytes(st.memory.total)}` : "") : `offline${b.since ? ` · ${shortAgo(b.since)}` : ""}`}
        </span>
        {waiting > 0 && <StateGlyph state="waiting" className={sx(paint.s6)} />}
        {working > 0 && (
          <span className={sx(paint.s7)}>
            <StateGlyph state="running" className={sx(paint.s8)} />
            {working}
          </span>
        )}
      </span>
      {online && st ? (
        <span className={sx(paint.s9)} role="group" aria-label={`${b.name}: CPU ${Math.round(cpu * 100)}%, memory ${Math.round(mem * 100)}%, disk ${Math.round(disk * 100)}%`}>
          {(
            [
              ["CPU", cpu],
              ["Mem", mem],
              ["Disk", disk],
            ] as const
          ).map(([l, v]) => (
            <span key={l} className={sx(paint.s10)} aria-hidden>
              <span className={sx(paint.s11)}>
                <span>{l}</span>
                <span className={sx(paint.s12)}>{Math.round(Math.min(1, v) * 100)}%</span>
              </span>
              <Bar value={v} tone={v > 0.9 ? "destructive" : v > 0.8 ? "warning" : "muted"} />
            </span>
          ))}
        </span>
      ) : online ? (
        <span className={sx(paint.s13)}>Reading stats…</span>
      ) : (
        <span className={sx(paint.s14)}>{b.error ? "Can't reach it" : "Not connected"}</span>
      )}
    </div>
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
  const { height, span } = useHomeWidget();
  const boxes = useStore((s) => s.boxes);
  const urlPort = useStore((s) => s.status?.proxy.url_port);
  const loaded = useStore((s) => !!s.status && Object.values(s.boxes).some((b) => b.services));
  const list = useMemo(
    () =>
      Object.entries(boxes)
        .flatMap(([box, d]) => (d.services ?? []).filter((s) => !NOISE.test(s.process ?? "")).map((s) => ({ box, ...s, name: serviceName(s.process) })))
        .sort((a, b) => a.box.localeCompare(b.box) || a.port - b.port),
    [boxes],
  );
  if (!loaded && !list.length) return <WidgetSkeleton rows={3} />;
  if (!list.length) return <WidgetEmpty scene="dock" title="Nothing is listening" hint="Dev servers your agents start in worktrees show here, a click from a tab." />;
  const shown = list.slice(0, list.length * 36 > height ? fitRows(height, 36) : list.length);
  return (
    <div className={sx(paint.s15)}>
      {shown.map((s) => (
        <WidgetRow
          key={`${s.box}:${s.port}`}
          label={`Open ${placeLabel(s, boxes)} on port ${s.port}`}
          onClick={() => {
            const ref = { box: s.box, location: s.location, worktree: s.worktree, path: s.path, main: s.main };
            selectWorktree(ref);
            openBrowser(portUrl(s.port, { ref, services: boxes[s.box]?.services ?? [], urlPort }) ?? `http://${s.port}.${s.box}.localhost${hostSuffix(urlPort)}/`);
          }}
        >
          <span className={sx(paint.s16)} aria-hidden />
          <span className={sx(paint.s17)}>:{s.port}</span>
          <span className={sx(paint.s18)}>{placeLabel(s, boxes)}</span>
          {span.c > 1 && <span className={[sx(paint.s19), sx(paint.s22)].filter(Boolean).join(" ")}>{s.name}</span>}
          <ArrowUpRightIcon className={sx(paint.s20)} />
        </WidgetRow>
      ))}
      <More n={list.length - shown.length} label="listening" />
    </div>
  );
}
