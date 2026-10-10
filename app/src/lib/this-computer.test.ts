import assert from "node:assert/strict";
import { test } from "node:test";

import { thisComputerName, thisComputerTarget } from "./this-computer.ts";

test("a Mac with no native sessions still takes the local box hostname", () => {
  assert.equal(thisComputerName({ supported: false, name: "ignored" }, "myles-macbook-pro"), "myles-macbook-pro");
  assert.equal(thisComputerName(undefined, "myles-macbook-pro"), "myles-macbook-pro");
});

test("native local sessions use their own name", () => {
  assert.equal(thisComputerName({ supported: true, name: "MC-PC" }, "other"), "MC-PC");
});

test("nothing to name stays out of the sidebar", () => {
  assert.equal(thisComputerName({ supported: false, name: "work-hp" }, undefined), undefined);
  assert.equal(thisComputerName(undefined, undefined), undefined);
  assert.equal(thisComputerName({ supported: true, name: "" }, undefined), undefined);
});

test("native messages belong to this computer even when it has a paired local box", () => {
  assert.deepEqual(thisComputerTarget(true, "myles-macbook-pro"), { kind: "local" });
  assert.deepEqual(thisComputerTarget(true, undefined), { kind: "local" });
});

test("an unpaired or still-loading computer opens local messaging without remote setup", () => {
  assert.deepEqual(thisComputerTarget(false, undefined), { kind: "local" });
  assert.deepEqual(thisComputerTarget(undefined, undefined), { kind: "local" });
  assert.deepEqual(thisComputerTarget(undefined, "mini-mac"), { kind: "local" });
});

test("an older unsupported client keeps its existing local-box worktrees", () => {
  assert.deepEqual(thisComputerTarget(false, "mini-mac"), { kind: "worktrees", box: "mini-mac" });
});
