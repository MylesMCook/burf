import assert from "node:assert/strict";
import test from "node:test";
import { statusBarMemory } from "./status-bar-memory.ts";

test("zero memory use stays measured while absent samples stay unavailable", () => {
  assert.deepEqual(statusBarMemory({ used: 0, total: 8 }, true), { used: 0, total: 8 });
  assert.equal(statusBarMemory(undefined, true), undefined);
  assert.equal(statusBarMemory({ total: 8 }, true), undefined);
  assert.equal(statusBarMemory({ used: 8 }, true), undefined);
});

test("offline and invalid memory readings never become current percentages", () => {
  assert.equal(statusBarMemory({ used: 4, total: 8 }, false), undefined);
  for (const memory of [{ used: -1, total: 8 }, { used: 9, total: 8 }, { used: 0, total: 0 }, { used: NaN, total: 8 }, { used: 1, total: Infinity }]) assert.equal(statusBarMemory(memory, true), undefined);
  assert.deepEqual(statusBarMemory({ used: 8, total: 8 }, true), { used: 8, total: 8 });
});
