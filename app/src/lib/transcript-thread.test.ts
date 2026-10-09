import assert from "node:assert/strict";
import test from "node:test";

import type { TranscriptItem } from "./transcript.ts";
import { transcriptTurns } from "./transcript-thread.ts";

const user = (id: string, text = "Do it"): TranscriptItem => ({ kind: "user", id, text });
const text = (id: string, words: string): TranscriptItem => ({ kind: "text", id, text: words });
const tools = (id: string): TranscriptItem => ({ kind: "tools", id, verb: "Read 2 files", done: true });
const edit = (id: string): TranscriptItem => ({ kind: "edit", id, file: "a.ts", added: 2, removed: 1 });
const thinking = (id: string): TranscriptItem => ({ kind: "thinking", id, since: 1 });
const ping = (id: string, status = "done", at = 1000): TranscriptItem => ({ kind: "ping", id, msg: { from: { id: "h", name: "Claude Code", kind: "harness" }, status, text: "task", at } as never });

// One line per turn: who, then what is folded and what shows.
const shape = (items: TranscriptItem[]) =>
  transcriptTurns(items).map((t) =>
    t.kind === "agent" ? `agent ${t.id} [${t.steps.map((s) => s.id).join(" ")}] -> ${t.shown.map((s) => s.id).join(" ")}${t.working ? " (working)" : ""}` : t.kind === "pings" ? `pings ${t.items.map((p) => p.id).join(" ")}` : `${t.kind} ${t.id}`,
  );

test("the work on the way folds, and the answer stands below it", () => {
  assert.deepEqual(shape([user("u1"), tools("t1"), text("x1", "Looking at the loop."), tools("t2"), text("a1", "The retry loop never backs off, so a slow provider gets hammered.")]), [
    "said u1",
    "agent t1 [t1 x1 t2] -> a1",
  ]);
});

test("a reply and a note after it both show; what was said before the reply stays folded", () => {
  assert.deepEqual(shape([user("u1"), tools("t1"), text("x1", "Now I'll write it up."), text("a1", "Here is the whole explanation, at length, of what was wrong and what changed."), text("n1", "Tests pass.")]), [
    "said u1",
    "agent t1 [t1 x1] -> a1 n1",
  ]);
});

test("a change, a question and where the agent is always stand in view", () => {
  assert.deepEqual(shape([user("u1"), tools("t1"), edit("e1"), tools("t2"), { kind: "notice", id: "n1", notice: "interrupted" as never, text: "Interrupted" }, { kind: "artifact", id: "r1", text: "Plan" }]), ["said u1", "agent t1 [t1 t2] -> e1 n1 r1"]);
});

test("a turn with no words yet shows only its steps", () => {
  assert.deepEqual(shape([user("u1"), tools("t1")]), ["said u1", "agent t1 [t1] -> "]);
});

test("only the last turn is under way, while the agent works or waits on the person", () => {
  assert.deepEqual(shape([user("u1"), text("a1", "Done."), user("u2"), tools("t1"), thinking("k1")]), ["said u1", "agent a1 [] -> a1", "said u2", "agent t1 [t1] -> k1 (working)"]);
  assert.deepEqual(shape([user("u1"), { kind: "ask", id: "q1", tool: "Bash", detail: "rm -rf build" }]), ["said u1", "agent q1 [] -> q1 (working)"]);
  assert.deepEqual(shape([user("u1"), { kind: "ask", id: "q1", tool: "Bash", detail: "rm -rf build", decided: "yes" }]), ["said u1", "agent q1 [] -> q1"]);
  assert.deepEqual(shape([user("u1"), { kind: "question", id: "f1", questions: [] }]), ["said u1", "agent f1 [] -> f1 (working)"]);
});

test("a command, Burf's report and another agent's message each start a turn the agent answers", () => {
  assert.deepEqual(
    shape([
      { kind: "command", id: "c1", command: "/model" },
      text("a1", "Model changed."),
      { kind: "report", id: "r1", report: {} as never },
      text("a2", "The tests it ran passed."),
      { kind: "agent-message", id: "m1", msg: { from: { id: "t", name: "Reviewer", kind: "teammate" }, text: "Looks good" } as never },
      text("a3", "Thanks."),
    ]),
    ["said c1", "agent a1 [] -> a1", "arrived r1", "agent a2 [] -> a2", "arrived m1", "agent a3 [] -> a3"],
  );
});

test("finished pings in a row are one line; a single one, or one that failed, stands alone", () => {
  assert.deepEqual(shape([user("u1"), ping("p1"), ping("p2"), ping("p3"), text("a1", "All three finished.")]), ["said u1", "pings p1 p2 p3", "agent a1 [] -> a1"]);
  assert.deepEqual(shape([ping("p1"), text("a1", "Done.")]), ["arrived p1", "agent a1 [] -> a1"]);
  assert.deepEqual(shape([ping("p1"), ping("p2", "failed")]), ["arrived p1", "arrived p2"]);
});

test("nothing recorded, no turns", () => {
  assert.deepEqual(transcriptTurns([]), []);
});
