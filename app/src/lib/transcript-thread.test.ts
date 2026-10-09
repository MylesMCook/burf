import assert from "node:assert/strict";
import test from "node:test";

import type { TranscriptItem } from "./transcript.ts";
import { estimateTurn, newTurnCache, transcriptMessage, transcriptSearchEntries, transcriptTurns } from "./transcript-thread.ts";

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


test("streaming replaces only its turn and keeps unchanged steps and shown items", () => {
  const cache = newTurnCache();
  const items = [user("u1"), text("a1", "Done."), user("u2"), tools("t1"), edit("e1"), text("draft", "First words"), thinking("k1")];
  const before = transcriptTurns(items, cache);
  const after = transcriptTurns([...items.slice(0, -2), text("draft", "First words and more"), items.at(-1)!], cache);
  for (let i = 0; i < before.length - 1; i++) assert.equal(after[i], before[i]);
  assert.notEqual(after.at(-1), before.at(-1));
  const a = before.at(-1)!;
  const b = after.at(-1)!;
  assert.equal(a.kind, "agent");
  assert.equal(b.kind, "agent");
  if (a.kind !== "agent" || b.kind !== "agent") return;
  assert.equal(a.steps, b.steps);
  assert.equal(a.shown[0], b.shown[0]);
  assert.equal(transcriptTurns([...items], cache).length, before.length);
});

test("unchanged turns and grouped pings retain identity when history is prepended", () => {
  const cache = newTurnCache();
  const items = [user("u1"), tools("t1"), text("a1", "Done."), ping("p1"), ping("p2")];
  const before = transcriptTurns(items, cache);
  const again = transcriptTurns([...items], cache);
  before.forEach((turn, i) => assert.equal(again[i], turn));
  const after = transcriptTurns([user("old"), text("old-a", "Earlier."), ...items], cache);
  before.forEach((turn, i) => assert.equal(after[i + 2], turn));
});

test("ending work changes only the final turn, and read-only history never works", () => {
  const cache = newTurnCache();
  const items = [user("u"), tools("t"), { kind: "ask", id: "q", tool: "Bash", detail: "test" } satisfies TranscriptItem];
  const before = transcriptTurns(items, cache);
  const after = transcriptTurns(items, cache, true);
  assert.equal(before[0], after[0]);
  assert.notEqual(before[1], after[1]);
  assert.equal(after[1].kind === "agent" && after[1].working, false);
});

test("turn heights sum the folded work, each visible item's old estimate and the gaps between them", () => {
  const turns = transcriptTurns([user("u"), tools("t"), text("a", "Done."), edit("e")]);
  assert.equal(estimateTurn(turns[0]), 42);
  // The fold, the answer and the edit, with a gap after each but the last.
  assert.equal(estimateTurn(turns[1]), 28 + 31 + 32 + 2 * 16);
  assert.equal(estimateTurn(transcriptTurns([ping("p1"), ping("p2")])[0]), 22);
  // One part has no gap.
  assert.equal(estimateTurn(transcriptTurns([user("u"), text("a", "Done.")])[1]), 31);
});

test("search targets each item's turn and reveals its fold and tool group", () => {
  const turns = transcriptTurns([user("u"), tools("t"), text("n", "Looking."), tools("t2"), text("a", "Done."), edit("e"), ping("p1"), ping("p2")]);
  const entries = transcriptSearchEntries(turns, (it) => it.id);
  assert.deepEqual(entries, [
    { row: 0, item: "u", text: "u", open: [] },
    { row: 1, item: "t", text: "t", open: ["fold-t", "t"] },
    { row: 1, item: "n", text: "n", open: ["fold-t"] },
    { row: 1, item: "t2", text: "t2", open: ["fold-t", "t2"] },
    { row: 1, item: "a", text: "a", open: [] },
    { row: 1, item: "e", text: "e", open: [] },
    { row: 2, item: "p1", text: "p1", open: [] },
    { row: 2, item: "p2", text: "p2", open: [] },
  ]);
  assert.deepEqual(transcriptSearchEntries(turns, () => ""), []);
});


test("runtime messages reuse unchanged parts, and every prompt and reply uses Item", () => {
  const cache = newTurnCache();
  const items = [user("u"), tools("t"), edit("e"), text("draft", "Writing"), thinking("k")];
  const before = transcriptTurns(items, cache);
  const after = transcriptTurns([...items.slice(0, -2), text("draft", "Writing more"), items.at(-1)!], cache);
  const prompt = transcriptMessage(before[0]);
  assert.equal(transcriptMessage(after[0]), prompt);
  assert.equal(prompt.role, "user");
  assert.deepEqual(prompt.content, [{ type: "data-item", data: items[0] }]);
  const a = transcriptMessage(before[1]);
  const b = transcriptMessage(after[1]);
  assert.notEqual(a, b);
  assert.equal(transcriptMessage(after[1]), b);
  assert.notEqual(a.content, b.content);
  assert.equal(typeof a.content, "object");
  assert.equal(typeof b.content, "object");
  if (typeof a.content === "string" || typeof b.content === "string") return;
  assert.equal(a.content[0], b.content[0]);
  assert.equal(a.content[1], b.content[1]);
  assert.notEqual(a.content[2], b.content[2]);
  assert.equal(a.content[3], b.content[3]);
  assert.deepEqual(b.content.map((part) => part.type), ["data-steps", "data-item", "data-item", "data-item"]);
  assert.deepEqual(b.status, { type: "running" });
});

test("a 2,000-prompt transcript changes only its final runtime message while streaming", () => {
  const cache = newTurnCache();
  const items = Array.from({ length: 2000 }, (_, i) => [user(`u-${i}`), tools(`t-${i}`), text(`a-${i}`, "Done.")]).flat();
  const before = transcriptTurns(items, cache);
  const after = transcriptTurns([...items.slice(0, -1), text("a-1999", "Done, with more words.")], cache);
  assert.equal(after.length, 4000);
  const changed = after.filter((turn, i) => transcriptMessage(turn) !== transcriptMessage(before[i]));
  assert.deepEqual(changed.map((turn) => turn.id), ["t-1999"]);
});


test("commands and incoming reports keep their own cards without the agent's speaker label", () => {
  const turns = transcriptTurns([{ kind: "command", id: "c", command: "/model" }, { kind: "report", id: "r", report: {} as never }, ping("p1"), ping("p2")]);
  for (const turn of turns) assert.equal(transcriptMessage(turn).metadata?.custom?.own, true);
});
