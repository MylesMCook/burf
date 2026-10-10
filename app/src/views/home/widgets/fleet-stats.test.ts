import assert from "node:assert/strict";
import test from "node:test";
import { fleetStats } from "./fleet-stats.ts";

test("partial box stats preserve available readings without inventing zero usage", () => {
  assert.deepEqual(fleetStats({ cpus: 14, load: [0], disks: [{ used: 5, total: 10 }] }), { cpus: 14, memory: undefined, cpu: 0, mem: undefined, disk: 0.5 });
  assert.deepEqual(fleetStats({ memory: { used: 0, total: 0 } }), fleetStats(undefined));
  assert.deepEqual(fleetStats({ cpus: NaN, load: [Infinity], memory: { used: -1, total: 100 } }), { cpus: undefined, memory: 100, cpu: undefined, mem: undefined, disk: undefined });
});
