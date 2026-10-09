import assert from "node:assert/strict";
import test from "node:test";
import { savedChatMessages, type SavedTranscriptItem } from "./saved-chat.ts";

test("saved prompts and replies use real parts, with tools grouped in the reply", () => {
  const items: SavedTranscriptItem[] = [
    { kind: "user", id: "u", text: "Read the notes" },
    { kind: "thinking", id: "r", since: 10, label: "Considering the notes" },
    { kind: "tools", id: "tools", verb: "Run", done: true, items: [{ id: "call", verb: "Bash", target: "cat notes.txt", output: "Saved notes" }] },
    { kind: "text", id: "a", text: "Here are the notes." },
    { kind: "user", id: "u2", text: "Thanks" },
  ];
  const original = structuredClone(items);
  const messages = savedChatMessages(items);
  assert.deepEqual(messages.map((m) => [m.id, m.role]), [["u", "user"], ["r", "assistant"], ["u2", "user"]]);
  assert.deepEqual(messages[0].content, [{ type: "text", text: "Read the notes" }]);
  assert.deepEqual(messages[1].content, [
    { type: "reasoning", text: "Considering the notes" },
    { type: "tool-call", toolCallId: "call", toolName: "Bash", args: { summary: "cat notes.txt" }, argsText: '{"summary":"cat notes.txt"}', result: "Saved notes", isError: undefined },
    { type: "text", text: "Here are the notes." },
  ]);
  assert.deepEqual(messages[1].status, { type: "complete", reason: "stop" });
  assert.deepEqual(items, original);
});

test("recorded permissions keep the answer or its absence without a live approval", () => {
  const messages = savedChatMessages([
    { kind: "ask", id: "yes", tool: "Run", detail: "git status", choices: [{ key: "y", label: "Allow" }], decided: "y" },
    { kind: "ask", id: "no", tool: "Write", detail: "Historical permission" },
    { kind: "question", id: "q", questions: [{ question: "Which branch?", options: [] }], answers: ["main"], done: true },
  ]);
  assert.deepEqual(messages[0].content, [
    { type: "text", text: "Recorded permission · Run · git status · Answered: Allow" },
    { type: "text", text: "Recorded permission · Write · Historical permission · Not answered" },
    { type: "text", text: "Recorded question · Which branch? · main" },
  ]);
  assert.deepEqual(messages[0].status, { type: "complete", reason: "stop" });
});

test("missing outputs and incomplete historical calls stay complete with stable distinct IDs", () => {
  const messages = savedChatMessages([{ kind: "tools", id: "group", verb: "Read", items: [
    { verb: "Read", target: "a.ts" }, { verb: "Read", target: "b.ts", output: "", error: true },
  ] }]);
  const parts = messages[0].content;
  assert.ok(Array.isArray(parts));
  assert.equal(parts[0].type, "tool-call");
  assert.equal(parts[1].type, "tool-call");
  if (parts[0].type !== "tool-call" || parts[1].type !== "tool-call") assert.fail();
  assert.equal(parts[0].toolCallId, "group:0");
  assert.equal(parts[1].toolCallId, "group:1");
  assert.equal(parts[0].result, "Tool output is unavailable in this saved conversation.");
  assert.equal(parts[1].result, "");
  assert.equal(parts[1].isError, true);
  assert.deepEqual(messages[0].status, { type: "complete", reason: "stop" });
});

test("kinds without a stock part become readable lines and none disappear", () => {
  const items: SavedTranscriptItem[] = [
    { kind: "tools", id: "tools", verb: "Read 2 files" },
    { kind: "edit", id: "edit", file: "a.ts", added: 2, removed: 1 },
    { kind: "command", id: "cmd", command: "/model", args: "default", text: "Changed", error: true },
    { kind: "crew", id: "crew", names: ["Helper"] },
    { kind: "notice", id: "notice", notice: "interrupted", text: "Turn interrupted" },
    { kind: "artifact", id: "art", text: "Report", url: "https://example.test/report" },
    { kind: "report", id: "report", report: { kind: "task", status: "finished", title: "Checks", summary: "All passed" } },
    { kind: "agent-message", id: "msg", msg: { from: { id: "helper", name: "Helper", kind: "helper" }, body: "Done" } },
    { kind: "ping", id: "ping", msg: { from: { id: "helper", name: "Helper", kind: "helper" }, status: "done", summary: "Finished" } },
    { kind: "future", id: "unknown", text: "New recorded event" } as never,
  ];
  const parts = savedChatMessages(items)[0].content;
  assert.ok(Array.isArray(parts));
  assert.deepEqual(parts.map((p) => p.type === "text" ? p.text : p.type), [
    "Tool activity · Read 2 files", "File edit · a.ts · +2 -1", "Command · /model · default · Changed · Failed",
    "Helpers · Helper", "Notice · interrupted · Turn interrupted", "Artifact · Report · https://example.test/report",
    "Work report · Checks · finished · All passed", "Agent message · Helper · Done", "Status · Helper · done · Finished", "Recorded item · future · New recorded event",
  ]);
});

test("prepending an older prompt keeps the loaded prompt and tool IDs", () => {
  const recent: SavedTranscriptItem[] = [{ kind: "user", id: "u", text: "New" }, { kind: "tools", id: "t", verb: "Read", items: [{ id: "call", verb: "Read", target: "a.ts" }] }];
  const messages = savedChatMessages([{ kind: "user", id: "older", text: "Old" }, ...recent]);
  assert.deepEqual(messages.slice(1), savedChatMessages(recent));
  assert.deepEqual(savedChatMessages([]), []);
});
