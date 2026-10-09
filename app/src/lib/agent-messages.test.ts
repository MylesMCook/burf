// node --experimental-strip-types --test src/lib/agent-messages.test.ts (pnpm test)
import assert from "node:assert/strict";
import { test } from "node:test";

import type { TranscriptItem } from "@/lib/transcript";
import { foldPings, type PingItem, withoutReminders } from "./agent-messages.ts";

const ping = (id: string, status: string, at?: number): PingItem => ({ kind: "ping", id, msg: { from: { id: "b", name: "Background command", kind: "harness" }, status, summary: id, at } });
const text = (id: string): TranscriptItem => ({ kind: "text", id, text: id });

test("successes next to each other fold; a failure always shows on its own", () => {
  const rows: TranscriptItem[] = [ping("a", "done", 1000), ping("b", "done", 2000), ping("c", "done", 3000), ping("x", "failed", 3500), ping("d", "done", 4000), text("t"), ping("e", "done", 5000)];
  const out = foldPings<TranscriptItem | { kind: "group"; ids: string[] }>(rows, (r) => (r.kind === "ping" ? r : undefined), (run) => ({ kind: "group", ids: run.map((p) => p.id) }));
  assert.deepEqual(
    out.map((r) => (r.kind === "group" ? r.ids.join("+") : r.id)),
    ["a+b+c", "x", "d", "t", "e"],
  );
});

test("successes far apart don't fold", () => {
  const out = foldPings<TranscriptItem | { kind: "group" }>([ping("a", "done", 0), ping("b", "done", 10 * 60_000)], (r) => (r.kind === "ping" ? r : undefined), () => ({ kind: "group" }));
  assert.equal(out.length, 2);
});

test("reminders an older box left in a prompt don't show", () => {
  assert.equal(withoutReminders("Fix it\n\n<system-reminder>\nUse the task tools.\n</system-reminder>"), "Fix it");
  assert.equal(withoutReminders("<system-reminder>x</system-reminder>"), "");
  assert.equal(withoutReminders("plain"), "plain");
});
