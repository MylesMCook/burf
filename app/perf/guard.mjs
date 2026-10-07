#!/usr/bin/env node
// A reported check of the benchmark against generous limits: a 2,000-turn
// chat on CI-class hardware. It prints each number beside its limit and,
// with --strict, fails when one is over. Timings move with the machine, so
// it reports by default; the parts that don't (rows drawn, rows a draft
// redraws) are checked by e2e/chat-long.spec.ts, which fails.
//
//   pnpm build && pnpm perf:guard [--from perf-results/numbers.json] [--strict]
//
// Without --from it runs perf/bench.mjs for the chat at 2,000 turns first.

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
  const r = spawnSync(process.execPath, [join(here, "bench.mjs"), "--turns", "2000", "--only", "chat", "--port", String(port), "--out", out], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
  file = join(out, "numbers.json");
}

const res = JSON.parse(readFileSync(resolve(String(file)), "utf8"));
const chat = res.chat.find((c) => c.turns === 2000) ?? res.chat[res.chat.length - 1];
if (!chat) throw new Error(`no chat results in ${file}`);

// [what, value, limit]: lower is better for each.
const checks = [
  ["open: first render (ms)", chat.open.firstRenderMs, 3000],
  ["open: interactive (ms)", chat.open.interactiveMs, 4000],
  ["scroll at reading speed: dropped frames (%)", chat.scrollRead.droppedPct, 25],
  ["scroll sweep, top to foot: dropped frames (%)", chat.scrollSweep.droppedPct, 50],
  ["draft update: main thread (ms)", chat.draft.mainThreadMsPerTick, 60],
  ["draft update: chat rows drawn again", chat.draft.rowsRenderedPerCommitMax, 2],
  ["typing: input to paint, p95 (ms)", chat.typing.p95, 100],
  ["typing while a draft streams, p95 (ms)", chat.typingWhileDraft.p95, 120],
  ["switch to another long chat (ms)", chat.switch.toOther.interactiveMs, 2000],
  ["JS heap (MB)", chat.memory.heapMB, 250],
  ["DOM nodes", chat.memory.domNodes, 8000],
  ["chat rows drawn", chat.memory.chatRows, 60],
];

let over = 0;
const pad = Math.max(...checks.map(([k]) => k.length));
console.log(`${chat.turns} turns, ${res.machine}, ${res.at}`);
for (const [k, v, limit] of checks) {
  const bad = !(v <= limit);
  if (bad) over++;
  console.log(`${bad ? "OVER" : " ok "}  ${k.padEnd(pad)}  ${String(v).padStart(8)}  (limit ${limit})`);
}
if (over) console.log(`\n${over} over the limit${strict ? "" : " (reported only; --strict fails)"}`);
process.exit(over && strict ? 1 : 0);
