import assert from "node:assert/strict";
import { test } from "node:test";
import { ChatQueue, fileMention, insertFileMention, attachmentPaths } from "./chat-composer.ts";

test("queued messages keep their order and captured choices", () => {
  const queue = new ChatQueue<{ model?: string }>();
  queue.add("first", { model: "alpha" });
  queue.add("second", { model: "beta" });
  assert.equal(queue.take()?.text, "first");
  assert.equal(queue.take(), undefined);
  queue.finish(true);
  assert.deepEqual(queue.take()?.options, { model: "beta" });
  queue.finish(true);
  assert.equal(queue.take(), undefined);
});

test("cancelled messages never send and a failed send is never taken twice", () => {
  const queue = new ChatQueue();
  const cancelled = queue.add("cancel", undefined);
  queue.add("uncertain", undefined);
  queue.add("later", undefined);
  queue.cancel(cancelled.id);
  assert.equal(queue.take()?.text, "uncertain");
  queue.finish(false);
  assert.equal(queue.take(), undefined);
  assert.equal(queue.take(), undefined);
  queue.resume();
  assert.equal(queue.take()?.text, "later");
  queue.finish(true);
  assert.equal(queue.take(), undefined);
});

test("file mentions use the caret and insert a path without discarding following text", () => {
  assert.deepEqual(fileMention("Read @src/a then explain", 11), { start: 5, end: 11, query: "src/a" });
  assert.equal(insertFileMention("Read @src/a then explain", 11, "src/app.ts"), "Read src/app.ts then explain");
  assert.equal(insertFileMention("Read @src/old.ts then explain", 10, "src/app.ts"), "Read src/app.ts then explain");
  assert.equal(fileMention("me@example.com", 14), undefined);
  assert.equal(insertFileMention("@", 1, "a $& file.ts"), "a $& file.ts ");
});

test("only uploaded attachment paths enter the prompt", () => {
  const ready = { id: "ready", type: "file", name: "file.txt", content: [{ type: "text" as const, text: "/worktree/file.txt" }] };
  assert.deepEqual(attachmentPaths([
    { ...ready, status: { type: "complete" } },
    { ...ready, id: "uploading", file: {} as File, status: { type: "running", reason: "uploading", progress: 0 } },
    { ...ready, id: "failed", file: {} as File, status: { type: "incomplete", reason: "error" } },
    { ...ready, id: "uploaded", file: {} as File, status: { type: "requires-action", reason: "composer-send" } },
  ]), ["/worktree/file.txt", "/worktree/file.txt"]);
});
