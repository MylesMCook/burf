// node --experimental-strip-types --test src/lib/groups.test.ts (pnpm test)
import assert from "node:assert/strict";
import { test } from "node:test";

import { assignTones, foldedOf, groupsOf, hashTone, labelsFor, nameFromKey, stepGroup, stripTabs, TONES, withGroup, withoutGroup } from "./groups.ts";

const keys = Array.from({ length: 40 }, (_, i) => `devl:/home/me/work/shop-${i}`);

test("a worktree's tone is the same every time", () => {
  for (const k of keys) assert.equal(hashTone(k), hashTone(k));
  // Spread over the palette (all but copper, kept for a crowd), not piled
  // on one tone.
  assert.equal(new Set(keys.map(hashTone)).size, TONES.length - 1);
  assert.ok(!keys.some((k) => TONES[hashTone(k)] === "copper"));
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

const [A, B, C] = ["devl:/a", "devl:/b", "gpu:/c"];

test("the strip always holds the worktree in front", () => {
  assert.deepEqual(groupsOf(undefined, A), [A]);
  assert.deepEqual(groupsOf([A, B], B), [A, B]);
  // Picked on its own (a plain click elsewhere): alone.
  assert.deepEqual(groupsOf([A, B], C), [C]);
  // A worktree that is gone leaves; duplicates are dropped.
  assert.deepEqual(groupsOf([A, B, B, C], A, (k) => k !== C), [A, B]);
  assert.deepEqual(groupsOf([A], undefined), []);
});

test("adding a group puts it last and in front; adding one already there just fronts it", () => {
  assert.deepEqual(withGroup({ shown: [A], current: A }, B), { shown: [A, B], current: B });
  assert.deepEqual(withGroup({ shown: [A, B], current: B }, A), { shown: [A, B], current: A });
  // From one worktree that was never grouped.
  assert.deepEqual(withGroup({ shown: [], current: A }, B), { shown: [A, B], current: B });
  // Dropped between two groups.
  assert.deepEqual(withGroup({ shown: [A, B], current: A }, C, 1), { shown: [A, C, B], current: C });
  assert.deepEqual(withGroup({ shown: [A, B], current: A }, C, 0), { shown: [C, A, B], current: C });
});

test("closing a group fronts its neighbour, and leaves the worktree alone", () => {
  assert.deepEqual(withoutGroup({ shown: [A, B, C], current: B }, B), { shown: [A, C], current: C });
  assert.deepEqual(withoutGroup({ shown: [A, B, C], current: C }, C), { shown: [A, B], current: B });
  assert.deepEqual(withoutGroup({ shown: [A, B, C], current: A }, C), { shown: [A, B], current: A });
  assert.deepEqual(withoutGroup({ shown: [A], current: A }, A), { shown: [], current: undefined });
});

test("group navigation goes round", () => {
  assert.equal(stepGroup({ shown: [A, B, C], current: C }, 1), A);
  assert.equal(stepGroup({ shown: [A, B, C], current: A }, -1), C);
  assert.equal(stepGroup({ shown: [A], current: A }, 1), A);
});

test("folding: by hand, or every other group when narrow; never the one in front", () => {
  assert.deepEqual(foldedOf({ shown: [A, B, C], current: A }, [B, A], false), [B]);
  assert.deepEqual(foldedOf({ shown: [A, B, C], current: B }, [], true), [A, C]);
  assert.deepEqual(foldedOf({ shown: [A], current: A }, [A], true), []);
});

test("⌘1–9 count the tabs of every unfolded group, in order", () => {
  const t = (id: string) => ({ id });
  const got = stripTabs([
    { key: A, tabs: [t("a1"), t("a2")], folded: false },
    { key: B, tabs: [t("b1")], folded: true },
    { key: C, tabs: [t("c1")], folded: false },
  ]);
  assert.deepEqual(got.map((x) => x.tab.id), ["a1", "a2", "c1"]);
  assert.equal(got[2].key, C);
});
