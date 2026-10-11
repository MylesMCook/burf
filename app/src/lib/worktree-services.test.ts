import assert from "node:assert/strict";
import { test } from "node:test";

import { knownServiceProcess, liveServices } from "./worktree-services.ts";

test("a listener is known by what its command says, never by its port", () => {
  assert.deepEqual(knownServiceProcess("redis-server *:41021"), { name: "Redis", kind: "data" });
  assert.deepEqual(knownServiceProcess("next-server (v15)"), { name: "Next.js", kind: "dev" });
  assert.deepEqual(knownServiceProcess("node --inspect=41024 server.js"), { name: "Node inspector", kind: "other" });
  // Nothing says what these are: whoever asks leaves them openable.
  assert.equal(knownServiceProcess("custom-web-server --port 5432"), undefined);
  assert.equal(knownServiceProcess("node server.js"), undefined);
  assert.equal(knownServiceProcess(undefined), undefined);
});

test("a worktree's list gives a data store its address on the box, never a page", () => {
  const ref = { box: "devl", location: "shop", worktree: "checkout", path: "/w/shop-checkout" };
  const at = (port: number, process?: string) => ({ location: "shop", worktree: "checkout", path: ref.path, port, process });
  // The list still falls back to a usual port when the box reports no command.
  const services = [at(41020, "next-server (v15)"), at(41021, "redis-server *:41021"), at(27017)];
  const rows = liveServices(services, { ref, services }, 41020);
  assert.deepEqual(rows.map((r) => [r.label, r.kind]), [["Dev server", "dev"], ["MongoDB", "data"], ["Redis", "data"]]);
  assert.equal(rows[2].url, "localhost:41021 on devl");
});
