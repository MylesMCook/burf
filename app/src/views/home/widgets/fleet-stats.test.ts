import assert from "node:assert/strict";
import test from "node:test";
import { fleetBytes, fleetLayout, fleetStats, fleetVisibleCount } from "./fleet-stats.ts";

test("a medium Home slot keeps machine readings in one readable column", () => {
  assert.deepEqual(fleetLayout(540, 2), { columns: 1, rowHeight: 82 });
  assert.equal(fleetLayout(900, 2).columns, 2);
  assert.equal(fleetLayout(900, 1).columns, 1);
  assert.equal(fleetLayout(250, 1).rowHeight, 98);
});

test("visible machines and their More control fit the measured body budget", () => {
  for (const width of [250, 540, 900]) {
    const { columns, rowHeight } = fleetLayout(width, 2);
    for (const height of [142, 338]) for (const total of [0, 1, 2, 5, 20]) {
      const shown = fleetVisibleCount(height, rowHeight, columns, total);
      assert.ok(shown <= total);
      const rows = Math.ceil(shown / columns);
      assert.ok(rows * rowHeight + Math.max(0, rows - 1) * 2 + (shown < total ? 26 : 0) <= height);
    }
  }
});

test("partial box stats distinguish absent readings from measured zero", () => {
  const readings = fleetStats({ cpus: 14, load: [0], disks: [{ mount: "/", used: 5, total: 10 }] });
  assert.equal(readings.load, 0);
  assert.equal(readings.loadPerCpu, 0);
  assert.equal(readings.mem, undefined);
  assert.equal(readings.disk, 0.5);
  assert.deepEqual(fleetStats({ memory: { used: 0, total: 0 } }), fleetStats(undefined));
  const invalid = fleetStats({ cpus: NaN, load: [Infinity], memory: { used: -1, total: 100 } });
  assert.equal(invalid.cpus, undefined);
  assert.equal(invalid.load, undefined);
  assert.equal(invalid.mem, undefined);
  assert.equal(fleetStats({ memory: { used: 101, total: 100 } }).mem, undefined);
  assert.equal(fleetStats({ disks: [{ used: 101, total: 100 }] }).disk, undefined);
});

test("one minute load is available without CPU count and retains overload", () => {
  assert.equal(fleetStats({ load: [8] }).load, 8);
  assert.equal(fleetStats({ load: [8] }).loadPerCpu, undefined);
  assert.equal(fleetStats({ cpus: 4, load: [8] }).loadPerCpu, 2);
});

test("fleet disk reading names the fullest valid filesystem regardless of order", () => {
  const disks = [{ mount: "/", used: 30, total: 100 }, { mount: "/data", used: 90, total: 100 }, { mount: "/unknown", used: 100, total: 0 }];
  for (const list of [disks, [...disks].reverse()]) {
    const readings = fleetStats({ disks: list });
    assert.equal(readings.disk, 0.9);
    assert.equal(readings.diskMount, "/data");
    assert.equal(readings.diskUsed, 90);
    assert.equal(readings.diskTotal, 100);
  }
  assert.equal(fleetStats({ disks: [{ used: 0, total: 0 }] }).disk, undefined);
});

test("empty valid filesystems are measured zero rather than unavailable", () => {
  const readings = fleetStats({ disks: [{ mount: "/", used: 0, total: 100 }] });
  assert.equal(readings.disk, 0);
  assert.equal(readings.diskUsed, 0);
  assert.equal(readings.diskTotal, 100);
});

test("capacity labels preserve measured zero and use honest binary units", () => {
  assert.equal(fleetBytes(0), "0 B");
  assert.equal(fleetBytes(90), "90 B");
  assert.equal(fleetBytes(1024), "1.0 KiB");
  assert.equal(fleetBytes(16 * 2 ** 30), "16.0 GiB");
});
