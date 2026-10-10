import assert from "node:assert/strict";
import test from "node:test";

import { agentEndpointLine, updateUnavailableCopy } from "./about-status.ts";

test("About prints the agent this window is calling, and the live proxy port", () => {
  assert.equal(agentEndpointLine("http://127.0.0.1:17478", 17477), "127.0.0.1:17478 · proxy :17477");
  assert.equal(agentEndpointLine("http://127.0.0.1:17478/"), "127.0.0.1:17478 · proxy :-");
});

test("a desktop window without a feed is not described as a browser", () => {
  const desktop = updateUnavailableCopy(true);
  assert.equal(desktop.label, "Updates come with the Burf app");
  assert.equal(desktop.description, "This build has no update feed.");
  assert.equal(desktop.description.includes("browser"), false);
});

test("a browser tab says it is a browser", () => {
  const browser = updateUnavailableCopy(false);
  assert.match(browser.description, /browser/);
  assert.equal(browser.description.includes("update feed"), false);
});
