import assert from "node:assert/strict";
import { test } from "node:test";

import { greet } from "./greet.js";

test("greets someone by name", () => {
  assert.equal(greet("Ada"), "Hello, Ada!");
});

test("greets the world without a name", () => {
  assert.equal(greet(), "Hello, world!");
  assert.equal(greet("  "), "Hello, world!");
});
