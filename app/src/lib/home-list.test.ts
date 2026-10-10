import assert from "node:assert/strict";
import { test } from "node:test";

import { homePresence } from "./home-list.ts";

test("an empty list leaves the card, and a row or an offline note keeps it", () => {
  assert.equal(homePresence(true, 0), "loading");
  assert.equal(homePresence(false, 0), "empty");
  assert.equal(homePresence(false, 0, true), "shown");
  assert.equal(homePresence(false, 2), "shown");
  assert.equal(homePresence(true, 2), "shown");
});
