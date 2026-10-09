import assert from "node:assert/strict";
import test from "node:test";

import { SUITES, suitesFor } from "./ci-changes.mjs";

const picked = (...paths) => [...suitesFor(paths)].sort();

test("a change to the page runs its checks and the browser suite, and nothing native", () => {
  assert.deepEqual(picked("app/src/lib/notifications.ts", "app/e2e/notifications.spec.ts"), ["app", "e2e"]);
});

test("a change to Go runs the race suite and the native Windows tests, not the browser suite", () => {
  assert.deepEqual(picked("internal/wire/server.go", "internal/wire/stopped_unix_test.go"), ["go", "windows"]);
  assert.deepEqual(picked("go.mod", "go.sum"), ["go", "windows"]);
});

test("a change to the native shell builds both desktops and leaves the page's suites alone", () => {
  assert.deepEqual(picked("app/src-tauri/src/lib.rs"), ["desktop", "windows"]);
});

test("the page's dependencies reach every build of it", () => {
  assert.deepEqual(picked("app/pnpm-lock.yaml"), ["app", "desktop", "e2e", "windows"]);
});

test("the docs are the docs site's, and writing elsewhere runs nothing", () => {
  assert.deepEqual(picked("docs/guides/phone.mdx"), ["docs"]);
  assert.deepEqual(picked("FORK.md", "UPSTREAM.md", "README.md"), []);
});

test("a script is shellcheck's as well as whoever else names it", () => {
  assert.deepEqual(picked("scripts/upgrade-test.sh"), ["shell"]);
  assert.deepEqual(picked("scripts/build-tmux.sh"), ["shell", "windows"]);
});

test("a mixed change runs the union", () => {
  assert.deepEqual(picked("internal/agent/link.go", "app/e2e/predict.spec.ts", "UPSTREAM.md"), ["app", "e2e", "go", "windows"]);
});

test("CI itself, and a path nothing knows, run everything", () => {
  const all = [...SUITES].sort();
  assert.deepEqual(picked(".github/workflows/ci.yml"), all);
  assert.deepEqual(picked("scripts/ci-changes.mjs"), all);
  assert.deepEqual(picked("some-new-folder/thing.xyz"), all);
  assert.deepEqual(picked("app/src/App.tsx", "some-new-folder/thing.xyz"), all);
});

test("nothing changed runs nothing", () => {
  assert.deepEqual(picked(), []);
});
