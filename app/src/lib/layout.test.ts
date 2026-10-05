// node --experimental-strip-types --test src/lib/layout.test.ts (pnpm test)
import assert from "node:assert/strict";
import { test } from "node:test";

import { bounds, leaf, leaves, movePane, type PaneNode, place, remove, sideAt, split, swap } from "./layout.ts";

const term = (s: string) => leaf({ kind: "terminal", box: "b", session: s });
const names = (n: PaneNode) => leaves(n).map((l) => (l.content.kind === "terminal" ? l.content.session : "?"));
const shape = (n: PaneNode): string => (n.kind === "leaf" ? names(n)[0] : `${n.dir}(${shape(n.a)},${shape(n.b)})`);

test("place puts a pane on each side of another", () => {
  const a = term("a");
  assert.equal(shape(place(a, a.id, "right", term("x"))), "row(a,x)");
  assert.equal(shape(place(a, a.id, "left", term("x"))), "row(x,a)");
  assert.equal(shape(place(a, a.id, "top", term("x"))), "col(x,a)");
  assert.equal(shape(place(a, a.id, "bottom", term("x"))), "col(a,x)");
});

test("place takes a whole tab's tree and keeps its leaves' ids", () => {
  const a = term("a");
  const x = term("x");
  const y = term("y");
  const other = split(x, x.id, "col", y);
  const got = place(a, a.id, "right", other);
  assert.equal(shape(got), "row(a,col(x,y))");
  assert.deepEqual(leaves(got).map((l) => l.id), [a.id, x.id, y.id]);
});

test("movePane closes the gap it leaves and keeps the pane's id", () => {
  const a = term("a");
  const b = term("b");
  const c = term("c");
  let t = split(a, a.id, "row", b); // a | b
  t = split(t, b.id, "col", c); // a | (b / c)
  const got = movePane(t, c.id, a.id, "left");
  assert.equal(shape(got), "row(row(c,a),b)");
  assert.ok(leaves(got).some((l) => l.id === c.id));
  // Out of a two-pane split and back in the other way.
  assert.equal(shape(movePane(split(a, a.id, "row", b), a.id, b.id, "bottom")), "col(b,a)");
});

test("movePane leaves the tree alone for itself or an unknown pane", () => {
  const a = term("a");
  const b = term("b");
  const t = split(a, a.id, "row", b);
  assert.equal(movePane(t, a.id, a.id, "left"), t);
  assert.equal(movePane(t, a.id, "nope", "left"), t);
  assert.equal(movePane(a, a.id, a.id, "left"), a);
});

test("swap trades two panes", () => {
  const a = term("a");
  const b = term("b");
  const c = term("c");
  const t = split(split(a, a.id, "row", b), b.id, "col", c);
  assert.equal(shape(swap(t, a.id, c.id)), "row(c,col(b,a))");
  assert.equal(swap(t, a.id, "nope"), t);
});

test("removing the last pane of a side collapses the split", () => {
  const a = term("a");
  const b = term("b");
  const t = split(a, a.id, "row", b);
  assert.equal(remove(t, b.id), a);
});

test("bounds is where moved leaves land", () => {
  const a = term("a");
  const x = term("x");
  const y = term("y");
  const got = place(a, a.id, "right", split(x, x.id, "col", y));
  assert.deepEqual(bounds(got, [x.id, y.id]), { x: 0.5, y: 0, w: 0.5, h: 1 });
  assert.deepEqual(bounds(got, [a.id]), { x: 0, y: 0, w: 0.5, h: 1 });
  assert.equal(bounds(got, ["nope"]), undefined);
});

test("sideAt picks the nearest edge, or the middle when asked", () => {
  assert.equal(sideAt(0.1, 0.5), "left");
  assert.equal(sideAt(0.9, 0.5), "right");
  assert.equal(sideAt(0.5, 0.05), "top");
  assert.equal(sideAt(0.6, 0.95), "bottom");
  assert.equal(sideAt(0.5, 0.5, true), "center");
  assert.notEqual(sideAt(0.5, 0.5), "center");
});
