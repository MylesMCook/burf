import assert from "node:assert/strict";
import test from "node:test";
import { type AppendMessage } from "@assistant-ui/react";
import { createSavedChatQueue } from "./chat-queue.ts";

const message = (text: string, model = "alpha"): AppendMessage => ({ role: "user", content: [{ type: "text", text }], attachments: [], createdAt: new Date(), metadata: { custom: {} }, parentId: null, sourceId: null, runConfig: { custom: { choices: { model } } } });

test("recovered messages stay held until the chat explicitly releases them", () => {
  const sent: string[] = [];
  const queue = createSavedChatQueue((value) => { sent.push(value.content.map((part) => part.type === "text" ? part.text : "").join("")); queue.notifyBusy(); }, [{ text: "Unsent", options: { model: "alpha" } }]);
  queue.notifyIdle();
  assert.deepEqual(sent, []);
  assert.deepEqual(queue.snapshot(), [{ text: "Unsent", options: { model: "alpha" } }]);
  queue.release();
  assert.deepEqual(sent, ["Unsent"]);
  assert.deepEqual(queue.snapshot(), []);
});

test("queue persistence retires before dispatch and keeps each message's own choices", () => {
  const saved: unknown[] = [];
  const queue = createSavedChatQueue(() => { assert.deepEqual(queue.snapshot(), [{ text: "Second", options: { model: "beta" } }]); queue.notifyBusy(); });
  queue.subscribe(() => saved.push(queue.snapshot()));
  queue.adapter.enqueue(message("First"));
  queue.adapter.enqueue(message("Second", "beta"));
  assert.deepEqual(queue.snapshot(), [{ text: "First", options: { model: "alpha" } }, { text: "Second", options: { model: "beta" } }]);
  queue.release();
  assert.deepEqual(saved.at(-1), [{ text: "Second", options: { model: "beta" } }]);
  queue.hold();
  queue.notifyIdle();
  assert.deepEqual(queue.snapshot(), [{ text: "Second", options: { model: "beta" } }]);
});

test("editing and cancelling a queued message update the recoverable state", () => {
  const queue = createSavedChatQueue(() => assert.fail("held work dispatched"));
  queue.adapter.enqueue(message("First"));
  queue.adapter.edit(queue.adapter.items[0].id, message("Edited", "beta"));
  assert.deepEqual(queue.snapshot(), [{ text: "Edited", options: { model: "beta" } }]);
  queue.adapter.remove(queue.adapter.items[0].id);
  assert.deepEqual(queue.snapshot(), []);
});

test("completed attachment paths survive queue recovery without persisting File bytes", () => {
  const queue = createSavedChatQueue(() => assert.fail("held work dispatched"));
  queue.adapter.enqueue({ ...message("Read this"), attachments: [{ id: "file", name: "note.txt", type: "file", contentType: "text/plain", content: [{ type: "text", text: "/w/.berth/attachments/note.txt" }], status: { type: "complete" } }] });
  assert.deepEqual(queue.snapshot(), [{ text: "Read this\n\n/w/.berth/attachments/note.txt", options: { model: "alpha" } }]);
});
