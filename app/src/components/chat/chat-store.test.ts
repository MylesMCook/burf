import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import type { ThreadMessageLike } from "@assistant-ui/react";
import { chatStore } from "./chat-store.ts";

// Exercise the pinned runtime, including its retained branch repository.
const require = createRequire(import.meta.url);
const dependency = createRequire(require.resolve("@assistant-ui/react"));
const { ExternalStoreThreadRuntimeCore } = await import(dependency.resolve("@assistant-ui/core/internal"));
const context = { getModelContext: () => ({}), subscribe: () => () => {} };
const user = (id: string, text: string): ThreadMessageLike => ({ id, role: "user", content: [{ type: "text", text }] });

test("confirming a pending message replaces it without inventing another branch", () => {
  const core = new ExternalStoreThreadRuntimeCore(context, { ...chatStore([user("sending", "Test")]), isRunning: false });
  core.__internal_setAdapter({ ...chatStore([user("provider-user-1", "Test")]), isRunning: true });
  assert.deepEqual(core.getBranches("provider-user-1"), ["provider-user-1"]);
  assert.deepEqual(core.messages.filter((message: { role: string }) => message.role === "user").map((message: { id: string }) => message.id), ["provider-user-1"]);
});

test("replacing a bounded page does not retain removed messages as branches", () => {
  const core = new ExternalStoreThreadRuntimeCore(context, { ...chatStore([user("older", "Old")]), isRunning: false });
  core.__internal_setAdapter({ ...chatStore([user("latest", "Latest")]), isRunning: false });
  assert.deepEqual(core.getBranches("latest"), ["latest"]);
});
