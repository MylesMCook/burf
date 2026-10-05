// node --experimental-strip-types --test src/lib/groups.test.ts (pnpm test)
import assert from "node:assert/strict";
import { test } from "node:test";

import { assignTones, hashTone, labelsFor, nameFromKey, TONES } from "./groups.ts";

const keys = Array.from({ length: 40 }, (_, i) => `devl:/home/me/work/shop-${i}`);

test("a worktree's tone is the same every time", () => {
  for (const k of keys) assert.equal(hashTone(k), hashTone(k));
  // Spread over the palette, not piled on one tone.
  assert.ok(new Set(keys.map(hashTone)).size >= TONES.length - 1);
});

test("worktrees on screen never share a tone, or one close to it, while there are enough", () => {
  for (let i = 0; i + 1 < keys.length; i++) {
    const got = assignTones([keys[i], keys[i + 1]]);
    assert.notEqual(got[keys[i]], got[keys[i + 1]]);
    const pair = new Set([got[keys[i]], got[keys[i + 1]]]);
    assert.ok(!(pair.has("violet") && pair.has("magenta")) && !(pair.has("magenta") && pair.has("pink")), [...pair].join("+"));
  }
  const six = assignTones(keys.slice(0, 6));
  assert.equal(new Set(Object.values(six)).size, 6);
  // The first keeps its own: adding a second never recolours the first.
  assert.equal(assignTones([keys[0], keys[1]])[keys[0]], TONES[hashTone(keys[0])]);
});

test("a picked tone wins, and the others move out of its way", () => {
  const own = TONES[hashTone(keys[1])];
  const got = assignTones([keys[0], keys[1]], { [keys[0]]: own });
  assert.equal(got[keys[0]], own);
  assert.notEqual(got[keys[1]], own);
  // Something that is not a tone is ignored.
  assert.equal(assignTones([keys[0]], { [keys[0]]: "plaid" })[keys[0]], TONES[hashTone(keys[0])]);
});

test("labels add the box only when two on screen share a name", () => {
  const got = labelsFor([
    { key: "devl:/w/search-perf", name: "search-perf", box: "devl" },
    { key: "gpu:/w/search-perf", name: "search-perf", box: "gpu" },
    { key: "devl:/w/checkout-fix", name: "checkout-fix", box: "devl" },
  ]);
  assert.deepEqual(got, { "devl:/w/search-perf": "search-perf · devl", "gpu:/w/search-perf": "search-perf · gpu", "devl:/w/checkout-fix": "checkout-fix" });
  assert.equal(nameFromKey("devl:/home/me/work/shop-search-perf"), "shop-search-perf");
});
