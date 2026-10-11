// Older agents can omit memory fields. Zero used bytes is a reading;
// an absent sample or offline computer is not.
export function statusBarMemory(memory: { used?: number; total?: number } | undefined, online: boolean): { used: number; total: number } | undefined {
  const used = memory?.used;
  const total = memory?.total;
  if (!online || typeof used !== "number" || typeof total !== "number" || !Number.isFinite(used) || !Number.isFinite(total) || used < 0 || total <= 0 || used > total) return undefined;
  return { used, total };
}
