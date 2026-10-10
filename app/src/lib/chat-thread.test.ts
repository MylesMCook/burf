import assert from "node:assert/strict";
import test from "node:test";

import { threadTurns, type ChatItem } from "./chat-thread.ts";

const user = (id: string, text: string): ChatItem => ({ id, kind: "user", text });
const says = (id: string, text: string): ChatItem => ({ id, kind: "assistant", text });
const tool = (id: string, text: string, status?: string): ChatItem => ({ id, kind: "tool", text, status });
const shape = (items: ChatItem[], working = false, sending?: Parameters<typeof threadTurns>[2]) => threadTurns(items, working, sending).map((t) => `${t.role}:${t.id}:${t.parts.map((p) => p.type).join("+")}${t.running ? ":running" : ""}`);

test("what the agent said and did between two messages is one turn", () => {
  assert.deepEqual(shape([user("u1", "Fix it"), tool("t1", "ls"), tool("t2", "cat a"), says("a1", "Done"), user("u2", "Thanks"), says("a2", "Welcome")]), [
    "user:u1:text",
    "assistant:t1:tool+tool+text",
    "user:u2:text",
    "assistant:a2:text",
  ]);
});

test("a tool's line is its command, then what it printed", () => {
  const [turn] = threadTurns([tool("t1", "cat build.log\nline one\nline two", "inProgress"), tool("t2", "pwd")], false);
  assert.deepEqual(turn.parts, [
    { type: "tool", id: "t1", command: "cat build.log", output: "line one\nline two", running: true },
    { type: "tool", id: "t2", command: "pwd", output: "", running: false },
  ]);
});

test("Burf's report of work the chat started stands alone", () => {
  assert.deepEqual(shape([says("a1", "Started it"), { id: "r1", kind: "report", text: "Tests passed" }, says("a2", "Good")]), ["assistant:a1:text", "report:r1:text", "assistant:a2:text"]);
});

test("only the agent's last turn is the one under way", () => {
  assert.deepEqual(shape([user("u1", "Go"), says("a1", "Looking"), tool("t1", "ls", "inProgress")], true), ["user:u1:text", "assistant:a1:text+tool:running"]);
  assert.deepEqual(shape([user("u1", "Go")], true), ["user:u1:text"]);
  assert.deepEqual(shape([says("a1", "Hi")], false), ["assistant:a1:text"]);
});

test("a message on its way shows until the box lists it", () => {
  const before = new Set(["u1", "a1"]);
  const sending = { text: "And the tests?", before };
  assert.deepEqual(shape([user("u1", "Go"), says("a1", "Done")], false, sending), ["user:u1:text", "assistant:a1:text", "user:sending:text"]);
  // The box has it now, under its own id: shown once.
  assert.deepEqual(shape([user("u1", "Go"), says("a1", "Done"), user("u2", "And the tests?")], true, sending), ["user:u1:text", "assistant:a1:text", "user:u2:text"]);
});

test("no items, no turns", () => {
  assert.deepEqual(threadTurns([], true), []);
});

test("public reasoning summaries stay in the assistant turn as reasoning", () => {
  assert.deepEqual(shape([user("u", "Inspect"), { id: "r", kind: "assistant", reasoning: true, text: "Checking the public plan" }, tool("t", "git status"), says("a", "Done")]), [
    "user:u:text", "assistant:r:reasoning+tool+text",
  ]);
});
