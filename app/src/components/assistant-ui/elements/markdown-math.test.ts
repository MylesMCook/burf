import assert from "node:assert/strict";
import test from "node:test";
import { remarkDisplayMath } from "./markdown-math.ts";

test("double-dollar math retains display mode while single-dollar math stays inline", () => {
  const inline = { type: "inlineMath", position: { start: { offset: 0 } }, data: { hProperties: { className: ["math-inline"] } } };
  const display = { type: "inlineMath", position: { start: { offset: 4 } }, data: { hProperties: { className: ["math-inline"] } } };
  remarkDisplayMath()({ type: "root", children: [inline, display] }, { value: "$x$ $$y$$" });
  assert.deepEqual(inline.data.hProperties.className, ["math-inline"]);
  assert.deepEqual(display.data.hProperties.className, ["language-math", "math-display"]);
});

test("code and incomplete math keep their original nodes", () => {
  const code = { type: "code", position: { start: { offset: 0 } } };
  const incomplete = { type: "text", position: { start: { offset: 6 } } };
  const tree = { type: "root", children: [code, incomplete] };
  const before = structuredClone(tree);
  remarkDisplayMath()(tree, { value: "$$x$$ $$" });
  assert.deepEqual(tree, before);
});
