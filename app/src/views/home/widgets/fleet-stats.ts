// Each machine needs room for its name, units and normalization. Reserve a
// full-width More line only when a machine is actually outside the card.
export function fleetLayout(width: number, span: number) {
  const columns = span >= 2 && width >= 740 ? 2 : 1;
  return { columns, rowHeight: width / columns < 420 ? 98 : 82 };
}

export function fleetVisibleCount(height: number, rowHeight: number, columns: number, total: number, heights?: readonly number[]): number {
  const sizes = heights ?? Array<number>(total).fill(rowHeight);
  const rows: number[] = [];
  for (let i = 0; i < total; i += columns) rows.push(Math.max(...sizes.slice(i, i + columns)));
  const full = rows.reduce((sum, size) => sum + size, 0) + Math.max(0, rows.length - 1) * 2;
  if (full <= height) return total;
  let used = 0;
  let visible = 0;
  for (const size of rows) {
    const next = used + size + (visible ? 2 : 0);
    if (next + 26 > height) break;
    used = next;
    visible += columns;
  }
  return Math.min(total, Math.max(1, visible));
}

// Capacity readings use binary units, including tiny filesystems and measured zero.
export function fleetBytes(amount: number): string {
  if (amount < 1024) return `${amount} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let value = amount / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value.toFixed(1)} ${units[unit]}`;
}

// Older boxes can return only the stats their platform supports.
export function fleetStats(stats: {
  cpus?: number;
  load?: number[];
  memory?: { used?: number; total?: number };
  disks?: { mount?: string; used?: number; total?: number }[];
} | undefined) {
  const positive = (value: number | undefined) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
  const nonnegative = (value: number | undefined) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
  const ratio = (used: number | undefined, total: number | undefined, bounded = false) => {
    const capacity = positive(total);
    const amount = nonnegative(used);
    return capacity !== undefined && amount !== undefined && (!bounded || amount <= capacity) ? amount / capacity : undefined;
  };
  const disks = (stats?.disks ?? []).map((disk) => ({ mount: disk.mount, used: disk.used, total: disk.total, ratio: ratio(disk.used, disk.total, true) }))
    .filter((disk): disk is { mount: string | undefined; used: number; total: number; ratio: number } => disk.ratio !== undefined)
    .sort((a, b) => b.ratio - a.ratio || (a.mount ?? "").localeCompare(b.mount ?? ""));
  return {
    cpus: positive(stats?.cpus),
    memory: positive(stats?.memory?.total),
    load: nonnegative(stats?.load?.[0]),
    loadPerCpu: ratio(stats?.load?.[0], stats?.cpus),
    mem: ratio(stats?.memory?.used, stats?.memory?.total, true),
    disk: disks[0]?.ratio,
    diskMount: disks[0]?.mount,
    diskUsed: disks[0]?.used,
    diskTotal: disks[0]?.total,
  };
}
