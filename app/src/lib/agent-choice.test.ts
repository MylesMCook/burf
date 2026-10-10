import assert from "node:assert/strict";
import test from "node:test";

import { resolveAgentChoice } from "./agent-choice.ts";

test("a remembered agent that is not installed stays missing", () => {
  const chosen = { claude: { models: [""], effort: "" } };
  assert.deepEqual(resolveAgentChoice(chosen, ["codex"]), { sel: {}, missing: "claude" });
});

test("an installed remembered agent is the one that starts", () => {
  const chosen = { claude: { models: ["opus"], effort: "high" } };
  assert.deepEqual(resolveAgentChoice(chosen, ["codex", "claude"]), { sel: chosen });
});

test("with nothing remembered, the first installed agent is the default", () => {
  assert.deepEqual(resolveAgentChoice({}, ["codex", "claude"]), { sel: { codex: { models: [""], effort: "" } } });
  assert.deepEqual(resolveAgentChoice({}, []), { sel: {} });
});
