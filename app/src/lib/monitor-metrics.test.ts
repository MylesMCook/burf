import assert from "node:assert/strict";
import test from "node:test";
import { fraction, readings, retainHistory, historySeries, HISTORY_WINDOW } from "../../../plugins/box-monitor/src/metrics.ts";

test("missing, zero and overload remain distinct and the fullest filesystem is identified", () => {
  assert.equal(fraction(0, 100), 0);
  assert.equal(fraction(undefined, 100), undefined);
  assert.equal(fraction(100, 0), undefined);
  assert.equal(fraction(-1, 100), undefined);
  assert.equal(fraction(Infinity, 100), undefined);
  const s = readings({ cpus: 2, load: [6], disks: [{ mount: "/", used: 2, total: 10 }, { mount: "/data", used: 9, total: 10 }] });
  assert.equal(s.mem, undefined);
  assert.equal(s.load, 3);
  assert.equal(s.disk, 0.9);
  assert.equal(s.diskMount, "/data");
  assert.equal(readings({ load: [6] }).load, undefined);
  assert.equal(readings({ load: [6] }).loadAverage, 6);
});

test("history follows elapsed time and leaves missing samples, pauses and stale tails blank", () => {
  const series = historySeries([{ t: 0, mem: 0 }, { t: 15_000, mem: 0.5 }, { t: 30_000 }, { t: 45_000, mem: 0.75 }, { t: 120_000, mem: 1 }], "mem", 150_000, 100, 20);
  assert.deepEqual(series.segments, ["0.0,20.0 10.0,10.0", "30.0,5.0", "80.0,0.0"]);
  assert.equal(series.count, 4);
  assert.match(series.label, /4 readings over 2m 0s; last sampled 30s ago/);
  const load = historySeries([{ t: 0, load: 0 }, { t: 15_000, load: 3 }], "load", 15_000);
  assert.equal(load.max, 3);
  assert.equal(load.last, 3);
});

test("history expires by timestamp instead of inventing an hour from sample count", () => {
  assert.deepEqual(retainHistory([{ t: 0 }, { t: HISTORY_WINDOW }, { t: HISTORY_WINDOW + 2 }, { t: NaN }], HISTORY_WINDOW + 1), [{ t: HISTORY_WINDOW }]);
  assert.equal(historySeries([{ t: 15_000, mem: 0 }], "mem", 15_000).label, "1 reading over 0s; last sampled 0s ago; gaps shown");
  assert.equal(historySeries([{ t: 15_000 }], "mem", 15_000).count, 0);
});

test("a sampling burst stays bounded and reports the shorter collected coverage", () => {
  const retained = retainHistory(Array.from({ length: 1000 }, (_, index) => ({ t: index * 100, mem: 0.5 })), 100_000);
  assert.equal(retained.length, 240);
  assert.equal(historySeries(retained, "mem", 100_000).spanMs, 23_900);
});
