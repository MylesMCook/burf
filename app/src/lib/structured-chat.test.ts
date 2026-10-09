import assert from "node:assert/strict";
import test from "node:test";
import { supportsStructuredChat } from "./structured-chat.ts";

test("each structured provider requires its own capability and plain command", () => {
  for (const agent of ["codex", "claude"]) {
    assert.equal(supportsStructuredChat(agent, agent, [`chat.${agent}`]), true);
    assert.equal(supportsStructuredChat(agent, agent), false);
    assert.equal(supportsStructuredChat(agent, agent, [agent === "claude" ? "chat.codex" : "chat.claude"]), false);
    for (const command of [`${agent} --model custom`, `/usr/bin/${agent}`, `${agent} `, ""])
      assert.equal(supportsStructuredChat(agent, command, [`chat.${agent}`]), false);
  }
  assert.equal(supportsStructuredChat("custom", "claude", ["chat.claude"]), false);
  assert.equal(supportsStructuredChat(undefined, "claude", ["chat.claude"]), false);
});
