import * as stylex from "@stylexjs/stylex";
import { definePlugin, type BerthPluginContext, type Stats } from "@berth/plugin";
import {
  Badge,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
  Icon,
  Skeleton,
} from "@berth/plugin/ui";
import { useSyncExternalStore } from "react";

const paint = stylex.create({
  s0: {
    "display": "grid",
    "gap": "16px",
    "gridTemplateColumns": {
      "@media (min-width: 768px)": {
        "default": "repeat(2, minmax(0, 1fr))",
      },
    },
  },
  s1: {
    "height": "176px",
  },
  s2: {
    "height": "176px",
  },
  s3: {
    "display": "grid",
    "gap": "16px",
    "gridTemplateColumns": {
      "@media (min-width: 768px)": {
        "default": "repeat(2, minmax(0, 1fr))",
      },
    },
  },
  s4: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s5: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s6: {
    "marginLeft": "auto",
    "color": "var(--warning)",
  },
  s7: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s8: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s9: {
    "display": "flex",
    "gap": "12px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingTop": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s10: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s11: {
    "color": "var(--warning)",
  },
  s12: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "6px",
    },
  },
  s13: {
    "display": "flex",
    "alignItems": "baseline",
    "gap": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s14: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s15: {
    "color": "var(--muted-foreground)",
  },
  s16: {
    "marginLeft": "auto",
    "fontVariantNumeric": "tabular-nums",
  },
  s17: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
  },
  s18: {
    "height": "6px",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "borderRadius": "999px",
    "backgroundColor": "var(--muted)",
  },
  s19: {
    "height": "100%",
    "borderRadius": "999px",
  },
  s20: {
    "width": "96px",
    "textAlign": "right",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s21: {
    "flexShrink": 0,
  },
  q22: {
    "transitionProperty": "width",
    "transitionDuration": "150ms",
  },
  toneBad: { color: "var(--destructive)" },
  toneWarn: { color: "var(--warning)" },
  toneMuted: { color: "var(--muted-foreground)" },
  fillBad: { backgroundColor: "var(--destructive)" },
  fillWarn: { backgroundColor: "var(--warning)" },
  fillOk: { backgroundColor: "color-mix(in oklab, var(--primary) 70%, transparent)" },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Box monitor: how loaded each box is, sampled every 15 seconds while the app
// is open and on screen (the status bar already shows each box's memory), with an hour of history and a notification when a box is about
// to run out of memory or disk. Agents and dev servers are heavy; a box
// that runs out stops them.

const EVERY = 15_000;
const KEEP = 240; // an hour of samples
const WARN = 0.85;
const CRITICAL = 0.92;

interface Sample {
  t: number;
  mem: number; // fraction of memory in use
  load: number; // 1-minute load per CPU
  disk: number; // fullest disk, fraction
}

interface BoxView {
  box: string;
  stats?: Stats;
  error?: string;
  history: Sample[];
}

// A small store the screen and status bar both read.
let views: BoxView[] = [];
let ready = false;
const listeners = new Set<() => void>();
const emit = () => {
  views = [...views];
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const useViews = () => useSyncExternalStore(subscribe, () => views);
const useReady = () => useSyncExternalStore(subscribe, () => ready);

const memOf = (s: Stats) => (s.memory.total ? s.memory.used / s.memory.total : 0);
const diskOf = (s: Stats) => Math.max(0, ...s.disks.map((d) => (d.total ? d.used / d.total : 0)));
const loadOf = (s: Stats) => (s.load?.[0] ?? 0) / Math.max(1, s.cpus);

export default definePlugin((berth) => {
  const saved = berth.storage.get<Record<string, Sample[]>>("history", {});
  // One warning per box and resource until it recovers.
  const warned = new Set<string>();

  const sample = async () => {
    const boxes = (await berth.api.boxes().catch(() => [])).filter((b) => b.state === "online");
    const next: BoxView[] = await Promise.all(
      boxes.map(async (b) => {
        const prev = views.find((v) => v.box === b.name);
        const history = prev?.history ?? saved[b.name] ?? [];
        try {
          const stats = await berth.api.stats(b.name);
          const s: Sample = { t: Date.now(), mem: memOf(stats), load: loadOf(stats), disk: diskOf(stats) };
          check(berth, warned, b.name, "memory", s.mem);
          check(berth, warned, b.name, "disk", s.disk);
          return { box: b.name, stats, history: [...history, s].slice(-KEEP) };
        } catch (err) {
          return { box: b.name, stats: prev?.stats, error: String((err as Error).message ?? err), history };
        }
      }),
    );
    views = next;
    ready = true;
    emit();
    berth.storage.set("history", Object.fromEntries(next.map((v) => [v.box, v.history.slice(-120)])));
  };

  void sample();
  // Not while the window is hidden: nobody is looking, and a hidden Burf
  // shouldn't keep the Mac awake. Coming back samples at once.
  const timer = setInterval(() => !document.hidden && void sample(), EVERY);
  const back = () => !document.hidden && void sample();
  document.addEventListener("visibilitychange", back);

  berth.addScreen({ id: "boxes", title: "Box monitor", description: "Memory, disk and load on every online box, sampled every 15 seconds while Burf is open.", Component: MonitorScreen });
  berth.addSidebarItem({ id: "boxes", title: "Box monitor", icon: "Activity", screen: "boxes" });
  berth.addCommand({ id: "boxes", title: "Show box monitor", group: "Boxes", run: () => berth.openScreen("boxes") });
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", back);
  };
});

function check(berth: BerthPluginContext, warned: Set<string>, box: string, what: "memory" | "disk", frac: number) {
  const key = `${box}:${what}`;
  if (frac >= CRITICAL && !warned.has(key)) {
    warned.add(key);
    berth.notify(`${box} is almost out of ${what}`, `${Math.round(frac * 100)}% used. Agents and dev servers there may be stopped.`);
  } else if (frac < WARN) warned.delete(key);
}

const pct = (f: number) => `${Math.round(f * 100)}%`;
const tone = (f: number) => sx(f >= CRITICAL ? paint.toneBad : f >= WARN ? paint.toneWarn : paint.toneMuted);
const fill = (f: number) => sx(f >= CRITICAL ? paint.fillBad : f >= WARN ? paint.fillWarn : paint.fillOk);

function gib(bytes: number) {
  return `${(bytes / 2 ** 30).toFixed(bytes >= 10 * 2 ** 30 ? 0 : 1)} GB`;
}

function uptime(s?: number) {
  if (!s) return "";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return d ? `up ${d}d ${h}h` : `up ${h}h ${Math.floor((s % 3600) / 60)}m`;
}

function MonitorScreen() {
  const all = useViews();
  const loaded = useReady();
  return (
    <>
      {!loaded ? (
        <div className={sx(paint.s0)}>
          <Skeleton className={sx(paint.s1)} />
          <Skeleton className={sx(paint.s2)} />
        </div>
      ) : all.length === 0 ? (
        <Empty pad="room">
          <EmptyHeader>
            <EmptyTitle>No boxes online</EmptyTitle>
            <EmptyDescription>When a box is connected, its memory, disk and load show up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className={sx(paint.s3)}>
          {all.map((v) => (
            <BoxCard key={v.box} view={v} />
          ))}
        </div>
      )}
    </>
  );
}

function BoxCard({ view: v }: { view: BoxView }) {
  const s = v.stats;
  if (!s) {
    return (
      <Frame variant="card">
        <FrameHeader pad="tight">
          <FrameTitle>{v.box}</FrameTitle>
        </FrameHeader>
        <FramePanel tone>{v.error ?? "No stats yet."}</FramePanel>
      </Frame>
    );
  }
  const m = memOf(s);
  const l = loadOf(s);
  const working = s.agents.filter((a) => a.state === "running").length;
  const waiting = s.agents.filter((a) => a.state === "waiting").length;
  return (
    <Frame variant="card">
      <FrameHeader row gap={2} pad="snug">
        <Icon name="Server" className={sx(paint.s4)} />
        <FrameTitle>{v.box}</FrameTitle>
        <span className={sx(paint.s5)}>
          {s.hostname} · {s.cpus} CPUs {uptime(s.uptime_s) && `· ${uptime(s.uptime_s)}`}
        </span>
        {v.error && (
          <Badge variant="outline" size="sm" className={sx(paint.s6)}>
            stale
          </Badge>
        )}
      </FrameHeader>
      <FramePanel pad="room" space={4}>
        {s.memory.total > 0 ? (
          <Row label="Memory" value={`${gib(s.memory.used)} of ${gib(s.memory.total)}`} frac={m} history={v.history.map((h) => h.mem)} />
        ) : (
          <p className={sx(paint.s7)}>
            <span className={sx(paint.s8)}>Memory</span> isn't reported by this box's system.
          </p>
        )}
        <Row label="Load" value={`${(s.load?.[0] ?? 0).toFixed(2)} on ${s.cpus} CPUs`} frac={Math.min(1, l)} history={v.history.map((h) => Math.min(1, h.load))} />
        {s.swap.total > 0 && <Row label="Swap" value={`${gib(s.swap.used)} of ${gib(s.swap.total)}`} frac={s.swap.used / s.swap.total} />}
        {s.disks.map((d) => (
          <Row key={d.mount} label={`Disk ${d.mount}`} value={`${gib(d.used)} of ${gib(d.total)}`} frac={d.total ? d.used / d.total : 0} />
        ))}
        <p className={sx(paint.s9)}>
          <span>
            <b className={sx(paint.s10)}>{s.agents.length}</b> agent{s.agents.length === 1 ? "" : "s"}
          </span>
          {working > 0 && <span>{working} working</span>}
          {waiting > 0 && <span className={sx(paint.s11)}>{waiting} waiting for you</span>}
          {!s.hooks && <span>agent status hooks not installed</span>}
        </p>
      </FramePanel>
    </Frame>
  );
}

function Row({ label, value, frac, history }: { label: string; value: string; frac: number; history?: number[] }) {
  return (
    <div className={sx(paint.s12)}>
      <div className={sx(paint.s13)}>
        <span className={sx(paint.s14)}>{label}</span>
        <span className={sx(paint.s15)}>{value}</span>
        <span className={[sx(paint.s16), tone(frac)].filter(Boolean).join(" ")}>{pct(frac)}</span>
      </div>
      <div className={sx(paint.s17)}>
        <div className={sx(paint.s18)} role="meter" aria-valuenow={Math.round(frac * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
          <div className={[[sx(paint.s19), sx(paint.q22)].filter(Boolean).join(" "), fill(frac)].filter(Boolean).join(" ")} style={{ width: `${Math.min(100, frac * 100)}%` }} />
        </div>
        {history && <Spark values={history} />}
      </div>
    </div>
  );
}

// Spark draws the last hour as a small line, 0 to 100%.
function Spark({ values }: { values: number[] }) {
  const w = 96;
  const h = 18;
  if (values.length < 2) return <span className={sx(paint.s20)}>collecting…</span>;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - Math.min(1, v) * h).toFixed(1)}`).join(" ");
  const last = values[values.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={[sx(paint.s21), tone(last)].filter(Boolean).join(" ")} aria-label="last hour">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  );
}
