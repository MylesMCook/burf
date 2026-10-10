// Older boxes can return only the stats their platform supports.
export function fleetStats(stats: {
  cpus?: number;
  load?: number[];
  memory?: { used?: number; total?: number };
  disks?: { used?: number; total?: number }[];
} | undefined) {
  const positive = (value: number | undefined) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
  const ratio = (used: number | undefined, total: number | undefined) => {
    const capacity = positive(total);
    return capacity !== undefined && typeof used === "number" && Number.isFinite(used) && used >= 0 ? used / capacity : undefined;
  };
  return {
    cpus: positive(stats?.cpus),
    memory: positive(stats?.memory?.total),
    cpu: ratio(stats?.load?.[0], stats?.cpus),
    mem: ratio(stats?.memory?.used, stats?.memory?.total),
    disk: ratio(stats?.disks?.[0]?.used, stats?.disks?.[0]?.total),
  };
}
