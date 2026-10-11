export const SAMPLE_INTERVAL = 15_000;
export const HISTORY_WINDOW = 60 * 60_000;
const KEEP = 240;

export interface Sample {
  t: number;
  mem?: number;
  load?: number;
  disk?: number;
}

const finite = (n: number | undefined) => typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : undefined;
export function fraction(used?: number, total?: number) {
  const amount = finite(used);
  const capacity = finite(total);
  return amount !== undefined && capacity !== undefined && capacity > 0 ? amount / capacity : undefined;
}
export function readings(s: {
  cpus?: number; load?: number[];
  memory?: { used?: number; total?: number };
  disks?: { mount?: string; used?: number; total?: number }[];
}) {
  const disks = (s.disks ?? []).map((d) => ({ ...d, fraction: fraction(d.used, d.total) }))
    .filter((d): d is typeof d & { fraction: number } => d.fraction !== undefined)
    .sort((a, b) => b.fraction - a.fraction || (a.mount ?? "").localeCompare(b.mount ?? ""));
  return { mem: fraction(s.memory?.used, s.memory?.total), load: fraction(s.load?.[0], s.cpus), loadAverage: finite(s.load?.[0]), disk: disks[0]?.fraction, diskMount: disks[0]?.mount };
}
export function retainHistory(history: Sample[], now: number) {
  return history.filter((s) => Number.isFinite(s.t) && s.t >= now - HISTORY_WINDOW && s.t <= now).sort((a, b) => a.t - b.t).slice(-KEEP);
}
export function elapsed(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

// Time determines x; missed samples or an unavailable reading break the line.
export function historySeries(history: Sample[], key: "mem" | "load" | "disk", now: number, width = 96, height = 18) {
  const samples = retainHistory(history, now);
  const valid = samples.filter((s) => finite(s[key]) !== undefined);
  const max = Math.max(1, ...valid.map((s) => s[key]!));
  const start = samples[0]?.t ?? now;
  const duration = Math.max(SAMPLE_INTERVAL, now - start);
  const segments: string[][] = [];
  let previous: Sample | undefined;
  let segment: string[] | undefined;
  for (const sample of samples) {
    const value = finite(sample[key]);
    if (value === undefined) { segment = undefined; previous = undefined; continue; }
    if (!segment || !previous || sample.t - previous.t > SAMPLE_INTERVAL * 2) {
      segment = [];
      segments.push(segment);
    }
    segment.push(`${((sample.t - start) / duration * width).toFixed(1)},${(height - value / max * height).toFixed(1)}`);
    previous = sample;
  }
  const first = valid[0], last = valid[valid.length - 1];
  const label = !last ? "No readings" : `${valid.length} reading${valid.length === 1 ? "" : "s"} over ${elapsed(last.t - first.t)}; last sampled ${elapsed(now - last.t)} ago; gaps shown`;
  return { segments: segments.map((s) => s.join(" ")), max, label, count: valid.length, spanMs: first && last ? last.t - first.t : 0, last: last?.[key] };
}
