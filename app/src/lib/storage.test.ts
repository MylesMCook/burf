import assert from "node:assert/strict";
import test from "node:test";
import { save, saveChecked, StorageWriteError } from "./storage.ts";

test("checked draft persistence writes its complete snapshot once", () => {
  const writes: [string, string][] = [];
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem: (key: string, value: string) => writes.push([key, value]) } });
  const workspace = { current: "project", shown: ["project"], folded: [], tones: {}, spaces: { project: { tabs: [] } }, recentUrls: ["https://example.test"], localChatDrafts: { source: { pending: { text: "Unsent" } } } };
  saveChecked("berth.workspaces", workspace);
  assert.deepEqual(writes, [["berth.workspaces", JSON.stringify(workspace)]]);
});

test("refused critical persistence throws an actionable error while convenience save stays optional", () => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem: () => { throw new Error("synthetic quota refusal"); } } });
  assert.throws(() => saveChecked("berth.workspaces", { localChatDrafts: {} }), (error) => error instanceof StorageWriteError && /save the chat draft/.test(error.message) && /Keep this window open/.test(error.message));
  assert.doesNotThrow(() => save("berth.ui", { themeId: "berth-dark" }));
});
