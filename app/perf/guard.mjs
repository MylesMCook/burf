#!/usr/bin/env node
// Check fleet benchmark output against limits. --strict fails when one is over.
// Without --from, run the fleet benchmark first.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (k) => {
  const i = argv.indexOf(`--${k}`);
  return i < 0 ? undefined : (argv[i + 1] ?? true);
};
const strict = argv.includes("--strict");

let file = flag("from");
if (!file) {
  const out = resolve(here, "../node_modules/.perf/guard");
  const port = flag("port") ?? process.env.E2E_PORT ?? "1431";
  const r = spawnSync(process.execPath, [join(here, "bench.mjs"), "--only", "fleet", "--worktrees", "300", "--port", String(port), "--out", out], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
  file = join(out, "numbers.json");
}

const res = JSON.parse(readFileSync(resolve(String(file)), "utf8"));
const fleet = (res.fleet ?? []).find((f) => f.worktrees === 300) ?? res.fleet?.[0];
if (!fleet) throw new Error(`no fleet results in ${file}`);

// The sidebar, the folded rail and Home with 300 worktrees, each with an
// agent: 1.2 s of long tasks at start and 120 MB before rows made their
// menus and tooltips only when used.
const fleetChecks = () => [
  ["fleet start: long tasks (ms)", fleet.longTaskMs, 800],
  ["fleet JS heap (MB)", fleet.memory.heapMB, 60],
  ["sidebar DOM nodes", fleet.sidebar?.nodes, 6500],
  ["at rest: main thread (ms a second)", fleet.idle?.mainThreadMsPerSec, 500],
  ["sidebar scroll: dropped frames (%)", fleet.sidebarScroll.droppedPct, 10],
  ["sidebar edge dragged: dropped frames (%)", fleet.sidebarDrag?.droppedPct, 20],
  ["fold a project (ms)", fleet.collapse?.ms, 250],
  ["open it again (ms)", fleet.expand?.ms, 300],
  ["a row's context menu (ms)", fleet.contextMenu?.ms, 300],
  ["a row's ⋯ menu (ms)", fleet.dotsMenu?.ms, 500],
  ["rename: to the field (ms)", fleet.renameOpen?.ms, 250],
  ["rename: saved, main thread (ms)", fleet.renameSave?.mainThreadMs, 600],
  ["to Home: long tasks (ms)", fleet.home.longTaskMs, 300],
  ["folded rail start: long tasks (ms)", fleet.rail?.longTaskMs, 600],
];

const checks = fleetChecks();

let over = 0;
const pad = Math.max(...checks.map(([k]) => k.length));
console.log(`${fleet.worktrees} worktrees, ${res.machine}, ${res.at}`);
for (const [k, v, limit] of checks) {
  const bad = !(v <= limit);
  if (bad) over++;
  console.log(`${bad ? "OVER" : " ok "}  ${k.padEnd(pad)}  ${String(v).padStart(8)}  (limit ${limit})`);
}
if (over) console.log(`\n${over} over the limit${strict ? "" : " (reported only; --strict fails)"}`);
process.exit(over && strict ? 1 : 0);
