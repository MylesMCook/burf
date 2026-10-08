import assert from "node:assert/strict";
import test from "node:test";

import { chatArtifacts } from "./chat-artifacts.ts";

const tool = (text: string) => ({ id: "t1", text });

test("a command that added an artifact gives the chat its card", () => {
  const [a, ...rest] = chatArtifacts(tool('berthd artifact add p95.json --title "p95 before and after"\nArtifact d2e8f1a0b3 v1 · chart · p95 before and after\nShown in your chat and on fix\'s board.'));
  assert.deepEqual(rest, []);
  assert.deepEqual(a, { kind: "artifact", id: "t1:d2e8f1a0b3:1", tool: "t1", text: "p95 before and after", local: "d2e8f1a0b3", version: 1, updated: false, done: true });
});

test("a later version is an update, and an unchanged one keeps its title", () => {
  const [a] = chatArtifacts(tool("berthd artifact add p95.json --id d2e8f1a0b3\nArtifact d2e8f1a0b3 v3 · chart · p95 before and after (no change)"));
  assert.equal(a.version, 3);
  assert.equal(a.updated, true);
  assert.equal(a.text, "p95 before and after");
});

test("only the command's own line counts", () => {
  // Prose that mentions one, a malformed id, and a line that merely contains the form.
  assert.deepEqual(chatArtifacts(tool("echo done\nThe Artifact d2e8f1a0b3 v1 · chart · p95 is ready")), []);
  assert.deepEqual(chatArtifacts(tool("cat notes\nArtifact XYZ v1 · chart · p95")), []);
  assert.deepEqual(chatArtifacts(tool("ls")), []);
});

test("one command shows at most four", () => {
  const lines = ["a", "b", "c", "d", "e"].map((x, i) => `Artifact ${String(i).repeat(10)} v1 · table · ${x}`);
  assert.equal(chatArtifacts(tool(["for f in *.csv; do berthd artifact add $f; done", ...lines].join("\n"))).length, 4);
});

test("Burf's own tool answers with the same line (seen from a real Codex turn)", () => {
  const [a] = chatArtifacts(tool("mcpToolCall · berth_artifact_add\nArtifact 7d395167b9 v1 · notes · Search speed-up plan\nShown in your chat and on cal's board. Rewrite plan.md to update it live; berthd artifact add again only to retitle or add --note."));
  assert.equal(a.local, "7d395167b9");
  assert.equal(a.text, "Search speed-up plan");
});
