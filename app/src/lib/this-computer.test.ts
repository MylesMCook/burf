import assert from "node:assert/strict";
import { test } from "node:test";

import { thisComputerName } from "./this-computer.ts";

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
