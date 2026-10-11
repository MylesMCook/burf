import * as stylex from "@stylexjs/stylex";
import { definePlugin, sessionName, useBerth, useBoxes, useLocations, useSessions, useStorage, type BerthPluginContext, type Stats } from "@berth/plugin";
import {
  Badge,
  BoxFilter,
  Button,
  ViewHeader,
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
import { SAMPLE_INTERVAL, fraction, readings, retainHistory, historySeries, elapsed, type Sample } from "./metrics";

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
  spark: { display: "flex", flexDirection: "column", gap: "2px", flexShrink: 0 },
  sparkCaption: { color: "var(--muted-foreground)", fontSize: "10px", lineHeight: "14px", maxWidth: "112px" },
  filter: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: "16px" },
  details: { color: "var(--muted-foreground)", fontSize: "12px", lineHeight: "18px" },
  process: { overflowWrap: "anywhere", marginTop: "8px" },
  session: { display: "block", marginTop: "8px", textAlign: "left" },
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

// History is collected only while Burf is visible; pauses remain gaps.
const WARN = 0.85;
const CRITICAL = 0.92;
interface BoxView {
  box: string;
  os?: string;
  online: boolean;
  stats?: Stats;
  error?: string;
  sampledAt?: number;
  history: Sample[];
}

// A small store the screen and status bar both read.
let views: BoxView[] = [];
let ready = false;
let fleetError: string | undefined;
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
const useFleetError = () => useSyncExternalStore(subscribe, () => fleetError);

export default definePlugin((berth) => {
  const saved = berth.storage.get<Record<string, Sample[]>>("history-v2", {});
  // One warning per box and resource until it recovers.
  const warned = new Set<string>();

  let sampling = false;
  let disposed = false;
  const sample = async () => {
    if (sampling || disposed) return;
    sampling = true;
    try {
      const boxes = await berth.api.boxes();
      if (disposed) return;
      fleetError = undefined;
      const next: BoxView[] = await Promise.all(boxes.map(async (b) => {
        const prev = views.find((v) => v.box === b.name);
        const history = retainHistory(prev?.history ?? saved[b.name] ?? [], Date.now());
        if (b.state !== "online") return { box: b.name, os: prev?.os, online: false, stats: prev?.stats, sampledAt: prev?.sampledAt, history };
        try {
          const stats = await berth.api.stats(b.name);
          const sampledAt = Date.now();
          if (disposed) return { box: b.name, online: true, history };
          const os = prev?.os ?? await berth.api.info(b.name).then((info) => info.os, () => undefined);
          if (disposed) return { box: b.name, online: true, history };
          const r = readings(stats);
          const point: Sample = { t: sampledAt, mem: r.mem, load: r.load, disk: r.disk };
          check(berth, warned, b.name, "memory", point.mem);
          check(berth, warned, b.name, "disk", point.disk);
          return { box: b.name, os, online: true, stats, sampledAt, history: retainHistory([...history, point], sampledAt) };
        } catch (err) {
          return { box: b.name, os: prev?.os, online: true, stats: prev?.stats, sampledAt: prev?.sampledAt, error: String((err as Error).message ?? err), history: [...history, { t: Date.now() }] };
        }
      }));
      if (disposed) return;
      views = next;
      berth.storage.set("history-v2", Object.fromEntries(next.map((v) => [v.box, v.history])));
    } catch (err) {
      if (disposed) return;
      // A failed fleet read preserves known machines and marks the readings stale.
      fleetError = String((err as Error).message ?? err);
      views = views.map((v) => ({ ...v, error: String((err as Error).message ?? err) }));
    } finally {
      sampling = false;
      if (!disposed) { ready = true; emit(); }
    }
  };

  void sample();
  // Not while the window is hidden: nobody is looking, and a hidden Burf
  // shouldn't keep the Mac awake. Coming back samples at once.
  const timer = setInterval(() => !document.hidden && void sample(), SAMPLE_INTERVAL);
  const back = () => !document.hidden && void sample();
  document.addEventListener("visibilitychange", back);

  berth.addScreen({ id: "boxes", title: "Computer monitor", description: "Memory, disk and one-minute load on paired machines. Readings sampled every 15 seconds while Burf is visible.", Component: MonitorScreen });
  berth.addSidebarItem({ id: "boxes", title: "Computer monitor", icon: "Activity", screen: "boxes" });
  berth.addCommand({ id: "boxes", title: "Show box monitor", group: "Boxes", run: () => berth.openScreen("boxes") });
  return () => {
    disposed = true;
    clearInterval(timer);
    document.removeEventListener("visibilitychange", back);
  };
});

function check(berth: BerthPluginContext, warned: Set<string>, box: string, what: "memory" | "disk", frac: number | undefined) {
  if (frac === undefined) return;
  const key = `${box}:${what}`;
  if (frac >= CRITICAL && !warned.has(key)) {
    warned.add(key);
    berth.notify(`${box} is almost out of ${what}`, `${Math.round(frac * 100)}% used. Agents and dev servers there may be stopped.`);
  } else if (frac < WARN) warned.delete(key);
}

const pct = (f: number) => `${Math.round(f * 100)}%`;
const tone = (f: number) => sx(f >= CRITICAL ? paint.toneBad : f >= WARN ? paint.toneWarn : paint.toneMuted);
const loadTone = (f: number) => sx(f > 1 ? paint.toneWarn : paint.toneMuted);
const fill = (f: number) => sx(f >= CRITICAL ? paint.fillBad : f >= WARN ? paint.fillWarn : paint.fillOk);

function gib(bytes: number) {
  return `${(bytes / 2 ** 30).toFixed(bytes >= 10 * 2 ** 30 ? 0 : 1)} GiB`;
}

function uptime(s?: number) {
  if (!s) return "";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return d ? `up ${d}d ${h}h` : `up ${h}h ${Math.floor((s % 3600) / 60)}m`;
}

function MonitorScreen() {
  const berth = useBerth();
  const sampled = useViews();
  const paired = useBoxes();
  const loaded = useReady();
  const error = useFleetError();
  const [hidden, setHidden] = useStorage<string[]>("hidden-boxes", []);
  const boxes = [...new Set([...paired.map((b) => b.name), ...sampled.map((v) => v.box)])].sort();
  const selected = boxes.filter((b) => !hidden.includes(b));
  const shown = selected.length ? selected : boxes;
  const all = shown.map((box) => {
    const view = sampled.find((v) => v.box === box);
    const status = paired.find((b) => b.name === box);
    return { ...(view ?? { box, history: [] }), online: status ? status.state === "online" : view?.online ?? false };
  });
  return (
    <>
      <ViewHeader title="Computer monitor" description="One-minute load is work waiting or running, not CPU utilization. History covers collected readings; pauses leave gaps." />
      {error && <p className={sx(paint.s7)}>Machine status unavailable: {error}</p>}
      <div className={sx(paint.filter)}>
        <BoxFilter boxes={boxes} hidden={hidden} onChange={setHidden} label="Machines to monitor" />
        {boxes.length > 0 && berth.openComputerDiscovery && <Button size="sm" variant="outline" onClick={() => berth.openComputerDiscovery?.()}>Discover or pair a computer</Button>}
      </div>
      {!loaded ? (
        <div className={sx(paint.s0)}>
          <Skeleton className={sx(paint.s1)} />
          <Skeleton className={sx(paint.s2)} />
        </div>
      ) : all.length === 0 ? (
        <Empty pad="room">
          <EmptyHeader>
            <EmptyTitle>No paired machines</EmptyTitle>
            <EmptyDescription>Pair a machine to see its memory, disk and load here.</EmptyDescription>
          </EmptyHeader>
          {berth.openComputerDiscovery && <Button size="sm" onClick={() => berth.openComputerDiscovery?.()}>Discover or pair a computer</Button>}
        </Empty>
      ) : (
        <div className={sx(paint.s3)}>
          {all.map((v) => <BoxCard key={v.box} view={v} />)}
        </div>
      )}
    </>
  );
}

function BoxCard({ view: v }: { view: BoxView }) {
  const berth = useBerth();
  const sessions = useSessions(v.box);
  const locations = useLocations(v.box);
  const agentSessions = sessions?.filter((s) => s.agent && !s.exited);
  const s = v.stats;
  const processesAvailable = s?.agents_available ?? (v.os !== "darwin" || !!s?.agents?.length);
  const now = Date.now();
  const stale = !v.online || !!v.error || (v.sampledAt !== undefined && now - v.sampledAt > SAMPLE_INTERVAL * 2);
  const r = s && readings(s);
  return (
    <Frame variant="card">
      <FrameHeader row gap={2} pad="snug">
        <Icon name="Server" className={sx(paint.s4)} />
        <FrameTitle>{v.box}</FrameTitle>
        {s && <span className={sx(paint.s5)}>{s.hostname} · {s.cpus > 0 ? `${s.cpus} CPUs` : "CPU count unavailable"} {uptime(s.uptime_s) && `· ${uptime(s.uptime_s)}`}</span>}
        {stale && <Badge variant="outline" size="sm" className={sx(paint.s6)}>{v.online ? "Stale" : "Offline"}</Badge>}
      </FrameHeader>
      <FramePanel pad="room" space={4}>
        <p className={sx(paint.s7)}>{v.sampledAt === undefined ? (v.online ? "No readings yet." : "Offline. No readings yet.") : `${stale ? "Last reading" : "Sampled"} ${elapsed(now - v.sampledAt)} ago.`}{v.error && ` ${v.error}`}</p>
        {s && r && <>
          <Row label={v.os === "darwin" ? "RAM used (excludes cache)" : "Memory"} value={r.mem === undefined ? "Unavailable" : `${gib(s.memory.used)} of ${gib(s.memory.total)}`} frac={r.mem} history={v.history} metric="mem" now={now} />
          <Row label="Load (1m)" value={r.loadAverage === undefined ? "Unavailable" : `${r.loadAverage.toFixed(2)}${r.load === undefined ? " · CPU count unavailable" : ` on ${s.cpus} CPUs`}`} frac={r.load} history={v.history} metric="load" now={now} load />
          {s.swap?.total > 0 && <Row label="Swap" value={`${gib(s.swap.used)} of ${gib(s.swap.total)}`} frac={fraction(s.swap.used, s.swap.total)} />}
          {(s.disks ?? []).length ? s.disks.map((d) => <Row key={d.mount} label={`Disk ${d.mount}${r.diskMount !== undefined && d.mount === r.diskMount ? " (fullest)" : ""}`} value={fraction(d.used, d.total) === undefined ? "Unavailable" : `${gib(d.used)} of ${gib(d.total)}`} frac={fraction(d.used, d.total)} />) : <Row label="Disk" value="Unavailable" />}
          <details className={sx(paint.details)}>
            <summary>{s.agents && processesAvailable ? `${s.agents.length} detected agent process${s.agents.length === 1 ? "" : "es"}${stale ? " at last reading" : ""}` : "Detected agent processes unavailable"}</summary>
            {(s.agents ?? []).map((a) => {
              const target = locations?.flatMap((location) => (location.worktrees ?? []).filter((worktree) => a.path ? a.path === worktree.path : a.location === location.name && a.worktree === worktree.name).map((worktree) => ({ location: location.name, worktree }))).at(0);
              return <div className={sx(paint.process)} key={a.pid}>
                <p>{a.tool} · PID {a.pid} · {a.state}{a.path && ` · ${a.path}`}{a.location && ` · ${a.location}`}{a.worktree && ` / ${a.worktree}`}</p>
                {target ? <Button size="xs" variant="outline" disabled={!v.online} onClick={() => berth.openWorktree({ box: v.box, location: target.location, worktree: target.worktree.name, path: target.worktree.path })}>View project for PID {a.pid}</Button>
                  : berth.openAddProject && a.path ? <Button size="xs" variant="outline" disabled={!v.online} onClick={() => berth.openAddProject?.(v.box)}>Add project on {v.box}</Button> : null}
              </div>;
            })}
            <p>Process detection can include agents started outside Burf.{!s.hooks && " Agent status hooks are not installed."}</p>
          </details>
        </>}
        <details className={sx(paint.details)}>
          <summary>{agentSessions === undefined ? "Burf agent sessions unavailable" : `${agentSessions.length} open Burf agent session${agentSessions.length === 1 ? "" : "s"}`}</summary>
          {agentSessions?.map((session) => <Button key={session.name} className={sx(paint.session)} variant="ghost" size="sm" disabled={!v.online} onClick={() => berth.openTerminal(v.box, session.name)}>Open {sessionName(session, { sessions, locations, place: true })}</Button>)}
          <p>These sessions are tracked by Burf separately from detected processes.</p>
        </details>
      </FramePanel>
    </Frame>
  );
}

function Row({ label, value, frac, history, metric, now = Date.now(), load = false }: { label: string; value: string; frac?: number; history?: Sample[]; metric?: "mem" | "load" | "disk"; now?: number; load?: boolean }) {
  return (
    <div className={sx(paint.s12)}>
      <div className={sx(paint.s13)}>
        <span className={sx(paint.s14)}>{label}</span>
        <span className={sx(paint.s15)}>{value}</span>
        {frac !== undefined && <span className={[sx(paint.s16), load ? loadTone(frac) : tone(frac)].filter(Boolean).join(" ")}>{load ? `${frac.toFixed(2)}/CPU` : pct(frac)}</span>}
      </div>
      <div className={sx(paint.s17)}>
        {frac !== undefined && <div className={sx(paint.s18)} role={load ? "img" : "meter"} aria-valuenow={load ? undefined : Math.min(100, Math.round(frac * 100))} aria-valuemin={load ? undefined : 0} aria-valuemax={load ? undefined : 100} aria-valuetext={load ? undefined : pct(frac)} aria-label={load ? `${label}: ${frac.toFixed(2)} per CPU; bar fills at 1 per CPU` : label}>
          <div className={[sx(paint.s19, paint.q22), load ? sx(paint.fillOk) : fill(frac)].filter(Boolean).join(" ")} style={{ width: `${Math.min(100, frac * 100)}%` }} />
        </div>}
        {history && metric && <Spark history={history} metric={metric} now={now} />}
      </div>
    </div>
  );
}

function Spark({ history, metric, now }: { history: Sample[]; metric: "mem" | "load" | "disk"; now: number }) {
  const series = historySeries(history, metric, now);
  if (!series.count) return <span className={sx(paint.s20)}>No history</span>;
  return (
    <span className={sx(paint.spark)}>
    <svg width={96} height={18} viewBox="0 0 96 18" className={[sx(paint.s21), metric === "load" ? loadTone(series.last ?? 0) : tone(series.last ?? 0)].filter(Boolean).join(" ")} role="img" aria-label={`${series.label}; range 0 to ${series.max.toFixed(2)}${metric === "load" ? " per CPU" : " of capacity"}`}>
      {series.segments.map((points, i) => points.includes(" ") ? <polyline key={i} points={points} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" /> : <circle key={i} cx={points.split(",")[0]} cy={points.split(",")[1]} r="1.5" fill="currentColor" />)}
    </svg>
    <span className={sx(paint.sparkCaption)}>{series.count} reading{series.count === 1 ? "" : "s"} / {elapsed(series.spanMs)}{metric === "load" && ` · 0–${series.max.toFixed(2)}/CPU`}</span>
    </span>
  );
}
