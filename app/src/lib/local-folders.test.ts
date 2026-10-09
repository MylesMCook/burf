import assert from "node:assert/strict";
import test from "node:test";

import { folderChoices } from "./local-folders.ts";

test("a unique folder keeps its own name", () => {
  assert.deepEqual(folderChoices(["C:\\Projects\\burf"]), [{ value: "C:\\Projects\\burf", label: "burf", hint: "C:\\Projects\\burf" }]);
});

test("folders that share a name keep a short parent", () => {
  const advisor = "C:\\Users\\me\\Documents\\Codex\\2026-10-07\\claude-advisor-long-paths\\repo";
  const release = "C:\\Users\\me\\Documents\\Codex\\2026-10-07\\live-windows-final\\repo";
  const labels = folderChoices([advisor, release]).map((row) => row.label);
  assert.equal(labels[0]?.endsWith("/repo"), true);
  assert.equal(labels[1]?.endsWith("/repo"), true);
  assert.notEqual(labels[0], labels[1]);
  assert.ok(labels.every((label) => (label?.length ?? 0) < 40));
});
