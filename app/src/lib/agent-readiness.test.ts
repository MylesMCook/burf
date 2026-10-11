import assert from "node:assert/strict";
import test from "node:test";
import type { LocalComputer } from "./local-computer";
import { localAgentReadiness, remoteAgentReadiness } from "./agent-readiness.ts";

const local = (agents: LocalComputer["agents"], supported = true): LocalComputer => ({ supported, name: "Laptop", home: "/synthetic", agents, sessions: [] });

test("this computer reports new chat, terminal and continuation separately", () => {
  assert.deepEqual(localAgentReadiness(local([{ id: "codex", available: true, can_chat: true, can_continue_chat: true }]), "codex"), { installed: true, mode: "chat", canContinueChat: true });
  assert.equal(localAgentReadiness(local([{ id: "claude", available: true, can_terminal: true }]), "claude").mode, "terminal");
  const continuation = localAgentReadiness(local([{ id: "codex", available: true, can_continue_chat: true }]), "codex");
  assert.equal(continuation.mode, "unavailable");
  assert.equal(continuation.canContinueChat, true);
  assert.equal(localAgentReadiness(local([{ id: "codex", available: false, can_chat: true }]), "codex").mode, "unavailable");
  assert.equal(localAgentReadiness(local([{ id: "codex", available: true, can_chat: true }], false), "codex").mode, "unavailable");
  assert.equal(localAgentReadiness(local([]), "cursor").mode, "unknown");
  assert.equal(localAgentReadiness(undefined, "codex").mode, "unknown");
});

test("remote chat requires the installed preset's own plain command and capability", () => {
  for (const id of ["codex", "claude"]) {
    const agent = { id, name: id, command: id };
    assert.equal(remoteAgentReadiness({ agents: [agent], capabilities: [`chat.${id}`] }, id).mode, "chat");
    assert.equal(remoteAgentReadiness({ agents: [agent], capabilities: [] }, id).mode, "terminal");
    assert.equal(remoteAgentReadiness({ agents: [{ ...agent, command: `${id} --model custom` }], capabilities: [`chat.${id}`] }, id).mode, "terminal");
  }
  assert.equal(remoteAgentReadiness({ agents: [{ id: "custom", name: "My Claude", command: "claude" }], capabilities: ["chat.claude"] }, "custom").mode, "terminal");
  assert.equal(remoteAgentReadiness({ agents: [{ id: "cursor", name: "Cursor", command: "cursor" }], capabilities: ["chat.cursor"] }, "cursor").mode, "terminal");
  assert.deepEqual(remoteAgentReadiness({ agents: [], capabilities: ["chat.codex"] }, "codex"), { installed: false, mode: "unavailable" });
  assert.equal(remoteAgentReadiness(undefined, "codex").mode, "unknown");
});
